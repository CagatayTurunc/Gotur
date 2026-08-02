# Götür — QA Test Raporu

**Tarih:** 2026-08-02
**Test edilen commit:** `815bd60` (origin/main ile birebir aynı, `test/qa-full-setup` branch'i main'e fast-forward edildi)
**Ortam:** Local Docker Compose (Windows, Docker Desktop) — PostgreSQL + Redis + API + Frontend + (ek olarak) Prometheus + Grafana + Seq
**Kapsam:** Backend API (ASP.NET Core 9), Web Frontend (React/Vite), Flutter mobil (statik analiz düzeyinde), Observability stack

Bu rapor, projeyi sıfırdan ayağa kaldırıp README/DEMO_SCRIPT.md/ISSUE.md'de tarif edilen akışları uçtan uca doğrulamak için yapılan manuel + otomatik QA turunun sonuçlarını içerir. Hiçbir değişiklik uzak repoya (`origin`) push edilmedi; tüm testler local'de yapıldı.

---

## Özet

| Kategori | Sayı |
|---|---|
| 🔴 Kritik bulgu | 2 |
| 🟠 Yüksek öncelikli bulgu | 3 |
| 🟡 Orta öncelikli bulgu | 4 |
| 🔵 Düşük öncelikli / not | 3 |
| ✅ Doğrulanan, sorunsuz çalışan akış | 12 |

---

## 🔴 Kritik Bulgular

### 1. Gerçek SMTP şifresi düz metin olarak public repoya commit edilmiş

**Nerede:** `docker-compose.yml` (main'deki `dc158ae` / `89c7522` commit'leri civarı)

```yaml
Smtp__Username=cagatayturuncc06@gmail.com
Smtp__Password=vaee nnof grmf guwg
```

Bu, gerçek bir Gmail hesabının **App Password**'ü ve repo public (`github.com/CagatayTurunc/Gotur`). Git geçmişine giren bir secret, dosyadan silinse bile eski commit'lerde herkese açık kalır.

**Önerilen aksiyon:**
- Google hesabından bu app password **hemen iptal edilmeli (revoke)** ve yenisi üretilmeli.
- Yeni şifre koda değil, `.env` (gitignore'lu) veya K8s Secret / CI secret olarak enjekte edilmeli (proje zaten `SecretsExtensions` ile bunun altyapısına sahip, sadece bu satırlar için kullanılmamış).
- İsteğe bağlı: BFG Repo-Cleaner / `git filter-repo` ile geçmişten temizleme değerlendirilebilir (repo public olduğu için sınırlı fayda sağlar, önce rotasyon şart).

### 2. Sipariş fiyatı/kalemleri sunucu tarafında doğrulanmıyor (fiyat manipülasyonu)

**Nerede:** `backend/GetirReplica.API/Services/OrderService.cs:72` (`CreateOrderAsync`), `Models/DTOs/Orders/OrderItemDto.cs`

`POST /api/orders` isteğinde her ürün için `name`, `quantity`, `price` client'tan geldiği gibi kabul ediliyor ve doğrudan `ItemsJson` olarak kaydediliyor. Sunucu bu değerleri **restoranın gerçek menüsüyle hiç karşılaştırmıyor** (`MenuItemId` bile gönderilmiyor).

**Doğrulama (curl ile üretildi):**
```bash
curl -X POST http://localhost:5131/api/orders -H "Authorization: Bearer <customer_token>" \
  -d '{"restaurantId":"...","items":[{"name":"Adana Kebap","quantity":5,"price":0.01}], ...}'
# Sunucu bunu kabul ediyor — gerçek fiyat 189 TL, 5 adet 0.01 TL olarak siparişe giriyor
```

**Etki:** Kimliği doğrulanmış herhangi bir müşteri, frontend'i bypass edip API'yi doğrudan çağırarak istediği ürünü istediği fiyata sipariş edebilir. Bu üretim ortamında doğrudan mali kayıp anlamına gelir.

**Önerilen aksiyon:** `CreateOrderAsync` içinde her `OrderItemDto` için restoranın `MenuItems` tablosundan gerçek `Name`/`Price` lookup yapılmalı (istemciden sadece `MenuItemId` + `Quantity` alınmalı), toplam tutar sunucuda hesaplanmalı.

---

## 🟠 Yüksek Öncelikli Bulgular

### 3. API container healthcheck'i hiçbir zaman geçmiyor (`wget: not found`)

**Nerede:** `docker-compose.yml` — `api.healthcheck.test`

```yaml
test: ["CMD-SHELL", "wget --quiet --spider http://localhost:8080/health/ready || exit 1"]
```

Runtime imajı (`mcr.microsoft.com/dotnet/aspnet:9.0`, Debian bookworm) içinde **ne `wget` ne `curl` kurulu**. Doğrulandı:
```
docker inspect gotur-api → "Output":"/bin/sh: 1: wget: not found"
```
API'nin kendisi tamamen sağlıklı (`curl http://localhost:5131/health/ready` dışarıdan `200` dönüyor), ama Docker'ın kendi healthcheck mekanizması sürekli `unhealthy` raporluyor (`FailingStreak: 83+`).

**Etki:** `docker-compose.yml` yorumunda da yazdığı gibi CI pipeline bu health check'in geçmesini bekliyor (`bu probe'u bekler; seed data yüklenmeden k6 başlamaz`) — bu hiç geçemeyeceği için CI'da zamanla sorun çıkarabilir. Ayrıca gerçek bir prod incident'ında "unhealthy" sinyali güvenilmez hale geliyor (sürekli kırmızı gördüğü için kimse fark etmeyebilir — "cry wolf" etkisi).

**Önerilen aksiyon:** Dockerfile'da runtime imajına `wget` veya `curl` kurulmalı (`apt-get install -y curl`), ya da .NET'in kendi `HEALTHCHECK` desteği (custom health check binary) kullanılmalı.

### 4. Seq'e hiç log gitmiyor (Docker'da network hatası)

**Nerede:** `backend/GetirReplica.API/appsettings.Development.json:39`

```json
"Name": "Seq",
"Args": { "serverUrl": "http://localhost:5341" }
```

`ASPNETCORE_ENVIRONMENT=Development` olduğu için docker-compose'daki API container'ı da bu dosyayı kullanıyor. Ama `localhost` container **kendi içini** işaret eder — Seq container'ı (`gotur-seq`) değil. Postgres/Redis bağlantıları `docker-compose.yml`'de `postgres:5432` / `redis:6379` şeklinde doğru override edilmiş, ama Seq URL'i için aynı override yapılmamış.

**Doğrulama:** Seq arayüzü açılıyor (`http://localhost:5341` → 200, UI çalışıyor, giriş gerektirmiyor) ama "No events matched the current search" — API 1+ saattir çalışmasına, onlarca istek almasına rağmen **tek bir log satırı bile Seq'e ulaşmamış**. Bu, kullanıcının "sayfa açılamıyor" izleniminin gerçek nedeni değil (sayfa açılıyor) ama işlevsel olarak README'nin vaadi ("Seq'te filtreli arama") çalışmıyor.

**Önerilen aksiyon:** `docker-compose.logging.yml` içinde API servisine `Serilog__WriteTo__1__Args__serverUrl=http://seq:5341` (logging compose dosyasındaki servis adıyla) environment override eklenmeli.

### 5. Hangfire dashboard Docker'da her zaman 401 dönüyor

**Nerede:** `Program.cs:177` — `app.UseHangfireDashboard("/hangfire")` (opsiyon geçilmeden, varsayılan `LocalRequestsOnlyAuthorizationFilter` kullanılıyor)

Bu filtre isteğin `127.0.0.1`'den geldiğini kontrol ediyor. Ama API Docker container'ı içinde çalıştığından, host makineden (tarayıcı veya `curl`) gelen istek container'a Docker bridge network üzerinden ulaşıyor — asla gerçek loopback olarak görünmüyor. Sonuç: `http://localhost:5131/hangfire` **her zaman `401`** dönüyor. Bu, kullanıcının "sayfa açılamıyor" deneyimini birebir açıklıyor — benim ortamımda da aynı sonuç alındı.

**Önerilen aksiyon:** Development ortamı için özel, sadece dev/local'de aktif bir `DashboardOptions { Authorization = [...] }` (örn. `AllowAllDashboardAuthorizationFilter`) tanımlanmalı.

---

## 🟡 Orta Öncelikli Bulgular

### 6. `tests/load/login.js` smoke testi, kendi login rate limitine takılıp başarısız oluyor

Smoke profili varsayılan olarak 2 VU ile 20 iterasyon çalıştırıyor (~1-2 saniyede tamamlanıyor). Auth endpoint'inin rate limiti 10 istek/dakika. Sonuç:
```
Successful logins: 10
Failure rate: 50.00%
thresholds on metrics 'http_req_failed, login_failures' have been crossed
```
Yani README'de "hızlı kontrol" olarak tarif edilen smoke test, **taze bir local ortamda hep başarısız çıkıyor** — testin kendisi ile API'nin rate limit politikası çelişiyor, gerçek bir regresyon değil.

**Önerilen aksiyon:** Ya smoke profilinin VU/iterasyon sayısı rate limitin altında tutulmalı, ya da test ortamı için ayrı (daha yüksek) bir rate limit politikası tanımlanmalı, ya da dokümana bu davranış not düşülmeli.

### 7. Kampanya kartları tıklanabilir görünüyor ama işlevsiz

**Nerede:** `HomePage.tsx:653-654` — kampanya kartı `<div>`'i `cursor-pointer` class'ı ve hover animasyonu (`group-hover:scale-105`) taşıyor ama **hiç `onClick` handler'ı yok**. "Sipariş Ver", "Büyük İndirim" gibi bannerlara tıklamak hiçbir şey yapmıyor.

**Önerilen aksiyon:** Ya bannerlara ilgili sayfaya/restorana yönlendiren bir `onClick` eklenmeli, ya da tıklanamıyorsa `cursor-pointer`/hover efekti kaldırılmalı (görsel olarak yanlış sinyal vermemesi için).

### 8. Cüzdan (Wallet) sayfası tamamen mock — gerçek siparişlerle bağlantısı yok

**Nerede:** `WalletPage.tsx:14-58` — bakiye (`useState(245.50)`) ve işlem geçmişi (`MOCK_TRANSACTIONS`) tamamen sabit/local state. Hiçbir backend API çağrısı yok. "Bakiye Yükle" butonu çalışıyor gibi görünüyor (toast bildirimi çıkıyor, state güncelleniyor) ama sayfa yenilenince sıfırlanıyor, gerçek sipariş ödemesiyle hiç ilişkilendirilmiyor.

**Etki:** Kullanıcı gerçek bir sipariş verdiğinde cüzdan bakiyesinin değişmemesi bug değil — özellik zaten hiç implemente edilmemiş, sadece UI prototipi var. Demo sırasında bu ayrım net değilse yanıltıcı olabilir.

**Önerilen aksiyon:** Ya "yapım aşamasında" etiketi eklenmeli ya da gerçek bir wallet/payment backend'i (ayrı bir iş) yazılmalı.

### 9. k6 sonuç dizini repoda yok, özet export'u başarısız oluyor

```
error msg="Could not save some summary information: could not open 'results/login-summary.json'"
```
`tests/load/results/` klasörü repoya dahil değil ve script onu otomatik oluşturmuyor.

**Önerilen aksiyon:** `.gitkeep` ile boş `results/` klasörü eklenmeli veya script `mkdir -p` ile klasörü kendi oluşturmalı.

---

## 🔵 Düşük Öncelikli / Notlar

### 10. Adres arama, üçüncü parti API'ye (Nominatim) doğrudan client'tan bağlanıyor

`AddressPickerModal.tsx`, backend proxy olmadan doğrudan `nominatim.openstreetmap.org`'a fetch atıyor. Nominatim'in kullanım politikası ~1 istek/saniye ile sınırlı; gerçek trafik altında IP banlanabilir. Ayrıca kullanıcının yazdığı adres sorguları doğrudan üçüncü bir servise gidiyor (gizlilik notu). API'nin kendisinin çalıştığı doğrulandı (manuel `fetch` testi 5 sonuç döndü), ama otomasyon tarayıcısı üzerinden uygulamanın kendi arama kutusu test edilirken istek hiç tetiklenmedi — otomasyon sandbox'ının bir kısıtı mı yoksa gerçek bir uygulama davranışı mı net ayırt edilemedi, gerçek bir tarayıcıda elle doğrulanması önerilir.

### 11. `.gitignore` Flutter ephemeral build dosyalarını kapsamıyor

`mobile/*/flutter/ephemeral/.plugin_symlinks/*` gibi otomatik üretilen dosyalar repoya commit edilmiş (biz `flutter pub get` çalıştırınca bunlardan bazıları yerelde "deleted" görünüyor — gerçek bir silme değil, yeniden üretiliyorlar). Bu dosyalar `.gitignore`'a eklenip repodan çıkarılmalı.

### 12. İkon-only butonlarda erişilebilirlik etiketi eksik

Restoran kartlarındaki favori/sepete-ekle/kapat gibi butonlar `aria-label` içermiyor (accessibility tree'de sadece `button` olarak, isimsiz görünüyorlar). Ekran okuyucu kullanıcıları için deneyimi zayıflatıyor — kritik değil ama düşük maliyetle düzeltilebilir.

---

## ✅ Doğrulanan, Sorunsuz Çalışan Akışlar

1. **Branch senkronizasyonu** — `test/qa-full-setup`, `origin/main`'e fark olmadan (0 conflict) fast-forward edildi.
2. **4 rol için login** — Müşteri, kurye, restoran, admin hesapları JWT token ile başarıyla giriş yapıyor; yanlış şifre `401` ile doğru reddediliyor.
3. **Frontend login/session** — UI üzerinden giriş, kullanıcı menüsü (ad, e-posta, rol, cüzdan/siparişler/hesap) doğru render ediliyor.
4. **Uçtan uca sipariş yaşam döngüsü** — `Pending → ReadyForPickup → Assigned (Haversine + Hangfire ile otomatik eşleşme) → Picked → Delivered` API üzerinden tam olarak çalıştı.
5. **Durum makinesi koruması** — Teslim edilmiş bir siparişi tekrar güncellemeye çalışmak doğru şekilde reddediliyor.
6. **Tek aktif sipariş kuralı** — Aktif siparişi olan müşteri ikinci sipariş veremiyor (`409`).
7. **Idempotency-Key** — Aynı key ile iki kez `POST /api/orders` atıldığında ikinci istek `X-Idempotent-Replayed: true` ile aynı siparişi dönüyor, DB'ye ikinci kayıt girmiyor.
8. **Rate limiting** — Login endpoint'i 10 istekten sonra doğru şekilde `429` dönüyor.
9. **Chaos testi (Redis down)** — Redis durdurulduğunda: `/api/orders/active` hâlâ `200` (graceful degradation, DB fallback), `/health/live` hâlâ `200` (pod öldürülmüyor), `/health/ready` doğru şekilde `503` (trafik kesiliyor). Redis geri gelince Polly circuit breaker ve SignalR Redis backplane otomatik toparlandı (loglarda doğrulandı).
10. **Flutter statik analiz** — `flutter analyze`: 0 uyarı/hata. `flutter test`: mevcut tek test geçti.
11. **Grafana** — `admin`/`gotur-admin` ile giriş çalışıyor, provisioned "Gotur API — Gözlemlenebilirlik" dashboard'u ve içindeki panel satırları mevcut (grafik verisi bu oturumda görsel olarak doğrulanamadı — bkz. "Test Edilmeyen" bölümü).
12. **Prometheus** — API'nin `/metrics` endpoint'ini başarıyla scrape ediyor (`gotur-api → up`), metrik zinciri (API → Prometheus → Grafana) altyapısal olarak sağlam.

**Not — Admin panel kurye "Yenile" butonu:** Kullanıcı bunun kurye konumlarını da güncellemesi gerekip gerekmediğini sordu. İncelemeye göre bu **beklenen davranış**: "Yenile" salt-okunur bir `GET` ile DB'deki mevcut durumu tekrar çekiyor, konum üretmiyor (konum sadece gerçek bir kurye simülatörü çalışırken `PUT /api/couriers/location` ile değişir). "Kuryeleri Sıfırla" (debug) butonu ise kasıtlı olarak `LastLocationAt`'i günceller — amacı, matching motorundaki "5 dakikadan eski konum" filtresini bypass edip eşleştirme sorunlarını debug etmek (UI'da bunu zaten açıkça yazıyor). Yani mevcut davranış doğru, bir bug değil.

---

## Test Edilmeyen / Kapsam Dışı Bırakılanlar

- **Playwright / otomatik E2E test kodu yazılmadı.** Bu turda "manuel E2E" yapıldı: sipariş yaşam döngüsü `curl` zinciriyle (auth → sipariş → hazır → eşleşme → teslim), UI akışları (login, sepet, checkout) otomasyonlu tarayıcı ile adım adım doğrulandı — ama repoya eklenen, tekrar çalıştırılabilir bir Playwright/Cypress test dosyası yok. **Önerim:** Şu an için gerekli değil — bulduğumuz bugların hiçbiri "test eksikliği" yüzünden kaçmadı, hepsini bu manuel turda yakaladık. Ama proje büyümeye devam ederse (yeni özellikler, birden fazla katkıcı), regresyonları otomatik yakalamak için en azından "login → sipariş ver → eşleşme → teslim al" akışını kapsayan 1 Playwright smoke testi eklemek değerli olur. İstersen ayrı bir görev olarak başlatabiliriz.
- **Tam sayfa ekran görüntüsü alınamadı.** Bu oturumdaki tarayıcı aracı, ekran görüntüsü almaya çalıştığında sürekli "Browser pane is not displayed, so the page is not compositing frames" hatası verdi — yani bu araç bu ortamda görsel render/compositing yapamıyor (muhtemelen tarayıcı paneli aktif olarak görüntülenmediği için). Bunun yerine metin/DOM tabanlı doğrulama (accessibility tree okuma, network istekleri, API çağrıları) kullanıldı. **Sonuç:** Grafana panellerinin gerçek grafik verisiyle dolu olup olmadığı görsel olarak teyit edilemedi (ama Prometheus'un veri topladığı API seviyesinde doğrulandı). Gerçek ekran görüntüleri için tarayıcıdan elle (Win+Shift+S veya Ctrl+Shift+P → "ekran görüntüsü al") çekilmesi gerekiyor — istersen hangi sayfaların önemli olduğunu söyle, ben de senin çektiğin görüntüleri rapora nereye ekleyeceğimi söyleyeyim.
- Mobil uygulamanın gerçek cihaz/emülatörde görsel testi (sadece statik analiz yapıldı — emülatör kurulumu ayrı bir oturum gerektirir).
- Google OAuth login (local docker build'de `VITE_GOOGLE_CLIENT_ID` build-arg olarak geçilmiyor, bu yüzden test edilemedi).
- Favoriler/yorumlar özelliklerinin derinlemesine testi (sayfalar yüklendi, API 200 döndü, ama uçtan uca senaryo denenmedi).
- Kubernetes manifest'lerinin gerçek bir cluster'da deploy testi.
- SMTP/e-posta gönderimi (şifre sıfırlama akışı) — güvenlik bulgusu #1 nedeniyle gerçek kimlik bilgileriyle test edilmedi.

---

## Yöntem Notu

Tüm testler local Docker Compose ortamında yapıldı: `docker compose up -d --build` ile 4 servis (postgres, redis, api, frontend) ayağa kaldırıldı; ardından `docker-compose.monitoring.yml` (Prometheus+Grafana) ve `docker-compose.logging.yml` (Seq) ek olarak başlatıldı. API'ye doğrudan `curl` ile (JWT auth akışı, sipariş yaşam döngüsü, idempotency, rate limit, chaos testi), frontend'e ise otomasyonlu tarayıcı ile (login, restoran/menü/sepet akışı, Grafana) erişildi. Hiçbir test verisi/kod değişikliği uzak repoya push edilmedi.
