using GetirReplica.API.Data;
using GetirReplica.API.Extensions;
using GetirReplica.API.Hubs;
using GetirReplica.API.Models.DTOs.Orders;
using GetirReplica.API.Models.Entities;
using GetirReplica.API.Models.Enums;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using StackExchange.Redis;
using System.Diagnostics;
using System.Text.Json;

namespace GetirReplica.API.Services;

public class LocationService : ILocationService
{
    private readonly AppDbContext _db;
    private readonly IDistributedCache _cache;
    private readonly IConnectionMultiplexer _redis;
    private readonly IHubContext<TrackingHub> _hub;
    private readonly ILogger<LocationService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;

    private const int RateLimitSeconds = 3;
    private const int MaxHistoryPoints = 100;

    public LocationService(
        AppDbContext db,
        IDistributedCache cache,
        IConnectionMultiplexer redis,
        IHubContext<TrackingHub> hub,
        ILogger<LocationService> logger,
        IServiceScopeFactory scopeFactory)
    {
        _db = db;
        _cache = cache;
        _redis = redis;
        _hub = hub;
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    public async Task UpdateLocationAsync(Guid courierId, double latitude, double longitude)
    {
        // OpenTelemetry span: konum güncellemesi izlenir
        // Trace waterfall: "PUT /api/couriers/location" → "LocationService.Update" → Redis SET → EF INSERT
        using var activity = OpenTelemetryExtensions.ActivitySource
            .StartActivity("LocationService.UpdateLocation", ActivityKind.Internal);
        activity?.SetTag("courier.id", courierId.ToString());
        activity?.SetTag("location.lat", latitude);
        activity?.SetTag("location.lng", longitude);

        // Atomik rate limit: tek Redis komutu (SET NX EX)
        // Neden atomik? GetString → SetString arası race window:
        // İki paralel istek aynı anda "key yok" görüp ikisi de geçebilir.
        // SET key 1 NX EX 3 → tek komut, ya set edilir ya edilmez.
        var rateLimitKey = $"courier:{courierId}:rate";
        var db = _redis.GetDatabase();
        var acquired = await db.StringSetAsync(
            rateLimitKey,
            "1",
            TimeSpan.FromSeconds(RateLimitSeconds),
            When.NotExists);

        if (!acquired)
            throw new InvalidOperationException("Konum güncellemesi çok sık gönderildi. Lütfen 3 saniye bekleyin.");

        var courier = await _db.Couriers
            .Include(c => c.Orders.Where(o => o.Status == OrderStatus.Picked || o.Status == OrderStatus.Assigned))
            .FirstOrDefaultAsync(c => c.Id == courierId)
            ?? throw new KeyNotFoundException($"Kurye bulunamadı: {courierId}");

        var wasStale = courier.LastLocationAt == null ||
                       courier.LastLocationAt < DateTime.UtcNow.AddMinutes(-5);

        courier.CurrentLocationLat = latitude;
        courier.CurrentLocationLng = longitude;
        courier.LastLocationAt = DateTime.UtcNow;

        // Aktif sipariş varsa konum geçmişine ekle (son 100 nokta)
        var activeOrder = courier.Orders.FirstOrDefault();
        if (activeOrder != null)
        {
            var historyCount = await _db.CourierLocationHistory
                .CountAsync(h => h.CourierId == courierId && h.OrderId == activeOrder.Id);

            if (historyCount >= MaxHistoryPoints)
            {
                var oldest = await _db.CourierLocationHistory
                    .Where(h => h.CourierId == courierId && h.OrderId == activeOrder.Id)
                    .OrderBy(h => h.RecordedAt)
                    .FirstOrDefaultAsync();
                if (oldest != null) _db.CourierLocationHistory.Remove(oldest);
            }

            _db.CourierLocationHistory.Add(new CourierLocationHistory
            {
                CourierId = courierId,
                OrderId = activeOrder.Id,
                LocationLat = latitude,
                LocationLng = longitude,
                RecordedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();

        // Redis'e anlık konum yaz (TTL: 30sn)
        var locationJson = JsonSerializer.Serialize(new { latitude, longitude, timestamp = DateTime.UtcNow });
        await _cache.SetStringAsync($"courier:{courierId}:location", locationJson, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30)
        });

        // SignalR: aktif siparişin grubuna konum yayınla
        if (activeOrder != null)
        {
            await _hub.Clients.Group($"order:{activeOrder.Id}").SendAsync("LocationUpdated", new
            {
                courierId,
                latitude,
                longitude,
                timestamp = DateTime.UtcNow
            });
        }

        // Kurye konumu yeni veya bayat durumdan güncel duruma geçtiyse,
        // eşleşme bekleyen Pending siparişleri tekrar dene.
        if (wasStale && courier.Status == CourierStatus.Available && activeOrder == null)
        {
            _ = Task.Run(async () =>
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var pendingOrderIds = await db.Orders
                    .Where(o => (o.Status == OrderStatus.Pending || o.Status == OrderStatus.ReadyForPickup) && o.RetryCount < 3)
                    .Select(o => o.Id)
                    .ToListAsync();

                if (pendingOrderIds.Count > 0)
                {
                    var matching = scope.ServiceProvider.GetRequiredService<IMatchingService>();
                    foreach (var orderId in pendingOrderIds)
                        await matching.FindAndAssignCourierAsync(orderId);
                }
            });
        }

        _logger.LogDebug("Kurye {CourierId} konumu güncellendi: {Lat},{Lng}", courierId, latitude, longitude);
    }

    public async Task<LocationDto?> GetCurrentLocationAsync(Guid courierId)
    {
        // Önce Redis'ten dene
        var cached = await _cache.GetStringAsync($"courier:{courierId}:location");
        if (cached != null)
        {
            var data = JsonSerializer.Deserialize<JsonElement>(cached);
            return new LocationDto(
                data.GetProperty("latitude").GetDouble(),
                data.GetProperty("longitude").GetDouble()
            );
        }

        // Redis'te yoksa DB'den oku
        var courier = await _db.Couriers.FindAsync(courierId);
        if (courier?.CurrentLocationLat == null) return null;

        return new LocationDto(courier.CurrentLocationLat.Value, courier.CurrentLocationLng!.Value);
    }
}
