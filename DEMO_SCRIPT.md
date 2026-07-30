# Demo Video Senaryosu — Götür

> Bu dosyayı video çekmeden önce oku. Her bölümde ne göstereceğini,
> ne söyleyeceğini ve neden önemli olduğunu yazıyor.

---

## Genel Yapı (toplam ~8-10 dakika)

```
Bölüm 1 — Proje tanıtımı       (1 dk)
Bölüm 2 — Canlı demo akışı     (3 dk)
Bölüm 3 — Teknik altyapı       (3 dk)
Bölüm 4 — Kapanış              (1 dk)
```

---

## Bölüm 1 — Proje Tanıtımı (1 dakika)

**Ekranda:** GitHub repo ana sayfası veya ARCHITECTURE.md

**Söyle:**
> "Bu proje, Getir'in sipariş eşleştirme ve kurye anlık takip sisteminin
> MVP klonudur. Amaç ürünü birebir kopyalamak değil — gerçek bir sistemin
> mimari kararlarını okuyup uygulanabilir bir versiyonunu yazmak.
>
> Stack seçimlerini Getir'in mühendislik iş ilanlarından ve AWS blog
> yazılarından araştırdım. Backend .NET, frontend React, real-time SignalR,
> cache Redis — bunların her birinin neden seçildiği ve trade-off'ları
> ARCHITECTURE.md'de detaylı yazıyor."

---

## Bölüm 2 — Canlı Demo Akışı (3 dakika)

### 2a. Siteyi aç
**Ekranda:** `https://gotur.site`

**Söyle:**
> "Uygulama AWS EC2 üzerinde k3s Kubernetes cluster'ında çalışıyor.
> HTTPS sertifikası cert-manager ile Let's Encrypt'ten otomatik alındı."

---

### 2b. Müşteri girişi ve sipariş
**Ekranda:** Login sayfası

**Söyle:**
> "Müşteri hesabıyla giriş yapıyorum."

- Email: `ahmet.yilmaz@gotur.com` / Şifre: `Test123!`
- Bir restoran seç, sepete ürün ekle, sipariş ver

**Söyle:**
> "Sipariş oluşturuldu, status 'Pending'. Şimdi arka planda
> Hangfire job tetiklendi — Haversine formülü ile 10km yarıçapta
> müsait kurye aranıyor."

---

### 2c. Kurye eşleştirmesi (ayrı sekme)
**Ekranda:** Yeni sekmede kurye girişi

- Email: `kurye.istanbul1@gotur.com` / Şifre: `Test123!`
- Kurye panelinde GPS simülatörünü başlat

**Söyle:**
> "Kurye panelini açıyorum. Simülatörü başlatınca kurye konumu
> her 3 saniyede bir API'ye gönderiliyor. Redis'e TTL: 30sn ile yazılıyor,
> aynı zamanda rate limit koruması var — 3 saniyeden önce gelen
> ikinci istek 429 döner."

---

### 2d. Canlı takip
**Ekranda:** Müşteri sekmesine geç, tracking sayfası

**Söyle:**
> "Müşteri sekmesine geçiyorum. Haritada kurye konumu gerçek zamanlı
> güncelleniyor. Bu SignalR WebSocket ile çalışıyor — her konum
> güncellemesinde LocationService SignalR hub'a bildiriyor,
> hub `order:{orderId}` grubundaki tüm istemcilere push yapıyor."

---

### 2e. Teslim
- Kurye panelinden "Teslim Aldım" → "Teslim Ettim"

**Söyle:**
> "Sipariş durumu 'Delivered' oldu. Durum makinesi AllowedTransitions
> dictionary ile kontrol ediliyor — geçersiz bir geçiş yapılmaya
> çalışılırsa API 422 döner."

---

## Bölüm 3 — Teknik Altyapı (3 dakika)

### 3a. Health ve version endpoint'leri
**Ekranda:** `https://gotur.site/health/ready`

**Söyle:**
> "Kubernetes için iki ayrı health endpoint tasarladım.
> `/health/ready` PostgreSQL ve Redis bağlantısını test ediyor —
> ikisi de başarılıysa 200 döner, Kubernetes bu 200'ü görmeden
> pod'a trafik vermiyor.
>
> `/health/live` sadece process sağlığını kontrol ediyor.
> Neden ikisi ayrı? Redis geçici olarak erişilemez hale gelirse
> pod'u yeniden başlatmak sorunu çözmez. Liveness başarısız kalır,
> readiness başarısız olur — pod trafik almaz ama ölmez."

**Ekranda:** `https://gotur.site/api/meta/version`

**Söyle:**
> "Bu endpoint çalışan binary'nin SemVer numarasını dönüyor.
> Production'da bir incident sonrası hangi kodun çalıştığı bu
> endpoint'ten anlaşılır."

---

### 3b. Kubernetes manifestleri
**Ekranda:** `infra/k8s/api.yaml` dosyası VSCode'da

**Söyle:**
> "k3s üzerinde çalışan Kubernetes manifestlerim var.
> `maxUnavailable: 0` rolling update stratejisi — yeni pod
> readiness probe'u geçmeden eski pod kapatılmaz, deploy sırasında
> kullanıcı 503 görmez.
>
> HPA ile 3'ten 20 pod'a otomatik ölçekleme tanımlı.
> CPU %65'i geçince yeni pod açılıyor. Scale-up hızlı, scale-down yavaş —
> trafik düştükten 5 dakika sonra küçülüyor çünkü tekrar artabilir."

---

### 3c. CI/CD pipeline
**Ekranda:** GitHub Actions son run

**Söyle:**
> "5 aşamalı CI pipeline'ım var. Backend build ve test, frontend
> TypeScript check ve build, Docker image build, gerçek PostgreSQL
> ve Redis ile k6 smoke testi, Kubernetes manifest render kontrolü.
>
> Sadece main branch'e push edilince image GHCR'a push ediliyor —
> iki tag alıyor: `:latest` ve Git SHA. SHA tag immutable —
> hangi commit'in cluster'da çalıştığını her zaman biliyorum,
> sorun çıkarsa `kubectl rollout undo` ile geri dönüyorum."

---

### 3d. k6 yük testi
**Ekranda:** `tests/load/login.js` dosyası

**Söyle:**
> "1 milyon kullanıcı derken neyi kastettiğimi belirtmek önemli.
> 1M kayıtlı kullanıcı, 1M günlük giriş ve 1M eşzamanlı giriş
> üç farklı kapasite problemi.
>
> Ben bunu k6'da üç profile indirdim: smoke 20 iterasyon hızlı kontrol,
> load 100 req/sn 5 dakika sürdürülebilir throughput, million
> 1000 sanal kullanıcı toplam 1M iterasyon.
>
> Başarı kriteri sadece HTTP 200 değil: hata oranı yüzde 1'in altında,
> p95 latency 500ms altında, p99 1 saniye altında."

---

### 3e. Redis kavramları (isteğe bağlı, zaman kalırsa)
**Ekranda:** `Services/LocationService.cs`

**Söyle:**
> "Redis'i beş farklı şekilde kullanıyorum: cache-aside pattern ile
> kurye konumu önce Redis'ten okunuyor, rate limiting için
> courier:{id}:rate anahtarıyla 3sn TTL, SignalR pod'ları arası
> mesaj senkronizasyonu için backplane.
>
> Önemli bir not: mevcut rate limit implementasyonu GetString sonra
> SetString yapıyor — iki Redis komutu arasında küçük bir race window var.
> Production'da atomik SET NX EX kullanılmalı. Bunu biliyorum ve
> ENGINEERING.md'ye not olarak düştüm."

---

## Bölüm 4 — Kapanış (1 dakika)

**Söyle:**
> "Özetle: gerçek zamanlı kurye takibi SignalR ile, eşleştirme algoritması
> Haversine formülü ile, yük altında davranış k6 ile ölçülüyor,
> production deploy Kubernetes rolling update ile yapılıyor,
> sistem sağlığı Prometheus metrics endpoint'i ile izlenebilir.
>
> Getir'in aynı stack kararlarını aldım — her seçimin gerekçesini
> ve trade-off'ını ARCHITECTURE.md'de yazdım. Mimari kararları
> anlamak, araçları doğru seçmek ve sistemi çalışır hale getirmek
> üzerine odaklandım."

---

## Hazırlık Kontrol Listesi

Video çekmeden önce bunları kontrol et:

- [ ] `https://gotur.site` açılıyor mu?
- [ ] `https://gotur.site/health/ready` 200 dönüyor mu?
- [ ] Müşteri hesabıyla giriş çalışıyor mu?
- [ ] Kurye simülatörü çalışıyor mu?
- [ ] SignalR bağlantısı kuruluyor mu? (haritada konum güncelleniyor mu?)
- [ ] GitHub Actions'ta son CI yeşil mi?
- [ ] Tarayıcı sekmelerini önceden hazır et (gotur.site, GitHub repo, VSCode)

---

## Sık Kullanılan Test Hesapları

| Rol | Email | Şifre |
|-----|-------|-------|
| Müşteri | ahmet.yilmaz@gotur.com | Test123! |
| Kurye | kurye.istanbul1@gotur.com | Test123! |
| Admin | admin@gotur.com | Admin123! |
| Restoran | karadeniz.mangal@gotur.com | Rest123! |
