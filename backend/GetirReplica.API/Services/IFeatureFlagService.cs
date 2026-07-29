namespace GetirReplica.API.Services;

/// <summary>
/// Feature Flag değerlendirme servisi.
/// </summary>
public interface IFeatureFlagService
{
    /// <summary>
    /// Flag açık mı? (Basit boolean kontrol)
    /// </summary>
    Task<bool> IsEnabledAsync(string flagName, CancellationToken ct = default);

    /// <summary>
    /// Belirli bir kullanıcı için flag açık mı?
    /// Percentage rollout ve TargetUserIds dikkate alınır.
    /// </summary>
    Task<bool> IsEnabledForUserAsync(string flagName, Guid userId, CancellationToken ct = default);

    /// <summary>
    /// Tüm flag'leri listele (admin paneli için).
    /// </summary>
    Task<IReadOnlyList<FeatureFlagDto>> GetAllFlagsAsync(CancellationToken ct = default);

    /// <summary>
    /// Flag değerini güncelle (admin toggle).
    /// </summary>
    Task SetFlagAsync(string flagName, bool isEnabled, int rolloutPercentage = 100, CancellationToken ct = default);
}

public record FeatureFlagDto(
    string Name,
    bool IsEnabled,
    int RolloutPercentage,
    string? Description,
    DateTime UpdatedAt
);
