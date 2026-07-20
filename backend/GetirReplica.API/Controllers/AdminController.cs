using GetirReplica.API.Data;
using GetirReplica.API.Models.DTOs.Couriers;
using GetirReplica.API.Models.DTOs.Orders;
using GetirReplica.API.Models.DTOs.Restaurants;
using GetirReplica.API.Models.Entities;
using GetirReplica.API.Models.Enums;
using GetirReplica.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GetirReplica.API.Controllers;

/// <summary>
/// Admin paneli — tüm siparişler ve kurye yönetimi.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public AdminController(IOrderService orderService, AppDbContext db, UserManager<AppUser> userManager)
    {
        _orderService = orderService;
        _db = db;
        _userManager = userManager;
    }

    /// <summary>
    /// Filtreli ve sayfalı sipariş listesi.
    /// </summary>
    [HttpGet("orders")]
    [ProducesResponseType(typeof(PagedResult<OrderResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOrders([FromQuery] OrderFilterDto filter)
    {
        var result = await _orderService.GetOrdersAsync(filter, Guid.Empty, "admin");
        return Ok(result);
    }

    /// <summary>
    /// Tüm kuryelerin durumu ve son konum bilgisi.
    /// </summary>
    [HttpGet("couriers")]
    [ProducesResponseType(typeof(List<CourierResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCouriers()
    {
        var couriers = await _db.Couriers
            .Include(c => c.User)
            .ToListAsync();

        var result = couriers.Select(c => new CourierResponseDto(
            Id: c.Id,
            UserId: c.UserId,
            FullName: c.User.FullName,
            Status: c.Status.ToString(),
            CurrentLocation: c.CurrentLocationLat.HasValue
                ? new LocationDto(c.CurrentLocationLat.Value, c.CurrentLocationLng!.Value)
                : null,
            LastLocationAt: c.LastLocationAt
        )).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Kuryeyi offline veya available olarak işaretle.
    /// </summary>
    [HttpPatch("couriers/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCourierStatus(Guid id, [FromBody] UpdateCourierStatusDto dto)
    {
        var courier = await _db.Couriers.FindAsync(id);
        if (courier is null) return NotFound();

        if (!Enum.TryParse<CourierStatus>(dto.Status, ignoreCase: true, out var newStatus))
            return BadRequest(new { message = $"Geçersiz durum: {dto.Status}. Geçerli: available, offline" });

        courier.Status = newStatus;
        await _db.SaveChangesAsync();

        return Ok(new { courierId = id, status = newStatus.ToString() });
    }

    // ── Restoran Başvuruları ────────────────────────────────────────────────

    /// <summary>Tüm başvuruları listele, duruma göre filtrele.</summary>
    [HttpGet("applications")]
    [ProducesResponseType(typeof(List<ApplicationResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetApplications([FromQuery] string? status)
    {
        var query = _db.RestaurantApplications.AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<ApplicationStatus>(status, ignoreCase: true, out var statusEnum))
            query = query.Where(a => a.Status == statusEnum);

        var list = await query.OrderByDescending(a => a.CreatedAt)
            .Select(a => new ApplicationResponseDto(
                a.Id, a.RestaurantName, a.OwnerName, a.Email, a.Phone,
                a.Address, a.City, a.Category, a.Description, a.TaxNumber,
                a.Status.ToString(), a.AdminNote, a.CreatedAt, a.ReviewedAt))
            .ToListAsync();

        return Ok(list);
    }

    /// <summary>Başvuruyu onayla veya reddet. Onaylanırsa restoran hesabı oluşturulur.</summary>
    [HttpPatch("applications/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReviewApplication(Guid id, [FromBody] ReviewApplicationDto dto)
    {
        var app = await _db.RestaurantApplications.FindAsync(id);
        if (app is null) return NotFound();
        if (app.Status != ApplicationStatus.Pending)
            return BadRequest(new { message = "Bu başvuru zaten incelenmiş." });

        var adminId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        if (dto.Decision.Equals("approve", StringComparison.OrdinalIgnoreCase))
        {
            app.Status = ApplicationStatus.Approved;
            app.ReviewedAt = DateTime.UtcNow;
            app.ReviewedByAdminId = adminId;
            app.AdminNote = dto.Note;

            // Kullanıcı yoksa ya da customer ise → restaurant rolüne yükselt / yeni oluştur
            AppUser? user = app.UserId.HasValue
                ? await _userManager.FindByIdAsync(app.UserId.Value.ToString())
                : await _userManager.FindByEmailAsync(app.Email);

            if (user == null)
            {
                // Otomatik hesap oluştur — başvuruda şifre varsa onu kullan, yoksa geçici şifre
                user = new AppUser
                {
                    Email = app.Email,
                    UserName = app.Email,
                    FullName = app.OwnerName,
                    Role = "restaurant"
                };

                IdentityResult createResult;
                if (!string.IsNullOrEmpty(app.PasswordHash))
                {
                    // Hash'i doğrudan set et — yeni şifre hashlemesine gerek yok
                    createResult = await _userManager.CreateAsync(user);
                    if (createResult.Succeeded)
                    {
                        user.PasswordHash = app.PasswordHash;
                        await _userManager.UpdateAsync(user);
                    }
                }
                else
                {
                    var tempPassword = $"Gotür{Guid.NewGuid().ToString("N")[..8]}!";
                    createResult = await _userManager.CreateAsync(user, tempPassword);
                }

                if (!createResult.Succeeded)
                    return BadRequest(new { message = "Kullanıcı oluşturulamadı.", errors = createResult.Errors.Select(e => e.Description) });

                await _userManager.AddToRoleAsync(user, "restaurant");
            }
            else
            {
                // Mevcut kullanıcının rolünü güncelle
                var currentRoles = await _userManager.GetRolesAsync(user);
                if (!currentRoles.Contains("restaurant"))
                {
                    await _userManager.RemoveFromRolesAsync(user, currentRoles);
                    await _userManager.AddToRoleAsync(user, "restaurant");
                    user.Role = "restaurant";
                    await _userManager.UpdateAsync(user);
                }
            }

            app.UserId = user.Id;

            // Restoran kaydı yoksa oluştur
            var existingRestaurant = await _db.Restaurants.FirstOrDefaultAsync(r => r.UserId == user.Id);
            if (existingRestaurant == null)
            {
                _db.Restaurants.Add(new Restaurant
                {
                    UserId = user.Id,
                    Name = app.RestaurantName,
                    Address = $"{app.Address}, {app.City}",
                    LocationLat = 0,
                    LocationLng = 0,
                });
            }
        }
        else if (dto.Decision.Equals("reject", StringComparison.OrdinalIgnoreCase))
        {
            app.Status = ApplicationStatus.Rejected;
            app.ReviewedAt = DateTime.UtcNow;
            app.ReviewedByAdminId = adminId;
            app.AdminNote = dto.Note;
        }
        else
        {
            return BadRequest(new { message = "Geçersiz karar. 'approve' veya 'reject' olmalıdır." });
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = $"Başvuru {(app.Status == ApplicationStatus.Approved ? "onaylandı" : "reddedildi")}.", status = app.Status.ToString() });
    }
}
