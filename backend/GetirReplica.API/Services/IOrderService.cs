using GetirReplica.API.Models.DTOs.Orders;
using GetirReplica.API.Models.Enums;

namespace GetirReplica.API.Services;

public interface IOrderService
{
    Task<OrderResponseDto> CreateOrderAsync(CreateOrderDto dto, Guid customerId);
    Task<OrderResponseDto> GetOrderAsync(Guid orderId, Guid requesterId, string requesterRole);
    Task<PagedResult<OrderResponseDto>> GetOrdersAsync(OrderFilterDto filter, Guid requesterId, string requesterRole);
    Task<PagedResult<OrderResponseDto>> GetCustomerOrdersAsync(Guid customerId, OrderFilterDto filter);
    Task<OrderResponseDto> UpdateStatusAsync(Guid orderId, OrderStatus newStatus, Guid requesterId, string requesterRole);
    Task<OrderResponseDto> CancelOrderAsync(Guid orderId, Guid customerId);
    Task<OrderResponseDto> CancelOrderByRestaurantAsync(Guid orderId, Guid restaurantUserId);
    Task<LocationDto?> GetOrderTrackingAsync(Guid orderId);
    Task<OrderResponseDto?> GetActiveOrderAsync(Guid customerId);
}
