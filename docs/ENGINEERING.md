# Sistem Mühendisliği, Ölçek ve Operasyon

Bu belge backend sürümleme, Redis, CI/CD pipeline, yük testi,
gözlemlenebilirlik ve Kubernetes yaklaşımını somut dosya referanslarıyla
bir arada açıklar. Her başlık altında "ne yaptık" değil "neden yaptık ve
nasıl ölçeriz" sorusu yanıtlanmaktadır.

---

## Teknik temel

| Alan | Uygulama | Dosya |
|---|---|---|
| Backend | ASP.NET Core 9, API v1, SemVer `1.0.0` | `backend/GetirReplica.API/Program.cs` |
| Sürüm endpoint'i | `GET /api/meta/version` | `Program.cs` ~L159 |
| Process sağlığı | `GET /health/live` | `Program.cs` ~L115 |
| Bağımlılık hazırlığı | `GET /health/ready` (PostgreSQL + Redis) | `Program.cs` ~L122 |
| Redis — rate limit | `courier:{id}:rate`, TTL 3sn, SetString NX | `Services/LocationService.cs` ~L41 |
| Redis — cache-aside | `courier:{id}:location`, TTL 30sn | `Services/LocationService.cs` ~L93 |
| Redis — SignalR backplane | `AddStackExchangeRedisCache` + SignalR | `Program.cs` |
| CI pipeline | Build → Docker → Smoke → k8s dry-run → Push | `.github/workflows/ci.yml` |
| Yük testi | k6 smoke / load / million profilleri | `tests/load/login.js` |
| Kubernetes | Deployment, HPA, PDB, Ingress | `infra/k8s/` |

---

## Sürüm yönetimi (SemVer + API versiyonlama)

`/api/meta/version` çalışan process hakkında üç bilgi döner:

```json
{
  "service": "GetirReplica.API",
  "apiVersion": "v1",
  "applicationVersion": "1.0.0",
  "framework": ".NET 9.x.x"
}
```

**Neden iki ayrı versiyon?**
- `apiVersion` (v1): URL prefix'i. Breaking change yapılırsa `/api/v2/...` açılır,
  v1 istemciler bozulmaz. Bu API versiyonlamadır.
- `applicationVersion` (1.0.0): SemVer. Hangi binary çalışıyor? Bu deployment
  versiyonlamasıdır. CI'da Git SHA ile image tag'lenir; `applicationVersion` ile
  "bu SHA hangi SemVer'a karşılık gelir" ilişkisi kurulur.

Gerçek dünyada (Getir ölçeği) bu bilgi Datadog/New Relic'e gönderilir ve
"bu deployment'tan sonra hata oranı arttı mı?" sorusu yanıtlanır.

---

## "1 milyon kullanıcı giriş yaparsa?" — sorunun doğru çerçevelenmesi

Kapasite iddiası ölçülmeden anlamsızdır. Önce trafik modeli netleştirilir:

| Soru | Anlam |
|---|---|
| 1M kayıtlı kullanıcı | Veritabanı boyutu sorusu — storage ve index meselesi |
| 1M günlük giriş | ~12 login/sn — orta ölçek, tek instance kaldırır |
| 1 saatte 1M giriş | ~278 login/sn — bağlantı havuzu ve bcrypt maliyeti kritik |
| 1M eşzamanlı giriş | ~1M açık WebSocket — tamamen farklı bir problem |

`tests/load/login.js` bu ayrımı somut profillere dönüştürür:

```
smoke   →  2 VU, 20 iterasyon   — "akış çalışıyor mu?" kontrol
load    →  100 req/sn, 5 dk     — sürdürülebilir throughput ölçümü
million →  1000 VU, 1M toplam   — toplam iterasyon hedefi
```

**Başarı kriterleri** (tüm profillerde aynı):
- Hata oranı `< %1`
- p95 latency `< 500 ms`
- p99 latency `< 1 sn`

**Önemli kısıt:** 1M testi tek bir makinede çalıştırıp
"sistem 1M kullanıcı kaldırır" sonucu çıkarılamaz.
Gerçek kapasite testi şunları gerektirir:
1. İzole test ortamı (üretim DB'si değil)
2. Birden fazla k6 load generator (distributed mode)
3. API, PostgreSQL, Redis metriklerinin aynı anda izlenmesi
4. Benzersiz kullanıcı havuzu — aynı hesabın defalarca login yapması
   bcrypt cache etkisi nedeniyle gerçekçi ölçüm vermez

---

## Redis — beş kavram, beş satır

```
Kavram          Projedeki karşılığı
─────────────   ─────────────────────────────────────────────────────────
Cache-aside     Konum önce Redis'ten okunur; miss → PostgreSQL → Redis'e yaz
TTL             Konum 30sn, rate-limit 3sn — bayat/geçici veri otomatik temizlenir
Rate limiting   courier:{id}:rate anahtarı; 3sn içinde ikinci istek 429 döner
Backplane       SignalR pod'ları Redis üzerinden mesaj senkronize eder
Key namespace   courier:{id}:location / courier:{id}:rate — izlenebilir, çakışmasız
```

**Rate limit implementasyon notu:**
Mevcut implementasyon `GetString` → `SetString` sırasıyla çalışır.
Bu iki ayrı Redis komutu arasında çok küçük bir race window mevcuttur.
Production'da atomik `SET key 1 NX EX 3` (tek komut) veya Lua script
kullanılmalıdır. MVP ölçeğinde bu fark hissedilmez; not olarak bırakılmıştır.

**Redis kaybı senaryosu:**
Kritik sipariş verisi Redis'te tutulmaz — PostgreSQL'dedir.
Redis kaybı şu anlama gelir:
- Anlık konum birkaç saniye gecikir (sonraki güncellemeyle düzelir)
- Rate limit sıfırlanır (birkaç ekstra istek geçer, zararsız)
- SignalR backplane durumu sıfırlanır (istemciler yeniden bağlanır)
- Sipariş kaybı: **sıfır**

---

## CI/CD Pipeline — adım adım

```
Push / PR
    │
    ├─ [1] backend: dotnet restore → build → test
    │        Neden önce: en hızlı geri bildirim, Docker beklemiyor
    │
    ├─ [2] frontend: npm ci → tsc --noEmit → vite build
    │        npm ci: package-lock.json'u baz alır, herkes aynı versiyonu alır
    │        tsc --noEmit: runtime hatası olmadan tip sistemi doğrulanır
    │
    ├─ [3] docker: API + Frontend image build
    │        PR'da: sadece build hatası kontrol edilir (push yok)
    │        main push'unda: GHCR'a :latest ve :SHA ile iki tag push edilir
    │        Neden iki tag?
    │          :SHA    → immutable, hangi kodun çalıştığı kesin
    │          :latest → kolaylık, "son stable'ı çek" için
    │
    ├─ [4] load-smoke: docker compose up → /health/ready bekle → k6 smoke
    │        Gerçek PostgreSQL + Redis ile login akışını test eder
    │        "Derlendi" ≠ "Çalışıyor" — bu adım ikisinin farkını kapatır
    │
    └─ [5] kubernetes: kubectl kustomize infra/k8s
             Tüm YAML'ları render et; syntax hatası veya eksik referans patlatır
             Gerçek cluster gerekmez, sadece manifest doğrulamasıdır
```

**Release akışı (production pattern):**
```
CI geçti
    │
    ├─ kustomize edit set image gotur-api:$SHA
    ├─ kubectl apply -k infra/k8s
    ├─ kubectl rollout status deployment/gotur-api -n gotur
    │       ↑ Pod'lar readiness probe'u geçene kadar bekler
    │
    └─ Sorun çıkarsa: kubectl rollout undo deployment/gotur-api -n gotur
```

---

## Kubernetes — neden her özellik var

### Rolling Update (`maxUnavailable: 0`)
Yeni pod readiness probe'u geçmeden eski pod kapatılmaz.
Deploy sırasında kullanıcı 503 görmez.
`maxSurge: 1` → aynı anda toplam `replicas+1` pod çalışır, kaynak tüketimi sınırlı.

### HPA (Horizontal Pod Autoscaler)
```
Min: 3 pod  →  Normal trafik
Max: 20 pod →  Yoğun dönem (akşam saatleri, kampanya)
Tetikleyici: CPU %65
Scale-up:   Hızlı (0sn stabilization, max(+%100, +4 pod)/dk)
Scale-down: Yavaş (300sn stabilization, %25/dk)
```
Neden hızlı büyü, yavaş küçül?
Trafik ani artışta hemen pod ekle (gecikme yok).
Trafik düşünce acele etme — birkaç dakika sonra tekrar artabilir,
pod başlatma maliyetinden kaçın.

### PodDisruptionBudget (`minAvailable: 2`)
Node bakımı, cluster upgrade veya `kubectl drain` sırasında
Kubernetes API en az 2 pod'u ayakta tutar.
Bu olmadan tüm podlar aynı anda silinebilir — kısa süreli tam kesinti.

### Readiness vs Liveness probe farkı

```
Liveness  → "process cevap veriyor mu?"
             /health/live sadece process sağlığını kontrol eder
             Redis/DB erişilemez → liveness başarılı (restart yok)
             Neden? Bağımlılık sorunu pod'u yeniden başlatarak çözülmez

Readiness → "istek alabilir misin?"
             /health/ready PostgreSQL + Redis bağlantısını doğrular
             Başarısız → pod trafik almaz ama ölmez
             Neden? DB geçici unavailable → pod kuyrukta bekler,
             düzelince otomatik trafiğe geri döner
```

### Resource limit neden önemli
`requests` → Kubernetes'in pod'u nereye yerleştireceğini belirler.
`limits`   → Pod limit'i aşarsa throttle edilir (CPU) veya OOMKilled (memory).

```yaml
requests: { cpu: 250m, memory: 256Mi }  # "bana bu kadar yer ayır"
limits:    { cpu: "1",  memory: 768Mi }  # "bundan fazla yeme"
```

Limit olmadan tek hatalı pod tüm node'u tüketebilir.

---

## Gözlemlenebilirlik — dört altın sinyal

Prometheus/Grafana kurulmamış olsa da hangi metriklerin izlenmesi
gerektiğini bilmek mimari olgunluğunu gösterir:

| Sinyal | Metrik | Alarm eşiği |
|---|---|---|
| Latency | p95 `/api/auth/login` | > 500 ms |
| Traffic | request/sn | Baseline'ın %200'ü |
| Errors | HTTP 5xx oranı | > %1 |
| Saturation | PostgreSQL connection pool | > %80 dolu |
| Saturation | Redis memory | > %80 dolu |
| Saturation | API pod CPU | > %65 (HPA trigger) |

**Structured logging (Serilog):**
Her log satırı JSON formatında; `orderId`, `courierId`, `userId` alanları
correlation için eklenir. Bu alanlar olmadan dağıtık sistemde bir siparişin
yaşam döngüsünü takip etmek imkansızlaşır.

**Sonraki adımlar (uygulanmadı, plan olarak not düşüldü):**
- OpenTelemetry → trace + metric export
- Prometheus `/metrics` endpoint (`prometheus-net.AspNetCore`)
- Grafana dashboard: SLO burn-rate alarmları
- Loki / Elasticsearch: merkezi log aggregation

---

## Lokalde çalıştır

### Smoke test (Docker gerekli)
```bash
# 1. Stack'i başlat
docker compose up -d postgres redis api

# 2. API hazır olana kadar bekle
# (docker-compose'daki healthcheck otomatik izler)

# 3. k6 smoke testini çalıştır (Windows)
docker run --rm `
  -e BASE_URL=http://host.docker.internal:5131 `
  -e PROFILE=smoke `
  -v "${PWD}/tests/load:/scripts" `
  -w /scripts grafana/k6:0.57.0 run login.js
```

### Load test
```bash
k6 run -e PROFILE=load -e RATE=100 -e DURATION=5m tests/load/login.js
```

Sonuçlar `tests/load/results/login-summary.json` dosyasına yazılır.
