# Kafka Tasarım Belgesi — Asenkron Mesajlaşma Mimarisi

> Bu belge Kafka'nın projeye nasıl entegre edileceğini açıklar.
> Şu an Hangfire in-process queue kullanılıyor (MVP tercihi).
> Kafka geçişi için migration path ve tasarım kararları burada.

---

## Neden Hangfire Yeterli Değil?

Mevcut Hangfire yaklaşımının üç sınırı var:

**1. Tek process bağımlılığı**
Hangfire job'ları aynı API process'i içinde çalışır. API instance ölünce
sıraya girmiş job'lar ya kaybolur ya da PostgreSQL'e yazılmış olanlar
yeniden başlatmada işlenir. Job durumu API'nin durumuna bağlı.

**2. Mikroservis geçişi mümkün değil**
Yarın `NotificationService` ayrı bir mikroservis olarak çıkarıldığında
Hangfire bu servisi tetikleyemez — aynı process içinde değil.

**3. Yüksek trafikte darboğaz**
Saniyede 1000 sipariş gelirse Hangfire worker pool yetersiz kalır,
sıra uzar, müşteri gecikme yaşar.

---

## Kafka Ne Sağlar?

```
Producer (API)                    Consumer (Servis)
──────────────                    ─────────────────
order.created ──► [Kafka Topic] ──► MatchingService
                                ──► NotificationService
                                ──► BillingService
                                ──► AnalyticsService
```

**Avantajlar:**
- **Decoupling**: API sadece event yayar, hangi servislerin dinlediğini bilmez
- **Replay**: Bir servis dursa mesajlar kaybolmaz, ayağa kalkınca kaldığından devam eder
- **Scale**: Consumer'lar bağımsız ölçeklenir — matching yavaşsa sadece onu artır
- **Audit log**: Tüm event'ler Kafka'da saklanır, sonradan sorgulanabilir

---

## Topic Tasarımı

### Kural: Her domain için ayrı topic, partition = paralellik

```
gotur.orders          — sipariş yaşam döngüsü event'leri
gotur.couriers        — kurye konum ve durum event'leri
gotur.notifications   — push/SMS/email bildirimleri
gotur.analytics       — iş metriği event'leri (BI için)
```

**Partition stratejisi:**

```
gotur.orders     → partition key: restaurantId
                   Neden? Aynı restoranın siparişleri sıralı işlenir
                   (aynı mutfak kapasitesi kontrolü)

gotur.couriers   → partition key: courierId
                   Neden? Aynı kurye'nin konum güncellemeleri sıralı
                   (konum A→B→C sırasını koru)
```

### Mesaj şeması (Avro/JSON)

```json
// gotur.orders — OrderCreated event
{
  "eventType": "OrderCreated",
  "eventId": "uuid-v4",
  "timestamp": "2026-07-30T10:00:00Z",
  "traceId": "otel-trace-id",          // OpenTelemetry ile korelasyon
  "payload": {
    "orderId": "abc123",
    "customerId": "def456",
    "restaurantId": "ghi789",
    "items": [...],
    "deliveryAddress": "..."
  }
}
```

`traceId` alanı OpenTelemetry ile entegrasyon için kritik —
Kafka consumer'ı aynı trace'i devam ettirebilir.

---

## Hangfire → Kafka Migration Path

### Adım 1: Arayüz gerisinde sakla (şu an)

```csharp
// IEventBus — Hangfire veya Kafka, dışarıdan farklı değil
public interface IEventBus
{
    Task PublishAsync<T>(string topic, T message) where T : class;
}

// HangfireEventBus — mevcut
public class HangfireEventBus : IEventBus { ... }

// KafkaEventBus — geçiş sırasında
public class KafkaEventBus : IEventBus { ... }
```

### Adım 2: OrderService zaten soyutlamayı kullanıyor

```csharp
// OrderService.cs — bugün
await _eventBus.PublishAsync("order.created", new OrderCreatedEvent { ... });

// Kafka'ya geçişte değişen tek şey:
// services.AddSingleton<IEventBus, HangfireEventBus>();
// →
// services.AddSingleton<IEventBus, KafkaEventBus>();
```

### Adım 3: Outbox pattern ile guaranteed delivery

```
Sipariş oluşturma transaction:
  ┌────────────────────────────────┐
  │  orders INSERT                 │
  │  outbox_events INSERT          │ ← aynı transaction
  └────────────────────────────────┘
              │
  OutboxProcessor (her 5sn)
              │
              ├── Kafka'ya publish et
              └── outbox_events.processed_at = now
```

Kafka down olsa bile event kaybolmaz — outbox'ta bekler.

---

## Öncelikli Taşınacak Akış: Bildirimler

**Neden bildirimler?**
- Siparişin kritik yolunda değil — gecikse de sipariş işlenir
- En yüksek hacimli akış (her konum güncellemesinde bildirim)
- Hata izolasyonu en kolay — bildirim başarısız olsa sipariş etkilenmez

```
Bugün (Hangfire):
  CourierAssigned → Hangfire job → SignalR.SendAsync()

Kafka ile:
  CourierAssigned → Kafka: gotur.notifications
                        → NotificationConsumer → SignalR.SendAsync()
                        → PushNotificationConsumer → FCM/APNS
                        → SMSConsumer → Twilio
```

Aynı event üç farklı consumer tarafından bağımsız işleniyor.
Biri yavaşlasa diğerleri etkilenmiyor.

---

## .NET'te Kafka Entegrasyonu

### Paket

```xml
<PackageReference Include="Confluent.Kafka" Version="2.6.0" />
<PackageReference Include="MassTransit.Kafka" Version="8.x" />
```

`MassTransit` tercih edilir — Saga, retry, dead letter queue built-in gelir.

### Producer

```csharp
public class KafkaEventBus : IEventBus
{
    private readonly IProducer<string, string> _producer;

    public async Task PublishAsync<T>(string topic, T message) where T : class
    {
        var key = (message as IPartitionable)?.PartitionKey ?? Guid.NewGuid().ToString();
        var value = JsonSerializer.Serialize(message);

        await _producer.ProduceAsync(topic, new Message<string, string>
        {
            Key = key,     // partition routing
            Value = value,
            Headers = new Headers
            {
                { "trace-id", Encoding.UTF8.GetBytes(Activity.Current?.TraceId.ToString() ?? "") }
            }
        });
    }
}
```

### Consumer

```csharp
public class OrderCreatedConsumer : IConsumer<OrderCreatedEvent>
{
    public async Task Consume(ConsumeContext<OrderCreatedEvent> context)
    {
        // OpenTelemetry: Kafka header'dan trace-id al, span'i devam ettir
        var traceId = context.Headers.Get<string>("trace-id");

        await _matchingService.FindAndAssignCourierAsync(
            context.Message.OrderId);
    }
}
```

---

## Getir'in Gerçek Kafka Kullanımı

Getir ölçeğinde (milyonlarca sipariş/gün):

| Topic | Producer | Consumer | Günlük hacim |
|-------|----------|----------|-------------|
| order.events | Orders API | Matching, Billing, Analytics | ~2M |
| courier.location | Courier App | Tracking, ETA | ~500M |
| notification.send | Her servis | Push, SMS, Email | ~10M |

`courier.location` topic'i en yüksek hacimli — her aktif kuryeden
saniyede bir mesaj. Bu yüzden Kafka: RabbitMQ bu hacmi kaldıramaz
(bellek tabanlı, kalıcı log değil).

**Kafka vs RabbitMQ seçim kriteri:**

| | RabbitMQ | Kafka |
|---|---|---|
| Mesaj modeli | Push (broker iter) | Pull (consumer çeker) |
| Saklama | Kısa süreli | Uzun süreli (log) |
| Replay | Yok | Var |
| Throughput | ~50K msg/sn | ~1M msg/sn |
| Kullanım | Task queue | Event streaming |
| Getir'de | Mikroservis RPC | Konum, analitik |

Proje Hangfire → RabbitMQ → Kafka sırasını izliyor:
- Hangfire: in-process, sıfır operasyonel yük (şu an)
- RabbitMQ: mikroservis geçişinde ilk adım
- Kafka: yüksek hacimli event streaming gerektiğinde

---

## docker-compose ile Local Test (opsiyonel)

```yaml
# docker-compose.kafka.yml
services:
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    environment:
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_NODE_ID: 1
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    ports:
      - "9092:9092"

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
    ports:
      - "8090:8080"
    # http://localhost:8090 → topic'leri, mesajları gör
```

```bash
docker compose -f docker-compose.kafka.yml up -d
# Kafka UI: http://localhost:8090
```

---

## Özet: Şu An vs Kafka

| Özellik | Hangfire (şu an) | Kafka (geçiş) |
|---------|-----------------|---------------|
| Setup | Sıfır operasyonel yük | Kafka cluster gerekir |
| Replay | Yok | Var |
| Mikroservis | Hayır | Evet |
| Throughput | Orta | Çok yüksek |
| Görünürlük | Hangfire dashboard | Kafka UI + trace |
| Migration | IEventBus arayüzü hazır | DI swap yeterli |

MVP'de Hangfire bilinçli bir seçim. Ölçek gerektirdiğinde
`IEventBus` implementasyonunu değiştirmek yeterli — servis kodu değişmez.
