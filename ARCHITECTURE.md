# ARCHITECTURE.md
## Sipariş Eşleştirme + Kurye Anlık Takip Sistemi — Mimari Kararlar

> Bu belge, StackShare projesinin temel gereksinimlerinden biridir.
> Her teknoloji seçiminin yanında **neden** sorusunun cevabı ve **trade-off** analizi bulunmaktadır.
> Referans sistem: **Getir** (stackshare.io + iş ilanları üzerinden doğrulanmış stack)

---

## Seçilen Sistem: Getir

Getir, 2015'te Türkiye'de kurulan ultrafast teslimat şirketidir. Temel akışı:
kullanıcı sipariş verir → en yakın kurye eşleştirilir → kurye teslim eder → süreç boyunca konum canlı takip edilir.

Bu MVP, o akışın çalışan minimal bir kopyasıdır.

---

## Getir'in Gerçek Stack'i (Referans)

| Kategori       | Getir'de Kullanılan                        |
|----------------|--------------------------------------------|
| Backend        | Node.js, Java (microservices)              |
| Mobil          | Kotlin (Android), Swift (iOS)              |
| Frontend       | React                                      |
| Veritabanı     | MongoDB                                    |
| Cache          | Redis                                      |
| Real-time      | WebSockets                                 |
| Message Queue  | RabbitMQ                                   |
| Arama          | Elasticsearch                              |
| Infra          | AWS, Docker, Kubernetes                    |
| Monitoring     | New Relic                                  |

*Kaynak: Getir mühendislik iş ilanları (welcometothejungle.com) + AWS blog (2024)*

---

## Bizim Stack'imiz ve Gerekçeler

### 1. Backend — .NET Web API (Controller tabanlı)

**Getir'de:** Node.js ve Java microservices
**Bizde:** ASP.NET Core Web API (.NET 9)

**Neden .NET seçtik?**
- VBT'nin kurumsal ürünleri (Heroty, Flerpi, VizyonİK) büyük ihtimalle .NET tabanlı; ekibin bilgi birikimi bu yönde.
- .NET 9 minimal API'ye kıyasla controller tabanlı yapı, büyük projelerde sorumlulukları net ayırır; Swagger entegrasyonu daha temiz çalışır.
- Node.js'in non-blocking I/O avantajı bu ölçekte anlamsız; .NET'in async/await desteği yeterli.

**Trade-off:**
Node.js daha hızlı prototipleme sağlar ve npm ekosistemi geniştir. Ancak tip güvenliği ve kurumsal yapı için .NET daha sağlam bir zemin sunar. TypeScript ile bu fark kapanıyor olsa da takımın mevcut deneyimi belirleyici faktördür.

---

### 2. Veritabanı — PostgreSQL + PostGIS

**Getir'de:** MongoDB
**Bizde:** PostgreSQL 16 + PostGIS extension

**Neden PostgreSQL + PostGIS seçtik?**
- Sipariş verisi doğası gereği ilişkiseldir: müşteri → sipariş → kurye → restoran. JOIN ağırlıklı sorgular için ilişkisel DB çok daha verimli.
- PostGIS, coğrafi sorgular için MongoDB'nin geospatial özelliklerinden çok daha olgun bir ekosisteme sahip. `ST_Distance`, `ST_DWithin`, `ST_Within` gibi fonksiyonlar eşleştirme algoritmasını sade tutar.
- GIST indeksi sayesinde 10 km yarıçap içindeki kurye sorgusu milisaniyeler içinde tamamlanır.

**Trade-off:**
MongoDB yatay ölçekleme ve esnek şema konusunda avantajlıdır; konum geçmişi gibi yapılandırılmamış veriler için daha doğaldır. Ancak MVP ölçeğinde MongoDB'nin bu avantajları anlamsız kalır ve PostgreSQL'in ACID garantisi sipariş durumu geçişleri için kritiktir.

**Coğrafi veri örneği:**
```sql
-- En yakın müsait kuryeyi bul (10 km içinde)
SELECT courier_id, ST_Distance(location, ST_MakePoint(28.9784, 41.0082)::geography) AS distance
FROM couriers
WHERE status = 'available'
  AND ST_DWithin(location, ST_MakePoint(28.9784, 41.0082)::geography, 10000)
ORDER BY distance
LIMIT 1;
```

---

### 3. Cache — Redis

**Getir'de:** Redis
**Bizde:** Redis

**Neden Redis?**
- Kurye konumu saniyede birden fazla güncellenir; bu veri kalıcı depolama gerektirmez, yalnızca "en güncel konum" önemlidir.
- Redis `GEO` komutları (`GEOADD`, `GEODIST`, `GEORADIUS`) konum tabanlı sorgular için tasarlanmıştır.
- SignalR backplane olarak Redis kullanılabilir; birden fazla sunucu instance'ı olduğunda hub mesajları Redis üzerinden senkronize edilir.
- In-memory yapısı sayesinde okuma/yazma gecikmeleri < 1 ms seviyesindedir.

**Trade-off:**
Redis restart durumunda veriyi kaybeder (persistence konfigüre edilmezse). Ancak kurye konum verisi gibi geçici veriler için bu kabul edilebilir; kritik sipariş verisi zaten PostgreSQL'de tutulur.

---

### 4. Real-time İletişim — SignalR

**Getir'de:** WebSockets
**Bizde:** ASP.NET Core SignalR

**Neden SignalR?**
- SignalR, WebSocket üzerinde çalışır; dolayısıyla Getir'in yaklaşımıyla mimari olarak eşdeğerdir.
- Fallback mekanizması vardır: WebSocket desteklenmezse otomatik olarak Server-Sent Events veya Long Polling'e geçer.
- .NET ekosistemiyle native entegrasyon; Hub sınıfları DI container'a dahil edilir.
- Flutter için `signalr_netcore` paketi mevcuttur; ayrı WebSocket implementasyonu yazmak gerekmez.
- Group yönetimi built-in gelir: `Groups.AddToGroupAsync(connectionId, orderId)` ile müşteri sadece kendi siparişinin güncellemelerini alır.

**Trade-off:**
Raw WebSocket daha az abstraction katmanı içerir ve başka dil/platformlara entegrasyon daha kolaydır. Ancak SignalR'ın sağladığı reconnect, group yönetimi ve fallback özellikleri manuel implementasyon maliyetini ortadan kaldırır.

---

### 5. Message Queue — Hangfire (in-process)

**Getir'de:** RabbitMQ
**Bizde:** Hangfire (PostgreSQL backend'li)

**Neden Hangfire?**
- RabbitMQ ayrı bir broker sunucusu gerektirir; Docker ortamında ek container, ek konfigürasyon ve ek operasyonel yük demektir.
- MVP'de async iş ihtiyacı sınırlıdır: eşleştirme retry mekanizması, bildirim gönderimi.
- Hangfire, PostgreSQL'i backend olarak kullanır; ekstra altyapı gerekmez, job takibi dashboard'dan yapılabilir.
- RabbitMQ'ya migration path açıktır: servis arayüzleri değişmeden broker değiştirilebilir.

**Trade-off:**
RabbitMQ, yüksek trafikte çok daha güçlüdür; topic bazlı routing, dead letter queue ve publisher/consumer ayrımı sağlar. Getir ölçeğinde RabbitMQ zorunludur. Ancak MVP'de bu avantajlar gereksiz karmaşıklık yaratır.

---

### 6. Harita — Leaflet + OpenStreetMap

**Getir'de:** Google Maps (tahminen)
**Bizde:** Leaflet.js + OpenStreetMap (web), flutter_map + OpenStreetMap (mobil)

**Neden OpenStreetMap?**
- Google Maps API ücretlidir; MVP için maliyet yaratmaz.
- Leaflet açık kaynaklı, hafif (< 40KB) ve özelleştirilebilir.
- OpenStreetMap Türkiye verileri yeterince güncel ve detaylıdır.
- Flutter tarafında `flutter_map` paketi Leaflet ile benzer API'ye sahiptir; web ve mobil tutarlı davranır.

**Trade-off:**
Google Maps daha iyi trafik verisi, daha güçlü geocoding ve daha detaylı POI bilgisi sunar. Gerçek ürün için Google Maps tercih edilmeli; MVP için OSM yeterlidir.

---

### 7. Frontend — React (Vite)

**Getir'de:** React
**Bizde:** React + Vite

**Neden React?**
- Getir ile aynı teknoloji; mimari eşdeğerlik sağlanmış olur.
- Leaflet entegrasyonu `react-leaflet` ile trivialdir.
- SignalR client (`@microsoft/signalr`) npm paketi olarak gelir; React hook'larıyla kolayca sarmalanır.
- Vite, CRA'ya kıyasla çok daha hızlı geliştirme ortamı sunar.

---

### 8. Mobil — Flutter

**Getir'de:** Kotlin + Swift (native)
**Bizde:** Flutter (Dart)

**Neden Flutter?**
- Tek codebase ile Android ve iOS; iki geliştirici yerine bir geliştirici yeter.
- `signalr_netcore` paketi ile SignalR entegrasyonu mümkün.
- `flutter_map` ile OpenStreetMap harita desteği.
- Getir'in native yaklaşımı performans ve platform API erişimi açısından üstündür; ancak MVP ölçeğinde bu fark kullanıcı tarafından hissedilmez.

---

### 9. Kimlik Doğrulama — JWT (ASP.NET Core Identity)

**Neden JWT?**
- Stateless: sunucu session tutmaz, yatay ölçekleme kolaylaşır.
- Mobil ve web aynı token mekanizmasını kullanır; ayrı session yönetimi gerekmez.
- ASP.NET Core Identity ile out-of-the-box entegrasyon; rol bazlı yetkilendirme `[Authorize(Roles = "courier")]` ile trivialdir.

---

### 10. Medya Depolama — Cloudinary (Client-side Upload)

**Yemeksepeti/Getir'de:** AWS S3 + CloudFront CDN (presigned URL pattern)
**Bizde:** Cloudinary (unsigned upload → URL DB'ye kaydedilir)

**Neden Cloudinary seçtik?**
- Restoran logoları ve menü görselleri backend'e hiç uğramıyor; resim dosyası direkt Cloudinary'e gidiyor, backend sadece dönen URL'yi kaydediyor.
- Sıfır altyapı maliyeti: ayrı bir S3 bucket, IAM role veya CDN konfigürasyonu gerekmez.
- Cloudinary otomatik CDN üzerinden global dağıtım yapar; görsel URL'sine parametre ekleyerek anında resize/compress mümkündür (`w_200,h_200,c_fill`).
- Ücretsiz planda 25 GB bant genişliği ve 25 GB depolama — MVP ölçeği için yeterli.

**Mevcut akış:**
```
Kullanıcı logo seçer
    │
    │  Frontend → Cloudinary API'ye direkt POST (unsigned upload preset)
    ▼
Cloudinary
    │  secure_url döner (https://res.cloudinary.com/...)
    ▼
Frontend → PATCH /api/restaurants/mine  { logoUrl: "https://res.cloudinary.com/..." }
    │
    ▼
PostgreSQL'e URL kaydedilir
```

**Büyük ölçekte (Yemeksepeti/Getir) nasıl yapılır?**
```
Kullanıcı logo seçer
    │
    │  Frontend → Backend'e "upload izni ver"
    ▼
Backend → S3'e presigned URL üret (5 dakika geçerli) → Frontend'e döner
    │
    │  Frontend → Direkt S3'e PUT (backend yük almaz)
    ▼
S3 → CloudFront CDN üzerinden serve edilir
    │
Frontend → Backend'e "URL şu" der → DB'ye kaydedilir
```

**Neden bu pattern tercih ediliyor?**
- Backend hiçbir zaman dosya byte'larını işlemiyor → bant genişliği ve bellek tasarrufu.
- CDN sayesinde görsel dünya genelinde düşük latency ile servis ediliyor.
- Presigned URL: sadece yetkili kullanıcı upload yapabiliyor, güvenlik backend kontrolünde kalıyor.

**Mevcut yapının zayıf noktası:**
Unsigned upload preset herkese açık — preset adı bilinen biri teorik olarak bu hesaba upload yapabilir. Gerçek ürüne taşırken backend presigned URL pattern'ine geçilmeli.

**Migration path (ilerisi için):**
| Aşama | Yapı |
|---|---|
| Şu an (MVP) | Cloudinary unsigned upload |
| Güvenlik öncelikli | Cloudinary signed upload — backend token üretir |
| Maliyet/kontrol öncelikli | AWS S3 + CloudFront + presigned URL |
| Tam bağımsızlık | MinIO (self-hosted S3 uyumlu) + kendi CDN |

---

### 11. CI/CD — GitHub Actions

**Getir'de:** Kubernetes + AWS (tahminen)
**Bizde:** GitHub Actions

**Pipeline adımları:**
1. `dotnet build` → derleme hatası kontrolü
2. `dotnet test` → unit testler
3. Docker image build
4. (Opsiyonel) Railway veya Render'a otomatik deploy

---

## Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  React Web   │  │ Flutter Mobil│  │  Admin/Restoran  │  │
│  │  (Leaflet)   │  │ (flutter_map)│  │  Paneli (React)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼────────────────┼───────────────────┼─────────────┘
          │ REST + SignalR  │ REST + SignalR     │ REST
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER (.NET 9)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Orders    │  │   Couriers   │  │    Auth/Users     │  │
│  │ Controller  │  │  Controller  │  │    Controller     │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                │                    │             │
│  ┌──────▼──────┐  ┌──────▼───────┐            │             │
│  │  Matching   │  │  Location    │            │             │
│  │  Service    │  │  Service     │            │             │
│  └──────┬──────┘  └──────┬───────┘            │             │
│         │                │                    │             │
│  ┌──────▼────────────────▼────────────────────▼──────────┐  │
│  │                   SignalR Hub                          │  │
│  │           (OrderHub / LocationHub)                     │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  ┌──────────────────────┐      ┌───────────────────────┐   │
│  │  PostgreSQL + PostGIS│      │         Redis         │   │
│  │  - orders            │      │  - courier:location   │   │
│  │  - couriers          │      │  - signalr backplane  │   │
│  │  - users             │      │  - rate limit counter │   │
│  │  - courier_locations │      └───────────────────────┘   │
│  │  (GIST index)        │                                   │
│  └──────────────────────┘                                   │
│                                                             │
│  ┌──────────────────────┐                                   │
│  │  Hangfire (jobs)     │                                   │
│  │  - matching retry    │                                   │
│  │  - notifications     │                                   │
│  └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Veri Akışı — Anlık Kurye Takibi

```
Kurye (Flutter/GPS)
    │
    │ POST /api/couriers/location  (her 3 saniyede bir)
    ▼
Location Service
    │
    ├── PostgreSQL'e yaz (courier_locations tablosu)
    │
    ├── Redis'e yaz (courier:{id}:location — TTL: 30sn)
    │
    └── SignalR Hub'a bildir
            │
            └── order:{orderId} grubundaki tüm istemcilere push
                    │
                    ├── React Web → Leaflet marker güncelle
                    └── Flutter Mobil → flutter_map marker güncelle
```

---

## Veri Akışı — Sipariş Eşleştirme

```
Müşteri
    │
    │ POST /api/orders  (sipariş oluştur)
    ▼
Orders Controller
    │
    └── Sipariş DB'ye yazılır (status: pending)
            │
            └── Matching Service tetiklenir (Hangfire job)
                    │
                    └── PostGIS ST_DWithin ile 10km içinde
                        müsait kurye sorgulanır
                            │
                            ├── Kurye bulundu:
                            │       sipariş status → assigned
                            │       kurye status → busy
                            │       SignalR → kuryeye atama bildirimi
                            │       SignalR → müşteriye bildirim
                            │
                            └── Kurye bulunamadı:
                                    60 saniye bekle → retry
                                    (max 3 deneme, sonra status: failed)
```



---

## Kritik Trade-off Özeti

| Karar | Alternatif | Neden Bu? |
|-------|-----------|-----------|
| PostgreSQL | MongoDB | İlişkisel veri + PostGIS coğrafi sorgular |
| SignalR | Raw WebSocket | Fallback, group yönetimi, .NET native |
| Hangfire | RabbitMQ | MVP için sıfır operasyonel yük |
| Redis | In-memory cache | Distributed lock, SignalR backplane, GEO komutları |
| Flutter | Kotlin+Swift | Tek codebase, MVP ölçeği için yeterli |
| .NET | Node.js | VBT ekosistemi, tip güvenliği, ACID ihtiyacı |
| OSM+Leaflet | Google Maps | Ücretsiz, MVP için yeterli |
| JWT | Session | Stateless, mobil+web aynı mekanizma |
| Cloudinary | AWS S3 + CDN | Sıfır altyapı, CDN dahil, MVP için yeterli — presigned URL pattern'ine migration path açık |

---

## Üretim Kalitesi: Distributed Systems Patterns

Bu MVP, gerçek bir üretim sisteminde karşılaşılan sorunlara somut çözümler içerir.

### 1. Race Condition → Distributed Lock + Optimistic Concurrency

**Problem**: Paralel iki eşleştirme isteği aynı kuryeye çift atama yapabilir.

**Çözüm**: Redis `SET NX` kilit + transaction içinde `freshCourier.Status` çift kontrol.

```
İstek 1 & İstek 2 → MatchingService
    │
    ├── Redis SET NX "matching:order:{id}" [LockExpiry=15sn]
    │   ├── İstek 1: ALINDI → DoFindAndAssign çalışır
    │   └── İstek 2: false → "sipariş zaten işleniyor" loglanır
    │
    └── İstek 1 → Transaction
            ├── freshCourier = DB'den yeniden çek (Status=Available?)
            ├── Evet → Assign + Commit ✓
            └── Hayır → Rollback + retry (başka thread Busy yapmış)
```

### 2. Guaranteed Event Delivery → Outbox Pattern

**Problem**: `order.Status = Delivered` DB'ye yazıldı, SignalR bildirimi sırasında restart → bildirim kaybolur.

**Çözüm**: Aynı transaction içinde `OutboxEvents` tablosuna da yaz. Hangfire her 5sn işler.

```
UpdateStatusAsync() → aynı transaction
    ├── order.Status = Delivered       ─┐
    ├── courier.Status = Available      ├── COMMIT (atomik)
    └── OutboxEvent { ... }            ─┘
                │
    OutboxProcessor (Hangfire, 5sn)
                ├── SignalR.SendAsync() → Başarı: ProcessedAt = Now
                └── Hata: RetryCount++ → max 5 → dead letter
```

"En az bir kez teslim" (at-least-once delivery) garantisi.

### 3. Graceful Degradation → Polly Resilience

**Problem**: Redis down → tüm API 500.

**Çözüm**: `ResilientDistributedCache` — Polly üç katman: Timeout → CircuitBreaker → Retry.

```
Cache.GetAsync(key)
    ├── Timeout(2s)           → aşılırsa TimeoutRejectedException
    ├── CircuitBreaker        → 3 hata/3sn → 30sn "open" (Redis'e gidilmez)
    └── Retry(3x exponential) → 100ms → 200ms → 400ms
            │
            ├── Başarı → normal akış
            └── Tümü başarısız → null döner (cache miss)
                                 → çağıran DB'den okur
```

### 4. Feature Flags → Kademeli Rollout

**Problem**: Yeni algoritma direkt %100'e açılırsa sorun çıkınca tüm kullanıcı etkilenir.

**Çözüm**: Deterministik SHA256 hash ile bucket sistemi.

```
bucket = SHA256(userId + "new_matching_algorithm") % 100
RolloutPercentage = 10 → bucket < 10: açık  (%10 kullanıcı)
                         bucket ≥ 10: kapalı (%90 kullanıcı)
```

Aynı kullanıcı her zaman aynı bucket → tutarlı deneyim.
Admin paneli: `PUT /api/admin/feature-flags/{name}`

### 5. Correlation ID → Baştan Sona İz

Her log satırında `CorrelationId` taşınır. Hata response'unda da dönüyor:

```json
{ "status": 404, "message": "Sipariş bulunamadı", "correlationId": "a1b2c3d4" }
```

Seq'te `CorrelationId = 'a1b2c3d4'` filtresiyle o isteğe ait tüm satırlar görünür.

### 6. Rate Limiting → Gateway Katmanı

4 ayrı politika, controller'dan bağımsız middleware seviyesinde:

| Politika | Limit | Kapsam |
|----------|-------|--------|
| `auth` | 10 istek/dakika | IP bazlı — brute-force koruması |
| `orders` | 5 istek/dakika | Kullanıcı bazlı |
| `location` | 20 istek/dakika | Kullanıcı bazlı |
| `api` | 100 istek/dakika | IP bazlı — genel koruma |

Mikroservise geçişte attribute'ları kaldırıp YARP/Kong'a taşımak yeterli.

---

## Ölçek, Test Otomasyonu ve Kubernetes

API `1.0.0` SemVer sürümüyle derlenir; `/api/meta/version` çalışan backend ve
framework sürümünü, `/health/live` process sağlığını, `/health/ready` ise
PostgreSQL + Redis hazırlığını bildirir.

"1 milyon kullanıcı" doğrulanmamış bir kapasite iddiası olarak değil, k6 ile
tekrarlanabilir toplam 1.000.000 login iterasyonu olarak modellenmiştir.
Smoke/load/million profilleri, p95/p99 latency ve hata oranı eşikleri
`tests/load` altında bulunur.

Kubernetes manifestleri API'yi en az 3 replica ile, rolling update,
readiness/liveness probe, resource limit, PodDisruptionBudget ve 3–20 pod HPA
ile çalıştırır. PostgreSQL ile Redis production ortamında yönetilen servis,
uygulama pod'ları ise stateless kabul edilir.

Detaylı sistem mühendisliği ve ölçüm planı:
[docs/ENGINEERING.md](./docs/ENGINEERING.md)

---

## Zero-Downtime Deployment Stratejileri

### Mevcut: Rolling Update

k3s manifestlerinde `maxUnavailable: 0, maxSurge: 1` ile yapılandırılmış.
Yeni pod readiness probe'u geçmeden eski pod kapatılmaz — kullanıcı kesinti görmez.

```
v1 v1 v1          (başlangıç, 3 pod)
v1 v1 v1 v2       (yeni pod eklendi — maxSurge: 1)
v1 v1    v2       (eski bir pod kaldırıldı — maxUnavailable: 0 ile sadece ready olanlar gider)
v1    v2 v2
   v2 v2 v2       (tamamlandı)
```

**Trade-off:** Deploy sırasında v1 ve v2 eşzamanlı çalışır. DB şeması geriye uyumlu
olmalı (expand/contract migration pattern).

---

### Sonraki Adım: Blue-Green Deployment

Rolling update'in yetersiz kaldığı durum: büyük şema değişikliği veya kritik
servis güncellemesi, geri dönüş süresi sıfır olmalı.

```
                    ┌─────────────┐
Internet ──── LB ──►│   BLUE (v1) │ ◄── aktif trafik
                    └─────────────┘
                    ┌─────────────┐
                    │  GREEN (v2) │ ◄── smoke test çalışıyor
                    └─────────────┘
```

**Uygulama:**

```yaml
# blue-deployment.yaml — mevcut stable
metadata:
  name: gotur-api-blue
  labels:
    slot: blue

# green-deployment.yaml — yeni sürüm
metadata:
  name: gotur-api-green
  labels:
    slot: green
```

```bash
# Green hazır, smoke test geçti → trafik green'e al
kubectl patch service gotur-api -p '{"spec":{"selector":{"slot":"green"}}}'

# Sorun çıkarsa anlık geri dön (sıfır downtime)
kubectl patch service gotur-api -p '{"spec":{"selector":{"slot":"blue"}}}'
```

**Getir ölçeğinde:** AWS ALB weighted target groups ile %100 blue → %100 green
geçişi yapılır. Rollback: ALB kuralı güncellenir, pod değiştirilmez.

---

### İleri Adım: Canary Deployment

Risk dağıtımı: yeni sürüm önce küçük bir kullanıcı yüzdesine açılır.

```
Trafik dağılımı:
  %95 → stable (v1)
  %5  → canary  (v2)

Gözlem:
  - Error rate: v1 vs v2 karşılaştır
  - p95 latency: v1 vs v2 karşılaştır
  - İş metrikleri: sipariş tamamlanma oranı

5 dakika sonra:
  Sorun yok → %95 canary'ye taşı
  Sorun var → canary silinir, %100 stable kalır
```

**Traefik ile uygulama:**

```yaml
# TraefikService ile ağırlıklı yönlendirme
apiVersion: traefik.io/v1alpha1
kind: TraefikService
metadata:
  name: gotur-api-canary
spec:
  weighted:
    services:
      - name: gotur-api-stable
        weight: 95
      - name: gotur-api-canary
        weight: 5
```

**Getir'de production kullanımı:** Yeni eşleştirme algoritması, önce %1 trafikte
test edilir. Prometheus/Grafana'da hata oranı ve latency izlenir; eşik aşılmazsa
kademeli olarak %100'e çıkarılır. Bu pattern A/B testing ile de örtüşür.

---

## Read Replica / CQRS-Lite

### Problem

Admin panel sorguları (raporlama, kullanıcı listeleme, sipariş geçmişi) ile
sipariş yazma akışı aynı PostgreSQL instance'ını kullanıyor.

Ağır bir admin raporu çalışırken `POST /api/orders` latency'si artıyor —
okuma yükü yazma yolunu etkiliyor.

### Çözüm: CQRS-Lite (Command Query Responsibility Segregation)

Mimari prensibi: **yazan yol ayrı, okuyan yol ayrı.**

```
┌─────────────────────────────────────────────────────────────┐
│                    COMMAND (Yazma) Yolu                      │
│  POST /api/orders → OrderService → Primary PostgreSQL        │
│  PUT /api/couriers/location → LocationService → Primary      │
│  PATCH /api/orders/:id/status → OrderService → Primary      │
└─────────────────────────────────────────────────────────────┘
                              │
                    Streaming Replication
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    QUERY (Okuma) Yolu                        │
│  GET /api/admin/orders → AdminQueryService → Read Replica    │
│  GET /api/admin/users  → AdminQueryService → Read Replica    │
│  GET /api/restaurants  → RestaurantQuery   → Read Replica    │
└─────────────────────────────────────────────────────────────┘
```

### Uygulama

```csharp
// Program.cs — iki ayrı DbContext
builder.Services.AddDbContext<WriteDbContext>(options =>
    options.UseNpgsql(config["ConnectionStrings:Primary"]));

builder.Services.AddDbContext<ReadDbContext>(options =>
    options.UseNpgsql(config["ConnectionStrings:Replica"])
           .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));
```

`ReadDbContext` için `NoTracking` zorunlu — change tracker devreye girmesin,
read replica'ya yazma denemesi yapılmasın.

### Kubernetes'te Read Replica

```yaml
# configmap.yaml
data:
  ConnectionStrings__Primary: "Host=postgres;Port=5432;..."
  ConnectionStrings__Replica: "Host=postgres-replica;Port=5432;..."
```

MVP'de `postgres-replica` aynı primary'yi gösterir (no-op).
Production'da AWS RDS read replica veya Patroni cluster eklenince
sadece connection string değişir, kod değişmez.

### Trade-off

| | Primary | Read Replica |
|---|---|---|
| Veri tutarlılığı | Anlık | ~millisecond gecikme (eventual) |
| Kullanım | Yazma + kritik okuma | Raporlama, listeleme, admin |
| Maliyet | Yüksek IOPS | Düşük IOPS, daha ucuz instance |

Getir ölçeğinde: yoğun akşam saatlerinde raporlama sorguları primary'yi
etkilemez; sipariş yazma hattı izole kalır.

---

## Saga Pattern — Çok Adımlı İş Akışları

### Problem

Sipariş oluşturma tek bir veritabanı işlemi değil; birden fazla servisi
etkileyen dağıtık bir akış:

```
1. Sipariş oluştur (Orders DB)
2. Stok/kapasite kontrol et (Restaurant Service)
3. Ödeme al (Payment Service)
4. Kurye ata (Matching Service)
5. Bildirim gönder (Notification Service)
```

Bu adımların herhangi birinde hata olursa ne olur?
Adım 3 başarılı (ödeme alındı) ama adım 4 başarısız (kurye yok) →
müşterinin parası alındı ama siparişi yok. Klasik distributed transaction sorunu.

### Choreography Saga (Olay Tabanlı)

Her servis bir olay yayar, diğerleri dinler. Merkezi koordinatör yok.

```
OrderCreated ──────────────────────────────────────────────►
                │                    │                    │
                ▼                    ▼                    ▼
        RestaurantService    PaymentService        MatchingService
        CapacityReserved     PaymentCompleted      CourierAssigned
                │                    │                    │
                ▼                    ▼                    ▼
        CapacityReleased     PaymentRefunded       CourierReleased
        (compensate)         (compensate)          (compensate)
```

**Avantaj:** Servisler birbirini bilmez, loosely coupled.
**Dezavantaj:** Akışı takip etmek zor; "şu an hangi adımdayız?" görünmez.

### Orchestration Saga (Koordinatör Tabanlı)

Merkezi bir Saga Orchestrator tüm adımları yönetir.

```
SagaOrchestrator
    │
    ├─► RestaurantService.ReserveCapacity()
    │       ✓ → devam
    │       ✗ → END (henüz ödeme yok, geri alma kolay)
    │
    ├─► PaymentService.Charge()
    │       ✓ → devam
    │       ✗ → RestaurantService.ReleaseCapacity() [compensate]
    │
    ├─► MatchingService.AssignCourier()
    │       ✓ → devam
    │       ✗ → PaymentService.Refund() [compensate]
    │           RestaurantService.ReleaseCapacity() [compensate]
    │
    └─► NotificationService.Send()
            ✓ → Saga tamamlandı
            ✗ → Sadece loglama (idempotent, retry yeterli)
```

**Avantaj:** Akış merkezi ve görünür; hangi adımda olduğu izlenebilir.
**Dezavantaj:** Orchestrator single point of failure olabilir (HA ile çözülür).

### Mevcut Durumla İlişki

Projedeki `MatchingService` zaten choreography saga'nın basit bir versiyonunu
uyguluyor:

```csharp
// Başarısız eşleştirme → compensating transaction
order.Status = OrderStatus.Failed;
courier.Status = CourierStatus.Available; // geri al
await db.SaveChangesAsync();
```

Gerçek bir saga implementasyonu için:
- **MassTransit Saga StateMachine** (.NET'te de-facto standart)
- **Hangfire** ile state machine'in her adımı job olarak kayıt altında

### Getir Ölçeğinde

Getir'de ödeme, restorana bildirim ve kurye ataması ayrı mikroservisler.
Bu akışı yönetmek için Saga Orchestration pattern ve RabbitMQ/Kafka üzerinden
olay kuyruğu kullanılır. Her adım idempotent yazılır; ağ hatası durumunda
aynı mesaj iki kez işlense de sonuç değişmez.

MVP'de bu karmaşıklık tek servis içinde `try-catch + compensate` olarak
basitleştirilmiştir. Mikroservise geçişte MassTransit StateMachine
doğrudan migration path'i sunar.
