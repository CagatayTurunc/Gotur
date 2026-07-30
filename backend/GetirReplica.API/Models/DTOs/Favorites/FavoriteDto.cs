namespace GetirReplica.API.Models.DTOs.Favorites;

public record FavoriteDto(
    Guid RestaurantId,
    string RestaurantName,
    DateTime CreatedAt
);
