using System.ComponentModel.DataAnnotations;

namespace GetirReplica.API.Models.DTOs.Orders;

public record LocationDto(
    [Range(-90, 90)] double Latitude,
    [Range(-180, 180)] double Longitude
);
