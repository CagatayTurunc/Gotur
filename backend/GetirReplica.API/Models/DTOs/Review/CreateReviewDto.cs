namespace GetirReplica.API.DTOs.Review;

public record CreateReviewDto(
    Guid RestaurantId,
    int Rating,
    string? Comment
);