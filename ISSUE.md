# 🛵 Götür — Sipariş Eşleştirme & Kurye Anlık Takip Sistemi (StackShare Replica)

## Proje Hakkında

Getir'in sipariş eşleştirme ve kurye anlık takip sisteminin çalışan MVP klonu.
Amaç; büyük bir sistemin mimari kararlarını StackShare üzerinden analiz etmek,
her teknoloji seçiminin trade-off'unu belgelemek ve uçtan uca çalışan bir sistem inşa etmektir.

📁 Repo: https://github.com/CagatayTurunc/Gotur
📹 Demo: (eklenecek)
📄 Mimari Analiz: [ARCHITECTURE.md](https://github.com/CagatayTurunc/Gotur/blob/main/ARCHITECTURE.md)

---

## Referans Sistem: Getir (StackShare Analizi)

| Katman | Getir'de | Götür'de | Neden farklı? |
|--------|----------|----------|----------------|
| Backend | Node.js, Java | ASP.NET Core 9 | Kurumsal ekosistem, tip güvenliği |
| Veritabanı | MongoDB | PostgreSQL + JSONB | İlişkisel veri + coğrafi sorgular |
| Real-time | WebSocket | SignalR (WebSocket üstünde) | .NET native, fallback, grup yönetimi |
| Cache | Redis | Redis ✓ | Aynı — konum cache, rate limit, backplane |
| Message Queue | RabbitMQ | Hangfire | MVP ölçeği için sıfır operasyonel yük |
| Mobil | Kotlin + Swift | Flutter | Tek codebase, aynı API |
| Harita | Google Maps | Leaflet + OpenStreetMap | Ücretsiz, MVP için yeterli |
| Infra | AWS + Kubernetes | Docker Compose + K8s manifestleri | Local geliştirme ve ölçeklenebilir deployment |

---

## Gerçekleştirilen Teknik Özellikler

### 🔴 Real-time Sistem
- **SignalR Hub** — `order:{id}` ve `courier:{id}` grupları
- Kurye GPS konumu 3 saniyede bir tüm bağlı istemcilere broadcast
- **Redis backplane** — çoklu sunucu instance desteği (horizontal scaling hazır)
- Konum timeout detection (30sn) → istemciye `LocationTimeout` eventi

### 🔴 Sipariş Eşleştirme Algoritması
- **Haversine formülü** ile 10km yarıçap içinde en yakın müsait kurye
- Stale konum filtresi — 5 dakikadan eski konumlu kurye eşleştirmeye dahil edilmez
- **Hangfire** ile otomatik retry (60sn × 3 deneme → Failed)
- Transaction içinde atomik atama: sipariş `Assigned`, kurye `Busy`

### 🔴 Redis Kullanımı
- Kurye anlık konumu → `courier:{id}:location` (TTL: 30sn)
- Rate limiting → `courier:{id}:rate` (TTL: 3sn) — 429 Too Many Requests
- SignalR Redis backplane — çoklu instance senkronizasyonu

### 🔴 Durum Makinesi
- `Pending → Assigned → Picked → Delivered`
- `AllowedTransitions` dictionary ile geçiş kontrolü
- Geçersiz geçişler 422 Unprocessable Entity döner
- Her geçişte UTC timestamp ve SignalR bildirimi

### 🔴 Authentication & Authorization
- JWT Bearer token (ASP.NET Core Identity)
- Rol bazlı yetkilendirme: `customer`, `courier`, `restaurant`, `admin`
- SignalR bağlantısında query string token desteği
- Token süresi 8 saat

### 🔴 CI/CD Pipeline (GitHub Actions)
```
Push → main / develop
    ├── Backend: dotnet restore → dotnet build --Release → dotnet test
    ├── Frontend: npm ci → tsc --noEmit → npm run build → artifact upload
    └── Docker: API image build + Frontend image build (sadece main)
```

### 🔴 Veritabanı Tasarımı
- PostgreSQL — JSONB sipariş kalemleri, indexed status & customerId sorguları
- EF Core 9 code-first migrations
- Konum verisi `double precision` lat/lng → PostGIS migration hazır
- `courier_location_history` — aktif teslimat sırasında son 100 konum noktası

### 🔴 API Tasarımı
- RESTful, controller tabanlı ASP.NET Core 9
- Swagger / OpenAPI 3.0 — `/swagger` adresinde
- Global exception middleware — tutarlı hata formatı
- Serilog ile structured logging

---

## Mimari Diyagram

```
┌─────────────────────────────────────────────────┐
│                  CLIENT LAYER                   │
│   React Web (Leaflet)    Flutter Mobile         │
│         │                     │                 │
└─────────┼─────────────────────┼─────────────────┘
          │   REST + SignalR    │
          ▼                     ▼
┌─────────────────────────────────────────────────┐
│            ASP.NET Core 9 Web API               │
│  OrdersController  CouriersController  Auth     │
│       │                  │                      │
│  MatchingService    LocationService             │
│       │                  │                      │
│            SignalR TrackingHub                  │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
   PostgreSQL               Redis
   (orders, couriers,   (konum cache,
    restaurants,         rate limit,
    location history)    signalr backplane)
        │
     Hangfire
  (retry jobs,
   background tasks)
```

---

## Roadmap

- [x] **k6 yük testi altyapısı** — smoke/load/1.000.000 toplam login profili, p95/p99 ve hata eşiği
- [ ] **Prometheus + Grafana** — health metrics ve dashboard
- [x] **Kubernetes manifests** — Deployment, Service, Ingress, HPA, probes ve PDB
- [ ] **Staging kapasite testi** — distributed k6 koşusu ve doğrulanmış sonuç raporu
- [ ] **PostGIS aktifleştirme** — `ST_DWithin` + GIST index
- [ ] **ETA hesaplama** — tahmini teslimat süresi
- [ ] **Email bildirimi** — sipariş durumu değişimlerinde SMTP

---

## Kullanılan Teknolojiler

**Backend:** ASP.NET Core 9 · EF Core 9 · PostgreSQL · Redis · SignalR · Hangfire · JWT
**Frontend:** React · Vite · TypeScript · Tailwind CSS · Leaflet · @microsoft/signalr
**Mobil:** Flutter · Dart · flutter_map · signalr_netcore
**DevOps:** Docker · Docker Compose · GitHub Actions CI/CD · k6 · Kubernetes

---

## Ekip

| İsim | Rol | Sorumluluk |
|------|-----|------------|
| Çağatay Turunc @CagatayTurunc | Backend · Frontend · DB | API, SignalR, eşleştirme, React UI, CI/CD |
| [İsim 2] @github | Backend · Test | Bildirim sistemi, ETA, yük testi |
| [İsim 3] @github | QA | E2E testler, demo video, dokümantasyon |
| [İsim 4] @github | Mobil | Flutter uygulaması, SignalR entegrasyonu |
