namespace GetirReplica.API.Models.Entities;

public class Category
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<MenuItem> MenuItems { get; set; }
        = new List<MenuItem>();
}