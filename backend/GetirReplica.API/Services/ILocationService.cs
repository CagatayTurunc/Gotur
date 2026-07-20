using GetirReplica.API.Models.DTOs.Orders;

namespace GetirReplica.API.Services;

public interface ILocationService
{
    Task UpdateLocationAsync(Guid courierId, double latitude, double longitude);
    Task<LocationDto?> GetCurrentLocationAsync(Guid courierId);
}
