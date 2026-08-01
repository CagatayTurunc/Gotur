using System.Security.Claims;
using System.Text;
using GetirReplica.API.Extensions;
using GetirReplica.API.Models.DTOs.Auth;
using GetirReplica.API.Models.Entities;
using GetirReplica.API.Services;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Controllers;

/// <summary>
/// Kullanıcı kayıt, giriş ve profil işlemleri.
/// </summary>
[ApiController]
[Route("api/auth")]
[EnableRateLimiting(RateLimitingExtensions.AuthPolicy)]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly ITokenService _tokenService;
    private readonly IConfiguration _config;
    private readonly IEmailService _emailService;

    public AuthController(
        UserManager<AppUser> userManager,
        SignInManager<AppUser> signInManager,
        ITokenService tokenService,
        IConfiguration config,
        IEmailService emailService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
        _config = config;
        _emailService = emailService;
    }

    /// <summary>
    /// Yeni kullanıcı kaydı.
    /// </summary>
    /// <response code="200">Kayıt başarılı, JWT döner.</response>
    /// <response code="400">Geçersiz istek veya kayıt hatası.</response>
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterRequestDto dto)
    {
        var validRoles = new[] { "customer", "courier", "admin", "restaurant" };
        if (!validRoles.Contains(dto.Role.ToLower()))
            return BadRequest(new { message = $"Geçersiz rol. Geçerli roller: {string.Join(", ", validRoles)}" });

        var user = new AppUser
        {
            Email = dto.Email,
            UserName = dto.Email,
            FullName = dto.FullName,
            Role = dto.Role.ToLower()
        };

        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        await _userManager.AddToRoleAsync(user, dto.Role.ToLower());

        var token = _tokenService.GenerateToken(user, dto.Role.ToLower());
        var expiryMinutes = 60;

        return Ok(new AuthResponseDto(
            Token: token,
            ExpiresAt: DateTime.UtcNow.AddMinutes(expiryMinutes),
            User: new UserInfoDto(user.Id, user.Email!, user.FullName, user.Role)
        ));
    }

    /// <summary>
    /// Kullanıcı girişi. Başarılı girişte JWT döner.
    /// </summary>
    /// <response code="200">JWT token.</response>
    /// <response code="401">Geçersiz kimlik bilgileri.</response>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null || user.IsDeleted)
            return Unauthorized(new { message = "Email veya şifre hatalı." });

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: false);
        if (!result.Succeeded)
            return Unauthorized(new { message = "Email veya şifre hatalı." });

        var token = _tokenService.GenerateToken(user, user.Role);
        var expiryMinutes = 60;

        return Ok(new AuthResponseDto(
            Token: token,
            ExpiresAt: DateTime.UtcNow.AddMinutes(expiryMinutes),
            User: new UserInfoDto(user.Id, user.Email!, user.FullName, user.Role)
        ));
    }

    /// <summary>
    /// Mevcut kullanıcının şifresini değiştirir.
    /// </summary>
    [HttpPatch("password")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return Unauthorized();

        var result = await _userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { message = result.Errors.First().Description });

        return Ok(new { message = "Şifre başarıyla güncellendi." });
    }

    /// <summary>
    /// Mevcut kullanıcının profil bilgilerini döner.
    /// </summary>
    /// <response code="200">Kullanıcı bilgisi.</response>
    /// <response code="401">Token geçersiz veya eksik.</response>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(UserInfoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null) return Unauthorized();

        return Ok(new UserInfoDto(user.Id, user.Email!, user.FullName, user.Role));
    }

    /// <summary>
    /// Mevcut kullanıcının hesabını soft-delete ile siler.
    /// Kullanıcı verisi fiziksel olarak silinmez; IsDeleted=true ve DeletedAt set edilir.
    /// Silinmiş hesapla giriş yapılamaz.
    /// </summary>
    /// <response code="200">Hesap başarıyla silindi.</response>
    /// <response code="401">Token geçersiz veya eksik.</response>
    [HttpDelete("me")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> DeleteAccount()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Unauthorized();

        // IgnoreQueryFilters: soft-deleted kullanıcıya erişmek için global filtreyi atla
        var user = await _userManager.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));

        if (user is null) return Unauthorized();

        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;

        // E-posta ve kullanıcı adını normalize et — aynı e-postayla yeniden kayıt mümkün olsun
        var stamp = $"deleted_{user.Id}";
        user.Email = $"{stamp}@deleted.invalid";
        user.NormalizedEmail = user.Email.ToUpperInvariant();
        user.UserName = stamp;
        user.NormalizedUserName = stamp.ToUpperInvariant();

        await _userManager.UpdateAsync(user);

        return Ok(new { message = "Hesabınız başarıyla silindi." });
    }

    /// <summary>
    /// Google ID Token ile giriş / kayıt. Token frontend'deki Google OAuth popup'ından alınır.
    /// Kullanıcı yoksa otomatik olarak 'customer' rolüyle kaydedilir.
    /// </summary>
    /// <response code="200">JWT token.</response>
    /// <response code="400">Geçersiz Google token.</response>
    [HttpPost("google")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GoogleLogin([FromBody] SocialLoginDto dto)
    {
        var clientId = _config["Google:ClientId"];
        if (string.IsNullOrEmpty(clientId))
            return BadRequest(new { message = "Google OAuth yapılandırılmamış." });

        GoogleJsonWebSignature.Payload payload;
        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { clientId }
            };
            payload = await GoogleJsonWebSignature.ValidateAsync(dto.IdToken, settings);
        }
        catch
        {
            return BadRequest(new { message = "Geçersiz Google token." });
        }

        // Mevcut kullanıcıyı bul ya da oluştur
        var user = await _userManager.FindByEmailAsync(payload.Email);
        if (user is null)
        {
            user = new AppUser
            {
                Email = payload.Email,
                UserName = payload.Email,
                FullName = payload.Name ?? payload.Email,
                Role = "customer",
                EmailConfirmed = true
            };
            var result = await _userManager.CreateAsync(user);
            if (!result.Succeeded)
                return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

            await _userManager.AddToRoleAsync(user, "customer");
        }
        else if (user.IsDeleted)
        {
            return BadRequest(new { message = "Bu hesap silinmiş." });
        }

        var token = _tokenService.GenerateToken(user, user.Role);
        return Ok(new AuthResponseDto(
            Token: token,
            ExpiresAt: DateTime.UtcNow.AddMinutes(480),
            User: new UserInfoDto(user.Id, user.Email!, user.FullName, user.Role)
        ));
    }

    /// <summary>
    /// Şifremi unuttum — kullanıcının e-posta adresine sıfırlama bağlantısı gönderir.
    /// Kullanıcı bulunamasa bile 200 döner (timing attack koruması).
    /// </summary>
    /// <response code="200">Mail gönderildi (veya kullanıcı bulunamadı — güvenlik gereği aynı yanıt).</response>
    [HttpPost("forgot-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);

        // Kullanıcı yoksa veya silinmişse sessizce 200 döndür — e-posta enumeration önleme
        if (user is null || user.IsDeleted)
            return Ok(new { message = "Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi." });

        // Identity'nin yerleşik token jeneratörü — DataProtection ile imzalanmış, 30 dk geçerli
        var rawToken  = await _userManager.GeneratePasswordResetTokenAsync(user);
        var encoded   = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(rawToken));

        var frontendBase = _config["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var resetLink = $"{frontendBase}/reset-password?email={Uri.EscapeDataString(dto.Email)}&token={encoded}";

        try
        {
            await _emailService.SendPasswordResetEmailAsync(user.Email!, user.FullName, resetLink);
        }
        catch (Exception ex)
        {
            // Mail gönderimi başarısız olsa bile kullanıcıya aynı mesajı ver
            // ama sunucu tarafında logla
            HttpContext.RequestServices
                .GetRequiredService<ILogger<AuthController>>()
                .LogError(ex, "Şifre sıfırlama maili gönderilemedi: {Email} — {ErrorMessage}", dto.Email, ex.Message);

            // Production'da da hatayı döndür ki frontend kullanıcıyı uyarsın
            return StatusCode(500, new { message = $"Mail gönderilemedi: {ex.Message}" });
        }

        return Ok(new { message = "Eğer bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi." });
    }

    /// <summary>
    /// Şifre sıfırlama — e-posta linkindeki token ve yeni şifreyle şifreyi günceller.
    /// </summary>
    /// <response code="200">Şifre güncellendi.</response>
    /// <response code="400">Token geçersiz veya süresi dolmuş.</response>
    [HttpPost("reset-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null || user.IsDeleted)
            return BadRequest(new { message = "Geçersiz istek." });

        string rawToken;
        try
        {
            rawToken = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(dto.Token));
        }
        catch
        {
            return BadRequest(new { message = "Geçersiz token formatı." });
        }

        var result = await _userManager.ResetPasswordAsync(user, rawToken, dto.NewPassword);
        if (!result.Succeeded)
        {
            var firstError = result.Errors.FirstOrDefault();
            return BadRequest(new { message = firstError?.Description ?? "Şifre sıfırlanamadı. Token geçersiz veya süresi dolmuş olabilir." });
        }

        return Ok(new { message = "Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz." });
    }
}
