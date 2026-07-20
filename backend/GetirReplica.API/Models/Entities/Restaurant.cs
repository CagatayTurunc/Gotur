namespace GetirReplica.API.Models.Entities;

public class Restaurant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public bool IsOpen { get; set; } = true;

    // PostGIS aktif olduğunda geography(Point,4326) tipine geçirilecek
    public double LocationLat { get; set; }
    public double LocationLng { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public AppUser User { get; set; } = null!;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<MenuItem> MenuItems { get; set; } = new List<MenuItem>();
}
