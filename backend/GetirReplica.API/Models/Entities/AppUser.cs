using Microsoft.AspNetCore.Identity;

namespace GetirReplica.API.Models.Entities;

public class AppUser : IdentityUser<Guid>
{
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty; // customer | courier | admin | restaurant
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Soft delete
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; } = null;
}
