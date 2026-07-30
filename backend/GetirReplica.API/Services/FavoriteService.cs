using GetirReplica.API.Data;
using GetirReplica.API.Models.DTOs.Favorites;
using GetirReplica.API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Services;

public class FavoriteService : IFavoriteService
{
    private readonly AppDbContext _db;

    public FavoriteService(AppDbContext db)
    {
        _db = db;
    }

    public async Task AddFavoriteAsync(AddFavoriteDto dto, Guid userId)
    {
        var userExists = await _db.Users.AnyAsync(u => u.Id == userId);

        if (!userExists)
            throw new UnauthorizedAccessException(
                "Kullanıcı bulunamadı. Lütfen tekrar giriş yapın.");

        var restaurantExists = await _db.Restaurants
            .AnyAsync(r => r.Id == dto.RestaurantId);

        if (!restaurantExists)
            throw new KeyNotFoundException(
                $"Restoran bulunamadı: {dto.RestaurantId}");

        var alreadyFavorite = await _db.Favorites.AnyAsync(f =>
            f.UserId == userId &&
            f.RestaurantId == dto.RestaurantId);

        if (alreadyFavorite)
            throw new InvalidOperationException(
                "Bu restoran zaten favorilerinizde.");

        var favorite = new Favorite
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            RestaurantId = dto.RestaurantId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Favorites.Add(favorite);
        await _db.SaveChangesAsync();
    }

    public async Task RemoveFavoriteAsync(Guid restaurantId, Guid userId)
    {
        var favorite = await _db.Favorites.FirstOrDefaultAsync(f =>
            f.UserId == userId &&
            f.RestaurantId == restaurantId);

        if (favorite is null)
            throw new KeyNotFoundException(
                "Bu restoran favorilerinizde bulunamadı.");

        _db.Favorites.Remove(favorite);
        await _db.SaveChangesAsync();
    }

    public async Task<bool> IsFavoriteAsync(Guid restaurantId, Guid userId)
    {
        return await _db.Favorites.AnyAsync(f =>
            f.UserId == userId &&
            f.RestaurantId == restaurantId);
    }

    public async Task<List<FavoriteDto>> GetFavoritesAsync(Guid userId)
    {
        return await _db.Favorites
            .AsNoTracking()
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new FavoriteDto(
                f.RestaurantId,
                f.Restaurant.Name,
                f.CreatedAt
            ))
            .ToListAsync();
    }
}