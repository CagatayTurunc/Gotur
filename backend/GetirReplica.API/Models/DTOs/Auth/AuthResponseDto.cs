namespace GetirReplica.API.Models.DTOs.Auth;

public record AuthResponseDto(
    string Token,
    DateTime ExpiresAt,
    UserInfoDto User
);

public record UserInfoDto(
    Guid Id,
    string Email,
    string FullName,
    string Role
);
