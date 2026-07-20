using GetirReplica.API.Models.Enums;

namespace GetirReplica.API.Models.Entities;

public class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid RestaurantId { get; set; }
    public Guid? CourierId { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public string DeliveryAddress { get; set; } = string.Empty;

    // PostGIS aktif olduğunda geography(Point,4326) tipine geçirilecek
    public double DeliveryLocationLat { get; set; }
    public double DeliveryLocationLng { get; set; }
    public string ItemsJson { get; set; } = "[]";
    public int RetryCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AssignedAt { get; set; }
    public DateTime? PickedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public AppUser Customer { get; set; } = null!;
    public Restaurant Restaurant { get; set; } = null!;
    public Courier? Courier { get; set; }
    public ICollection<CourierLocationHistory> LocationHistory { get; set; } = new List<CourierLocationHistory>();
}
