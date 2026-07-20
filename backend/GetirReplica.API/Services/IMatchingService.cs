namespace GetirReplica.API.Services;

public interface IMatchingService
{
    Task<bool> FindAndAssignCourierAsync(Guid orderId);
    Task ScheduleRetryAsync(Guid orderId, int retryCount);
}
