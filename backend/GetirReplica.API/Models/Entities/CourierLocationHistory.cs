namespace GetirReplica.API.Models.Entities;

public class CourierLocationHistory
{
    public long Id { get; set; }
    public Guid CourierId { get; set; }
    public Guid? OrderId { get; set; }

    // PostGIS aktif olduğunda geography(Point,4326) tipine geçirilecek
    public double LocationLat { get; set; }
    public double LocationLng { get; set; }
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;

    public Courier Courier { get; set; } = null!;
    public Order? Order { get; set; }
}
