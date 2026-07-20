namespace GetirReplica.API.Models.DTOs.Orders;

public record OrderResponseDto(
    Guid Id,
    string Status,
    Guid CustomerId,
    Guid RestaurantId,
    Guid? CourierId,
    string DeliveryAddress,
    LocationDto DeliveryLocation,
    List<OrderItemDto> Items,
    DateTime CreatedAt,
    DateTime? AssignedAt,
    DateTime? PickedAt,
    DateTime? DeliveredAt
);
