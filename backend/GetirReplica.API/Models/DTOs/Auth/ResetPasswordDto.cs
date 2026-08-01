using System.ComponentModel.DataAnnotations;

namespace GetirReplica.API.Models.DTOs.Auth;

public record ResetPasswordDto(
    [Required, EmailAddress] string Email,
    [Required] string Token,
    [Required, MinLength(6)] string NewPassword
);
