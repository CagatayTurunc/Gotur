using System.ComponentModel.DataAnnotations;

namespace GetirReplica.API.Models.DTOs.Couriers;

public record UpdateLocationDto(
    [Required][Range(-90, 90)] double Latitude,
    [Required][Range(-180, 180)] double Longitude
);
