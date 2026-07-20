using System.Security.Claims;
using GetirReplica.API.Data;
using GetirReplica.API.Models.DTOs.Restaurants;
using GetirReplica.API.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Controllers;

/// <summary>
/// Restoran menü ürünleri CRUD — sadece ilgili restoran sahibi yönetebilir.
/// </summary>
[ApiController]
[Route("api/restaurants/{restaurantId:guid}/menu")]
[Authorize(Roles = "restaurant,admin")]
public class MenuItemsController : ControllerBase
{
    private readonly AppDbContext _db;
    public MenuItemsController(AppDbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool IsAdmin => User.IsInRole("admin");

    private async Task<Restaurant?> GetOwnedRestaurant(Guid restaurantId)
    {
        if (IsAdmin)
            return await _db.Restaurants.FindAsync(restaurantId);
        return await _db.Restaurants
            .FirstOrDefaultAsync(r => r.Id == restaurantId && r.UserId == CurrentUserId);
    }

    /// <summary>Restoranın tüm menü ürünlerini listele (herkese açık).</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll(Guid restaurantId)
    {
        var items = await _db.MenuItems
            .Where(m => m.RestaurantId == restaurantId)
            .OrderBy(m => m.SortOrder).ThenBy(m => m.Name)
            .Select(m => ToDto(m))
            .ToListAsync();
        return Ok(items);
    }

    /// <summary>Yeni menü ürünü ekle.</summary>
    [HttpPost]
    public async Task<IActionResult> Create(Guid restaurantId, [FromBody] CreateMenuItemDto dto)
    {
        var restaurant = await GetOwnedRestaurant(restaurantId);
        if (restaurant is null) return NotFound(new { message = "Restoran bulunamadı veya bu restoran size ait değil." });

        var item = new MenuItem
        {
            RestaurantId = restaurantId,
            Name = dto.Name,
            Description = dto.Description,
            Price = dto.Price,
            Category = dto.Category,
            ImageUrl = dto.ImageUrl,
            IsAvailable = dto.IsAvailable,
            SortOrder = dto.SortOrder,
        };

        _db.MenuItems.Add(item);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { restaurantId }, ToDto(item));
    }

    /// <summary>Menü ürününü güncelle.</summary>
    [HttpPatch("{itemId:guid}")]
    public async Task<IActionResult> Update(Guid restaurantId, Guid itemId, [FromBody] UpdateMenuItemDto dto)
    {
        var restaurant = await GetOwnedRestaurant(restaurantId);
        if (restaurant is null) return NotFound(new { message = "Restoran bulunamadı veya bu restoran size ait değil." });

        var item = await _db.MenuItems.FirstOrDefaultAsync(m => m.Id == itemId && m.RestaurantId == restaurantId);
        if (item is null) return NotFound(new { message = "Ürün bulunamadı." });

        if (dto.Name != null) item.Name = dto.Name;
        if (dto.Description != null) item.Description = dto.Description;
        if (dto.Price.HasValue) item.Price = dto.Price.Value;
        if (dto.Category != null) item.Category = dto.Category;
        if (dto.ImageUrl != null) item.ImageUrl = dto.ImageUrl;
        if (dto.IsAvailable.HasValue) item.IsAvailable = dto.IsAvailable.Value;
        if (dto.SortOrder.HasValue) item.SortOrder = dto.SortOrder.Value;
        item.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    /// <summary>Menü ürününü sil.</summary>
    [HttpDelete("{itemId:guid}")]
    public async Task<IActionResult> Delete(Guid restaurantId, Guid itemId)
    {
        var restaurant = await GetOwnedRestaurant(restaurantId);
        if (restaurant is null) return NotFound(new { message = "Restoran bulunamadı veya bu restoran size ait değil." });

        var item = await _db.MenuItems.FirstOrDefaultAsync(m => m.Id == itemId && m.RestaurantId == restaurantId);
        if (item is null) return NotFound(new { message = "Ürün bulunamadı." });

        _db.MenuItems.Remove(item);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Ürün silindi." });
    }

    private static MenuItemResponseDto ToDto(MenuItem m) => new(
        m.Id, m.RestaurantId, m.Name, m.Description, m.Price,
        m.Category, m.ImageUrl, m.IsAvailable, m.SortOrder,
        m.CreatedAt, m.UpdatedAt
    );
}
