using System.ComponentModel.DataAnnotations;

namespace GetirReplica.API.Models.DTOs.Auth;

public record ForgotPasswordDto(
    [Required, EmailAddress] string Email
);
