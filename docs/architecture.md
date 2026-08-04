# Götür — Sistem Mimarisi

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#9a0002",
    "primaryTextColor": "#ffffff",
    "primaryBorderColor": "#6f0001",
    "lineColor": "#9a0002",
    "secondaryColor": "#1a1a2e",
    "tertiaryColor": "#f8f9fa",
    "fontSize": "14px"
  }
}}%%

graph TB
    subgraph CLIENTS["🖥️  CLIENT LAYER"]
        direction LR
        WEB["⚛️ React Web\nLeaflet · Vite · Tailwind\nDark/Light · Google OAuth"]
        MOB["📱 Flutter Mobil\nflutter_map · signalr_netcore\nAndroid & iOS"]
        ADM["🔧 Admin Paneli\nFeature Flags · Courier Mgmt\nOrder Dashboard"]
    end

    subgraph API["⚙️  ASP.NET Core 9 Web API"]
        direction TB
        subgraph CONTROLLERS["Controllers"]
            direction LR
            C1["📦 Orders"]
            C2["🛵 Couriers"]
            C3["🔐 Auth"]
            C4["🍽️ Restaurants"]
            C5["⚙️ Admin"]
            C6["⭐ Reviews · Favorites"]
        end

        subgraph SERVICES["Services"]
            direction LR
            MS["🎯 MatchingService\nHaversine · Distributed Lock\nFeature Flag · Retry"]
            LS["📍 LocationService\nRedis Cache · Rate Limit\nSignalR Publish"]
            OS["📋 OrderService\nState Machine · Outbox\nIdempotency"]
            OP["⚡ OutboxProcessor\nHangfire Job\nGuaranteed Delivery"]
        end

        subgraph MIDDLEWARE["Middleware"]
            direction LR
            M1["🔗 CorrelationId"]
            M2["🛡️ Idempotency"]
            M3["🚨 Exception"]
        end

        subgraph HUB["Real-time"]
            SH["🔴 SignalR TrackingHub\norder:{id} · courier:{id}\nWebSocket + Fallback"]
        end
    end

    subgraph DATA["🗄️  DATA LAYER"]
        direction LR
        subgraph PG["PostgreSQL 16"]
            PG1["Orders · Couriers · Users\nRestaurants · MenuItems\nFavorites · Reviews"]
            PG2["OutboxEvents · FeatureFlags\nCourierLocationHistory\nCategories"]
        end

        subgraph RD["Redis"]
            R1["🔑 Distributed Lock\nSET NX per order"]
            R2["📍 Konum Cache\ncourer:{id}:location TTL:30s"]
            R3["⚡ SignalR Backplane\nMulti-instance sync"]
            R4["🚦 Rate Limiting\nIP + User bazlı"]
        end

        HF["🔄 Hangfire\nOutbox Processor · 5sn\nMatching Retry · 60sn"]
    end

    subgraph OBS["📊  OBSERVABILİTE"]
        direction LR
        GR["📈 Prometheus\n+ Grafana\np95/p99 · GC · CPU"]
        OT["🔍 OpenTelemetry\n→ Jaeger / Tempo\nDistributed Trace"]
        SQ["📝 Serilog\n+ Seq\nCorrelationId zinciri"]
    end

    subgraph INFRA["☸️  INFRA"]
        direction LR
        DK["🐳 Docker Compose\nLocal Dev"]
        K8["☸️ k3s / Kubernetes\nHPA 3→20 pod\nRolling Update"]
        CI["⚙️ GitHub Actions\nBuild · Test · Docker"]
    end

    %% Client → API
    WEB  -->|"REST + SignalR\nHTTPS"| API
    MOB  -->|"REST + SignalR\nHTTPS"| API
    ADM  -->|"REST\nHTTPS"| API

    %% Controllers → Services
    C1 --> OS
    C2 --> LS
    C2 --> MS
    C3 --> OS
    C4 --> OS
    C5 --> MS

    %% Services → Hub
    MS --> SH
    LS --> SH
    OS --> SH
    OP --> SH

    %% Services → Data
    MS --> PG
    MS --> RD
    LS --> RD
    LS --> PG
    OS --> PG
    OP --> PG
    OP --> SH

    %% SignalR → Clients (push)
    SH -->|"LocationUpdated\nOrderStatusChanged\nCourierAssigned"| WEB
    SH -->|"LocationUpdated\nOrderStatusChanged"| MOB

    %% Hangfire
    HF --> OP

    %% API → Observability
    API --> GR
    API --> OT
    API --> SQ

    %% Infra
    INFRA -.->|deploy| API
    INFRA -.->|deploy| DATA

    %% Styles
    classDef client fill:#1a1a2e,stroke:#9a0002,stroke-width:2px,color:#fff
    classDef controller fill:#9a0002,stroke:#6f0001,stroke-width:1px,color:#fff
    classDef service fill:#c0392b,stroke:#9a0002,stroke-width:1px,color:#fff
    classDef database fill:#2c3e50,stroke:#9a0002,stroke-width:2px,color:#fff
    classDef redis fill:#d63031,stroke:#9a0002,stroke-width:1px,color:#fff
    classDef hub fill:#8e44ad,stroke:#6c3483,stroke-width:2px,color:#fff
    classDef obs fill:#27ae60,stroke:#1e8449,stroke-width:1px,color:#fff
    classDef infra fill:#2980b9,stroke:#1a5276,stroke-width:1px,color:#fff
    classDef middleware fill:#e67e22,stroke:#ca6f1e,stroke-width:1px,color:#fff

    class WEB,MOB,ADM client
    class C1,C2,C3,C4,C5,C6 controller
    class MS,LS,OS,OP service
    class PG1,PG2 database
    class R1,R2,R3,R4 redis
    class SH hub
    class GR,OT,SQ obs
    class DK,K8,CI infra
    class M1,M2,M3 middleware
```

---

## Veri Akışı — Sipariş Eşleştirme

```mermaid
sequenceDiagram
    autonumber
    actor Müşteri
    participant API as ASP.NET Core API
    participant DB as PostgreSQL
    participant Redis
    participant Hangfire
    participant SignalR as SignalR Hub
    actor Kurye

    Müşteri->>API: POST /api/orders (Idempotency-Key)
    API->>DB: Sipariş kaydet (status: Pending)
    API-->>Müşteri: 201 Created {orderId}

    Note over API,Hangfire: Restoran "Hazır" işaretler → ReadyForPickup

    API->>Redis: SET NX matching:order:{id} (15sn lock)
    Redis-->>API: Lock alındı ✓

    API->>DB: ST_Distance ile müsait kurye sorgula (Haversine)
    DB-->>API: En yakın kurye bulundu

    API->>DB: BEGIN TRANSACTION
    API->>DB: order.Status = Assigned
    API->>DB: courier.Status = Busy
    API->>DB: OutboxEvent {CourierAssigned} yaz
    API->>DB: COMMIT

    API->>Redis: DEL lock (serbest bırak)

    Hangfire->>DB: ProcessedAt IS NULL event'leri çek (5sn)
    Hangfire->>SignalR: CourierAssigned yayınla
    SignalR-->>Kurye: 🔔 Yeni sipariş bildirimi
    SignalR-->>Müşteri: 📍 Kurye atandı

    loop Her 3 saniye
        Kurye->>API: PUT /api/couriers/location {lat, lng}
        API->>Redis: courier:{id}:location güncelle (TTL: 30s)
        API->>DB: CourierLocationHistory ekle
        API->>SignalR: LocationUpdated yayınla
        SignalR-->>Müşteri: 🗺️ Harita güncellendi
    end
```

---

## Veri Akışı — Graceful Degradation (Redis Down)

```mermaid
flowchart LR
    REQ["İstek\nGeldi"]

    REQ --> T{"Polly\nTimeout\n2sn"}
    T -->|Zaman\naşımı| TIMEOUT["TimeoutRejectedException"]
    T -->|OK| CB{"Circuit\nBreaker\nAçık mı?"}

    CB -->|Açık\nBreak 30sn| NULL1["null döner\nCache miss"]
    CB -->|Kapalı| RETRY{"Retry\n3x Exponential\n100→200→400ms"}

    RETRY -->|Başarı| REDIS["✅ Redis\nOK"]
    RETRY -->|3x Hata| NULL2["null döner\nCache miss"]

    TIMEOUT --> NULL3["null döner\nCache miss"]

    NULL1 & NULL2 & NULL3 --> DB["📦 DB'den\nOku\nFallback"]
    DB --> RES["✅ 200 OK\nAPI çalışmaya\ndevam eder"]

    style REDIS fill:#27ae60,color:#fff
    style RES fill:#27ae60,color:#fff
    style NULL1 fill:#e67e22,color:#fff
    style NULL2 fill:#e67e22,color:#fff
    style NULL3 fill:#e67e22,color:#fff
    style DB fill:#2980b9,color:#fff
```

---

## Durum Makinesi — Sipariş Yaşam Döngüsü

```mermaid
stateDiagram-v2
    direction LR

    [*] --> Pending : POST /api/orders

    Pending --> ReadyForPickup : Restoran hazır işaretledi
    Pending --> Failed : 3 retry başarısız

    ReadyForPickup --> Assigned : MatchingService\nHaversine + Distributed Lock

    Assigned --> Picked : Kurye restorana ulaştı\nPATCH status=Picked

    Picked --> Delivered : Kurye müşteriye teslim etti\nPATCH status=Delivered

    Pending --> Cancelled : Müşteri iptal
    Assigned --> Cancelled : Müşteri iptal

    Delivered --> [*]
    Failed --> [*]
    Cancelled --> [*]

    note right of Assigned
        OutboxEvent yazılır
        SignalR: CourierAssigned
        Courier.Status = Busy
    end note

    note right of Delivered
        OutboxEvent yazılır
        SignalR: OrderStatusChanged
        Courier.Status = Available
    end note
```

---

## Veritabanı İlişkileri

```mermaid
erDiagram
    AppUser {
        uuid Id PK
        string Email UK
        string FullName
        string Role
        bool IsDeleted
    }

    Courier {
        uuid Id PK
        uuid UserId FK
        string Status
        double CurrentLocationLat
        double CurrentLocationLng
        datetime LastLocationAt
    }

    Restaurant {
        uuid Id PK
        uuid UserId FK
        string Name
        string Address
        double LocationLat
        double LocationLng
        bool IsOpen
        string LogoUrl
    }

    MenuItem {
        uuid Id PK
        uuid RestaurantId FK
        uuid CategoryId FK
        string Name
        decimal Price
        bool IsAvailable
    }

    Order {
        uuid Id PK
        uuid CustomerId FK
        uuid RestaurantId FK
        uuid CourierId FK
        string Status
        jsonb ItemsJson
        int RetryCount
        datetime AssignedAt
        datetime DeliveredAt
    }

    OutboxEvent {
        uuid Id PK
        string EventType
        string TargetGroup
        jsonb Payload
        datetime ProcessedAt
        datetime CreatedAt
    }

    FeatureFlag {
        uuid Id PK
        string Name UK
        bool IsEnabled
        int RolloutPercentage
    }

    CourierLocationHistory {
        long Id PK
        uuid CourierId FK
        uuid OrderId FK
        double LocationLat
        double LocationLng
        datetime RecordedAt
    }

    Favorite {
        uuid Id PK
        uuid UserId FK
        uuid RestaurantId FK
    }

    Review {
        uuid Id PK
        uuid UserId FK
        uuid RestaurantId FK
        int Rating
        string Comment
    }

    Category {
        uuid Id PK
        string Name UK
    }

    AppUser ||--o| Courier : "1:1"
    AppUser ||--o| Restaurant : "1:1"
    AppUser ||--o{ Order : "müşteri"
    AppUser ||--o{ Favorite : ""
    AppUser ||--o{ Review : ""
    Restaurant ||--o{ Order : ""
    Restaurant ||--o{ MenuItem : ""
    Restaurant ||--o{ Favorite : ""
    Restaurant ||--o{ Review : ""
    Courier ||--o{ Order : ""
    Courier ||--o{ CourierLocationHistory : ""
    Order ||--o{ CourierLocationHistory : ""
    Category ||--o{ MenuItem : ""
```
