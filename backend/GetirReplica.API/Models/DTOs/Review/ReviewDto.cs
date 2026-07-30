namespace GetirReplica.API.DTOs.Review;

public record ReviewDto(
    Guid Id,
    Guid UserId,
    string UserName,
    int Rating,
    string? Comment,
    DateTime CreatedAt
);