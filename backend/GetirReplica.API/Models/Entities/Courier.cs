using GetirReplica.API.Models.Enums;

namespace GetirReplica.API.Models.Entities;

public class Courier
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public CourierStatus Status { get; set; } = CourierStatus.Available;

    // PostGIS aktif olduğunda geography(Point,4326) tipine geçirilecek
    public double? CurrentLocationLat { get; set; }
    public double? CurrentLocationLng { get; set; }
    public DateTime? LastLocationAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public decimal TotalEarnings { get; set; } = 0m;

    public AppUser User { get; set; } = null!;
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<CourierLocationHistory> LocationHistory { get; set; } = new List<CourierLocationHistory>();
}
