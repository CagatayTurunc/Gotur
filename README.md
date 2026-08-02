# 🛵 Götür — Sipariş Eşleştirme & Kurye Anlık Takip Sistemi

> VBT Yazılım A.Ş. · 2026 Staj Programı · StackShare Replica Projesi
> Referans sistem: **Getir** (stackshare.io + mühendislik iş ilanları üzerinden analiz edildi)

[![Live](https://img.shields.io/badge/Live-gotur.site-success?logo=kubernetes)](https://gotur.site)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## Proje Hakkında

Bu proje, Getir'in sipariş eşleştirme ve kurye anlık takip sisteminin çalışan bir MVP klonudur. Amaç Getir'i birebir kopyalamak değil; **gerçek bir sistemin mühendislik kararlarını okumak, her teknoloji seçiminin trade-off'unu belgelemek ve bu kararları uçtan uca çalışan bir sisteme indirgemekti.**

Getir'in StackShare sayfası, welcometothejungle.com mühendislik iş ilanları ve AWS blog yazıları incelenerek referans stack belirlendi. Her teknoloji seçimi için "neden bu, neden değil" sorusu cevaplandı ve `ARCHITECTURE.md` belgesinde trade-off analizleriyle birlikte dokümante edildi.

### Temel Akışlar

**Sipariş Eşleştirme** — Sipariş oluşturulur → Haversine formülüyle en yakın müsait kurye hesaplanır → Distributed lock altında atomik atama gerçekleşir → Durum makinesi `Pending → ReadyForPickup → Assigned → Picked → Delivered` üzerinden ilerler.

**Anlık Kurye Takibi** — Kuryenin GPS konumu 3 saniyede bir API'ye iletilir → Redis'e yazılır → SignalR üzerinden tüm bağlı istemcilere push edilir → Leaflet haritasında marker animasyonlu güncellenir.

---

## Stack ve Getir ile Karşılaştırma

| Katman | Getir'de | Götür'de | Neden farklı? |
|--------|----------|----------|---------------|
| Backend | Node.js, Java | ASP.NET Core 9 | Kurumsal ekosistem, tip güvenliği, ACID garantisi |
| Veritabanı | MongoDB | PostgreSQL + JSONB | İlişkisel veri yapısı, JOIN ağırlıklı sorgular |
| Real-time | WebSockets | SignalR (WebSocket) | Fallback mekanizması, grup yönetimi, .NET native |
| Cache / Lock | Redis | Redis ✓ | Aynı seçim — konum cache, distributed lock, backplane |
| Message Queue | RabbitMQ | Hangfire | MVP ölçeği için sıfır ek operasyonel yük |
| Frontend | React | React + Vite + Tailwind | Aynı — Vite ile çok daha hızlı geliştirme ortamı |
| Harita | Google Maps | Leaflet + OpenStreetMap | Ücretsiz, açık kaynak, MVP için yeterli |
| Mobil | Kotlin + Swift | Flutter | Tek codebase ile Android ve iOS |
| Medya | S3 + CloudFront | Cloudinary | Sıfır altyapı, CDN dahil, presigned URL'e migration hazır |
| Tracing | — | OpenTelemetry → Jaeger | Distributed trace, EF Core sorguları dahil |
| Logging | — | Serilog + Seq | Structured, CorrelationId zincirli |
| Metrics | New Relic | Prometheus + Grafana | Otomatik provisioned dashboard |
| Infra | AWS + Kubernetes | Docker Compose + k3s | Local geliştirme + production deploy |

---

## Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│   React Web (Leaflet)    Flutter Mobil    Admin Paneli      │
└──────────────────────┬───────────────────────┬──────────────┘
                       │ REST + SignalR         │
                       ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    ASP.NET Core 9 Web API                   │
│  OrdersController  CouriersController  AdminController      │
│  AuthController    RestaurantsController  ReviewsController │
│       │                       │                             │
│  MatchingService         LocationService                    │
│  (Haversine + Lock)      (Redis + SignalR)                  │
│       │                       │                             │
│          SignalR TrackingHub (order:{id} / courier:{id})    │
└──────────────────────┬───────────────────────┬──────────────┘
                       │                        │
               PostgreSQL + JSONB             Redis
               EF Core Migrations         (Konum, Lock,
               Outbox, FeatureFlags        Rate limit,
               Soft Delete                 Backplane)
                       │
                    Hangfire
               (Outbox Processor,
                Retry jobs)
```

---

## Üretim Kalitesi Patterns

### 1 · Distributed Lock + Optimistic Concurrency

**Problem:** Aynı siparişe iki paralel eşleştirme isteği aynı kuryeye çift atama yapabilir.

**Çözüm:** İki katmanlı koruma. İlk katman — `MatchingService.FindAndAssignCourierAsync` içinde Redis `SET NX` ile sipariş bazlı kilit alınır; ikinci istek kilidi alamayınca geri döner. İkinci katman — lock altında kurye `DbContext`'ten taze çekilerek `Status == Available` çift kontrol edilir. Bu aşamada başka bir thread kuryeyi `Busy` yapmışsa transaction rollback yapılır, retry zamanlanır.

```csharp
var executed = await _lockService.ExecuteWithLockAsync(
    $"matching:order:{orderId}",
    LockExpiry,
    async () => result = await DoFindAndAssignAsync(orderId));
```

### 2 · Outbox Pattern — Guaranteed Event Delivery

**Problem:** `order.Status = Delivered` DB'ye yazıldı, tam o sırada restart oldu. SignalR bildirimi kayboldu, müşteri hiç haberdar olmadı.

**Çözüm:** Sipariş durum geçişlerinde aynı transaction içine `OutboxEvent` kaydı da yazılır. `OutboxProcessor` (Hangfire job, her 5 sn) işlenmemiş event'leri bulur, SignalR'a iletir, `ProcessedAt` damgası basar. Restart sonrası bile event'ler `ProcessedAt IS NULL` partial index üzerinden bulunup işlenir. **En az bir kez teslim garantisi.**

```csharp
// AppDbContext'te partial index
e.HasIndex(o => o.ProcessedAt)
 .HasFilter("\"ProcessedAt\" IS NULL");
```

### 3 · Polly Resilience Pipeline — Graceful Degradation

**Problem:** Redis down → tüm API 500 döner, sistem çöker.

**Çözüm:** `ResilientDistributedCache` — `IDistributedCache` decorator'ı. Polly'nin üç katmanlı pipeline'ı (dıştan içe): `Timeout(2s) → CircuitBreaker(30s, hata oranı > %50) → Retry(3x exponential: 100ms→200ms→400ms)`. Tüm stratejiler başarısız olursa `null` döner — cache miss gibi davranır, çağıran DB'den okur. `BrokenCircuitException` yakalanınca Redis'e hiç gidilmez, overhead sıfır.

### 4 · Idempotency Middleware

**Problem:** Mobil ağ kopar, kullanıcı "Sipariş Ver" butonuna iki kez basar → iki sipariş oluşur.

**Çözüm:** `POST /api/orders` için `Idempotency-Key` header'ı. İlk istek işlenince response Redis'e 24 saat TTL ile yazılır. Aynı key ile gelen ikinci istek, DB'ye hiç dokunmadan cache'deki response'u `X-Idempotent-Replayed: true` header'ı ile döner. Stripe ve PayPal'ın kullandığı pattern.

### 5 · Feature Flags — Kademeli Rollout

**Problem:** Yeni eşleştirme algoritması direkt %100'e açılırsa sorun çıkınca tüm kullanıcı etkilenir.

**Çözüm:** `FeatureFlagService` — DB'den flag yükler, Redis'te cache'ler. Deterministik SHA256 hash ile bucket sistemi: `SHA256(userId + flagName) % 100 < rolloutPercentage → açık`. Aynı kullanıcı her zaman aynı bucket'a düşer, tutarlı deneyim. Admin paneli üzerinden canlıda `rolloutPercentage` güncellenir.

### 6 · Rate Limiting

Dört ayrı politika, controller'dan bağımsız middleware seviyesinde:

| Politika | Limit | Kapsam |
|----------|-------|--------|
| `auth` | 10 istek/dakika | IP bazlı — brute-force koruması |
| `orders` | 5 istek/dakika | Kullanıcı bazlı |
| `location` | 20 istek/dakika | Kullanıcı bazlı |
| `api` | 100 istek/dakika | IP bazlı — genel |

Mikroservise geçişte attribute'ları kaldırıp YARP/Kong'a taşımak yeterli.

### 7 · Correlation ID Zinciri

`CorrelationIdMiddleware` her isteğe `X-Correlation-ID` atar, tüm Serilog log satırlarında taşınır. Hata response'larında da görünür:

```json
{ "status": 404, "message": "Sipariş bulunamadı", "correlationId": "a1b2c3d4" }
```

Seq'te `CorrelationId = 'a1b2c3d4'` filtresiyle o isteğe ait tüm log satırları anlık listelenir.

---

## Veritabanı Şeması

EF Core 9 code-first migrations, 15 migration dosyasıyla evrildi. JSONB kolon, soft delete query filter, check constraint, partial index, composite unique index gibi PostgreSQL'e özgü özellikler kullanıldı.

```
AppUser ──(1:1)──► Courier
AppUser ──(1:1)──► Restaurant
AppUser ──(1:N)──► Order          (customerId)
Restaurant ──(1:N)──► Order
Restaurant ──(1:N)──► MenuItem
Restaurant ──(1:N)──► Favorite
Restaurant ──(1:N)──► Review
Courier ──(1:N)──► Order
Courier ──(1:N)──► CourierLocationHistory
Order ──(1:N)──► CourierLocationHistory
Order ──(1:N)──► OutboxEvent      (TargetGroup)
FeatureFlag                       (name unique index)
Category ──(1:N)──► MenuItem
```

Öne çıkan konfigürasyonlar:
- `Order.ItemsJson` → JSONB kolon, hem esneklik hem indekslenebilirlik
- `AppUser` → soft delete global query filter (`HasQueryFilter(u => !u.IsDeleted)`)
- `Review` → DB seviyesinde `CHECK (Rating >= 1 AND Rating <= 5)` constraint
- `Favorite` → `(UserId, RestaurantId)` composite unique index — bir kullanıcı aynı restoranı bir kez favorileyebilir
- `FeatureFlag.Name` → unique index, `Description` max 500 karakter

---

## Backend — Controller & Servis Yapısı

```
Controllers/
├── AuthController.cs          — JWT register/login/me, Google OAuth, şifre sıfırlama
├── OrdersController.cs        — Sipariş yaşam döngüsü, durum makinesi, idempotency
├── CouriersController.cs      — Konum güncelleme, aktif sipariş, durum geçişleri
├── AdminController.cs         — Tüm siparişler, kurye yönetimi, feature flag CRUD
├── RestaurantsController.cs   — Restoran CRUD, menü yönetimi, logo upload
├── MenuItemsController.cs     — Menü kalemleri ve kategori eşleştirme
├── CategoriesController.cs    — Kategori CRUD
├── FavoritesController.cs     — Favoriye ekle/çıkar, liste, durum kontrolü
├── ReviewsController.cs       — Yorum ve puan sistemi, sipariş doğrulama
└── RestaurantApplicationsController.cs — Restoran başvuru akışı

Services/
├── MatchingService.cs         — Haversine + distributed lock + feature flag
├── LocationService.cs         — Redis cache + rate limit + SignalR publish
├── OrderService.cs            — Durum makinesi + outbox transaction
├── OutboxProcessor.cs         — Hangfire job, SignalR guaranteed delivery
├── FeatureFlagService.cs      — %X rollout, Redis cache, SHA256 bucket
├── RedisDistributedLockService.cs — SET NX tabanlı dağıtık kilit
├── TokenService.cs            — JWT üretim
└── SmtpEmailService.cs        — Şifre sıfırlama maili (MailKit)

Middleware/
├── CorrelationIdMiddleware.cs — X-Correlation-ID zinciri
├── IdempotencyMiddleware.cs   — Duplicate request koruması
└── ExceptionMiddleware.cs     — Global hata yakalama, tutarlı hata formatı

Extensions/
├── JwtExtensions.cs           — JWT authentication pipeline
├── ResilienceExtensions.cs    — Polly pipeline + IDistributedCache decorator
├── RateLimitingExtensions.cs  — 4 politika, gateway katmanı
├── OpenTelemetryExtensions.cs — Distributed tracing, custom ActivitySource
└── SecretsExtensions.cs       — Startup secret doğrulama, env variable zinciri
```

---

## React Frontend

Vite + TypeScript + Tailwind CSS ile geliştirildi. Dark/Light theme, Google OAuth, animasyonlu Leaflet harita, gerçek zamanlı SignalR hook ve Nominatim tabanlı adres seçici içeriyor.

```
src/
├── pages/
│   ├── HomePage.tsx        — Restoran listeleme, Haversine mesafe filtresi, auth modal
│   ├── RestaurantDetailPage.tsx — Menü, kategori, sepet, yorumlar, favoriler
│   ├── CheckoutPage.tsx    — Adres seçimi, sipariş onaylama, idempotency key üretimi
│   ├── TrackingPage.tsx    — Canlı harita, SignalR konum, animasyonlu marker
│   ├── CourierPage.tsx     — Leaflet harita, GPS/Simülatör, sipariş durum güncelleme
│   ├── AdminPage.tsx       — Sipariş yönetimi, kurye tablosu, feature flag paneli
│   ├── RestaurantPage.tsx  — Aktif siparişler, menü yönetimi
│   ├── OrdersPage.tsx      — Sipariş geçmişi, durum takibi
│   └── ...static pages     — KVKK, Gizlilik, SSS, İletişim, Çerez Politikası
├── components/
│   ├── Navbar.tsx          — Sticky header, kullanıcı menüsü, adres seçici
│   ├── AddressPickerModal  — Nominatim geocoding, harita ile konum seçimi
│   └── ThemeToggle.tsx     — Dark/Light mod
├── hooks/
│   └── useSignalR.ts       — HubConnectionBuilder, otomatik reconnect, event listener
├── services/
│   ├── api.ts              — Axios instance, JWT interceptor
│   ├── authService.ts      — Login/register/Google OAuth/forgotPassword
│   ├── favoriteService.ts  — Favori CRUD, durum kontrolü
│   └── reviewService.ts    — Yorum CRUD, yorum yapma hakkı kontrolü
└── context/
    └── AddressContext.tsx  — Global adres state
```

Kurye sayfasında GPS takibi ve simülatör aynı interface üzerinden yönetiliyor — gerçek `navigator.geolocation.watchPosition` veya `setInterval` ile sahte konum üretimi:

```typescript
const startSim = () => {
  simRef.current = setInterval(() => {
    simPosRef.current = {
      lat: simPosRef.current.lat + (Math.random() - 0.5) * 0.001,
      lng: simPosRef.current.lng + (Math.random() - 0.5) * 0.001,
    }
    sendLocation(simPosRef.current.lat, simPosRef.current.lng)
  }, 3000)
}
```

Yorum sistemi, Yemeksepeti mantığıyla çalışıyor: `GET /api/reviews/restaurant/{id}/can-review` endpoint'i kullanıcının o restorana yorum yapıp yapamayacağını döner — teslim edilmiş sipariş + daha önce yorum yazmamış olma koşulu aranıyor.

---

## Flutter Mobil

Aynı REST API ve SignalR endpoint'lerini tüketiyor. `flutter_map` + OpenStreetMap ile harita, `signalr_netcore` ile gerçek zamanlı konum takibi, `flutter_secure_storage` ile JWT saklama. `flutter analyze` → 0 uyarı, 0 hata.

---

## Gözlemlenebilirlik Stack'i

Üç ayak: **Metrics + Distributed Tracing + Structured Logging.**

```bash
# Tüm stack bir arada
docker compose \
  -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.logging.yml up -d
```

| Araç | Adres | Ne sağlıyor |
|------|-------|-------------|
| Grafana | `:3001` | Throughput, p50/p95/p99 latency, 5xx oranı, GC, CPU, heap memory |
| Prometheus | `:9090` | API `/metrics` scrape, PromQL sorguları |
| OpenTelemetry → Jaeger | — | Her isteğe trace-id, EF Core sorguları dahil, custom `MatchingService` span |
| Seq | `:5341` | `CorrelationId = 'x'` ile anlık log filtreleme |
| Hangfire | `:5131/hangfire` | Outbox işlemleri, retry geçmişi |

Grafana dashboard **otomatik provisioning** ile gelir — elle import gerekmez.

---

## CI/CD Pipeline

```
Push → main / develop
    ├── Backend: dotnet restore → dotnet build --Release → dotnet test
    ├── Frontend: npm ci → tsc --noEmit → npm run build → artifact upload
    ├── k6 Login Smoke Test: Docker Compose (PostgreSQL + Redis + API) → gerçek ortamda test
    └── Docker: API image + Frontend image → GHCR push (SHA tag + latest)
                    │
                    └── Deploy to Production (sadece main)
                            SSH → git pull → kubectl rollout restart
                            → rollout status (120s timeout)
```

**VITE_GOOGLE_CLIENT_ID** CI'da build-arg olarak geçiliyor — frontend image içine derleme aşamasında gömülüyor. Sırlar Kubernetes Secret'lardan pod'a env variable olarak enjekte ediliyor.

---

## Kubernetes — AWS EC2 + k3s

```bash
kubectl apply -k infra/k8s/
```

- Rolling update — `maxUnavailable: 0, maxSurge: 1`, sıfır downtime
- HPA — 3 → 20 pod arası otomatik ölçekleme (CPU %70 eşiği)
- `PodDisruptionBudget`, readiness/liveness probe
- `ConfigMap + Secret` ayrımı — bağlantı stringleri Kubernetes Secret olarak enjekte edilir
- **EF Core migration bundle** Dockerfile build aşamasında derleniyor, API pod'u başlamadan önce **init container** olarak migration'ları uyguluyor — sıfır manuel müdahale
- Aynı YAML manifestler local k3s ve production'da çalışır — sadece kubeconfig değişir

---

## Yük Testleri — k6

Üç profil: `smoke` (hızlı sağlık kontrolü), `load` (sabit yük), `million` (1.000.000 toplam login iterasyonu).

```bash
k6 run -e PROFILE=load -e RATE=250 -e DURATION=10m tests/load/login.js
```

**SLO eşikleri:** p95 < 500ms · p99 < 1sn · hata oranı < %1

---

## Chaos Testing — Graceful Degradation Kanıtı

| Senaryo | Beklenen | Doğrulandı |
|---------|----------|------------|
| Redis down | Cache miss → DB fallback, API çalışmaya devam | ✅ |
| PostgreSQL down | `/health/ready` → 503, açıklayıcı hata mesajı | ✅ |
| API restart + Outbox | Event'ler DB'de bekler, restart sonrası işlenir | ✅ |
| Paralel eşleştirme (race) | Çift atama yok, distributed lock devrede | ✅ |
| Rate limit aşımı | 429 + `Retry-After` header | ✅ |
| Idempotency — çift istek | İkinci istek `X-Idempotent-Replayed: true` ile döner | ✅ |

---

## Kurulum

```bash
# Tüm servisler (PostgreSQL, Redis, API, Frontend)
docker compose up -d

# API Swagger  → http://localhost:5131/swagger
# Frontend     → http://localhost:3000
# Hangfire     → http://localhost:5131/hangfire
```

### Test Hesapları

| Rol | Email | Şifre |
|-----|-------|-------|
| Müşteri | ahmet.yilmaz@gotur.com | Test123! |
| Kurye (İstanbul) | kurye.istanbul1@gotur.com | Test123! |
| Kurye (Ankara) | kurye.ankara1@gotur.com | Test123! |
| Restoran | karadeniz.mangal@gotur.com | Test123! |
| Admin | admin@gotur.com | Admin123! |

---

## Proje Yapısı

```
getir-replica/
├── backend/GetirReplica.API/
│   ├── Controllers/        (10 controller)
│   ├── Services/           (15 servis, interface + implementasyon)
│   ├── Middleware/         (Correlation, Idempotency, Exception)
│   ├── Extensions/         (JWT, Polly, Rate Limit, OTel, Secrets)
│   ├── Hubs/               (SignalR TrackingHub)
│   ├── Data/               (AppDbContext, DataSeeder)
│   ├── Migrations/         (15 migration — evrim izlenebilir)
│   ├── Models/             (Entities, DTOs, Enums)
│   └── gotur-web/          (React + Vite + Tailwind)
├── mobile/                 (Flutter)
├── infra/
│   ├── k8s/                (Kubernetes manifestleri)
│   └── monitoring/         (Prometheus + Grafana provisioning)
├── tests/load/             (k6 — smoke/load/million)
├── docs/
│   ├── ARCHITECTURE.md     (Trade-off analizleri)
│   └── CHAOS_TESTING.md    (Graceful degradation senaryoları)
├── docker-compose.yml
├── docker-compose.monitoring.yml
└── docker-compose.logging.yml
```

---

## Teşekkür

Bu değerli fırsatı bize sunan Sayın Birol Başaran'a, süreç boyunca desteklerini esirgemeyen Sayın Bektaş Baysal'a ve proje geliştirme sürecindeki değerli mentörlüğü için Sayın Veli Bacık'a teşekkür ederim.

---

*VBT Yazılım A.Ş. · Staj 2026*
