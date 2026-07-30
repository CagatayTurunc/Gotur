using GetirReplica.API.DTOs.Review;

namespace GetirReplica.API.Services;

public interface IReviewService
{
    Task AddReviewAsync(CreateReviewDto dto, Guid userId);

    Task UpdateReviewAsync(Guid reviewId, CreateReviewDto dto, Guid userId);

    Task DeleteReviewAsync(Guid reviewId, Guid userId);

    Task<List<ReviewDto>> GetRestaurantReviewsAsync(Guid restaurantId);

    /// <summary>
    /// Kullanıcının bu restorana yorum yapıp yapamayacağını döner.
    /// Kural: teslim edilmiş sipariş gerekli + henüz yorum yapmamış olmalı.
    /// </summary>
    Task<bool> CanReviewAsync(Guid restaurantId, Guid userId);
}