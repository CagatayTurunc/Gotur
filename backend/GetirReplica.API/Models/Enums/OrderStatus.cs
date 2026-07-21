namespace GetirReplica.API.Models.Enums;

public enum OrderStatus
{
    Pending,
    ReadyForPickup,
    Assigned,
    Picked,
    Delivered,
    Failed,
    Cancelled
}
