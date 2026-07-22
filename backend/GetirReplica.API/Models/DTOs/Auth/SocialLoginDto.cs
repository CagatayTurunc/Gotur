namespace GetirReplica.API.Models.DTOs.Auth;

/// <summary>
/// Google / Facebook OAuth giriş isteği — frontend'den alınan ID token'ı taşır.
/// </summary>
public record SocialLoginDto(string IdToken);
