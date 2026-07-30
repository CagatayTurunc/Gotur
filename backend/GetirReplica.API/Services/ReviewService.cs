using Microsoft.EntityFrameworkCore;
using GetirReplica.API.Data;
using GetirReplica.API.DTOs.Review;
using GetirReplica.API.Models.Entities;

namespace GetirReplica.API.Services;

public class ReviewService : IReviewService
{
    private readonly AppDbContext _context;

    public ReviewService(AppDbContext context)
    {
        _context = context;
    }

    public async Task AddReviewAsync(CreateReviewDto dto, Guid userId)
    {
        var restaurantExists = await _context.Restaurants
            .AnyAsync(r => r.Id == dto.RestaurantId);

        if (!restaurantExists)
            throw new KeyNotFoundException("Restoran bulunamadı.");

        var reviewExists = await _context.Reviews
            .AnyAsync(r =>
                r.UserId == userId &&
                r.RestaurantId == dto.RestaurantId);

        if (reviewExists)
            throw new InvalidOperationException(
                "Bu restorana zaten yorum yaptınız.");

        if (dto.Rating < 1 || dto.Rating > 5)
            throw new ArgumentException(
                "Puan 1 ile 5 arasında olmalıdır.");

        var review = new Review
        {
            UserId = userId,
            RestaurantId = dto.RestaurantId,
            Rating = dto.Rating,
            Comment = dto.Comment
        };

        _context.Reviews.Add(review);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateReviewAsync(
        Guid reviewId,
        CreateReviewDto dto,
        Guid userId)
    {
        var review = await _context.Reviews
            .FirstOrDefaultAsync(r =>
                r.Id == reviewId &&
                r.UserId == userId);

        if (review is null)
            throw new KeyNotFoundException(
                "Yorum bulunamadı veya bu yorumu güncelleme yetkiniz yok.");

        if (dto.Rating < 1 || dto.Rating > 5)
            throw new ArgumentException(
                "Puan 1 ile 5 arasında olmalıdır.");

        if (review.RestaurantId != dto.RestaurantId)
            throw new ArgumentException(
                "Yorumun restoranı değiştirilemez.");

        review.Rating = dto.Rating;
        review.Comment = dto.Comment;
        review.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }

    public async Task DeleteReviewAsync(
        Guid reviewId,
        Guid userId)
    {
        var review = await _context.Reviews
            .FirstOrDefaultAsync(r =>
                r.Id == reviewId &&
                r.UserId == userId);

        if (review is null)
            throw new KeyNotFoundException(
                "Yorum bulunamadı veya bu yorumu silme yetkiniz yok.");

        _context.Reviews.Remove(review);
        await _context.SaveChangesAsync();
    }

    public async Task<List<ReviewDto>> GetRestaurantReviewsAsync(
        Guid restaurantId)
    {
        var restaurantExists = await _context.Restaurants
            .AnyAsync(r => r.Id == restaurantId);

        if (!restaurantExists)
            throw new KeyNotFoundException("Restoran bulunamadı.");

        return await _context.Reviews
            .AsNoTracking()
            .Where(r => r.RestaurantId == restaurantId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewDto(
                r.Id,
                r.UserId,
                r.User.FullName,
                r.Rating,
                r.Comment,
                r.CreatedAt
            ))
            .ToListAsync();
    }
}