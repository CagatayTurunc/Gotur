using System.Security.Claims;
using GetirReplica.API.Data;
using GetirReplica.API.Models.DTOs.Restaurants;
using GetirReplica.API.Models.Entities;
using GetirReplica.API.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Controllers;

/// <summary>
/// Restoran ortaklık başvuruları — herkese açık başvuru + admin yönetimi.
/// </summary>
[ApiController]
[Route("api/restaurant-applications")]
public class RestaurantApplicationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public RestaurantApplicationsController(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    /// <summary>
    /// Yeni restoran ortaklık başvurusu gönder. Giriş gerekmez.
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApplicationResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Submit([FromBody] SubmitApplicationDto dto)
    {
        // Aynı email ile bekleyen başvuru var mı?
        var existing = await _db.RestaurantApplications
            .Where(a => a.Email == dto.Email && a.Status == ApplicationStatus.Pending)
            .AnyAsync();
        if (existing)
            return Conflict(new { message = "Bu e-posta adresiyle zaten bekleyen bir başvurunuz var." });

        Guid? userId = null;
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userIdClaim != null) userId = Guid.Parse(userIdClaim);

        // Giriş yapılmadan başvuruluyorsa şifre zorunlu
        if (userId == null && string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { message = "Giriş yapmadan başvuru için şifre belirlemek zorunludur." });

        // Şifreyi geçici olarak hash'le (onayda kullanılacak)
        string? passwordHash = null;
        if (!string.IsNullOrWhiteSpace(dto.Password) && userId == null)
        {
            var tempUser = new AppUser();
            passwordHash = _userManager.PasswordHasher.HashPassword(tempUser, dto.Password);
        }

        var application = new RestaurantApplication
        {
            UserId = userId,
            RestaurantName = dto.RestaurantName,
            OwnerName = dto.OwnerName,
            Email = dto.Email,
            Phone = dto.Phone,
            Address = dto.Address,
            City = dto.City,
            Category = dto.Category,
            Description = dto.Description,
            TaxNumber = dto.TaxNumber,
            PasswordHash = passwordHash,
        };

        _db.RestaurantApplications.Add(application);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = application.Id }, ToDto(application));
    }

    /// <summary>
    /// Başvuru detayını getir (başvuru sahibi veya admin).
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize]
    [ProducesResponseType(typeof(ApplicationResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var app = await _db.RestaurantApplications.FindAsync(id);
        if (app is null) return NotFound();
        return Ok(ToDto(app));
    }

    private static ApplicationResponseDto ToDto(RestaurantApplication a) => new(
        a.Id, a.RestaurantName, a.OwnerName, a.Email, a.Phone,
        a.Address, a.City, a.Category, a.Description, a.TaxNumber,
        a.Status.ToString(), a.AdminNote, a.CreatedAt, a.ReviewedAt
    );
}
