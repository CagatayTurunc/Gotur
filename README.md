# 🛵 Götür — Sipariş Eşleştirme & Kurye Anlık Takip Sistemi

> VBT Yazılım Staj 2026 · StackShare Replica Projesi  
> Referans sistem: **Getir** (stackshare.io + mühendislik iş ilanları)

[![Demo Video](https://img.shields.io/badge/Demo-YouTube-red?logo=youtube)](https://youtube.com/TODO)

---

## 📌 Proje Hakkında

Bu proje, Getir'in sipariş eşleştirme ve kurye anlık takip sisteminin MVP klonudur.  
Amaç ürünü birebir kopyalamak değil; **gerçek bir sistemin mimari kararlarını okumak, anlamak ve uygulanabilir bir parçaya indirgemek**.

### Çekirdek Akışlar
1. **Sipariş Eşleştirme**: Sipariş gelir → en yakın uygun kurye bulunur (Haversine) → kurye kabul eder → durum makinesi (Pending → Assigned → Picked → Delivered)
2. **Anlık Kurye Takibi**: Kuryenin GPS konumu SignalR ile web ve mobil istemcilere gerçek zamanlı iletilir, Leaflet haritasında gösterilir

---

## 🏗️ Mimari

Detaylı trade-off analizleri için → [ARCHITECTURE.md](./ARCHITECTURE.md)

| Katman | Teknoloji | Getir'de Karşılığı |
|--------|-----------|-------------------|
| Backend | ASP.NET Core 8 Web API | Node.js / Java |
| Veritabanı | PostgreSQL + JSONB | MongoDB |
| Real-time | SignalR (WebSocket) | WebSockets |
| Cache | Redis | Redis ✓ |
| Background Jobs | Hangfire | RabbitMQ |
| Frontend | React + Vite + Tailwind | React |
| Harita | Leaflet + OpenStreetMap | Google Maps |
| Mobil | Flutter | Kotlin + Swift |

---

## 🚀 Kurulum

### Ön Koşullar
- [.NET 9 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 1. Veritabanı & Redis (Docker)

```bash
# Mevcut bir PostgreSQL varsa getir_replica DB'si oluştur
docker exec <postgres-container> psql -U postgres -c "CREATE DATABASE getir_replica;"

# Ya da docker-compose ile tümünü başlat
docker-compose up -d postgres redis
```

### 2. Backend

```bash
cd backend/GetirReplica.API

# appsettings.json içindeki connection string'i güncelle
# Default: Host=localhost;Port=5433;Database=getir_replica;Username=postgres;Password=123456

dotnet run
# → http://localhost:5131
# → http://localhost:5131/swagger
# Seed data otomatik yüklenir (admin, müşteri, restoran, 2 kurye)
```

### 3. Frontend

```bash
cd backend/GetirReplica.API/gotur-web

npm install
npm run dev
# → http://localhost:5173
```

---

## 👥 Test Hesapları

| Rol | Email | Şifre |
|-----|-------|-------|
| Müşteri | musteri@test.com | Test123! |
| Kurye 1 | kurye1@test.com | Test123! |
| Kurye 2 | kurye2@test.com | Test123! |
| Restoran | restoran@test.com | Test123! |
| Admin | admin@getir.com | Admin123! |

---

## 🎮 Demo Akışı

1. **Müşteri** hesabıyla giriş yap → sipariş ver
2. **Kurye** hesabıyla ayrı bir sekmede giriş yap → 🎮 Simülatör başlat
3. Birkaç saniye bekle → eşleştirme otomatik gerçekleşir
4. **Müşteri** sekmesinde haritada kurye konumunu canlı takip et
5. Kurye panelinden "Siparişi Teslim Aldım" → "Müşteriye Teslim Ettim"
6. Müşteri ekranında 🎉 teslim bildirimi

---

## 📁 Proje Yapısı

```
getir-replica/
├── backend/
│   └── GetirReplica.API/          # ASP.NET Core 8 Web API
│       ├── Controllers/           # Auth, Orders, Couriers, Admin, Restaurants
│       ├── Services/              # OrderService, LocationService, MatchingService, TokenService
│       ├── Hubs/                  # SignalR TrackingHub
│       ├── Data/                  # AppDbContext, DataSeeder, Migrations
│       ├── Models/                # Entities, DTOs, Enums
│       └── gotur-web/             # React + Vite + Tailwind frontend
│           └── src/
│               ├── pages/         # LoginPage, CustomerPage, TrackingPage, AdminPage, ...
│               ├── components/    # Navbar, MapView
│               ├── hooks/         # useSignalR
│               └── services/      # api, authService, orderService
├── ARCHITECTURE.md                # Mimari kararlar & trade-off analizi
└── README.md
```

---

## 🔑 Öne Çıkan Teknik Özellikler

- **Durum Makinesi**: Sipariş geçişleri `AllowedTransitions` dictionary ile kontrol edilir, geçersiz geçişler 422 döner
- **Eşleştirme Algoritması**: Haversine formülü ile 10km yarıçap, 5 dakika stale konum filtresi, 3 deneme retry (Hangfire)
- **SignalR Grupları**: Her sipariş için `order:{id}` grubu, kuryeler için `courier:{id}` grubu
- **Redis Rate Limit**: Kurye konumu 3sn'de bir kabul edilir, aşımı 429 döner
- **Redis Cache**: Kurye anlık konumu 30sn TTL ile önbellekte, SignalR backplane

---

## 📹 Demo Video

> YouTube linki eklenecek  
> [Buraya ekle](https://youtube.com/TODO)

---

## 👨‍💻 Ekip

| İsim | Rol |
|------|-----|
| Çağatay | Backend · Web Frontend · Mimari |
| [Arkadaşın Adı] | Mobil (Flutter) |

---

*VBT Yazılım A.Ş. · Staj 2026*
