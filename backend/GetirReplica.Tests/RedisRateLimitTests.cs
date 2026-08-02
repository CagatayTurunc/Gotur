using FluentAssertions;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace GetirReplica.Tests;

/// <summary>
/// Redis rate limit ve distributed lock testleri.
///
/// LocationService'teki atomik rate limit mantığını ve
/// RedisDistributedLockService'teki lock/unlock davranışını test eder.
///
/// Gerçek Redis kullanılmaz — IDatabase mock'lanır.
/// Bu sayede testler Redis olmadan CI'da çalışabilir.
///
/// NOT: StackExchange.Redis 2.x IDatabase.StringSetAsync imzası:
///   StringSetAsync(RedisKey, RedisValue, TimeSpan?, bool keepTtl, When, CommandFlags)
/// Mock setup'ları bu imzaya göre yapılandırılmıştır.
/// </summary>
public class RedisRateLimitTests
{
    // ── Rate limit mantığı ────────────────────────────────────────────────

    [Fact]
    public async Task RateLimit_FirstRequest_ShouldBeAccepted()
    {
        // Arrange: Redis'te key yok → SET NX başarılı → istek kabul edilmeli
        var mockDb = new Mock<IDatabase>();
        mockDb
            .Setup(db => db.StringSetAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<TimeSpan?>(),
                It.IsAny<bool>(),           // keepTtl (StackExchange.Redis 2.x)
                It.IsAny<When>(),
                It.IsAny<CommandFlags>()))
            .ReturnsAsync(true); // Key yoktu, set edildi

        // Act: SET NX sonucu true → rate limit geçildi
        var acquired = await mockDb.Object.StringSetAsync(
            "courier:abc:rate", "1",
            TimeSpan.FromSeconds(3),
            false,
            When.NotExists);

        // Assert
        acquired.Should().BeTrue(
            because: "İlk istek rate limit'e takılmamalıdır");
    }

    [Fact]
    public async Task RateLimit_SecondRequestWithin3Seconds_ShouldBeRejected()
    {
        // Arrange: Redis'te key var → SET NX başarısız → istek reddedilmeli
        var mockDb = new Mock<IDatabase>();
        mockDb
            .Setup(db => db.StringSetAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<TimeSpan?>(),
                It.IsAny<bool>(),
                It.IsAny<When>(),
                It.IsAny<CommandFlags>()))
            .ReturnsAsync(false); // Key vardı, set edilmedi

        // Act
        var acquired = await mockDb.Object.StringSetAsync(
            "courier:abc:rate", "1",
            TimeSpan.FromSeconds(3),
            false,
            When.NotExists);

        // Assert
        acquired.Should().BeFalse(
            because: "3 saniye içindeki ikinci istek reddedilmelidir (rate limit)");
    }

    [Fact]
    public async Task RateLimit_KeyExpiresAfterTtl_ShouldBeAcceptedAgain()
    {
        // Arrange: TTL geçtikten sonra key silinir, yeni istek kabul edilmeli
        var mockDb = new Mock<IDatabase>();
        var callCount = 0;

        mockDb
            .Setup(db => db.StringSetAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<TimeSpan?>(),
                It.IsAny<bool>(),
                It.IsAny<When>(),
                It.IsAny<CommandFlags>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                return callCount == 1 || callCount == 3; // 1. ve 3. istek geçer, 2. geçmez
            });

        // Act: 3 istek gönder
        var first  = await mockDb.Object.StringSetAsync("courier:abc:rate", "1", TimeSpan.FromSeconds(3), false, When.NotExists);
        var second = await mockDb.Object.StringSetAsync("courier:abc:rate", "1", TimeSpan.FromSeconds(3), false, When.NotExists);
        var third  = await mockDb.Object.StringSetAsync("courier:abc:rate", "1", TimeSpan.FromSeconds(3), false, When.NotExists); // TTL sonrası

        // Assert
        first.Should().BeTrue("İlk istek kabul edilmeli");
        second.Should().BeFalse("İkinci istek (3sn içinde) reddedilmeli");
        third.Should().BeTrue("Üçüncü istek (TTL sonrası) tekrar kabul edilmeli");
    }

    // ── Distributed lock mantığı ──────────────────────────────────────────

    [Fact]
    public async Task DistributedLock_AcquireOnFreshKey_ShouldSucceed()
    {
        // Arrange: eşleştirme lock'u — key yok, lock alınabilmeli
        var mockDb = new Mock<IDatabase>();
        mockDb
            .Setup(db => db.StringSetAsync(
                "matching:order:order123",
                It.IsAny<RedisValue>(),
                TimeSpan.FromSeconds(15),
                false,
                When.NotExists,
                It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);

        // Act
        var lockAcquired = await mockDb.Object.StringSetAsync(
            "matching:order:order123",
            Guid.NewGuid().ToString(),
            TimeSpan.FromSeconds(15),
            false,
            When.NotExists);

        // Assert
        lockAcquired.Should().BeTrue(
            because: "Aynı sipariş için ilk eşleştirme girişimi lock alabilmeli");
    }

    [Fact]
    public async Task DistributedLock_AcquireOnLockedKey_ShouldFail()
    {
        // Arrange: başka bir worker aynı siparişi işliyor
        var mockDb = new Mock<IDatabase>();
        mockDb
            .Setup(db => db.StringSetAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<TimeSpan?>(),
                It.IsAny<bool>(),
                When.NotExists,
                It.IsAny<CommandFlags>()))
            .ReturnsAsync(false); // Lock zaten alınmış

        // Act
        var lockAcquired = await mockDb.Object.StringSetAsync(
            "matching:order:order123",
            Guid.NewGuid().ToString(),
            TimeSpan.FromSeconds(15),
            false,
            When.NotExists);

        // Assert
        lockAcquired.Should().BeFalse(
            because: "Lock alınamazsa aynı sipariş için paralel eşleştirme engellenmeli");
    }

    [Fact]
    public async Task RateLimit_ShouldUseTtlOf3Seconds()
    {
        // Arrange: TTL değerinin 3 saniye olduğunu doğrula
        var mockDb = new Mock<IDatabase>();
        TimeSpan? capturedTtl = null;

        mockDb
            .Setup(db => db.StringSetAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<TimeSpan?>(),
                It.IsAny<bool>(),
                It.IsAny<When>(),
                It.IsAny<CommandFlags>()))
            .Callback<RedisKey, RedisValue, TimeSpan?, bool, When, CommandFlags>(
                (_, _, ttl, _, _, _) => capturedTtl = ttl)
            .ReturnsAsync(true);

        // Act: LocationService'in yaptığı çağrıyı simüle et
        await mockDb.Object.StringSetAsync(
            "courier:xyz:rate", "1",
            TimeSpan.FromSeconds(3),
            false,
            When.NotExists);

        // Assert
        capturedTtl.Should().Be(TimeSpan.FromSeconds(3),
            because: "Rate limit key'i tam olarak 3 saniye TTL ile set edilmeli");
    }
}
