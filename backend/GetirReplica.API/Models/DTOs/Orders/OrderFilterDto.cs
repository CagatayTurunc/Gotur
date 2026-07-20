namespace GetirReplica.API.Models.DTOs.Orders;

public record OrderFilterDto(
    string? Status = null,
    DateTime? From = null,
    DateTime? To = null,
    Guid? CourierId = null,
    int Page = 1,
    int PageSize = 20
);

public record PagedResult<T>(
    List<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);
