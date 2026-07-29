using System.Security.Claims;
using GetirReplica.API.Data;
using GetirReplica.API.Models.DTOs.Couriers;
using GetirReplica.API.Models.DTOs.Orders;
using GetirReplica.API.Models.Enums;
using GetirReplica.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace GetirReplica.API.Controllers;

/// <summary>
/// Kurye konum güncelleme, liste ve durum yönetimi.
/// </summary>
[ApiController]
[Route("api/couriers")]
[Authorize]
public class CouriersController : ControllerBase
{
    private readonly ILocationService _locationService;
    private readonly AppDbContext _db;
    private readonly IOrderService _orderService;

    public CouriersController(ILocationService locationService, AppDbContext db, IOrderService orderService)
    {
        _locationService = locationService;
        _db = db;
        _orderService = orderService;
    }

    /// <summary>
    /// Kuryenin anlık GPS konumunu günceller. Rate limit: 3sn.
    /// </summary>
    [HttpPut("location")]
    [Authorize(Roles = "courier")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> UpdateLocation([FromBody] UpdateLocationDto dto)
    {
        var courierId = await GetCurrentCourierIdAsync();
        if (courierId == Guid.Empty)
            return BadRequest(new { message = "Kurye profili bulunamadı." });

        await _locationService.UpdateLocationAsync(courierId, dto.Latitude, dto.Longitude);

        return Ok(new { recorded = true, timestamp = DateTime.UtcNow });
    }

    /// <summary>
    /// Belirli bir kuryenin anlık konumunu döner.
    /// </summary>
    [HttpGet("{id:guid}/location")]
    [ProducesResponseType(typeof(LocationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> GetLocation(Guid id)
    {
        var location = await _locationService.GetCurrentLocationAsync(id);
        if (location is null) return NoContent();
        return Ok(location);
    }

    /// <summary>
    /// Tüm kuryelerin listesi — sadece admin.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(List<CourierResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCouriers()
    {
        var couriers = await _db.Couriers
            .Include(c => c.User)
            .ToListAsync();

        var result = couriers.Select(c => new CourierResponseDto(
            Id: c.Id,
            UserId: c.UserId,
            FullName: c.User.FullName,
            Status: c.Status.ToString(),
            CurrentLocation: c.CurrentLocationLat.HasValue
                ? new LocationDto(c.CurrentLocationLat.Value, c.CurrentLocationLng!.Value)
                : null,
            LastLocationAt: c.LastLocationAt
        )).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Kurye durumunu güncelle (available/offline) — sadece admin.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCourierStatus(Guid id, [FromBody] UpdateCourierStatusDto dto)
    {
        var courier = await _db.Couriers.FindAsync(id);
        if (courier is null) return NotFound();

        if (!Enum.TryParse<CourierStatus>(dto.Status, ignoreCase: true, out var newStatus))
            return BadRequest(new { message = $"Geçersiz durum: {dto.Status}. Geçerli: available, offline" });

        courier.Status = newStatus;
        await _db.SaveChangesAsync();

        return Ok(new { courierId = id, status = newStatus.ToString() });
    }

    /// <summary>
    /// Kuryenin şu an aktif siparişini döner (Assigned veya Picked).
    /// </summary>
    [HttpGet("my-order")]
    [Authorize(Roles = "courier")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> GetMyOrder()
    {
        var courierId = await GetCurrentCourierIdAsync();
        if (courierId == Guid.Empty) return BadRequest();

        var order = await _db.Orders
            .Where(o => o.CourierId == courierId &&
                        (o.Status == OrderStatus.Assigned || o.Status == OrderStatus.Picked))
            .OrderByDescending(o => o.AssignedAt)
            .FirstOrDefaultAsync();

        if (order == null) return NoContent();

        List<Models.DTOs.Orders.OrderItemDto> items;
        try { items = System.Text.Json.JsonSerializer.Deserialize<List<Models.DTOs.Orders.OrderItemDto>>(order.ItemsJson) ?? []; }
        catch { items = []; }

        return Ok(new
        {
            id = order.Id,
            status = order.Status.ToString(),
            customerId = order.CustomerId,
            restaurantId = order.RestaurantId,
            courierId = order.CourierId,
            deliveryAddress = order.DeliveryAddress,
            deliveryLocation = new { latitude = order.DeliveryLocationLat, longitude = order.DeliveryLocationLng },
            items,
            createdAt = order.CreatedAt,
            assignedAt = order.AssignedAt,
            pickedAt = order.PickedAt,
            deliveredAt = order.DeliveredAt
        });
    }

    /// <summary>
    /// Kurye kendi aktif siparişinin durumunu günceller (Assigned→Picked, Picked→Delivered).
    /// </summary>
    [HttpPatch("my-order/status")]
    [Authorize(Roles = "courier")]
    public async Task<IActionResult> UpdateMyOrderStatus([FromBody] UpdateCourierStatusDto dto)
    {
        var courierId = await GetCurrentCourierIdAsync();
        if (courierId == Guid.Empty) return BadRequest();

        var order = await _db.Orders
            .Include(o => o.Courier)
            .Where(o => o.CourierId == courierId &&
                        (o.Status == OrderStatus.Assigned || o.Status == OrderStatus.Picked))
            .FirstOrDefaultAsync();

        if (order == null) return NotFound(new { message = "Aktif sipariş bulunamadı." });

        if (!Enum.TryParse<OrderStatus>(dto.Status, ignoreCase: true, out var newStatus))
            return BadRequest(new { message = $"Geçersiz durum: {dto.Status}" });

        var updated = await _orderService.UpdateStatusAsync(order.Id, newStatus, Guid.Empty, "admin");
        return Ok(updated);
    }

    private async Task<Guid> GetCurrentCourierIdAsync()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException());

        var courier = await _db.Couriers.FirstOrDefaultAsync(c => c.UserId == userId);
        return courier?.Id ?? Guid.Empty;
    }

    [HttpGet("available-orders")]
    [Authorize(Roles = "courier")]
    public async Task<IActionResult> GetAvailableOrders()
    {
        var orders = await _db.Orders
            .Include(o => o.Restaurant)
            .Where(o => o.Status == OrderStatus.ReadyForPickup)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        return Ok(orders.Select(o => new
        {
            id = o.Id,
            restaurantName = o.Restaurant?.Name ?? "Bilinmiyor",
            deliveryAddress = o.DeliveryAddress,
            createdAt = o.CreatedAt,
            status = o.Status.ToString(),
            restaurantLocationLat = o.Restaurant?.LocationLat,
            restaurantLocationLng = o.Restaurant?.LocationLng
        }));
    }

    [HttpPost("orders/{orderId:guid}/accept")]
    [Authorize(Roles = "courier")]
    public async Task<IActionResult> AcceptOrder(Guid orderId)
    {
        var courierId = await GetCurrentCourierIdAsync();
        if (courierId == Guid.Empty) return BadRequest(new { message = "Kurye profili bulunamadı." });

        var courier = await _db.Couriers.FindAsync(courierId);
        if (courier?.Status == CourierStatus.Busy)
            return BadRequest(new { message = "Zaten aktif bir siparişiniz var." });

        var order = await _db.Orders.FindAsync(orderId);
        if (order == null) return NotFound(new { message = "Sipariş bulunamadı." });

        if (order.Status != OrderStatus.ReadyForPickup)
            return BadRequest(new { message = "Bu sipariş henüz hazırlanmamış veya başka bir kurye tarafından üstlenilmiş." });

        order.Status = OrderStatus.Assigned;
        order.CourierId = courierId;
        order.AssignedAt = DateTime.UtcNow;

        if (courier != null) courier.Status = CourierStatus.Busy;

        await _db.SaveChangesAsync();

        return Ok(new { message = "Siparişi teslim aldınız.", orderId });
    }

    [HttpGet("history")]
    [Authorize(Roles = "courier")]
    public async Task<IActionResult> GetCourierHistory()
    {
        var courierId = await GetCurrentCourierIdAsync();
        if (courierId == Guid.Empty) return BadRequest();

        var history = await _db.Orders
            .Include(o => o.Restaurant)
            .Where(o => o.CourierId == courierId && o.Status == OrderStatus.Delivered)
            .OrderByDescending(o => o.DeliveredAt)
            .Select(o => new
            {
                id = o.Id,
                restaurantName = o.Restaurant.Name,
                deliveryAddress = o.DeliveryAddress,
                deliveredAt = o.DeliveredAt
            })
            .ToListAsync();

        return Ok(history);
    }
}
