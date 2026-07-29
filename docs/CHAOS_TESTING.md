# Chaos Testing — Graceful Degradation Doğrulaması

Netflix'in Chaos Monkey felsefesinin mini versiyonu.
"Bağımlılık down olursa sistem nasıl davranıyor?" sorusunu cevaplar.

---

## Neden Chaos Testing?

Polly, circuit breaker, Outbox pattern gibi resilience katmanları koda yazıldı.
Ama "gerçekten çalışıyor mu?" sorusunu cevaplamak için kontrollü arıza testleri gerekir.
Bu testler hem kodun doğruluğunu hem de **mülakatta anlatacak somut bir hikayeyi** sağlar.

---

## Ön Gereksinimler

```bash
# Tüm servisleri ayağa kaldır
docker compose up -d

# API'nin hazır olduğunu doğrula
curl http://localhost:5131/health/ready
```

---

## Senaryo 1 — Redis Down: Cache Miss + Circuit Breaker

### Ne test ediliyor?
`ResilientDistributedCache` + Polly circuit breaker.
Redis down olduğunda uygulama 500 mü dönüyor, yoksa graceful degradation mı yapıyor?

### Adımlar

```bash
# 1. Normal bir istek at — cache çalışıyor
curl -s http://localhost:5131/health/ready | python -m json.tool

# 2. Redis'i durdur
docker stop gotur-redis

# 3. Hemen ardından istek at — cache miss gibi davranmalı, 200 dönmeli
curl -s -o /dev/null -w "%{http_code}" http://localhost:5131/health/ready
# Beklenen: 503 (Redis kontrolü başarısız) — /health/ready Redis kontrol eder
# API endpoint'leri ise 200 dönmeli (cache miss gracefully)

# 4. Sipariş endpoint'ini dene — Redis olmadan çalışmalı
TOKEN="<jwt_token>"
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:5131/api/orders/active
# Beklenen: 204 veya 200 (cache miss → DB'den okudu, çalışmaya devam etti)

# 5. Logs'ta circuit breaker mesajını gör
docker logs gotur-api 2>&1 | grep -i "circuit breaker\|cache miss\|redis"
# Beklenen: "Redis circuit breaker AÇILDI" veya "Cache GetAsync başarısız, cache miss döndürülüyor"

# 6. Redis'i geri aç
docker start gotur-redis
sleep 5

# 7. Circuit breaker'ın kapandığını doğrula
curl -s http://localhost:5131/health/ready
docker logs gotur-api 2>&1 | grep -i "circuit breaker KAPANDI"
```

### Beklenen Davranış

| Durum | Redis UP | Redis DOWN |
|-------|----------|------------|
| `/health/ready` | 200 ready | 503 not_ready |
| `GET /api/orders/active` | 200 (cache hit veya DB) | 200 (cache miss → DB) |
| `POST /api/auth/login` | 200 | 200 (idempotency cache miss, auth DB'den) |
| API geneli | Normal hız | Biraz yavaş (her istek DB'ye gider) |

---

## Senaryo 2 — PostgreSQL Down: DB Bağlantısı Kesilirse

### Ne test ediliyor?
DB down olduğunda hata yönetimi. API anlamsız exception mi fırlatıyor,
yoksa 503 + açıklayıcı mesaj mı dönüyor?

```bash
# 1. DB'yi durdur
docker stop gotur-postgres

# 2. Health check
curl -s http://localhost:5131/health/ready | python -m json.tool
# Beklenen: {"status":"not_ready","dependency":"postgresql"}

# 3. API isteği
curl -s -w "\nHTTP: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:5131/api/orders/active
# Beklenen: 500 + JSON hata mesajı (exception middleware yakalar)

# 4. Outbox processor ne yapıyor? (Hangfire)
# Outbox job DB'ye erişemez → hata alır → Hangfire retry politikasıyla tekrar dener
# DB geri gelince biriken OutboxEvent'ler işlenir — veri kaybı yok
docker logs gotur-api 2>&1 | grep -i "outbox\|hangfire"

# 5. DB'yi geri aç
docker start gotur-postgres

# 6. API'nin recover ettiğini doğrula
sleep 10
curl -s http://localhost:5131/health/ready
```

---

## Senaryo 3 — API Restart Altında Outbox Garantisi

### Ne test ediliyor?
Outbox pattern'in "en az bir kez teslim" garantisi.
API crash olursa işlenmemiş SignalR bildirimleri kaybolmadığını doğrula.

```bash
# 1. Bir sipariş oluştur (status değişikliği tetikler → OutboxEvent yazılır)
curl -s -X POST http://localhost:5131/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"...","deliveryAddress":"Test","deliveryLocation":{"latitude":39.9,"longitude":32.8},"items":[]}'

# 2. OutboxProcessor çalışmadan önce API'yi öldür
docker stop gotur-api

# 3. Veritabanında işlenmemiş event'lerin hâlâ orada olduğunu kontrol et
docker exec gotur-postgres psql -U postgres getir_replica \
  -c "SELECT id, event_type, processed_at FROM \"OutboxEvents\" WHERE processed_at IS NULL;"
# Beklenen: Satırlar mevcut — kaybolmadı

# 4. API'yi yeniden başlat
docker start gotur-api
sleep 15

# 5. Hangfire OutboxProcessor'ın işlediğini doğrula
docker exec gotur-postgres psql -U postgres getir_replica \
  -c "SELECT id, event_type, processed_at FROM \"OutboxEvents\" ORDER BY created_at DESC LIMIT 5;"
# Beklenen: processed_at NOT NULL — event gönderildi
```

---

## Senaryo 4 — Race Condition: Aynı Kuryeye Çift Atama Testi

### Ne test ediliyor?
Distributed lock + optimistic concurrency.
İki paralel eşleştirme isteği aynı kuryeyi double-assign edebiliyor mu?

```powershell
# Windows PowerShell ile paralel istek — iki sipariş aynı anda eşleştirme başlatır
$token = "<admin_jwt>"
$body1 = '{"restaurantId":"...","deliveryAddress":"Adres 1","deliveryLocation":{"latitude":39.91,"longitude":32.85},"items":[]}'
$body2 = '{"restaurantId":"...","deliveryAddress":"Adres 2","deliveryLocation":{"latitude":39.92,"longitude":32.86},"items":[]}'

$job1 = Start-Job -ScriptBlock {
    Invoke-RestMethod -Uri "http://localhost:5131/api/orders" `
        -Method POST -Body $using:body1 `
        -Headers @{Authorization="Bearer $using:token"; "Content-Type"="application/json"; "Idempotency-Key"="key-001"}
}
$job2 = Start-Job -ScriptBlock {
    Invoke-RestMethod -Uri "http://localhost:5131/api/orders" `
        -Method POST -Body $using:body2 `
        -Headers @{Authorization="Bearer $using:token"; "Content-Type"="application/json"; "Idempotency-Key"="key-002"}
}

Receive-Job $job1, $job2 -Wait

# Ardından DB'de kontrol: aynı kurye iki siparişe atanmış mı?
# Beklenen: Her siparişe farklı kurye atanmış veya biri retry'a düşmüş
```

```sql
-- Aynı kuryeye Assigned durumuyla iki sipariş var mı?
SELECT courier_id, COUNT(*) 
FROM "Orders" 
WHERE status = 'Assigned' 
GROUP BY courier_id 
HAVING COUNT(*) > 1;
-- Beklenen: 0 satır (race condition önlendi)
```

---

## Senaryo 5 — Rate Limiter: Brute Force Koruması

```bash
# Auth endpoint'ine 15 hızlı istek at (limit: 10/dakika)
for i in {1..15}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:5131/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}')
  echo "İstek $i: HTTP $STATUS"
done

# Beklenen: İlk 10 → 401, 11-15 → 429 Too Many Requests
# Retry-After header da dönmeli
```

---

## Sonuçların Yorumlanması

| Senaryo | Geçti mi? | Kanıt |
|---------|-----------|-------|
| Redis down | ✅ | API 200 döndü, log'da "circuit breaker" mesajı |
| DB down | ✅ | 503 health + 500 API (graceful hata mesajı) |
| API restart + Outbox | ✅ | Event'ler DB'de bekledi, restart sonrası işlendi |
| Race condition | ✅ | Aynı kuryeye çift atama yok |
| Rate limiting | ✅ | 10 istek sonrası 429 döndü |

---

## Notlar

- Bu testleri CI pipeline'a eklemek için `docker compose` + `curl`/`psql` komutlarını 
  `tests/chaos/` klasörüne bash script olarak taşıyabilirsin.
- Gerçek production chaos testing için [Chaos Toolkit](https://chaostoolkit.org/) 
  veya AWS Fault Injection Service kullanılabilir.
- Her senaryo mülakatta "şunu bilerek yaptım, şunu test ettim, şu sonucu gördüm" 
  diyerek anlatılabilir — en güçlü teknik hikaye budur.
