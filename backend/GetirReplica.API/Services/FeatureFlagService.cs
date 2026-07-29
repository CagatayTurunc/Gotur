using System.Text.Json;
using GetirReplica.API.Data;
using GetirReplica.API.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace GetirReplica.API.Services;

/// <summary>
/// Feature Flag servisi — DB tabanlı, Redis cache ile hızlandırılmış.
///
/// Mimari:
///   - Flag değerleri PostgreSQL'de saklanır (kalıcı, admin panel ile yönetilir)
///   - Redis cache: her flag 30sn TTL ile cache'lenir (DB'yi her istekte çarpmaz)
///   - Cache invalidation: SetFlagAsync çağrıldığında ilgili cache temizlenir
///
/// Rollout algoritması:
///   Percentage rollout için deterministik hash kullanılır.
///   Aynı kullanıcı her zaman aynı bucket'a düşer (tutarlı davranış).
///   Hash(userId + flagName) % 100 < rolloutPercentage → açık
///
/// Genişletme önerileri:
///   - Microsoft.FeatureManagement paketi (Azure App Configuration entegrasyonu)
///   - LaunchDarkly / Unleash gibi feature flag platformlarına geçiş
/// </summary>
public class FeatureFlagService : IFeatureFlagService
{
    private readonly AppDbContext _db;
    private readonly IDistributedCache _cache;
    private readonly ILogger<FeatureFlagService> _logger;

    private const int CacheTtlSeconds = 30;

    // Bilinen flag isimleri — magic string hatalarını önler
    public static class Flags
    {
        public const string NewMatchingAlgorithm = "new_matching_algorithm";
        public const string MaintenanceMode = "maintenance_mode";
        public const string CourierSurgePricing = "courier_surge_pricing";
        public const string AdvancedOutboxRetry = "advanced_outbox_retry";
    }

    public FeatureFlagService(
        AppDbContext db,
        IDistributedCache cache,
        ILogger<FeatureFlagService> logger)
    {
        _db = db;
        _cache = cache;
        _logger = logger;
    }

    public async Task<bool> IsEnabledAsync(string flagName, CancellationToken ct = default)
    {
        var flag = await GetFlagCachedAsync(flagName, ct);
        if (flag == null) return false;

        return flag.IsEnabled;
    }

    public async Task<bool> IsEnabledForUserAsync(string flagName, Guid userId, CancellationToken ct = default)
    {
        var flag = await GetFlagCachedAsync(flagName, ct);
        if (flag == null || !flag.IsEnabled) return false;

        // TargetUserIds kontrolü — belirli kullanıcılar için override
        if (!string.IsNullOrWhiteSpace(flag.TargetUserIds))
        {
            try
            {
                var targetIds = JsonSerializer.Deserialize<List<string>>(flag.TargetUserIds) ?? [];
                if (targetIds.Contains(userId.ToString()))
                {
                    _logger.LogDebug("Feature flag '{Flag}' kullanıcı {UserId} için hedeflenmiş — açık.", flagName, userId);
                    return true;
                }
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Feature flag '{Flag}' TargetUserIds parse edilemedi.", flagName);
            }
        }

        // %100 rollout: herkese aç
        if (flag.RolloutPercentage >= 100) return true;
        if (flag.RolloutPercentage <= 0) return false;

        // Deterministik percentage rollout
        // Hash(userId + flagName) deterministic olduğu için aynı kullanıcı her zaman aynı sonucu alır.
        var bucket = GetUserBucket(userId, flagName);
        var isInBucket = bucket < flag.RolloutPercentage;

        _logger.LogDebug(
            "Feature flag '{Flag}' rollout: UserId={UserId}, Bucket={Bucket}, Threshold={Threshold}, Result={Result}",
            flagName, userId, bucket, flag.RolloutPercentage, isInBucket);

        return isInBucket;
    }

    public async Task<IReadOnlyList<FeatureFlagDto>> GetAllFlagsAsync(CancellationToken ct = default)
    {
        var flags = await _db.FeatureFlags
            .OrderBy(f => f.Name)
            .ToListAsync(ct);

        return flags.Select(f => new FeatureFlagDto(
            f.Name, f.IsEnabled, f.RolloutPercentage, f.Description, f.UpdatedAt
        )).ToList();
    }

    public async Task SetFlagAsync(
        string flagName, bool isEnabled, int rolloutPercentage = 100, CancellationToken ct = default)
    {
        rolloutPercentage = Math.Clamp(rolloutPercentage, 0, 100);

        var flag = await _db.FeatureFlags.FirstOrDefaultAsync(f => f.Name == flagName, ct);
        if (flag == null)
        {
            flag = new FeatureFlag { Name = flagName };
            _db.FeatureFlags.Add(flag);
        }

        flag.IsEnabled = isEnabled;
        flag.RolloutPercentage = rolloutPercentage;
        flag.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Cache'i invalidate et — bir sonraki okumada DB'den taze değer gelsin
        await _cache.RemoveAsync($"ff:{flagName}", ct);

        _logger.LogInformation(
            "Feature flag güncellendi: '{Flag}' → IsEnabled={Enabled}, Rollout={Rollout}%",
            flagName, isEnabled, rolloutPercentage);
    }

    // Redis cache → DB fallback
    private async Task<FeatureFlag?> GetFlagCachedAsync(string flagName, CancellationToken ct)
    {
        var cacheKey = $"ff:{flagName}";

        try
        {
            var cached = await _cache.GetStringAsync(cacheKey, ct);
            if (cached != null)
                return JsonSerializer.Deserialize<FeatureFlag>(cached);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Feature flag cache okunamadı: {Flag}, DB'den okunuyor.", flagName);
        }

        var flag = await _db.FeatureFlags.AsNoTracking()
            .FirstOrDefaultAsync(f => f.Name == flagName, ct);

        if (flag != null)
        {
            try
            {
                await _cache.SetStringAsync(
                    cacheKey,
                    JsonSerializer.Serialize(flag),
                    new DistributedCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(CacheTtlSeconds)
                    },
                    ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Feature flag cache yazılamadı: {Flag}", flagName);
            }
        }

        return flag;
    }

    /// <summary>
    /// Deterministik bucket hesaplama.
    /// Hash(userId + flagName) % 100 → 0-99 arası sabit bucket
    /// Aynı kullanıcı + aynı flag → her zaman aynı bucket
    /// </summary>
    private static int GetUserBucket(Guid userId, string flagName)
    {
        var input = $"{userId}:{flagName}";
        var hash = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(input));
        // İlk 4 byte'ı int32 olarak al, mutlak değer % 100
        var value = Math.Abs(BitConverter.ToInt32(hash, 0));
        return value % 100;
    }
}
