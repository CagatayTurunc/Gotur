using GetirReplica.API.Models.DTOs.Orders;

namespace GetirReplica.API.Models.DTOs.Couriers;

public record CourierResponseDto(
    Guid Id,
    Guid UserId,
    string FullName,
    string Status,
    LocationDto? CurrentLocation,
    DateTime? LastLocationAt
);
