# Gözlemlenebilirlik Stack'i — Prometheus + Grafana

## Araçlar ve rolleri

```
API (/metrics)  →  Prometheus (toplar, saklar)  →  Grafana (gösterir, alarm)
```

| Araç | Rol | Port |
|---|---|---|
| prometheus-net | .NET API'de /metrics endpoint'i açar | — |
| Prometheus | Metrikleri 15sn'de bir çeker, saklar | 9090 |
| Grafana | Grafikler, dashboard, alert | 3001 |

---

## Çalıştırma

```bash
# API + DB + Redis + Prometheus + Grafana'yı birlikte başlat
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

Grafana: http://localhost:3001
- Kullanıcı: `admin`
- Şifre: `gotur-admin`

"Gotur API — Gözlemlenebilirlik" dashboard'ı otomatik yüklü gelir.

---

## Dashboard panelleri

| Panel | Ne gösteriyor | Neden önemli |
|---|---|---|
| Throughput | req/sn — toplam ve login | Trafik artışı veya ani düşüş |
| 5xx Hata Oranı | Son 5dk HTTP hata yüzdesi | SLO: %1'in altında olmalı |
| Aktif Bağlantılar | SignalR + REST | Memory baskısı erken uyarısı |
| Login Latency p50/p95/p99 | Milisaniye | k6 SLO: p95<500ms, p99<1sn |
| Endpoint Bazlı p95 | Hangi endpoint yavaş | Darboğaz tespiti |
| Process CPU | API CPU kullanımı | HPA tetik eşiği: %65 |
| .NET Heap Memory | Yönetilen bellek boyutu | Memory leak erken tespiti |
| GC Frekansı | Garbage Collector çalışma sıklığı | Memory baskısı göstergesi |

---

## Prometheus'da manuel sorgu

http://localhost:9090/graph adresinde PromQL yazabilirsin:

```promql
# Login endpoint p95 latency (ms)
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{job="gotur-api"}[5m]))
  by (le)
) * 1000

# Son 5dk hata oranı
sum(rate(http_requests_received_total{job="gotur-api",code=~"5.."}[5m]))
/
sum(rate(http_requests_received_total{job="gotur-api"}[5m]))

# Toplam başarılı login sayısı
sum(http_requests_received_total{job="gotur-api",action=~".*[Ll]ogin.*",code="200"})
```

---

## Production'da ne değişir?

| MVP (şu an) | Production |
|---|---|
| docker-compose ile local | Kubernetes'te ayrı namespace |
| Admin şifre compose'da | Kubernetes Secret / Vault |
| Local storage | S3 remote storage (Thanos/Mimir) |
| Manuel alarm yok | Grafana alert → PagerDuty/Slack |
| 15 gün retention | 90+ gün, downsample ile |

---

## Dosya yapısı

```
infra/monitoring/
├── prometheus.yml              # Scrape konfigürasyonu
├── grafana-dashboard.json      # Dashboard (referans, import için)
├── docker-compose.monitoring.yml  # ← ana compose klasöründe
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── prometheus.yml  # Otomatik Prometheus bağlantısı
        └── dashboards/
            ├── default.yml     # Klasör tanımı
            └── gotur-api.json  # Dashboard (otomatik yüklenir)
```
