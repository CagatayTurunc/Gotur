namespace GetirReplica.API.Models.DTOs;

public class CreateCategoryDto
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
}