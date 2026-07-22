using GetirReplica.API.Data;
using GetirReplica.API.Hubs;
using GetirReplica.API.Models.Enums;
using Hangfire;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Services;

public class MatchingService : IMatchingService
{
    private readonly AppDbContext _db;
    private readonly IHubContext<TrackingHub> _hub;
    private readonly ILogger<MatchingService> _logger;

    private const double MaxRadiusKm = 99999.0; // Geliştirme: mesafe sınırı yok
    private const int MaxRetries = 3;
    private const int RetryDelaySeconds = 60;
    private const int StaleLocationMinutes = 1440; // 24 saat — geliştirme ortamında stale sorununu önler

    public MatchingService(AppDbContext db, IHubContext<TrackingHub> hub, ILogger<MatchingService> logger)
    {
        _db = db;
        _hub = hub;
        _logger = logger;
    }

    public async Task<bool> FindAndAssignCourierAsync(Guid orderId)
    {
        var order = await _db.Orders
            .Include(o => o.Restaurant)
            .FirstOrDefaultAsync(o => o.Id == orderId &&
                (o.Status == OrderStatus.ReadyForPickup || o.Status == OrderStatus.Pending));

        if (order == null)
        {
            _logger.LogWarning("Eşleştirme: Sipariş {OrderId} bulunamadı veya uygun durumda değil.", orderId);
            return false;
        }

        var staleThreshold = DateTime.UtcNow.AddMinutes(-StaleLocationMinutes);

        // Tüm müsait kuryeleri çek, basit Haversine ile yakınlık filtresi uygula
        // Busy ama aktif siparişi olmayan kuryeleri de dahil et (teslim sonrası status güncellenmemişse)
        var busyCourierIds = await _db.Orders
            .Where(o => o.Status == OrderStatus.Assigned || o.Status == OrderStatus.Picked)
            .Select(o => o.CourierId)
            .ToListAsync();

        // Önce konumu güncel olan kuryeleri dene; bulunamazsa konumu olan tüm Available kuryelere genişlet
        var availableCouriers = await _db.Couriers
            .Where(c =>
                c.CurrentLocationLat != null &&
                c.LastLocationAt >= staleThreshold &&
                (c.Status == CourierStatus.Available ||
                 (c.Status == CourierStatus.Busy && !busyCourierIds.Contains(c.Id))))
            .ToListAsync();

        // Fallback: stale threshold dışında kalan ama konumu olan Available kuryeler
        if (availableCouriers.Count == 0)
        {
            _logger.LogWarning(
                "Eşleştirme: Güncel konumlu kurye yok, tüm Available kuryelere genişletiliyor. OrderId={OrderId}",
                orderId);
            availableCouriers = await _db.Couriers
                .Where(c =>
                    c.CurrentLocationLat != null &&
                    (c.Status == CourierStatus.Available ||
                     (c.Status == CourierStatus.Busy && !busyCourierIds.Contains(c.Id))))
                .ToListAsync();
        }

        var restaurantLat = order.Restaurant.LocationLat;
        var restaurantLng = order.Restaurant.LocationLng;

        // Haversine mesafe hesaplama
        var nearest = availableCouriers
            .Select(c => new
            {
                Courier = c,
                Distance = HaversineKm(restaurantLat, restaurantLng,
                    c.CurrentLocationLat!.Value, c.CurrentLocationLng!.Value)
            })
            .Where(x => x.Distance <= MaxRadiusKm)
            .OrderBy(x => x.Distance)
            .FirstOrDefault();

        if (nearest == null)
        {
            var distances = availableCouriers.Select(c => new
            {
                courierId = c.Id,
                distance = HaversineKm(restaurantLat, restaurantLng, c.CurrentLocationLat!.Value, c.CurrentLocationLng!.Value)
            }).ToList();

            _logger.LogWarning(
                "Eşleştirme: {OrderId} için uygun kurye bulunamadı. Restoran: ({Lat},{Lng}). Retry #{Retry}. Kurye mesafeleri: {Distances}",
                orderId, restaurantLat, restaurantLng, order.RetryCount + 1,
                string.Join(", ", distances.Select(d => $"{d.courierId}={d.distance:F1}km")));
            await ScheduleRetryAsync(orderId, order.RetryCount);
            return false;
        }

        var courier = nearest.Courier;

        await using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            order.Status = OrderStatus.Assigned;
            order.CourierId = courier.Id;
            order.AssignedAt = DateTime.UtcNow;
            order.UpdatedAt = DateTime.UtcNow;
            courier.Status = CourierStatus.Busy;

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Eşleştirme transaction hatası: {OrderId}", orderId);
            throw;
        }

        // SignalR bildirimleri
        await _hub.Clients.Group($"courier:{courier.Id}").SendAsync("CourierAssigned", new
        {
            orderId = order.Id,
            courierId = courier.Id,
            restaurantAddress = order.Restaurant.Address,
            deliveryAddress = order.DeliveryAddress,
            timestamp = DateTime.UtcNow
        });

        await _hub.Clients.Group($"order:{order.Id}").SendAsync("CourierAssigned", new
        {
            orderId = order.Id,
            courierId = courier.Id,
            timestamp = DateTime.UtcNow
        });

        _logger.LogInformation("Sipariş {OrderId} → Kurye {CourierId} eşleştirildi. Mesafe: {Km:F1}km",
            orderId, courier.Id, nearest.Distance);
        return true;
    }

    public async Task ScheduleRetryAsync(Guid orderId, int currentRetryCount)
    {
        var order = await _db.Orders.FindAsync(orderId);
        if (order == null) return;

        order.RetryCount = currentRetryCount + 1;
        await _db.SaveChangesAsync();

        if (order.RetryCount >= MaxRetries)
        {
            order.Status = OrderStatus.Failed;
            order.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            await _hub.Clients.Group($"order:{orderId}").SendAsync("OrderStatusChanged", new
            {
                orderId,
                status = "Failed",
                reason = "Yakınında müsait kurye bulunamadı.",
                timestamp = DateTime.UtcNow
            });

            _logger.LogWarning("Sipariş {OrderId} başarısız: maksimum retry aşıldı.", orderId);
            return;
        }

        // Hangfire yerine basit Task.Delay ile retry — DB'ye job yazmak yerine in-memory
        _ = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromSeconds(RetryDelaySeconds));
            await FindAndAssignCourierAsync(orderId);
        });

        _logger.LogInformation("Sipariş {OrderId} için retry #{Retry} zamanlandı.", orderId, order.RetryCount);
    }

    // Haversine formülü — iki koordinat arası km cinsinden mesafe
    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371;
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double ToRad(double deg) => deg * Math.PI / 180;
}
