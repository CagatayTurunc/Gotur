using System.ComponentModel.DataAnnotations;

namespace GetirReplica.API.Models.DTOs.Orders;

public record OrderItemDto(
    [Required] string Name,
    [Range(1, 100)] int Quantity,
    [Range(0.01, 100000)] decimal Price
);
