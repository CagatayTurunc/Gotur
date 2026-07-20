using GetirReplica.API.Models.Enums;

namespace GetirReplica.API.Models.DTOs.Restaurants;

public record SubmitApplicationDto(
    string RestaurantName,
    string OwnerName,
    string Email,
    string Phone,
    string Address,
    string City,
    string Category,
    string? Description,
    string? TaxNumber,
    string? Password   // Giriş yapmadan başvurulduğunda kullanılır
);

public record ApplicationResponseDto(
    Guid Id,
    string RestaurantName,
    string OwnerName,
    string Email,
    string Phone,
    string Address,
    string City,
    string Category,
    string? Description,
    string? TaxNumber,
    string Status,
    string? AdminNote,
    DateTime CreatedAt,
    DateTime? ReviewedAt
);

public record ReviewApplicationDto(
    string Decision,   // "approve" | "reject"
    string? Note
);
