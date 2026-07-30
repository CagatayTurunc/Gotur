using GetirReplica.API.Models.DTOs.Favorites;

namespace GetirReplica.API.Services;

public interface IFavoriteService
{
    Task AddFavoriteAsync(AddFavoriteDto dto, Guid userId);
    Task RemoveFavoriteAsync(Guid restaurantId, Guid userId);
    Task<bool> IsFavoriteAsync(Guid restaurantId, Guid userId);
    Task<List<FavoriteDto>> GetFavoritesAsync(Guid userId);
}