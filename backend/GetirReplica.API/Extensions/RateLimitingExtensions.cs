using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace GetirReplica.API.Extensions;

/// <summary>
/// ASP.NET Core built-in Rate Limiting konfigürasyonu.
///
/// Neden controller'da değil burada?
///   Rate limiting, uygulama mantığından bağımsız bir cross-cutting concern.
///   API Gateway / Middleware seviyesinde tutmak:
///   - Mikroservise geçişte Gateway'e (YARP/Kong) taşımak kolaylaşır
///   - Her controller'ı değiştirmeden politika değiştirilebilir
///   - İlerleyen aşamada Redis tabanlı distributed rate limiting ile swap edilebilir
///
/// Politikalar:
///   "auth"     — Login/register: IP başına 10 istek/dakika (brute-force koruması)
///   "orders"   — Sipariş oluşturma: kullanıcı başına 5 istek/dakika
///   "api"      — Genel API: IP başına 100 istek/dakika (genel koruma)
///   "location" — Kurye konum güncellemesi: kullanıcı başına 20 istek/dakika
/// </summary>
public static class RateLimitingExtensions
{
    // Policy isimleri — controller attribute'larında referans alınır
    public const string AuthPolicy = "auth";
    public const string OrdersPolicy = "orders";
    public const string GeneralApiPolicy = "api";
    public const string LocationPolicy = "location";

    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            // Limit aşılınca 429 Too Many Requests döner
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

                // Retry-After header: kaç saniye sonra tekrar deneyebilir
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString();
                }

                await context.HttpContext.Response.WriteAsJsonAsync(new
                {
                    status = 429,
                    message = "Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.",
                    retryAfterSeconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var ra)
                        ? (int?)((int)ra.TotalSeconds) : null
                }, cancellationToken);
            };

            // ── Auth: Brute-force koruması ────────────────────────────────────
            // Login/register endpoint'leri: IP başına 10 istek/dakika, sliding window
            // Sliding window: token bucket'tan daha adil — sabit window sıfırlanma açığını kapatır
            // CI/test ortamlarında RATE_LIMIT_AUTH_PERMITS env değişkeni ile override edilebilir
            var authPermitLimit = int.TryParse(
                Environment.GetEnvironmentVariable("RATE_LIMIT_AUTH_PERMITS"), out var parsed)
                ? parsed : 10;

            options.AddPolicy(AuthPolicy, httpContext =>
                RateLimitPartition.GetSlidingWindowLimiter(
                    partitionKey: GetClientIp(httpContext),
                    factory: _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = authPermitLimit,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 4, // 15 saniyelik segmentler
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit = 0 // Bekleme yok, direkt reddet
                    }));

            // ── Orders: Sipariş oluşturma limiti ─────────────────────────────
            // Authenticated user ID veya IP bazlı: 5 sipariş/dakika
            options.AddPolicy(OrdersPolicy, httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: GetUserId(httpContext) ?? GetClientIp(httpContext),
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 5,
                        Window = TimeSpan.FromMinutes(1),
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit = 0
                    }));

            // ── Location: Kurye konum güncellemesi ────────────────────────────
            // Zaten LocationService'te 3sn rate limit var, bu ikinci katman koruma
            // kullanıcı başına 20 istek/dakika
            options.AddPolicy(LocationPolicy, httpContext =>
                RateLimitPartition.GetSlidingWindowLimiter(
                    partitionKey: GetUserId(httpContext) ?? GetClientIp(httpContext),
                    factory: _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 20,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit = 2
                    }));

            // ── Genel API: DDoS temel koruması ───────────────────────────────
            // Tüm endpoint'ler: IP başına 100 istek/dakika
            options.AddPolicy(GeneralApiPolicy, httpContext =>
                RateLimitPartition.GetSlidingWindowLimiter(
                    partitionKey: GetClientIp(httpContext),
                    factory: _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 100,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit = 0
                    }));
        });

        return services;
    }

    // Gerçek client IP — proxy/load balancer arkasında X-Forwarded-For'u dikkate al
    private static string GetClientIp(HttpContext ctx) =>
        ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',').First().Trim()
        ?? ctx.Connection.RemoteIpAddress?.ToString()
        ?? "unknown";

    // Authenticated user ID (rate limit per user)
    private static string? GetUserId(HttpContext ctx) =>
        ctx.User.Identity?.IsAuthenticated == true
            ? ctx.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            : null;
}
