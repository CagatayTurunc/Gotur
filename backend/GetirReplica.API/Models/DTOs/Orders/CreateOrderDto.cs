using System.ComponentModel.DataAnnotations;

namespace GetirReplica.API.Models.DTOs.Orders;

public record CreateOrderDto(
    [Required] Guid RestaurantId,
    [Required] string DeliveryAddress,
    [Required] LocationDto DeliveryLocation,
    [Required][MinLength(1)] List<OrderItemDto> Items
);
