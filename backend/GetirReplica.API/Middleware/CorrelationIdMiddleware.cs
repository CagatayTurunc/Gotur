namespace GetirReplica.API.Middleware;

/// <summary>
/// Her HTTP isteğine bir Correlation ID atar ve bunu log context'ine ekler.
///
/// Nasıl çalışır?
///   1. İstekte X-Correlation-ID header'ı varsa kullan (client veya gateway'den geliyor).
///   2. Yoksa yeni bir GUID üret.
///   3. Bu ID'yi:
///      - Response header'ına ekle (client hata ayıklaması için)
///      - Serilog LogContext'e ekle (her log satırına otomatik eklenir)
///      - HttpContext.Items'a koy (diğer middleware/servisler okuyabilsin)
///
/// Neden önemli?
///   Bir müşteri "siparişim takılı kaldı" diyince verdiği X-Correlation-ID ile
///   Seq/ELK'te o isteğe ait tüm log satırlarını tek sorguda bulabilirsin.
///   Dağıtık sistemlerde "bu istek hangi servise gitti, nerede patladı?"
///   sorusunun cevabı bu ID'dedir.
/// </summary>
public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;

    public const string CorrelationIdHeader = "X-Correlation-ID";
    public const string CorrelationIdItemKey = "CorrelationId";

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Client'tan gelen ID'yi kabul et, yoksa yeni üret
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault()
            ?? Guid.NewGuid().ToString("N");

        // Diğer katmanların erişebilmesi için Items'a koy
        context.Items[CorrelationIdItemKey] = correlationId;

        // Response header'ına da ekle — client hata ticket açarken bu ID'yi iletebilir
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[CorrelationIdHeader] = correlationId;
            return Task.CompletedTask;
        });

        // Serilog: tüm log satırlarına CorrelationId alanı eklenir
        using (Serilog.Context.LogContext.PushProperty("CorrelationId", correlationId))
        using (Serilog.Context.LogContext.PushProperty("RequestPath", context.Request.Path.Value))
        {
            await _next(context);
        }
    }
}
