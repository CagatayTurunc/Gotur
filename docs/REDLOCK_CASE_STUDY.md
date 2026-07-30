# Case Study: Redis ile Race Condition Önleme

## Problem: İki Paralel İstek, Tek Kurye

Sipariş eşleştirme sisteminde kritik bir race condition riski vardı:

```
Zaman →

T1: İstek A → "courier-42 müsait mi?" → Evet (Available)
T2: İstek B → "courier-42 müsait mi?" → Evet (Available)  ← aynı anda!
T3: İstek A → courier-42.Status = Busy, order-1 = Assigned
T4: İstek B → courier-42.Status = Busy, order-2 = Assigned  ← ÇİFT ATAMA!
```

Sonuç: Aynı kurye iki siparişe atanmış, ikinci müşteri asla teslim alamaz.

Bu sorun sadece teorik değil. Yoğun akşam saatlerinde Getir gibi sistemlerde
saniyede onlarca eşleştirme isteği gelir. Tek node'da bile iki Hangfire worker'ı
paralel çalışabilir.

---

## Çözüm 1: Redis Distributed Lock (SET NX EX)

`matching:order:{orderId}` key'i ile sipariş bazlı kilit.

```csharp
// RedisDistributedLockService.cs
var acquired = await db.StringSetAsync(
    key,           // "matching:order:abc123"
    token,         // Guid — sadece bu process'in token'ı
    expiry,        // 15 saniye
    When.NotExists // SET NX — sadece key yoksa set et
);
```

**Neden tek komut?** `GET` sonra `SET` iki ayrı komuttur — aralarında başka bir
process aynı key'i set edebilir. `SET NX EX` Redis'in atomik garantisi ile
ya set edilir ya edilmez, arada başka bir şey olamaz.

**Token neden önemli?** Lock expire olursa başka bir process aynı key'i alabilir.
Release sırasında Lua script ile "sadece kendi token'ımı sil" garantisi:

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0  -- başkasının lock'ı, dokunma
end
```

Bu olmadan: Process A lock'ı expiry'de kaybetti, Process B aldı,
Process A yanlışlıkla Process B'nin lock'ını siliyor.

**Kullanım:**

```csharp
// MatchingService.cs
var executed = await _lockService.ExecuteWithLockAsync(
    key: $"matching:order:{orderId}",
    expiry: TimeSpan.FromSeconds(15),
    action: async () => await DoFindAndAssignAsync(orderId)
);

if (!executed)
    _logger.LogWarning("Sipariş zaten işleniyor: {OrderId}", orderId);
```

---

## Çözüm 2: Optimistic Concurrency (Çift Güvence)

Lock alınıp DB'ye ulaşana kadar başka bir thread kuryeyi Busy yapmış olabilir.
Lock tek başına yeterli değil — iki farklı sipariş için iki farklı lock alınabilir,
ikisi de aynı kuryeyi hedefleyebilir.

```csharp
// DoFindAndAssignAsync — transaction içinde
var freshCourier = await _db.Couriers
    .FirstOrDefaultAsync(c =>
        c.Id == courier.Id &&
        c.Status == CourierStatus.Available); // DB'den taze oku

if (freshCourier == null)
{
    // Lock alındıktan sonra bile kurye Busy olmuş
    // → race condition önlendi, retry schedule et
    await transaction.RollbackAsync();
    await ScheduleRetryAsync(orderId, order.RetryCount);
    return false;
}
```

İki katmanlı koruma:
1. **Redis lock** → aynı sipariş için iki paralel işlemi engeller
2. **DB optimistic check** → farklı siparişlerin aynı kuryeyi çalışmasını engeller

---

## Çözüm 3: Atomik Rate Limit (SET NX EX)

LocationService'te kurye konum güncellemesi için rate limit de aynı sorunu taşıyordu:

```csharp
// YANLIŞ — race window var:
var existing = await cache.GetStringAsync(key);  // T1: null görür
// ← burada başka thread de null görür!
if (existing != null) throw ...;
await cache.SetStringAsync(key, "1", ...);       // İkisi de geçer
```

```csharp
// DOĞRU — atomik:
var acquired = await redisDb.StringSetAsync(
    key,
    "1",
    TimeSpan.FromSeconds(3),
    When.NotExists  // SET NX EX — tek komut
);
if (!acquired) throw new InvalidOperationException("Rate limit aşıldı.");
```

---

## Gerçek Hayatta (Getir Ölçeği)

Getir gibi sistemlerde distributed lock için **Redlock algoritması** kullanılır:
birden fazla Redis node'una aynı anda lock alınır, çoğunluk (N/2 + 1) node
onaylarsa lock geçerli sayılır. Tek node başarısız olsa bile sistem çalışmaya devam eder.

```
Node 1 ──► SET NX → acquired ✓
Node 2 ──► SET NX → acquired ✓   → 3/5 çoğunluk → lock geçerli
Node 3 ──► SET NX → acquired ✓
Node 4 ──► SET NX → DOWN ✗
Node 5 ──► SET NX → acquired ✓ (ama 3 zaten yeterli)
```

Bizim MVP'de tek Redis node kullanıyoruz — yeterli. Node sayısı arttıkça
`RedLock.net` kütüphanesi ile multi-node Redlock'a geçiş sadece DI konfigürasyonu değişikliği.

---

## Özet

| Sorun | Çözüm | Araç |
|-------|-------|------|
| Paralel eşleştirme → çift kurye atama | Sipariş bazlı distributed lock | Redis SET NX EX |
| Lock sonrası kurye başkasına gitmiş | DB'den taze okuma + transaction | PostgreSQL transaction |
| Rate limit race condition | Atomik SET NX yerine GET+SET | Redis SET NX EX |
| Lock expire → yanlış release | Token bazlı Lua script | Redis Lua atomik eval |

Tüm implementasyon: `Services/RedisDistributedLockService.cs`
