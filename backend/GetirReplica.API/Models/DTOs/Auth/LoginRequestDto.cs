using System.ComponentModel.DataAnnotations;

namespace GetirReplica.API.Models.DTOs.Auth;

public record LoginRequestDto(
    [Required][EmailAddress] string Email,
    [Required][MinLength(6)] string Password
);
