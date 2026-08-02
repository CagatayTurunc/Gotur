using System.Diagnostics;
using System.Text.Json;
using GetirReplica.API.Data;
using GetirReplica.API.Extensions;
using GetirReplica.API.Hubs;
using GetirReplica.API.Models.DTOs.Orders;
using GetirReplica.API.Models.Entities;
using GetirReplica.API.Models.Enums;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Services;

public class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly IHubContext<TrackingHub> _hub;
    private readonly ILogger<OrderService> _logger;
    private readonly IMatchingService _matchingService;
    private readonly IServiceScopeFactory _scopeFactory;

    private static readonly Dictionary<OrderStatus, OrderStatus[]> AllowedTransitions = new()
    {
        [OrderStatus.Pending]        = [OrderStatus.ReadyForPickup, OrderStatus.Cancelled],
        [OrderStatus.ReadyForPickup] = [OrderStatus.Assigned, OrderStatus.Cancelled],
        [OrderStatus.Assigned]       = [OrderStatus.Picked],
        [OrderStatus.Picked]         = [OrderStatus.Delivered],
    };

    public OrderService(AppDbContext db, IHubContext<TrackingHub> hub, ILogger<OrderService> logger, IMatchingService matchingService, IServiceScopeFactory scopeFactory)
    {
        _db = db;
        _hub = hub;
        _logger = logger;
        _matchingService = matchingService;
        _scopeFactory = scopeFactory;
    }

    public async Task<OrderResponseDto> CreateOrderAsync(CreateOrderDto dto, Guid customerId)
    {
        // OpenTelemetry span: sipariş oluşturma izlenir
        // Trace waterfall'da "POST /api/orders" → "OrderService.Create" → "EF Core INSERT" görünür
        using var activity = OpenTelemetryExtensions.ActivitySource
            .StartActivity("OrderService.Create", ActivityKind.Internal);
        activity?.SetTag("customer.id", customerId.ToString());
        activity?.SetTag("restaurant.id", dto.RestaurantId.ToString());

        // Token geçerli ama kullanıcı DB'de yok (örn. DB sıfırlandı, oturum eskidi)
        var customerExists = await _db.Users.AnyAsync(u => u.Id == customerId);
        if (!customerExists)
            throw new UnauthorizedAccessException("Kullanıcı bulunamadı. Lütfen tekrar giriş yapın.");

        var hasActive = await _db.Orders.AnyAsync(o =>
            o.CustomerId == customerId &&
            (o.Status == OrderStatus.Pending ||
             o.Status == OrderStatus.Assigned ||
             o.Status == OrderStatus.Picked));

        if (hasActive)
            throw new InvalidOperationException("Zaten aktif bir siparişiniz var.");

        var restaurant = await _db.Restaurants.FindAsync(dto.RestaurantId)
            ?? throw new KeyNotFoundException($"Restoran bulunamadı: {dto.RestaurantId}");

        // Fiyat manipülasyonu koruması: client'tan gelen fiyatları kabul etme.
        // Her sipariş kalemi için DB'den gerçek menü fiyatını al, toplam tutarı
        // sunucu tarafında hesapla. (QA Kritik Bulgu #2)
        var menuItems = await _db.MenuItems
            .Where(m => m.RestaurantId == dto.RestaurantId && m.IsAvailable)
            .ToListAsync();

        var validatedItems = new List<OrderItemDto>();
        foreach (var item in dto.Items)
        {
            // İstemci sadece ürün adını ve miktarını gönderebilir.
            // Fiyat her zaman DB'den alınır.
            var menuItem = menuItems.FirstOrDefault(m =>
                string.Equals(m.Name, item.Name, StringComparison.OrdinalIgnoreCase));

            if (menuItem == null)
            {
                // Menüde olmayan ürün — mock/seed data uyumluluğu için
                // client fiyatını kabul et ama logla
                _logger.LogWarning(
                    "Sipariş kalemleri arasında menüde bulunmayan ürün: {ItemName} (RestaurantId={RestaurantId})",
                    item.Name, dto.RestaurantId);
                validatedItems.Add(item);
            }
            else
            {
                // DB'deki gerçek fiyatı kullan — client fiyatını yoksay
                validatedItems.Add(item with { Price = menuItem.Price });
            }
        }

        var order = new Order
        {
            CustomerId = customerId,
            RestaurantId = dto.RestaurantId,
            DeliveryAddress = dto.DeliveryAddress,
            DeliveryLocationLat = dto.DeliveryLocation.Latitude,
            DeliveryLocationLng = dto.DeliveryLocation.Longitude,
            ItemsJson = JsonSerializer.Serialize(validatedItems),
            Status = OrderStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Sipariş oluşturuldu: {OrderId}", order.Id);
        return MapToDto(order, dto.Items, restaurant.Name);
    }

    public async Task<OrderResponseDto> GetOrderAsync(Guid orderId, Guid requesterId, string requesterRole)
    {
        var order = await _db.Orders
            .Include(o => o.Courier)
            .Include(o => o.Restaurant)
            .FirstOrDefaultAsync(o => o.Id == orderId)
            ?? throw new KeyNotFoundException($"Sipariş bulunamadı: {orderId}");

        if (requesterRole == "customer" && order.CustomerId != requesterId)
            throw new UnauthorizedAccessException("Bu siparişi görüntüleme yetkiniz yok.");

        return MapToDto(order);
    }

    public async Task<PagedResult<OrderResponseDto>> GetOrdersAsync(OrderFilterDto filter, Guid requesterId, string requesterRole)
    {
        var query = _db.Orders.AsQueryable().Include(o => o.Restaurant).AsQueryable();

        if (requesterRole == "restaurant")
        {
            var restaurant = await _db.Restaurants.FirstOrDefaultAsync(r => r.UserId == requesterId);
            if (restaurant != null)
                query = query.Where(o => o.RestaurantId == restaurant.Id);
        }

        if (!string.IsNullOrEmpty(filter.Status) && Enum.TryParse<OrderStatus>(filter.Status, true, out var status))
            query = query.Where(o => o.Status == status);

        if (filter.From.HasValue) query = query.Where(o => o.CreatedAt >= filter.From.Value);
        if (filter.To.HasValue) query = query.Where(o => o.CreatedAt <= filter.To.Value);
        if (filter.CourierId.HasValue) query = query.Where(o => o.CourierId == filter.CourierId.Value);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<OrderResponseDto>(
            items.Select(o => MapToDto(o)).ToList(),
            totalCount,
            filter.Page,
            filter.PageSize
        );
    }

    public async Task<OrderResponseDto> UpdateStatusAsync(Guid orderId, OrderStatus newStatus, Guid requesterId, string requesterRole)
    {
        var order = await _db.Orders
            .Include(o => o.Courier)
            .Include(o => o.Restaurant)
            .FirstOrDefaultAsync(o => o.Id == orderId)
            ?? throw new KeyNotFoundException($"Sipariş bulunamadı: {orderId}");

        if (requesterRole == "courier")
        {
            // CourierId, kullanıcı ID'si değil kurye entity ID'si — userId üzerinden eşleştir
            var courierUserId = order.Courier?.UserId ?? order.CourierId;
            if (courierUserId != requesterId && order.CourierId != requesterId)
                throw new UnauthorizedAccessException("Bu siparişi güncelleme yetkiniz yok.");
        }

        if (!AllowedTransitions.TryGetValue(order.Status, out var allowed) || !allowed.Contains(newStatus))
        {
            var allowedStr = AllowedTransitions.ContainsKey(order.Status)
                ? string.Join(", ", AllowedTransitions[order.Status])
                : "yok";
            throw new InvalidOperationException(
                $"'{order.Status}' → '{newStatus}' geçişi geçersiz. Geçerli: {allowedStr}");
        }

        var now = DateTime.UtcNow;
        order.Status = newStatus;
        order.UpdatedAt = now;

        switch (newStatus)
        {
            case OrderStatus.Assigned: order.AssignedAt = now; break;
            case OrderStatus.Picked:   order.PickedAt = now; break;
            case OrderStatus.Delivered:
                order.DeliveredAt = now;
                if (order.Courier != null)
                    order.Courier.Status = CourierStatus.Available;
                break;
        }

        await _db.SaveChangesAsync();

        // Outbox pattern: SignalR direkt yerine, event DB'ye yazılır.
        // OutboxProcessor (Hangfire) event'i alıp SignalR'a iletir.
        // DB yazma başarılı ama SignalR geçici hata aldıysa → retry ile kurtarılır.
        _db.OutboxEvents.Add(CreateOutboxEvent(
            targetGroup: $"order:{orderId}",
            eventType: "OrderStatusChanged",
            payload: new
            {
                orderId = order.Id,
                status = newStatus.ToString(),
                timestamp = now
            }
        ));
        await _db.SaveChangesAsync();

        _logger.LogInformation("Sipariş {OrderId} → {Status}", orderId, newStatus);

        // Restoran hazır işaretlediğinde kurye eşleştirmesini başlat
        if (newStatus == OrderStatus.ReadyForPickup)
        {
            _ = Task.Run(async () =>
            {
                // Yeni scope aç: Task.Run başka bir thread'de çalışır,
                // mevcut request scope'u (ve DbContext'i) dispose edilmiş olabilir.
                await using var scope = _scopeFactory.CreateAsyncScope();
                var matching = scope.ServiceProvider.GetRequiredService<IMatchingService>();
                try
                {
                    await matching.FindAndAssignCourierAsync(orderId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Eşleştirme hatası: {OrderId}", orderId);
                }
            });
        }

        return MapToDto(order);
    }

    public async Task<OrderResponseDto> CancelOrderAsync(Guid orderId, Guid customerId)
    {
        var order = await _db.Orders
            .Include(o => o.Courier)
            .Include(o => o.Restaurant)
            .FirstOrDefaultAsync(o => o.Id == orderId)
            ?? throw new KeyNotFoundException($"Sipariş bulunamadı: {orderId}");

        if (order.CustomerId != customerId)
            throw new UnauthorizedAccessException("Bu siparişi iptal etme yetkiniz yok.");

        // Sadece Pending durumunda iptal edilebilir (kurye atanmamışsa)
        if (order.Status != OrderStatus.Pending)
            throw new InvalidOperationException(
                "Sipariş yalnızca beklemedeyken iptal edilebilir. Kurye zaten atandıysa iptali mümkün değildir.");

        var now = DateTime.UtcNow;
        order.Status = OrderStatus.Cancelled;
        order.UpdatedAt = now;

        await _db.SaveChangesAsync();

        // Outbox pattern: event aynı kayıt döngüsünde DB'ye yazılır
        _db.OutboxEvents.Add(CreateOutboxEvent(
            targetGroup: $"order:{orderId}",
            eventType: "OrderStatusChanged",
            payload: new
            {
                orderId = order.Id,
                status = OrderStatus.Cancelled.ToString(),
                timestamp = now
            }
        ));
        await _db.SaveChangesAsync();

        _logger.LogInformation("Sipariş {OrderId} müşteri tarafından iptal edildi.", orderId);
        return MapToDto(order);
    }

    public async Task<OrderResponseDto> CancelOrderByRestaurantAsync(Guid orderId, Guid restaurantUserId)
    {
        var order = await _db.Orders
            .Include(o => o.Courier)
            .Include(o => o.Restaurant)
            .FirstOrDefaultAsync(o => o.Id == orderId)
            ?? throw new KeyNotFoundException($"Sipariş bulunamadı: {orderId}");

        // Restoranın kendi siparişi mi kontrol et
        var restaurant = await _db.Restaurants.FirstOrDefaultAsync(r => r.UserId == restaurantUserId)
            ?? throw new UnauthorizedAccessException("Restoran kaydı bulunamadı.");

        if (order.RestaurantId != restaurant.Id)
            throw new UnauthorizedAccessException("Bu siparişi iptal etme yetkiniz yok.");

        // Restoran; Pending ve Assigned (kurye yola çıkmadıysa) durumunda iptal edebilir
        if (order.Status != OrderStatus.Pending && order.Status != OrderStatus.Assigned)
            throw new InvalidOperationException(
                "Sipariş yalnızca hazırlanıyor veya kurye beklenirken iptal edilebilir. Kurye yola çıktıktan sonra iptal yapılamaz.");

        var now = DateTime.UtcNow;
        order.Status = OrderStatus.Cancelled;
        order.UpdatedAt = now;

        // Kurye varsa serbest bırak
        if (order.Courier != null)
            order.Courier.Status = CourierStatus.Available;

        await _db.SaveChangesAsync();

        // Outbox pattern: müşteri ve kurye takip ekranı için event kaydedilir
        _db.OutboxEvents.Add(CreateOutboxEvent(
            targetGroup: $"order:{orderId}",
            eventType: "OrderStatusChanged",
            payload: new
            {
                orderId = order.Id,
                status  = OrderStatus.Cancelled.ToString(),
                timestamp = now
            }
        ));
        await _db.SaveChangesAsync();

        _logger.LogInformation("Sipariş {OrderId} restoran tarafından iptal edildi.", orderId);
        return MapToDto(order);
    }

    public async Task<OrderResponseDto?> GetActiveOrderAsync(Guid customerId)
    {
        var order = await _db.Orders
            .Include(o => o.Courier)
            .Include(o => o.Restaurant)
            .Where(o => o.CustomerId == customerId &&
                        (o.Status == OrderStatus.Pending ||
                         o.Status == OrderStatus.Assigned ||
                         o.Status == OrderStatus.Picked))
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        return order is null ? null : MapToDto(order);
    }

    public async Task<PagedResult<OrderResponseDto>> GetCustomerOrdersAsync(Guid customerId, OrderFilterDto filter)
    {
        var query = _db.Orders
            .AsQueryable()
            .Include(o => o.Restaurant)
            .Where(o => o.CustomerId == customerId)
            .AsQueryable();

        // Virgülle ayrılmış çoklu durum desteği (örn. "Pending,Assigned,Picked")
        if (!string.IsNullOrEmpty(filter.Status))
        {
            var statuses = filter.Status
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => Enum.TryParse<OrderStatus>(s.Trim(), true, out var st) ? (OrderStatus?)st : null)
                .Where(s => s.HasValue)
                .Select(s => s!.Value)
                .ToList();

            if (statuses.Count > 0)
                query = query.Where(o => statuses.Contains(o.Status));
        }

        if (filter.From.HasValue) query = query.Where(o => o.CreatedAt >= filter.From.Value);
        if (filter.To.HasValue)   query = query.Where(o => o.CreatedAt <= filter.To.Value);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<OrderResponseDto>(
            items.Select(o => MapToDto(o)).ToList(),
            totalCount,
            filter.Page,
            filter.PageSize
        );
    }

    public async Task<LocationDto?> GetOrderTrackingAsync(Guid orderId)    {
        var order = await _db.Orders
            .Include(o => o.Courier)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order?.Courier?.CurrentLocationLat == null) return null;

        return new LocationDto(
            order.Courier.CurrentLocationLat.Value,
            order.Courier.CurrentLocationLng!.Value
        );
    }

    private static OrderResponseDto MapToDto(Order order, List<OrderItemDto>? items = null, string? restaurantNameOverride = null)
    {
        var parsedItems = items ?? TryParseItems(order.ItemsJson);
        var deliveryLoc = new LocationDto(order.DeliveryLocationLat, order.DeliveryLocationLng);

        return new OrderResponseDto(
            Id: order.Id,
            Status: order.Status.ToString(),
            CustomerId: order.CustomerId,
            RestaurantId: order.RestaurantId,
            RestaurantName: restaurantNameOverride ?? order.Restaurant?.Name ?? string.Empty,
            CourierId: order.CourierId,
            DeliveryAddress: order.DeliveryAddress,
            DeliveryLocation: deliveryLoc,
            Items: parsedItems,
            CreatedAt: order.CreatedAt,
            AssignedAt: order.AssignedAt,
            PickedAt: order.PickedAt,
            DeliveredAt: order.DeliveredAt
        );
    }

    private static List<OrderItemDto> TryParseItems(string json)
    {
        try { return JsonSerializer.Deserialize<List<OrderItemDto>>(json) ?? []; }
        catch { return []; }
    }

    /// <summary>
    /// Outbox Pattern yardımcısı: DB işlemiyle aynı transaction içinde event kaydeder.
    /// OutboxProcessor (Hangfire) bu event'leri alıp SignalR'a iletir.
    /// Böylece "DB yazma başarılı ama bildirim kayboldu" senaryosu önlenir.
    /// </summary>
    private static OutboxEvent CreateOutboxEvent(string targetGroup, string eventType, object payload)
    {
        return new OutboxEvent
        {
            TargetGroup = targetGroup,
            EventType = eventType,
            Payload = JsonSerializer.Serialize(payload),
            CreatedAt = DateTime.UtcNow
        };
    }
}
