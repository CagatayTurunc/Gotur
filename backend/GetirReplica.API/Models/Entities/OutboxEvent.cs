namespace GetirReplica.API.Models.Entities;

/// <summary>
/// Outbox Pattern için event tablosu.
///
/// Problem çözülen:
///   DB yazma başarılı, ama SignalR bildirimi patlarsa (network, restart)
///   müşteri hiç bildirim alamaz. Tutarsız durum.
///
/// Çözüm:
///   Aynı transaction içinde OutboxEvents tablosuna da yaz.
///   Hangfire arka plan işi bu tabloyu okuyup event'leri gönderir.
///   "En az bir kez teslim" (at-least-once delivery) garantisi sağlar.
///
/// Akış:
///   1. OrderService / MatchingService → DB işlemi + OutboxEvent kaydı (aynı transaction)
///   2. OutboxProcessor (Hangfire) → 5 saniyede bir çalışır
///   3. İşlenmemiş event'leri alır → SignalR'a gönderir → ProcessedAt damgası basar
/// </summary>
public class OutboxEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Event tipi — SignalR metod adıyla eşleşir.
    /// Örn: "OrderStatusChanged", "CourierAssigned", "LocationUpdated"
    /// </summary>
    public string EventType { get; set; } = string.Empty;

    /// <summary>
    /// SignalR group adı (ör: "order:3f2a...", "courier:7b1c...")
    /// </summary>
    public string TargetGroup { get; set; } = string.Empty;

    /// <summary>
    /// Gönderilecek veri — JSON olarak saklanır.
    /// </summary>
    public string Payload { get; set; } = "{}";

    /// <summary>
    /// Event oluşturulma zamanı.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// İşlenme zamanı. Null ise henüz işlenmemiş.
    /// </summary>
    public DateTime? ProcessedAt { get; set; }

    /// <summary>
    /// Hata sayısı — MaxRetryCount'a ulaşırsa Dead Letter'a alınır.
    /// </summary>
    public int RetryCount { get; set; } = 0;

    /// <summary>
    /// Son hata mesajı — debug için.
    /// </summary>
    public string? LastError { get; set; }

    public const int MaxRetryCount = 5;
}
