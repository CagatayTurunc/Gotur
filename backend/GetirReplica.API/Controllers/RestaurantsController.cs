using GetirReplica.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GetirReplica.API.Controllers;

[ApiController]
[Route("api/restaurants")]
[Authorize]
public class RestaurantsController : ControllerBase
{
    private readonly AppDbContext _db;
    public RestaurantsController(AppDbContext db) => _db = db;

    /// <summary>Tüm restoranları listele.</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var restaurants = await _db.Restaurants
            .Select(r => new {
                r.Id, r.Name, r.Address, r.Description, r.LogoUrl,
                r.IsOpen, r.LocationLat, r.LocationLng
            })
            .ToListAsync();
        return Ok(restaurants);
    }

    /// <summary>Giriş yapmış restoran kullanıcısının kendi restoranını döner.</summary>
    [HttpGet("mine")]
    [Authorize(Roles = "restaurant")]
    public async Task<IActionResult> GetMine()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var restaurant = await _db.Restaurants
            .Select(r => new {
                r.Id, r.Name, r.Address, r.Description, r.LogoUrl,
                r.IsOpen, r.LocationLat, r.LocationLng, r.UserId
            })
            .FirstOrDefaultAsync(r => r.UserId == userId);
        if (restaurant is null)
            return NotFound(new { message = "Restoranınız henüz oluşturulmamış." });
        return Ok(restaurant);
    }

    /// <summary>Kendi restoranını güncelle (ad, adres, açıklama, logo, açık/kapalı).</summary>
    [HttpPatch("mine")]
    [Authorize(Roles = "restaurant")]
    public async Task<IActionResult> UpdateMine([FromBody] UpdateRestaurantDto dto)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var restaurant = await _db.Restaurants.FirstOrDefaultAsync(r => r.UserId == userId);
        if (restaurant is null)
            return NotFound(new { message = "Restoranınız bulunamadı." });

        if (dto.Name        != null) restaurant.Name        = dto.Name;
        if (dto.Address     != null) restaurant.Address     = dto.Address;
        if (dto.Description != null) restaurant.Description = dto.Description;
        if (dto.LogoUrl     != null) restaurant.LogoUrl     = dto.LogoUrl;
        if (dto.IsOpen      != null) restaurant.IsOpen      = dto.IsOpen.Value;

        await _db.SaveChangesAsync();

        return Ok(new {
            restaurant.Id, restaurant.Name, restaurant.Address,
            restaurant.Description, restaurant.LogoUrl, restaurant.IsOpen
        });
    }
}

public record UpdateRestaurantDto(
    string? Name,
    string? Address,
    string? Description,
    string? LogoUrl,
    bool?   IsOpen
);
