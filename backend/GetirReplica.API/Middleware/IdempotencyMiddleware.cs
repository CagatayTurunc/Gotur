using Microsoft.Extensions.Caching.Distributed;
using System.Text;

namespace GetirReplica.API.Middleware;

/// <summary>
/// Idempotency-Key header'ı ile POST isteklerini tekrar işlenmekten korur.
///
/// Nasıl çalışır?
///   1. Client her POST isteğiyle benzersiz bir Idempotency-Key gönderir (GUID önerilir).
///   2. Middleware bu key'i Redis'te kontrol eder.
///   3. Key daha önce işlendiyse, kaydedilmiş response'u direkt döner — DB'ye ikinci kez yazılmaz.
///   4. Key ilk kez geliyorsa isteği işletir ve response'u Redis'e yazar.
///
/// Neden önemli?
///   Mobil ağ kopar, kullanıcı butona iki kez basar → aynı sipariş iki kez oluşur.
///   Stripe, PayPal, tüm ödeme sistemleri bu pattern'i kullanır.
///
/// Kapsam: Yalnızca /api/orders POST endpoint'i (diğer POST'lar varsa genişletilebilir).
/// TTL: 24 saat (siparişin hayat döngüsünden uzun olmalı).
/// </summary>
public class IdempotencyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<IdempotencyMiddleware> _logger;

    // Idempotency kontrolü uygulanacak path'ler
    private static readonly HashSet<string> IdempotentPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/orders"
    };

    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(24);

    public IdempotencyMiddleware(RequestDelegate next, ILogger<IdempotencyMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IDistributedCache cache)
    {
        // Yalnızca POST isteklerine uygula
        if (!HttpMethods.IsPost(context.Request.Method))
        {
            await _next(context);
            return;
        }

        // Yalnızca belirlenen path'lere uygula
        var path = context.Request.Path.Value ?? string.Empty;
        if (!IdempotentPaths.Any(p => path.Equals(p, StringComparison.OrdinalIgnoreCase)))
        {
            await _next(context);
            return;
        }

        // Idempotency-Key header'ını oku
        if (!context.Request.Headers.TryGetValue("Idempotency-Key", out var keyValues) ||
            string.IsNullOrWhiteSpace(keyValues.FirstOrDefault()))
        {
            // Key yoksa isteği geç (geriye dönük uyumluluk için hata vermiyoruz)
            await _next(context);
            return;
        }

        var idempotencyKey = keyValues.First()!.Trim();

        // Key formatını doğrula (GUID bekleniyor, ama string de kabul et)
        if (idempotencyKey.Length > 128)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new
            {
                message = "Idempotency-Key çok uzun (maksimum 128 karakter)."
            });
            return;
        }

        var cacheKey = $"idempotency:{idempotencyKey}";

        // Daha önce işlendi mi?
        var cached = await cache.GetStringAsync(cacheKey);
        if (cached != null)
        {
            _logger.LogInformation(
                "Idempotent istek tekrarlandı, cache'den dönülüyor. Key={Key}, Path={Path}",
                idempotencyKey, path);

            var cachedResponse = System.Text.Json.JsonSerializer.Deserialize<CachedResponse>(cached);
            if (cachedResponse != null)
            {
                context.Response.StatusCode = cachedResponse.StatusCode;
                context.Response.ContentType = "application/json";
                // Tekrarlanan istek için özel header
                context.Response.Headers["X-Idempotent-Replayed"] = "true";
                await context.Response.WriteAsync(cachedResponse.Body);
                return;
            }
        }

        // İlk istek: response'u yakala
        var originalBody = context.Response.Body;
        using var memoryStream = new MemoryStream();
        context.Response.Body = memoryStream;

        try
        {
            await _next(context);
        }
        finally
        {
            // Response'u oku ve orijinal stream'e geri yaz
            memoryStream.Seek(0, SeekOrigin.Begin);
            var responseBody = await new StreamReader(memoryStream).ReadToEndAsync();

            memoryStream.Seek(0, SeekOrigin.Begin);
            await memoryStream.CopyToAsync(originalBody);
            context.Response.Body = originalBody;

            // Sadece başarılı yanıtları cache'le (2xx)
            if (context.Response.StatusCode >= 200 && context.Response.StatusCode < 300)
            {
                var toCache = System.Text.Json.JsonSerializer.Serialize(new CachedResponse
                {
                    StatusCode = context.Response.StatusCode,
                    Body = responseBody
                });

                await cache.SetStringAsync(cacheKey, toCache, new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = CacheTtl
                });

                _logger.LogInformation(
                    "Idempotency key kaydedildi. Key={Key}, Status={Status}",
                    idempotencyKey, context.Response.StatusCode);
            }
        }
    }

    private sealed class CachedResponse
    {
        public int StatusCode { get; set; }
        public string Body { get; set; } = string.Empty;
    }
}
