using GetirReplica.API.Models.Entities;

namespace GetirReplica.API.Services;

public interface ITokenService
{
    string GenerateToken(AppUser user, string role);
}
