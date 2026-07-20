using System.ComponentModel.DataAnnotations;

namespace GetirReplica.API.Models.DTOs.Couriers;

public record UpdateCourierStatusDto(
    [Required] string Status  // available | offline
);
