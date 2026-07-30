# Case Study: Gözlemlenebilirlik — Üç Katman

Gözlemlenebilirlik (observability) üç soruya cevap verir:

| Soru | Araç |
|------|------|
| Ne kadar oldu? | **Metrics** — Prometheus + Grafana |
| Ne oldu? | **Logs** — Serilog + CorrelationId |
| Nerede geçti? | **Traces** — OpenTelemetry + Jaeger |

---

## Katman 1: Metrics (Prometheus + Grafana)

`prometheus-net.AspNetCore` paketi ile `/metrics` endpoint'i açık.
Her HTTP isteği otomatik sayılıyor: method, route, status code bazlı.

```
http_requests_received_total{method="POST",route="/api/orders",code="201"} 42
http_request_duration_seconds_bucket{le="0.5",...} 39
```

**SLO izleme:** Grafana dashboard'ında p95 < 500ms, hata oranı < %1.

Çalıştırma:
```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
# Grafana: http://localhost:3001  (admin/gotur-admin)
# Prometheus: http://localhost:9090
```

---

## Katman 2: Logs (Serilog + CorrelationId)

### CorrelationId Middleware

Her HTTP isteğine UUID atanır. İstekte `X-Correlation-ID` header'ı varsa
kullanılır (API gateway'den veya client'tan gelmiş), yoksa yeni üretilir.

```csharp
// CorrelationIdMiddleware.cs
var correlationId = context.Request.Headers["X-Correlation-ID"]
    .FirstOrDefault() ?? Guid.NewGuid().ToString("N");

context.Items["CorrelationId"] = correlationId;
context.Response.Headers["X-Correlation-ID"] = correlationId;

using (LogContext.PushProperty("CorrelationId", correlationId))
{
    await _next(context);
}
```

### Her log satırında CorrelationId

Serilog `FromLogContext()` ile her satıra otomatik eklenir:

```
[10:23:41 INF] a1b2c3d4  OrderService  Sipariş oluşturuldu OrderId=abc123
[10:23:41 INF] a1b2c3d4  MatchingService  Kurye aranıyor OrderId=abc123
[10:23:41 INF] a1b2c3d4  MatchingService  Kurye bulundu CourierId=xyz456
[10:23:42 INF] a1b2c3d4  LocationService  Konum güncellendi
```

Aynı `CorrelationId` ile bir siparişin tüm yaşam döngüsü tek sorguda görünür.

### Hata response'unda CorrelationId

```json
{
  "status": 404,
  "message": "Sipariş bulunamadı",
  "correlationId": "a1b2c3d4e5f6..."
}
```

Müşteri hata bildirdiğinde bu ID ile Serilog/Seq'te tam iz bulunur.

---

## Katman 3: Traces (OpenTelemetry)

Metrics "kaç ms sürdü?" der, traces "nerede geçti?" der.

### Span hiyerarşisi

```
POST /api/orders  [TraceId: abc123]  145ms
├── OrderService.Create              12ms
│   └── EF Core: SELECT users        3ms
│   └── EF Core: SELECT orders       2ms
│   └── EF Core: INSERT order        4ms
└── MatchingService.FindAndAssign   133ms
    ├── Redis: SET NX matching:lock   1ms
    ├── EF Core: SELECT couriers     15ms
    └── EF Core: UPDATE + INSERT    117ms
```

Prometheus sadece "POST /api/orders 145ms" der.
OpenTelemetry "EF Core UPDATE 117ms aldı, darboğaz burada" der.

### Instrumentation kapsamı

| Kaynak | Span |
|--------|------|
| ASP.NET Core | Her HTTP isteği otomatik |
| EF Core | Her DB sorgusu + SQL statement |
| OrderService | `OrderService.Create` — custom |
| MatchingService | `MatchingService.FindAndAssign` — custom |
| LocationService | `LocationService.UpdateLocation` — custom |

### Custom span örneği

```csharp
using var activity = OpenTelemetryExtensions.ActivitySource
    .StartActivity("MatchingService.FindAndAssign", ActivityKind.Internal);

activity?.SetTag("order.id", orderId.ToString());
// ... iş mantığı ...
activity?.SetTag("courier.assigned", courierId.ToString());
```

### Local'de Jaeger ile görselleştirme

```bash
# Jaeger'ı başlat (tracing profili)
docker compose --profile tracing up -d jaeger

# API'yi başlat (Jaeger'a OTLP push eder)
docker compose up -d api

# Jaeger UI
open http://localhost:16686

# Servis: "GetirReplica.API" seç → sipariş oluştur → trace görünür
```

### Production'da ne değişir?

| Local | Production |
|-------|-----------|
| Jaeger (all-in-one) | Grafana Tempo veya AWS X-Ray |
| Console exporter | OTLP → managed collector |
| Her trace kaydedilir | Sampling: %1-10 (maliyet kontrolü) |

---

## Üç Katmanın Birlikte Çalışması

Prod incident senaryosu:

```
1. Grafana alarm: p95 latency > 500ms  (Metrics)
2. Hata log'u: "correlationId: a1b2c3"  (Logs)
3. Seq filtresi: correlationId = a1b2c3  → tüm iz
4. Jaeger trace: EF Core SELECT 800ms  (Traces)
5. Sonuç: orders tablosunda eksik index
```

Her katman farklı bir soruya cevap veriyor, üçü birlikte tam resmi gösteriyor.
