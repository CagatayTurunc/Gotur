namespace GetirReplica.API.Models.DTOs.Auth;

public record ChangePasswordDto(
    string CurrentPassword,
    string NewPassword
);
