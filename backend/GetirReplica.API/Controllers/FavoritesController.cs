using System.Security.Claims;
using GetirReplica.API.Models.DTOs.Favorites;
using GetirReplica.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GetirReplica.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FavoritesController : ControllerBase
{
    private readonly IFavoriteService _favoriteService;

    public FavoritesController(IFavoriteService favoriteService)
    {
        _favoriteService = favoriteService;
    }

    [HttpGet]
    public async Task<IActionResult> GetFavorites()
    {
        var userId = GetUserId();

        var favorites = await _favoriteService
            .GetFavoritesAsync(userId);

        return Ok(favorites);
    }

    [HttpPost]
    public async Task<IActionResult> AddFavorite(AddFavoriteDto dto)
    {
        var userId = GetUserId();

        await _favoriteService.AddFavoriteAsync(dto, userId);

        return Ok(new
        {
            message = "Restoran favorilere eklendi."
        });
    }

    [HttpDelete("{restaurantId:guid}")]
    public async Task<IActionResult> RemoveFavorite(Guid restaurantId)
    {
        var userId = GetUserId();

        await _favoriteService.RemoveFavoriteAsync(restaurantId, userId);

        return Ok(new
        {
            message = "Restoran favorilerden çıkarıldı."
        });
    }

    [HttpGet("{restaurantId:guid}/status")]
    public async Task<IActionResult> IsFavorite(Guid restaurantId)
    {
        var userId = GetUserId();

        var isFavorite = await _favoriteService
            .IsFavoriteAsync(restaurantId, userId);

        return Ok(new
        {
            restaurantId,
            isFavorite
        });
    }

    private Guid GetUserId()
    {
        var userIdValue =
            User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userIdValue) ||
            !Guid.TryParse(userIdValue, out var userId))
        {
            throw new UnauthorizedAccessException(
                "Kullanıcı kimliği doğrulanamadı.");
        }

        return userId;
    }
}