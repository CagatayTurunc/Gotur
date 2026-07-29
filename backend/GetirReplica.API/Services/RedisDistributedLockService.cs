using StackExchange.Redis;

namespace GetirReplica.API.Services;

/// <summary>
/// Redis SET NX (set if not exists) ile distributed lock implementasyonu.
///
/// Neden bu gerekli?
///   MatchingService'te iki paralel request aynı anda aynı kuryeyi
///   "Available" olarak görüp ikisi de Assign edebilir. Bu lock,
///   "courier:{id}:lock" key'i ile sadece bir işleme izin verir.
///
/// Alternatif: PostgreSQL advisory lock / optimistic concurrency (RowVersion).
/// Redis seçildi çünkü proje zaten Redis kullanıyor.
/// </summary>
public class RedisDistributedLockService : IDistributedLockService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisDistributedLockService> _logger;

    // Lua script: token eşleşiyorsa sil, yoksa dokunma (atomik)
    private const string ReleaseLuaScript = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """;

    public RedisDistributedLockService(
        IConnectionMultiplexer redis,
        ILogger<RedisDistributedLockService> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    public async Task<bool> TryAcquireAsync(string key, TimeSpan expiry, CancellationToken ct = default)
    {
        var db = _redis.GetDatabase();
        // SET key token NX EX expiry — sadece key yoksa set eder
        var token = Guid.NewGuid().ToString("N");
        var acquired = await db.StringSetAsync(key, token, expiry, When.NotExists);
        if (acquired)
            _logger.LogDebug("Distributed lock alındı: {Key}", key);
        else
            _logger.LogDebug("Distributed lock alınamadı (başkası tutuyor): {Key}", key);
        return acquired;
    }

    public async Task ReleaseAsync(string key, string token, CancellationToken ct = default)
    {
        var db = _redis.GetDatabase();
        // Lua ile atomik: sadece kendi token'ımızı siliyoruz
        await db.ScriptEvaluateAsync(ReleaseLuaScript, [key], [token]);
        _logger.LogDebug("Distributed lock serbest bırakıldı: {Key}", key);
    }

    public async Task<bool> ExecuteWithLockAsync(
        string key, TimeSpan expiry, Func<Task> action, CancellationToken ct = default)
    {
        var db = _redis.GetDatabase();
        var token = Guid.NewGuid().ToString("N");

        // Kilit almayı dene
        var acquired = await db.StringSetAsync(key, token, expiry, When.NotExists);
        if (!acquired)
        {
            _logger.LogWarning("Lock alınamadı, işlem atlandı: {Key}", key);
            return false;
        }

        try
        {
            await action();
            return true;
        }
        finally
        {
            // Her halükarda kilidi bırak (sadece kendi token'ımızı)
            await db.ScriptEvaluateAsync(ReleaseLuaScript, [key], [token]);
        }
    }
}
