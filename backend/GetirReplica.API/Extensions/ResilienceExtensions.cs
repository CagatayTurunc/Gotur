using Microsoft.Extensions.Caching.Distributed;
using Polly;
using Polly.CircuitBreaker;
using Polly.Retry;
using Polly.Timeout;
using StackExchange.Redis;

namespace GetirReplica.API.Extensions;

/// <summary>
/// Polly Resilience Pipelines — Redis ve diğer harici bağımlılıklar için.
///
/// Her pipeline 3 katmandan oluşur (dıştan içe çalışır):
///   1. Timeout: İstek çok uzun sürerse pes et
///   2. Circuit Breaker: Üst üste hatalar olursa "devre kes"
///   3. Retry: Geçici hatalar için exponential backoff ile tekrar dene
///
/// Neden gerekli?
///   Redis anlık yanıt vermezse şu an direkt exception fırlar → 500 döner.
///   Polly: "3 kez dene, hala hata alıyorsan 30sn dinlen, fallback'e düş" der.
/// </summary>
public static class ResilienceExtensions
{
    /// <summary>
    /// Redis cache işlemleri için resilience pipeline kaydeder.
    /// Pipeline singleton olarak DI container'a eklenir.
    /// </summary>
    public static IServiceCollection AddRedisResiliencePipeline(this IServiceCollection services)
    {
        // Polly v8 standalone pipeline oluşturma
        var pipeline = new ResiliencePipelineBuilder()
            // 1. Timeout (en dış katman)
            .AddTimeout(new TimeoutStrategyOptions
            {
                Timeout = TimeSpan.FromSeconds(2)
            })
            // 2. Circuit Breaker
            .AddCircuitBreaker(new CircuitBreakerStrategyOptions
            {
                FailureRatio = 0.5,
                MinimumThroughput = 3,
                SamplingDuration = TimeSpan.FromSeconds(3),
                BreakDuration = TimeSpan.FromSeconds(30),
                ShouldHandle = new PredicateBuilder()
                    .Handle<RedisException>()
                    .Handle<RedisTimeoutException>()
                    .Handle<RedisConnectionException>()
                    .Handle<TimeoutRejectedException>()
            })
            // 3. Retry (exponential backoff: 100ms, 200ms, 400ms)
            .AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = 3,
                Delay = TimeSpan.FromMilliseconds(100),
                BackoffType = DelayBackoffType.Exponential,
                ShouldHandle = new PredicateBuilder()
                    .Handle<RedisException>()
                    .Handle<RedisTimeoutException>()
                    .Handle<RedisConnectionException>()
            })
            .Build();

        services.AddSingleton(new RedisResiliencePipeline(pipeline));
        return services;
    }

    /// <summary>
    /// Distributed cache işlemleri için resilient wrapper.
    /// AddStackExchangeRedisCache'den SONRA çağrılmalıdır.
    /// Redis down olursa null döner (graceful degradation — cache miss gibi davranır).
    /// </summary>
    public static IServiceCollection AddResilientDistributedCache(this IServiceCollection services)
    {
        // Mevcut IDistributedCache registration'ını bul, ServiceDescriptor'ı kaldır ve wrap et
        var existing = services.LastOrDefault(d => d.ServiceType == typeof(IDistributedCache));
        if (existing == null) return services;

        services.Remove(existing);

        services.AddSingleton<IDistributedCache>(sp =>
        {
            // Orijinal Redis implementasyonunu yeniden oluştur
            IDistributedCache inner;
            if (existing.ImplementationFactory != null)
                inner = (IDistributedCache)existing.ImplementationFactory(sp);
            else if (existing.ImplementationInstance != null)
                inner = (IDistributedCache)existing.ImplementationInstance;
            else
                inner = (IDistributedCache)ActivatorUtilities.CreateInstance(sp, existing.ImplementationType!);

            var pipelineHolder = sp.GetRequiredService<RedisResiliencePipeline>();
            var logger = sp.GetRequiredService<ILogger<ResilientDistributedCache>>();
            return new ResilientDistributedCache(inner, pipelineHolder, logger);
        });

        return services;
    }
}

/// <summary>
/// Polly pipeline için DI taşıyıcı — generic ResiliencePipeline'ı
/// servis olarak kaydetmek için kullanılır.
/// </summary>
public sealed class RedisResiliencePipeline
{
    public ResiliencePipeline Pipeline { get; }

    public RedisResiliencePipeline(ResiliencePipeline pipeline)
    {
        Pipeline = pipeline;
    }
}

/// <summary>
/// IDistributedCache için Polly decorator.
/// Redis geçici hata alırsa exception yerine graceful degradation yapar.
/// Cache miss gibi davranır — uygulama çalışmaya devam eder.
/// </summary>
public class ResilientDistributedCache : IDistributedCache
{
    private readonly IDistributedCache _inner;
    private readonly ResiliencePipeline _pipeline;
    private readonly ILogger<ResilientDistributedCache> _logger;

    public ResilientDistributedCache(
        IDistributedCache inner,
        RedisResiliencePipeline pipelineHolder,
        ILogger<ResilientDistributedCache> logger)
    {
        _inner = inner;
        _pipeline = pipelineHolder.Pipeline;
        _logger = logger;
    }

    public byte[]? Get(string key)
    {
        try { return _inner.Get(key); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache Get başarısız, cache miss döndürülüyor. Key={Key}", key);
            return null;
        }
    }

    public async Task<byte[]?> GetAsync(string key, CancellationToken token = default)
    {
        try
        {
            return await _pipeline.ExecuteAsync(
                async ct => await _inner.GetAsync(key, ct),
                token);
        }
        catch (BrokenCircuitException)
        {
            _logger.LogWarning("Redis circuit breaker açık, cache miss döndürülüyor. Key={Key}", key);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache GetAsync başarısız, cache miss döndürülüyor. Key={Key}", key);
            return null;
        }
    }

    public void Set(string key, byte[] value, DistributedCacheEntryOptions options)
    {
        try { _inner.Set(key, value, options); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache Set başarısız, atlanıyor. Key={Key}", key);
        }
    }

    public async Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options,
        CancellationToken token = default)
    {
        try
        {
            await _pipeline.ExecuteAsync(
                async ct => await _inner.SetAsync(key, value, options, ct),
                token);
        }
        catch (BrokenCircuitException)
        {
            _logger.LogWarning("Redis circuit breaker açık, Set atlanıyor. Key={Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache SetAsync başarısız, atlanıyor. Key={Key}", key);
        }
    }

    public void Refresh(string key)
    {
        try { _inner.Refresh(key); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache Refresh başarısız. Key={Key}", key);
        }
    }

    public async Task RefreshAsync(string key, CancellationToken token = default)
    {
        try { await _inner.RefreshAsync(key, token); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache RefreshAsync başarısız. Key={Key}", key);
        }
    }

    public void Remove(string key)
    {
        try { _inner.Remove(key); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache Remove başarısız. Key={Key}", key);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken token = default)
    {
        try { await _inner.RemoveAsync(key, token); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache RemoveAsync başarısız. Key={Key}", key);
        }
    }
}
