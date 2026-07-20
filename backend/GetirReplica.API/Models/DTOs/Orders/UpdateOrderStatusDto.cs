using System.ComponentModel.DataAnnotations;

namespace GetirReplica.API.Models.DTOs.Orders;

public record UpdateOrderStatusDto(
    [Required] string Status  // assigned | picked | delivered
);
