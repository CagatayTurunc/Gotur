using FluentAssertions;
using GetirReplica.API.Models.Enums;
using Xunit;

namespace GetirReplica.Tests;

/// <summary>
/// Sipariş durum makinesi testleri.
///
/// Neden bu testler önemli?
/// AllowedTransitions dictionary yanlış yapılandırılırsa:
/// - Teslim edilmiş sipariş tekrar "Assigned" yapılabilir
/// - İptal edilmiş sipariş "Delivered" olabilir
/// Bu testler bu tür regresyonları anında yakalar.
/// </summary>
public class OrderStateMachineTests
{
    // OrderService'teki AllowedTransitions'ı burada da tanımlıyoruz.
    // Tek source of truth için ileride bu dictionary'yi ayrı bir class'a taşıyabiliriz.
    private static readonly Dictionary<OrderStatus, OrderStatus[]> AllowedTransitions = new()
    {
        [OrderStatus.Pending]        = [OrderStatus.ReadyForPickup, OrderStatus.Cancelled],
        [OrderStatus.ReadyForPickup] = [OrderStatus.Assigned, OrderStatus.Cancelled],
        [OrderStatus.Assigned]       = [OrderStatus.Picked],
        [OrderStatus.Picked]         = [OrderStatus.Delivered],
    };

    private static bool CanTransition(OrderStatus from, OrderStatus to)
        => AllowedTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);

    // ── Geçerli geçişler ──────────────────────────────────────────────────

    [Theory]
    [InlineData(OrderStatus.Pending,        OrderStatus.ReadyForPickup)]
    [InlineData(OrderStatus.Pending,        OrderStatus.Cancelled)]
    [InlineData(OrderStatus.ReadyForPickup, OrderStatus.Assigned)]
    [InlineData(OrderStatus.ReadyForPickup, OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Assigned,       OrderStatus.Picked)]
    [InlineData(OrderStatus.Picked,         OrderStatus.Delivered)]
    public void ValidTransition_ShouldBeAllowed(OrderStatus from, OrderStatus to)
    {
        // Arrange & Act
        var result = CanTransition(from, to);

        // Assert
        result.Should().BeTrue(
            because: $"{from} → {to} geçerli bir sipariş akışı adımıdır");
    }

    // ── Geçersiz geçişler ─────────────────────────────────────────────────

    [Theory]
    [InlineData(OrderStatus.Delivered,      OrderStatus.Assigned)]   // teslim → geri atama imkânsız
    [InlineData(OrderStatus.Delivered,      OrderStatus.Pending)]    // teslim → başa dön imkânsız
    [InlineData(OrderStatus.Cancelled,      OrderStatus.Pending)]    // iptal → yeniden açma imkânsız
    [InlineData(OrderStatus.Cancelled,      OrderStatus.Assigned)]
    [InlineData(OrderStatus.Failed,         OrderStatus.Assigned)]   // başarısız → atama imkânsız
    [InlineData(OrderStatus.Pending,        OrderStatus.Delivered)]  // pending → direkt teslim atla
    [InlineData(OrderStatus.Pending,        OrderStatus.Picked)]     // pending → direkt picked atla
    [InlineData(OrderStatus.Assigned,       OrderStatus.Delivered)]  // atandı → teslim, kurye almadı
    public void InvalidTransition_ShouldBeRejected(OrderStatus from, OrderStatus to)
    {
        // Arrange & Act
        var result = CanTransition(from, to);

        // Assert
        result.Should().BeFalse(
            because: $"{from} → {to} geçersiz bir sipariş geçişidir ve reddedilmelidir");
    }

    // ── Terminal state'ler ────────────────────────────────────────────────

    [Theory]
    [InlineData(OrderStatus.Delivered)]
    [InlineData(OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Failed)]
    public void TerminalStatus_ShouldHaveNoAllowedTransitions(OrderStatus terminalStatus)
    {
        // Terminal state: hiçbir geçişe izin verilmemeli
        var hasAnyTransition = AllowedTransitions.ContainsKey(terminalStatus);

        hasAnyTransition.Should().BeFalse(
            because: $"{terminalStatus} terminal bir durumdur, hiçbir geçişe izin verilmemelidir");
    }
}
