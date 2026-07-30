namespace GetirReplica.API.Models.Entities;

public class Favorite
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;

    public Guid RestaurantId { get; set; }
    public Restaurant Restaurant { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}