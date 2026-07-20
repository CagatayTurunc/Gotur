using GetirReplica.API.Models.Enums;

namespace GetirReplica.API.Models.Entities;

public class RestaurantApplication
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Başvuran kullanıcı (zorunlu değil — giriş yapmadan da başvurulabilir)
    public Guid? UserId { get; set; }
    public AppUser? User { get; set; }

    // Başvuru bilgileri
    public string RestaurantName { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? TaxNumber { get; set; }

    // Giriş yapmadan başvuranlarda şifreyi saklayalım (onayda kullanılır)
    public string? PasswordHash { get; set; }

    // Durum
    public ApplicationStatus Status { get; set; } = ApplicationStatus.Pending;
    public string? AdminNote { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedByAdminId { get; set; }
}
