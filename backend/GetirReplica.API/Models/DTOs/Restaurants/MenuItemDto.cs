namespace GetirReplica.API.Models.DTOs.Restaurants;

public record MenuItemResponseDto(
    Guid Id,
    Guid RestaurantId,
    string Name,
    string? Description,
    decimal Price,
    string? Category,
    string? ImageUrl,
    bool IsAvailable,
    int SortOrder,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateMenuItemDto(
    string Name,
    string? Description,
    decimal Price,
    string? Category,
    string? ImageUrl,
    bool IsAvailable = true,
    int SortOrder = 0
);

public record UpdateMenuItemDto(
    string? Name,
    string? Description,
    decimal? Price,
    string? Category,
    string? ImageUrl,
    bool? IsAvailable,
    int? SortOrder
);
