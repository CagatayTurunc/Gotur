using System.Security.Claims;
using GetirReplica.API.DTOs.Review;
using GetirReplica.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GetirReplica.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviewService;

    public ReviewsController(IReviewService reviewService)
    {
        _reviewService = reviewService;
    }

    [HttpGet("restaurant/{restaurantId:guid}")]
    public async Task<ActionResult<List<ReviewDto>>> GetRestaurantReviews(
        Guid restaurantId)
    {
        var reviews =
            await _reviewService.GetRestaurantReviewsAsync(restaurantId);

        return Ok(reviews);
    }

    /// <summary>
    /// Giriş yapmış kullanıcının bu restorana yorum yapıp yapamayacağını döner.
    /// Kural: teslim edilmiş sipariş gerekli + daha önce yorum yapmamış olmalı.
    /// </summary>
    [Authorize]
    [HttpGet("restaurant/{restaurantId:guid}/can-review")]
    public async Task<IActionResult> CanReview(Guid restaurantId)
    {
        var userId = GetUserId();
        var canReview = await _reviewService.CanReviewAsync(restaurantId, userId);
        return Ok(new { canReview });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> AddReview(
        [FromBody] CreateReviewDto dto)
    {
        var userId = GetUserId();

        await _reviewService.AddReviewAsync(dto, userId);

        return Ok(new
        {
            message = "Yorum başarıyla eklendi."
        });
    }

    [Authorize]
    [HttpPut("{reviewId:guid}")]
    public async Task<IActionResult> UpdateReview(
        Guid reviewId,
        [FromBody] CreateReviewDto dto)
    {
        var userId = GetUserId();

        await _reviewService.UpdateReviewAsync(
            reviewId,
            dto,
            userId);

        return Ok(new
        {
            message = "Yorum başarıyla güncellendi."
        });
    }

    [Authorize]
    [HttpDelete("{reviewId:guid}")]
    public async Task<IActionResult> DeleteReview(
        Guid reviewId)
    {
        var userId = GetUserId();

        await _reviewService.DeleteReviewAsync(
            reviewId,
            userId);

        return Ok(new
        {
            message = "Yorum başarıyla silindi."
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
                "Kullanıcı bilgisi alınamadı.");
        }

        return userId;
    }
}