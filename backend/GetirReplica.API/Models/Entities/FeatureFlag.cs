namespace GetirReplica.API.Models.Entities;

/// <summary>
/// Feature Flag tablosu.
///
/// Neden bu gerekli?
///   "Yeni eşleştirme algoritmasını sadece %10 trafiğe aç" veya
///   "Bu kuryeyi beta grubunda test et" gibi kademeli rollout senaryoları için.
///   Kod deploy etmeden özelliği açıp kapatabilirsin.
///
/// Kullanım örnekleri:
///   - new-matching-algorithm: True/False veya %10 rollout
///   - courier-surge-pricing: Aktif/pasif
///   - maintenance-mode: Tüm sipariş yaratmayı geçici kapat
///
/// Rollout stratejileri:
///   - Boolean: Herkese aç/kapat
///   - Percentage: %X trafiğe aç (RolloutPercentage alanı)
///   - UserIds: Sadece belirli kullanıcılara aç (TargetUserIds JSON)
/// </summary>
public class FeatureFlag
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Flag adı — snake_case önerilir. Örn: "new_matching_algorithm"
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Boolean açık/kapalı.
    /// </summary>
    public bool IsEnabled { get; set; } = false;

    /// <summary>
    /// Yüzde tabanlı rollout: 0-100.
    /// 0 = kapalı, 100 = herkese açık, 10 = %10 trafiğe açık.
    /// IsEnabled = true olmalı, RolloutPercentage de dikkate alınır.
    /// </summary>
    public int RolloutPercentage { get; set; } = 100;

    /// <summary>
    /// Belirli user ID'lere özel açma — JSON array. Örn: ["uuid1","uuid2"]
    /// Boş veya null → tüm kullanıcılar için geçerli.
    /// </summary>
    public string? TargetUserIds { get; set; }

    /// <summary>
    /// İnsan okunabilir açıklama.
    /// </summary>
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
