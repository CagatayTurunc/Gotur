# Teknik Tasarım Dokümanı
## Sipariş Eşleştirme + Kurye Anlık Takip Sistemi

---

## 1. Genel Bakış

Bu doküman sistemin teknik tasarımını kapsar: proje yapısı, veritabanı şeması, API endpoint'leri, SignalR hub tasarımı ve servis katmanları.

**Stack:**
- Backend: ASP.NET Core 8 Web API (Controller tabanlı)
- ORM: Entity Framework Core 8
- Veritabanı: PostgreSQL 16 + PostGIS
- Cache / Real-time backplane: Redis
- Real-time: ASP.NET Core SignalR
- Background jobs: Hangfire
- Frontend: React + Vite + Leaflet
- Mobil: Flutter (arkadaşın katmanı — aynı API'yi tüketir)
- Auth: JWT (ASP.NET Core Identity)
- Docs: Swagger / OpenAPI 3.0

---

## 2. Proje Klasör Yapısı

```
getir-replica/
├── backend/
│   └── GetirReplica.API/
│       ├── Controllers/
│       │   ├── AuthController.cs
│       │   ├── OrdersController.cs
│       │   ├── CouriersController.cs
│       │   └── AdminController.cs
│       ├── Hubs/
│       │   └── TrackingHub.cs
│       ├── Services/
│       │   ├── IMatchingService.cs
│       │   ├── MatchingService.cs
│       │   ├── ILocationService.cs
│       │   ├── LocationService.cs
│       │   ├── IOrderService.cs
│       │   └── OrderService.cs
│       ├── Models/
│       │   ├── Entities/
│       │   │   ├── User.cs
│       │   │   ├── Order.cs
│       │   │   ├── Courier.cs
│       │   │   ├── Restaurant.cs
│       │   │   └── CourierLocationHistory.cs
│       │   ├── DTOs/
│       │   │   ├── Auth/
│       │   │   ├── Orders/
│       │   │   └── Couriers/
│       │   └── Enums/
│       │       ├── OrderStatus.cs
│       │       └── CourierStatus.cs
│       ├── Data/
│       │   ├── AppDbContext.cs
│       │   └── Migrations/
│       ├── Jobs/
│       │   └── MatchingRetryJob.cs
│       ├── Middleware/
│       │   └── ExceptionMiddleware.cs
│       ├── appsettings.json
│       └── Program.cs
│
├── frontend/
│   └── getir-web/
│       ├── src/
│       │   ├── pages/
│       │   │   ├── CustomerPage.tsx      # sipariş ver + takip et
│       │   │   ├── TrackingPage.tsx      # canlı harita
│       │   │   ├── AdminPage.tsx         # admin paneli
│       │   │   └── RestaurantPage.tsx    # restoran paneli
│       │   ├── components/
│       │   │   ├── MapView.tsx           # Leaflet harita
│       │   │   ├── OrderList.tsx
│       │   │   └── CourierMarker.tsx
│       │   ├── hooks/
│       │   │   ├── useSignalR.ts         # SignalR bağlantı hook'u
│       │   │   └── useOrderTracking.ts
│       │   ├── services/
│       │   │   ├── api.ts                # axios instance
│       │   │   ├── orderService.ts
│       │   │   └── authService.ts
│       │   └── App.tsx
│       └── package.json
│
├── ARCHITECTURE.md
├── README.md
└── docker-compose.yml
```

---

## 3. Veritabanı Şeması

### 3.1 Entity'ler

#### users
```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name   VARCHAR(255) NOT NULL,
    role        VARCHAR(50) NOT NULL,  -- 'customer' | 'courier' | 'admin' | 'restaurant'
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### restaurants
```sql
CREATE TABLE restaurants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    name        VARCHAR(255) NOT NULL,
    address     TEXT NOT NULL,
    location    geography(Point, 4326) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_restaurants_location ON restaurants USING GIST(location);
```

#### couriers
```sql
CREATE TABLE couriers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id),
    status              VARCHAR(50) DEFAULT 'available', -- 'available' | 'busy' | 'offline'
    current_location    geography(Point, 4326),
    last_location_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_couriers_location ON couriers USING GIST(current_location);
```

#### orders
```sql
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID REFERENCES users(id) NOT NULL,
    restaurant_id   UUID REFERENCES restaurants(id) NOT NULL,
    courier_id      UUID REFERENCES couriers(id),
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'assigned' | 'picked' | 'delivered' | 'failed'
    delivery_address TEXT NOT NULL,
    delivery_location geography(Point, 4326) NOT NULL,
    items           JSONB NOT NULL,
    retry_count     INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    assigned_at     TIMESTAMPTZ,
    picked_at       TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
```

#### courier_location_history
```sql
CREATE TABLE courier_location_history (
    id          BIGSERIAL PRIMARY KEY,
    courier_id  UUID REFERENCES couriers(id) NOT NULL,
    order_id    UUID REFERENCES orders(id),
    location    geography(Point, 4326) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_location_history_courier ON courier_location_history(courier_id, recorded_at DESC);
```

### 3.2 Entity Relationship (Özet)

```
users ──< couriers (1-1)
users ──< restaurants (1-1)
users ──< orders (1-N, customer_id)
restaurants ──< orders (1-N)
couriers ──< orders (1-N, aktif sipariş)
couriers ──< courier_location_history (1-N)
orders ──< courier_location_history (1-N)
```

---

## 4. Durum Makinesi

### Sipariş Durumları

```
         ┌──────────┐
         │  pending │ ◄── sipariş oluşturuldu
         └────┬─────┘
              │ eşleştirme başarılı
              ▼
         ┌──────────┐
         │ assigned │ ◄── kurye atandı, bildirimi aldı
         └────┬─────┘
              │ kurye restorana ulaştı, siparişi aldı
              ▼
         ┌──────────┐
         │  picked  │ ◄── kurye yolda, konum takibi aktif
         └────┬─────┘
              │ kurye müşteriye teslim etti
              ▼
         ┌───────────┐
         │ delivered │ ◄── tamamlandı, kurye tekrar müsait
         └───────────┘

pending ──(3 retry başarısız)──► failed
```

### Kurye Durumları

```
available ──(sipariş atandı)──► busy
busy ──(delivered)──► available
available/busy ──(admin)──► offline
offline ──(admin)──► available
```

---

## 5. API Endpoint'leri

### 5.1 Auth

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| POST | `/api/auth/register` | Kullanıcı kaydı | Public |
| POST | `/api/auth/login` | Giriş, JWT döner | Public |
| GET | `/api/auth/me` | Mevcut kullanıcı bilgisi | Auth |

**POST /api/auth/login — Request:**
```json
{
  "email": "user@example.com",
  "password": "string"
}
```
**Response 200:**
```json
{
  "token": "eyJ...",
  "expiresAt": "2026-07-18T14:00:00Z",
  "user": {
    "id": "uuid",
    "fullName": "Ad Soyad",
    "role": "customer"
  }
}
```

---

### 5.2 Orders

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| POST | `/api/orders` | Sipariş oluştur | Customer |
| GET | `/api/orders/{id}` | Sipariş detayı | Auth |
| GET | `/api/orders` | Sipariş listesi (filtreli) | Admin, Restaurant |
| PATCH | `/api/orders/{id}/status` | Durum güncelle | Courier, Admin |
| GET | `/api/orders/{id}/tracking` | Anlık takip verisi (ilk yükleme) | Customer |

**POST /api/orders — Request:**
```json
{
  "restaurantId": "uuid",
  "deliveryAddress": "Kadıköy, İstanbul",
  "deliveryLocation": {
    "latitude": 40.9906,
    "longitude": 29.0287
  },
  "items": [
    { "name": "Döner", "quantity": 2, "price": 120.00 }
  ]
}
```
**Response 201:**
```json
{
  "orderId": "uuid",
  "status": "pending",
  "createdAt": "2026-07-18T11:00:00Z"
}
```

**PATCH /api/orders/{id}/status — Request:**
```json
{
  "status": "picked"
}
```

---

### 5.3 Couriers

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| PUT | `/api/couriers/location` | Konum güncelle | Courier |
| GET | `/api/couriers` | Aktif kurye listesi | Admin |
| PATCH | `/api/couriers/{id}/status` | Kurye durumunu değiştir | Admin |
| GET | `/api/couriers/{id}/location` | Kuryenin anlık konumu | Auth |

**PUT /api/couriers/location — Request:**
```json
{
  "latitude": 41.0150,
  "longitude": 28.9730
}
```
**Response 200:**
```json
{
  "recorded": true,
  "timestamp": "2026-07-18T11:05:00Z"
}
```

---

### 5.4 Admin

| Method | Endpoint | Açıklama | Yetki |
|--------|----------|----------|-------|
| GET | `/api/admin/orders` | Tüm siparişler (filtreli, sayfalı) | Admin |
| GET | `/api/admin/couriers` | Tüm kuryelerin durumu | Admin |
| PATCH | `/api/admin/couriers/{id}` | Kurye offline/online | Admin |

**GET /api/admin/orders — Query Params:**
```
?status=assigned&from=2026-07-01&to=2026-07-18&courierId=uuid&page=1&pageSize=20
```

---

## 6. SignalR Hub Tasarımı

### TrackingHub

**Bağlantı URL:** `/hubs/tracking`

#### Client → Server Metodları

| Metod | Parametreler | Açıklama |
|-------|-------------|----------|
| `JoinOrderGroup` | `orderId: string` | Müşteri/restoran, belirli siparişin güncellemelerini dinlemek için gruba katılır |
| `LeaveOrderGroup` | `orderId: string` | Gruptan ayrıl |
| `UpdateLocation` | `latitude: double, longitude: double` | Kurye konumunu SignalR üzerinden gönderir (REST alternatifi) |

#### Server → Client Metodları

| Metod | Payload | Ne Zaman |
|-------|---------|----------|
| `LocationUpdated` | `{ courierId, latitude, longitude, timestamp }` | Kurye konum güncellediğinde |
| `OrderStatusChanged` | `{ orderId, status, timestamp }` | Sipariş durumu değiştiğinde |
| `CourierAssigned` | `{ orderId, courierId, courierName }` | Kurye atandığında |
| `LocationTimeout` | `{ orderId }` | Kurye 30sn konum göndermediğinde |

#### Grup Yapısı

```
order:{orderId}   → müşteri + restoran dinler
courier:{courierId} → kuryeye özel bildirimler
admin             → tüm admin bağlantıları
```

#### Hub Kod Taslağı (C#)

```csharp
[Authorize]
public class TrackingHub : Hub
{
    public async Task JoinOrderGroup(string orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"order:{orderId}");
    }

    public async Task LeaveOrderGroup(string orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order:{orderId}");
    }
}
```

---

## 7. Servis Katmanları

### MatchingService

```csharp
public interface IMatchingService
{
    Task<MatchResult> FindAndAssignCourierAsync(Guid orderId);
    Task ScheduleRetryAsync(Guid orderId, int retryCount);
}
```

**Algoritma:**
1. Siparişin restoran konumunu al
2. `ST_DWithin` ile 10 km içindeki `available` kuryeleri sorgula
3. `ST_Distance` ile en yakını seç
4. Kuryenin `last_location_at` değeri 5 dakikadan eski değil mi kontrol et
5. Transaction içinde: sipariş → `assigned`, kurye → `busy`
6. SignalR ile kuryeye `CourierAssigned` bildirimi gönder
7. Başarısız olursa Hangfire job kuyruğuna `MatchingRetryJob` ekle (60sn delay)

### LocationService

```csharp
public interface ILocationService
{
    Task UpdateLocationAsync(Guid courierId, double latitude, double longitude);
    Task<CourierLocation?> GetCurrentLocationAsync(Guid courierId);
}
```

**Akış:**
1. Rate limit kontrolü (Redis: `courier:{id}:rate` — 3sn TTL)
2. `couriers.current_location` güncelle (PostGIS point)
3. Redis'e yaz: `courier:{id}:location` (TTL: 30sn)
4. Aktif siparişi varsa `courier_location_history`'e ekle (son 100 nokta)
5. SignalR Hub üzerinden `order:{orderId}` grubuna `LocationUpdated` yayınla

### OrderService

```csharp
public interface IOrderService
{
    Task<Order> CreateOrderAsync(CreateOrderDto dto, Guid customerId);
    Task<Order> UpdateStatusAsync(Guid orderId, OrderStatus newStatus, Guid requesterId);
    Task<PagedResult<Order>> GetOrdersAsync(OrderFilterDto filter);
}
```

**Durum geçiş matrisi (kod):**
```csharp
private static readonly Dictionary<OrderStatus, OrderStatus[]> AllowedTransitions = new()
{
    [OrderStatus.Pending]   = [OrderStatus.Assigned],
    [OrderStatus.Assigned]  = [OrderStatus.Picked],
    [OrderStatus.Picked]    = [OrderStatus.Delivered],
};
```

---

## 8. DTO'lar

### CreateOrderDto
```csharp
public record CreateOrderDto(
    Guid RestaurantId,
    string DeliveryAddress,
    LocationDto DeliveryLocation,
    List<OrderItemDto> Items
);

public record LocationDto(double Latitude, double Longitude);
public record OrderItemDto(string Name, int Quantity, decimal Price);
```

### OrderResponseDto
```csharp
public record OrderResponseDto(
    Guid Id,
    string Status,
    Guid RestaurantId,
    Guid? CourierId,
    string DeliveryAddress,
    List<OrderItemDto> Items,
    DateTime CreatedAt,
    DateTime? AssignedAt,
    DateTime? DeliveredAt
);
```

### UpdateLocationDto
```csharp
public record UpdateLocationDto(
    [Range(-90, 90)] double Latitude,
    [Range(-180, 180)] double Longitude
);
```

---

## 9. Entity Framework — AppDbContext

```csharp
public class AppDbContext : IdentityDbContext<User, IdentityRole<Guid>, Guid>
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Courier> Couriers => Set<Courier>();
    public DbSet<Restaurant> Restaurants => Set<Restaurant>();
    public DbSet<CourierLocationHistory> LocationHistory => Set<CourierLocationHistory>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // PostGIS — NetTopologySuite kullanılır
        builder.Entity<Courier>()
            .Property(c => c.CurrentLocation)
            .HasColumnType("geography(Point, 4326)");

        builder.Entity<Courier>()
            .HasIndex(c => c.CurrentLocation)
            .HasMethod("GIST");

        builder.Entity<Order>()
            .Property(o => o.Status)
            .HasConversion<string>();
    }
}
```

**Gerekli NuGet paketleri:**
```
Npgsql.EntityFrameworkCore.PostgreSQL
Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite
Microsoft.AspNetCore.Identity.EntityFrameworkCore
Hangfire.AspNetCore
Hangfire.PostgreSql
StackExchange.Redis
Microsoft.AspNetCore.SignalR
Swashbuckle.AspNetCore
Serilog.AspNetCore
```

---

## 10. Program.cs Yapılandırması (Özet)

```csharp
// DB
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(connectionString, o => o.UseNetTopologySuite()));

// Identity + JWT
builder.Services.AddIdentity<User, IdentityRole<Guid>>()
    .AddEntityFrameworkStores<AppDbContext>();
builder.Services.AddJwtAuthentication(builder.Configuration);

// SignalR + Redis backplane
builder.Services.AddSignalR()
    .AddStackExchangeRedis(redisConnection);

// Redis cache
builder.Services.AddStackExchangeRedisCache(opt =>
    opt.Configuration = redisConnection);

// Hangfire
builder.Services.AddHangfire(config =>
    config.UsePostgreSqlStorage(connectionString));
builder.Services.AddHangfireServer();

// Services
builder.Services.AddScoped<IMatchingService, MatchingService>();
builder.Services.AddScoped<ILocationService, LocationService>();
builder.Services.AddScoped<IOrderService, OrderService>();

// Swagger
builder.Services.AddSwaggerWithJwtSupport();

// Hub mapping
app.MapHub<TrackingHub>("/hubs/tracking");
```

---

## 11. docker-compose.yml

```yaml
version: '3.8'
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: getir_replica
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: ./backend/GetirReplica.API
    ports:
      - "5000:8080"
    environment:
      - ConnectionStrings__Default=Host=postgres;Database=getir_replica;Username=postgres;Password=postgres
      - ConnectionStrings__Redis=redis:6379
      - Jwt__Secret=super-secret-key-32-chars-minimum
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend/getir-web
    ports:
      - "3000:80"
    depends_on:
      - api

volumes:
  pgdata:
```

---

## 12. Frontend Bileşen Haritası

```
App
├── /login              → LoginPage
├── /                   → CustomerPage
│   ├── OrderForm       → sipariş oluştur
│   └── TrackingPage    → /tracking/:orderId
│       ├── MapView     → Leaflet harita
│       │   └── CourierMarker (animasyonlu)
│       └── OrderStatus → durum kartı
├── /admin              → AdminPage
│   ├── OrderList       → filtreli tablo
│   └── CourierList     → kurye durumları
└── /restaurant         → RestaurantPage
    └── ActiveOrders    → canlı sipariş akışı
```

### useSignalR Hook (React)

```typescript
export function useSignalR(orderId: string) {
  const [courierLocation, setCourierLocation] = useState<Location | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/tracking', {
        accessTokenFactory: () => localStorage.getItem('token') ?? ''
      })
      .withAutomaticReconnect()
      .build();

    connection.on('LocationUpdated', (data) => {
      setCourierLocation({ lat: data.latitude, lng: data.longitude });
    });

    connection.on('OrderStatusChanged', (data) => {
      setOrderStatus(data.status);
    });

    connection.start()
      .then(() => connection.invoke('JoinOrderGroup', orderId));

    connectionRef.current = connection;
    return () => { connection.stop(); };
  }, [orderId]);

  return { courierLocation, orderStatus };
}
```

---

## 13. Güvenlik Notları

- JWT secret minimum 32 karakter, `appsettings` yerine environment variable'dan okunmalı
- Kurye endpoint'leri `[Authorize(Roles = "courier")]` ile korunmalı
- Rate limiting middleware: konum endpoint'i için 3sn kural Redis ile uygulanmalı
- CORS: sadece frontend origin'e izin verilmeli
- Input validation: tüm DTO'lar `DataAnnotations` veya `FluentValidation` ile doğrulanmalı
- HTTPS zorunlu (production)
