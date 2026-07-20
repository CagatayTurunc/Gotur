using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GetirReplica.API.Models.Entities;
using Microsoft.IdentityModel.Tokens;

namespace GetirReplica.API.Services;

public class TokenService : ITokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config)
    {
        _config = config;
    }

    public string GenerateToken(AppUser user, string role)
    {
        var secret = _config["Jwt:Secret"]
            ?? throw new InvalidOperationException("Jwt:Secret not configured.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiryMinutes = int.Parse(_config["Jwt:ExpiryMinutes"] ?? "60");

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email!),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
