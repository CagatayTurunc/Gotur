using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace GetirReplica.API.Hubs;

/// <summary>
/// Anlık kurye takibi ve sipariş durum bildirimleri için SignalR hub.
/// Client → Server: JoinOrderGroup, LeaveOrderGroup
/// Server → Client: LocationUpdated, OrderStatusChanged, CourierAssigned, LocationTimeout
/// </summary>
[Authorize]
public class TrackingHub : Hub
{
    /// <summary>
    /// Müşteri veya restoran, belirli siparişin güncellemelerini dinlemek için gruba katılır.
    /// </summary>
    public async Task JoinOrderGroup(string orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"order:{orderId}");
    }

    /// <summary>
    /// Sipariş grubundan ayrıl.
    /// </summary>
    public async Task LeaveOrderGroup(string orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order:{orderId}");
    }
}
