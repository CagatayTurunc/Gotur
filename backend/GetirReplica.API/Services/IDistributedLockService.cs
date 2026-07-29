namespace GetirReplica.API.Services;

/// <summary>
/// Redis SET NX tabanlı basit distributed lock arayüzü.
/// Matching gibi kritik bölümlerde race condition'ı önler.
/// </summary>
public interface IDistributedLockService
{
    /// <summary>
    /// Verilen key için kilit almayı dener.
    /// Kilit alınamazsa (başka process tutuyorsa) false döner.
    /// </summary>
    Task<bool> TryAcquireAsync(string key, TimeSpan expiry, CancellationToken ct = default);

    /// <summary>
    /// Kilidi serbest bırakır.
    /// Sadece bu process'in koyduğu kilidi siler (token kontrolü ile).
    /// </summary>
    Task ReleaseAsync(string key, string token, CancellationToken ct = default);

    /// <summary>
    /// Kilit alır, işlemi çalıştırır ve kilidi serbest bırakır.
    /// Kilit alınamazsa false döner, işlemi çalıştırmaz.
    /// </summary>
    Task<bool> ExecuteWithLockAsync(string key, TimeSpan expiry,
        Func<Task> action, CancellationToken ct = default);
}
