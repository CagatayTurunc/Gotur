using System.Security.Claims;
using GetirReplica.API.Models.DTOs.Orders;
using GetirReplica.API.Models.Enums;
using GetirReplica.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GetirReplica.API.Controllers;

/// <summary>
/// Sipariş yönetimi endpoint'leri.
/// </summary>
[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly IMatchingService _matchingService;
    private readonly IServiceScopeFactory _scopeFactory;

    public OrdersController(IOrderService orderService, IMatchingService matchingService, IServiceScopeFactory scopeFactory)
    {
        _orderService = orderService;
        _matchingService = matchingService;
        _scopeFactory = scopeFactory;
    }

    /// <summary>
    /// Yeni sipariş oluştur. Eşleştirme servisi arka planda tetiklenir.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "customer")]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto dto)
    {
        var customerId = GetCurrentUserId();
        var order = await _orderService.CreateOrderAsync(dto, customerId);

        // Eşleştirmeyi 3sn içinde tamamlamaya çalış, yoksa arka planda devam et
        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        try
        {
            await _matchingService.FindAndAssignCourierAsync(order.Id);
        }
        catch (OperationCanceledException)
        {
            // Timeout — arka planda devam et
            var orderId = order.Id;
            _ = Task.Run(async () =>
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var svc = scope.ServiceProvider.GetRequiredService<IMatchingService>();
                await svc.FindAndAssignCourierAsync(orderId);
            });
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[Matching] {order.Id}: {ex.Message}");
        }
        finally
        {
            cts.Dispose();
        }

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
    }

    /// <summary>
    /// Sipariş detayını döner.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOrder(Guid id)
    {
        var requesterId = GetCurrentUserId();
        var role = GetCurrentUserRole();
        var order = await _orderService.GetOrderAsync(id, requesterId, role);
        return Ok(order);
    }

    /// <summary>
    /// Müşterinin kendi siparişlerini listeler — sayfalı ve filtrelenebilir.
    /// </summary>
    [HttpGet("my")]
    [Authorize(Roles = "customer")]
    [ProducesResponseType(typeof(PagedResult<OrderResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyOrders([FromQuery] OrderFilterDto filter)
    {
        var customerId = GetCurrentUserId();
        var result = await _orderService.GetCustomerOrdersAsync(customerId, filter);
        return Ok(result);
    }

    /// <summary>
    /// Sipariş listesi — admin ve restoran rolü için, filtreli ve sayfalı.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "admin,restaurant")]
    [ProducesResponseType(typeof(PagedResult<OrderResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOrders([FromQuery] OrderFilterDto filter)
    {
        var requesterId = GetCurrentUserId();
        var role = GetCurrentUserRole();
        var result = await _orderService.GetOrdersAsync(filter, requesterId, role);
        return Ok(result);
    }

    /// <summary>
    /// Müşterinin aktif siparişini döner (varsa).
    /// </summary>
    [HttpGet("active")]
    [Authorize(Roles = "customer")]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> GetActiveOrder()
    {
        var customerId = GetCurrentUserId();
        var order = await _orderService.GetActiveOrderAsync(customerId);
        if (order is null) return NoContent();
        return Ok(order);
    }

    /// <summary>
    /// Müşteri kendi siparişini iptal eder (sadece Pending durumunda).
    /// </summary>
    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "customer")]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CancelOrder(Guid id)
    {
        var customerId = GetCurrentUserId();
        var order = await _orderService.CancelOrderAsync(id, customerId);
        return Ok(order);
    }

    /// <summary>
    /// Sipariş durumunu güncelle. Geçersiz geçişler reddedilir.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "courier,admin,restaurant")]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateOrderStatusDto dto)
    {
        if (!Enum.TryParse<OrderStatus>(dto.Status, ignoreCase: true, out var newStatus))
            return UnprocessableEntity(new { message = $"Geçersiz durum: {dto.Status}" });

        var requesterId = GetCurrentUserId();
        var role = GetCurrentUserRole();
        var order = await _orderService.UpdateStatusAsync(id, newStatus, requesterId, role);
        return Ok(order);
    }

    /// <summary>
    /// Takip ekranı ilk yüklemesi için kuryenin anlık konumunu döner.
    /// </summary>
    [HttpGet("{id:guid}/tracking")]
    [Authorize(Roles = "customer,admin")]
    [ProducesResponseType(typeof(LocationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> GetTracking(Guid id)
    {
        var location = await _orderService.GetOrderTrackingAsync(id);
        if (location is null) return NoContent();
        return Ok(location);
    }

    // ── Yardımcılar ───────────────────────────────────────────────────────────
    private Guid GetCurrentUserId() =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException());

    private string GetCurrentUserRole() =>
        User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
}
