# Implementation Plan: Sipariş Eşleştirme + Kurye Anlık Takip Sistemi

## Overview

Bu plan, ASP.NET Core 8 Web API + EF Core + PostgreSQL/PostGIS + Redis + SignalR + Hangfire backend'i ile React + Leaflet frontend'ini adım adım inşa eder. Her görev bir öncekinin üzerine inşa edilir; hiçbir bileşen entegre edilmeden askıda bırakılmaz.

---

## Tasks

- [x] 1. Proje altyapısı ve Docker ortamının kurulumu
  - `backend/GetirReplica.API` ve `frontend/getir-web` klasör yapısını oluştur
  - `docker-compose.yml` dosyasını yaz (PostgreSQL/PostGIS 16, Redis 7-alpine, API, frontend servisleri)
  - `appsettings.json` ve `appsettings.Development.json` şablonlarını oluştur (connection string, JWT secret, Redis)
  - NuGet paketlerini ekle: `Npgsql.EFCore.PostgreSQL`, `Npgsql.EFCore.PostgreSQL.NetTopologySuite`, `Microsoft.AspNetCore.Identity.EF`, `Hangfire.AspNetCore`, `Hangfire.PostgreSql`, `StackExchange.Redis`, `Serilog.AspNetCore`, `Swashbuckle.AspNetCore`
  - `Program.cs` iskeletini oluştur: DB, Identity, JWT, SignalR+Redis backplane, Hangfire, Swagger, CORS yapılandırmaları
  - _Gereksinimler: 1.1, 1.3, 9.1, 9.3_

- [x] 2. Veritabanı entity'leri, enum'lar ve AppDbContext
  - [x] 2.1 Enum'ları tanımla
    - `Models/Enums/OrderStatus.cs`: `Pending`, `Assigned`, `Picked`, `Delivered`, `Failed`
    - `Models/Enums/CourierStatus.cs`: `Available`, `Busy`, `Offline`
    - _Gereksinimler: 4.1, 3.1_

  - [x] 2.2 Entity sınıflarını oluştur
    - `User.cs` (IdentityUser'dan türer, `Role` property)
    - `Restaurant.cs` (PostGIS `Point` için `NetTopologySuite.Geometries.Point`)
    - `Courier.cs` (`CurrentLocation: Point`, `Status: CourierStatus`, `LastLocationAt`)
    - `Order.cs` (`Status: OrderStatus`, `DeliveryLocation: Point`, `Items: JSONB`, `RetryCount`, zaman damgası alanları)
    - `CourierLocationHistory.cs` (`Location: Point`, `RecordedAt`, `OrderId` nullable FK)
    - _Gereksinimler: 2.1, 3.1, 5.1, 8.1, 8.4_

  - [x] 2.3 AppDbContext'i yapılandır
    - `IdentityDbContext<User, IdentityRole<Guid>, Guid>` kalıtımı
    - PostGIS geography column type mapping (`geography(Point, 4326)`)
    - GIST index tanımlamaları (`HasMethod("GIST")`)
    - `OrderStatus` ve `CourierStatus` string dönüşümleri
    - `Items` için JSONB mapping
    - _Gereksinimler: 8.1, 8.2, 8.3_

  - [ ]* 2.4 AppDbContext birim testleri yaz
    - Entity ilişkileri ve index konfigürasyonlarını doğrula
    - _Gereksinimler: 8.1, 8.2_

- [x] 3. EF Core migration ve seed data
  - [x] 3.1 İlk migration oluşturuldu ve DB'ye uygulandı
    - Tüm tablolar PostgreSQL'de başarıyla oluşturuldu
    - Not: PostGIS geography kolonları şu an double precision lat/lng olarak çalışıyor
    - PostGIS Docker image (postgis/postgis:16-3.4) hazır olduğunda AddPostGIS migration'ı çalıştırılacak
  - [x] 3.2 Seed data eklendi
    - 1 admin (admin@getir.com / Admin123!)
    - 1 müşteri (musteri@test.com / Test123!)
    - 1 restoran kullanıcısı + restoran kaydı (restoran@test.com / Test123!)
    - 2 kurye (kurye1@test.com, kurye2@test.com / Test123!) — Kadıköy civarı konum ile

- [x] 4. Kimlik doğrulama ve yetkilendirme katmanı
  - [x] 4.1 JWT altyapısını kur
    - `JwtExtensions.cs` ile `AddJwtAuthentication` extension metodu yaz
    - JWT parametreleri: minimum 60 dakika süre, secret environment variable'dan okunacak
    - `AuthController.cs`: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
    - Register: bcrypt hash (Identity varsayılan), rol ataması
    - Login: JWT üret, `expiresAt` ve `user` bilgilerini döndür
    - _Gereksinimler: 1.1, 1.2, 1.5, 1.6_

  - [x] 4.2 Yetkilendirme politikalarını ve middleware'i ekle
    - `[Authorize(Roles = "courier")]`, `[Authorize(Roles = "admin")]`, `[Authorize(Roles = "customer")]` attribute'larını controller'lara uygula
    - JWT olmayan istekler için 401, yetersiz rol için 403 dönüşünü doğrula
    - `ExceptionMiddleware.cs` global hata yakalama middleware'ini yaz
    - _Gereksinimler: 1.3, 1.4_

  - [ ]* 4.3 Auth endpoint birim testleri yaz
    - Geçerli/geçersiz kimlik bilgileri senaryoları
    - Rol bazlı erişim kontrolleri
    - _Gereksinimler: 1.1, 1.2, 1.3, 1.4_

- [ ] 5. Kontrol noktası — Tüm testler geçiyor mu?
  - Tüm testlerin geçtiğini doğrula, takılan yerler varsa kullanıcıya sor.

- [x] 6. DTO'lar ve FluentValidation
  - [x] 6.1 Tüm DTO record'larını oluştur
    - `Auth/`: `LoginRequestDto`, `RegisterRequestDto`, `AuthResponseDto`
    - `Orders/`: `CreateOrderDto`, `OrderResponseDto`, `UpdateOrderStatusDto`, `OrderFilterDto`, `PagedResult<T>`
    - `Couriers/`: `UpdateLocationDto` (`[Range]` veya FluentValidation), `CourierResponseDto`, `UpdateCourierStatusDto`
    - `LocationDto`, `OrderItemDto`
    - _Gereksinimler: 2.2, 5.2_

  - [x] 6.2 Validasyon kurallarını yaz
    - `CreateOrderDto`: `RestaurantId` zorunlu, `DeliveryAddress` boş olamaz, `Items` en az 1 eleman
    - `UpdateLocationDto`: enlem -90..90, boylam -180..180
    - DataAnnotations ile validation uygulandı
    - _Gereksinimler: 2.2, 5.2_

  - [ ]* 6.3 DTO validasyon birim testleri yaz
    - Sınır değer testleri (latitude/longitude aralıkları)
    - Eksik alan senaryoları
    - _Gereksinimler: 2.2, 5.2_

- [x] 7. Sipariş servisi ve controller
  - [x] 7.1 `IOrderService` ve `OrderService` implementasyonunu yaz
  - [x] 7.2 `OrdersController.cs` endpoint'lerini yaz
  - [ ]* 7.3 OrderService birim testleri yaz
    - Durum geçiş matrisi: geçerli ve geçersiz geçişler
    - Eşzamanlı sipariş çakışması (409) senaryosu
    - Sayfalama ve filtreleme
    - _Gereksinimler: 2.4, 4.1, 4.2_

- [x] 8. Konum servisi, rate limiting ve controller
  - [x] 8.1 `ILocationService` ve `LocationService` implementasyonunu yaz
  - [x] 8.2 `CouriersController.cs` endpoint'lerini yaz
  - [ ]* 8.3 LocationService birim testleri yaz
    - Rate limiting (3sn altı istek → 429)
    - Geçersiz koordinat sınır değerleri
    - Redis önbellek okuma/yazma
    - _Gereksinimler: 5.2, 5.4_

- [x] 9. Eşleştirme servisi ve Hangfire job
  - [x] 9.1 `IMatchingService` ve `MatchingService` implementasyonunu yaz
  - [x] 9.2 Hangfire retry mekanizması MatchingService içine entegre edildi
  - [x] 9.3 OrdersController'da sipariş oluşturunca matching tetikleniyor
  - [ ]* 9.4 MatchingService birim testleri yaz
    - Uygun kurye var / yok senaryoları
    - 3 başarısız denemede `failed` geçişi
    - _Gereksinimler: 3.3, 3.4, 3.5_

- [ ] 10. Kontrol noktası — Tüm testler geçiyor mu?
  - Tüm testlerin geçtiğini doğrula, takılan yerler varsa kullanıcıya sor.

- [x] 11. SignalR TrackingHub
  - [x] 11.1 `TrackingHub.cs`'i yaz
  - [x] 11.2 Hub bildirimleri servislere entegre edildi (OrderService, LocationService, MatchingService)
  - [ ]* 11.3 Hub entegrasyon testleri yaz

- [x] 12. Admin controller
  - [x] 12.1 `AdminController.cs` endpoint'lerini yaz

- [x] 13. Swagger / OpenAPI yapılandırması
  - [x] 13.1 `SwaggerExtensions.cs` JWT destekli Swagger yapılandırması

- [ ] 14. Kontrol noktası — Backend API tamamlandı
  - Tüm testlerin geçtiğini doğrula, Swagger UI üzerinden endpoint'leri manuel kontrol et.

- [ ] 15. React frontend — Proje iskeleti ve auth
  - [ ] 15.1 Vite + React + TypeScript projesini yapılandır
    - `axios` instance (`services/api.ts`): baseURL, JWT interceptor
    - `services/authService.ts`: login/register/me çağrıları
    - `LoginPage.tsx`: form, JWT'yi localStorage'a kaydet, rol'e göre yönlendirme
    - React Router kurulumu (`/login`, `/`, `/tracking/:orderId`, `/admin`, `/restaurant`)
    - _Gereksinimler: 1.1, 1.3_

  - [ ] 15.2 `useSignalR.ts` hook'unu yaz
    - `@microsoft/signalr` paketini ekle
    - `HubConnectionBuilder`, `withAutomaticReconnect`, JWT factory
    - `JoinOrderGroup` / `LeaveOrderGroup` invoke
    - `LocationUpdated`, `OrderStatusChanged`, `CourierAssigned` event listener'ları
    - `LocationTimeout` event'inde UI uyarısı
    - _Gereksinimler: 6.1, 6.2, 6.4_

  - [ ]* 15.3 useSignalR hook birim testleri yaz
    - Bağlantı kurma ve event listener kayıt senaryoları
    - _Gereksinimler: 6.1, 6.2_

- [ ] 16. React frontend — Harita ve takip bileşenleri
  - [ ] 16.1 Leaflet MapView bileşenini yaz
    - `react-leaflet` paketini ekle
    - `MapView.tsx`: OpenStreetMap tile layer, zoom kontrolleri
    - `CourierMarker.tsx`: animasyonlu marker (konum değişince `setLatLng` geçişi)
    - İlk yüklemede `GET /api/orders/{id}/tracking` ile anlık konumu çek
    - _Gereksinimler: 6.3, 6.5_

  - [ ] 16.2 `useOrderTracking.ts` hook'unu ve `TrackingPage.tsx`'i yaz
    - `useSignalR` ve `useOrderTracking` hook'larını birleştir
    - `OrderStatus` kartı: mevcut durum, timestamp
    - 30sn timeout uyarısı UI'ında göster (`LocationTimeout` olayı)
    - _Gereksinimler: 6.2, 6.4, 6.5_

- [ ] 17. React frontend — Müşteri, restoran ve admin sayfaları
  - [ ] 17.1 `CustomerPage.tsx` sipariş formu
    - `services/orderService.ts`: createOrder, getOrder
    - Restoran seçimi, adres girişi, ürün listesi
    - Sipariş oluşturduktan sonra `/tracking/:orderId`'ye yönlendir
    - _Gereksinimler: 2.1, 2.2_

  - [ ] 17.2 `AdminPage.tsx` ve `RestaurantPage.tsx`
    - `OrderList.tsx`: filtreli tablo (status, tarih aralığı, courierId), sayfalama
    - `AdminPage`: kuryeler tablosu, offline/online toggle
    - `RestaurantPage`: aktif siparişler canlı akışı (SignalR `OrderStatusChanged` dinle)
    - _Gereksinimler: 7.1, 7.2, 7.3, 7.4_

- [ ] 18. Son kontrol noktası — Tüm testler geçiyor mu?
  - Tüm birim ve entegrasyon testlerinin geçtiğini doğrula, takılan yerler varsa kullanıcıya sor.

---

## Notes

- `*` ile işaretli alt görevler opsiyoneldir; hızlı MVP için atlanabilir
- Her görev ilgili gereksinim numarasını belirtir; traceability sağlar
- Kontrol noktaları artımlı doğrulama için eklenmiştir
- PostGIS GIST index'leri migration dosyasında doğru oluşturulmalı (100ms altı sorgu hedefi — Gereksinim 8.2)
- Redis backplane, SignalR için çoklu API instance senaryolarında gereklidir
- JWT secret `appsettings.json`'dan değil, environment variable'dan okunmalı (Gereksinim 1.5)
- Flutter mobil istemci aynı REST API ve SignalR endpoint'lerini tüketir; bu planda backend tarafı kapatılmaktadır

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "3.2"] },
    { "id": 2, "tasks": ["2.3", "4.1", "6.1"] },
    { "id": 3, "tasks": ["2.4", "4.2", "6.2"] },
    { "id": 4, "tasks": ["4.3", "6.3", "7.1"] },
    { "id": 5, "tasks": ["7.2", "8.1", "9.1"] },
    { "id": 6, "tasks": ["7.3", "8.2", "9.2"] },
    { "id": 7, "tasks": ["8.3", "9.3", "11.1", "12.1", "13.1"] },
    { "id": 8, "tasks": ["9.4", "11.2"] },
    { "id": 9, "tasks": ["11.3", "15.1"] },
    { "id": 10, "tasks": ["15.2", "16.1"] },
    { "id": 11, "tasks": ["15.3", "16.2", "17.1"] },
    { "id": 12, "tasks": ["17.2"] }
  ]
}
```
