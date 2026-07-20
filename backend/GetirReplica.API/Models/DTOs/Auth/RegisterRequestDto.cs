using System.ComponentModel.DataAnnotations;

namespace GetirReplica.API.Models.DTOs.Auth;

public record RegisterRequestDto(
    [Required][EmailAddress] string Email,
    [Required][MinLength(6)] string Password,
    [Required][MaxLength(100)] string FullName,
    [Required] string Role  // customer | courier | admin | restaurant
);
