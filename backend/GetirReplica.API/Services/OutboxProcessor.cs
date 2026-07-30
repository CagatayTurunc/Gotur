using System.Text.Json;
using GetirReplica.API.Data;
using GetirReplica.API.Hubs;
using GetirReplica.API.Models.Entities;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Services;

/// <summary>
/// Outbox Pattern işleyicisi — Hangfire tarafından periyodik olarak çalıştırılır.
///
/// Akış:
///   1. OutboxEvents tablosundan işlenmemiş (ProcessedAt IS NULL) event'leri çeker.
///   2. Her event için SignalR grubuna mesaj gönderir.
///   3. Başarılıysa ProcessedAt damgası basar.
///   4. Hata alırsa RetryCount artırır, MaxRetryCount'ta artık denemeyi bırakır (dead letter).
///
/// Bu sayede:
///   - DB yazma başarılı ama uygulama restart olduysa → event kaybolmaz
///   - SignalR geçici hata aldıysa → retry ile tekrar denenir
///   - "En az bir kez teslim" garantisi sağlanır
/// </summary>
public class OutboxProcessor
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OutboxProcessor> _logger;

    // Tek seferde işlenecek maksimum event sayısı (backpressure)
    private const int BatchSize = 50;

    public OutboxProcessor(IServiceScopeFactory scopeFactory, ILogger<OutboxProcessor> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    /// <summary>
    /// Hangfire tarafından her 5 saniyede bir çağrılır.
    /// </summary>
    public async Task ProcessPendingEventsAsync()
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hub = scope.ServiceProvider.GetRequiredService<IHubContext<TrackingHub>>();

        // İşlenmemiş ve retry limiti aşılmamış event'leri al
        var pendingEvents = await db.OutboxEvents
            .Where(e => e.ProcessedAt == null && e.RetryCount < OutboxEvent.MaxRetryCount)
            .OrderBy(e => e.CreatedAt)
            .Take(BatchSize)
            .ToListAsync();

        if (pendingEvents.Count == 0) return;

        _logger.LogInformation("Outbox: {Count} işlenmemiş event işleniyor.", pendingEvents.Count);

        foreach (var outboxEvent in pendingEvents)
        {
            try
            {
                // JSON payload'ı deserialize et
                var payload = JsonSerializer.Deserialize<object>(outboxEvent.Payload);

                // SignalR grubuna gönder
                await hub.Clients
                    .Group(outboxEvent.TargetGroup)
                    .SendAsync(outboxEvent.EventType, payload);

                outboxEvent.ProcessedAt = DateTime.UtcNow;
                _logger.LogDebug(
                    "Outbox event gönderildi: {EventType} → {Group}",
                    outboxEvent.EventType, outboxEvent.TargetGroup);
            }
            catch (Exception ex)
            {
                outboxEvent.RetryCount++;
                outboxEvent.LastError = ex.Message;

                if (outboxEvent.RetryCount >= OutboxEvent.MaxRetryCount)
                {
                    _logger.LogError(ex,
                        "Outbox event maksimum retry'a ulaştı (dead letter): Id={Id}, Type={Type}",
                        outboxEvent.Id, outboxEvent.EventType);
                }
                else
                {
                    _logger.LogWarning(ex,
                        "Outbox event gönderilemedi (retry {Retry}/{Max}): Id={Id}",
                        outboxEvent.RetryCount, OutboxEvent.MaxRetryCount, outboxEvent.Id);
                }
            }
        }

        await db.SaveChangesAsync();
    }
}
