# 📱 Götür — Flutter Mobil

> Bu klasör, Götür projesinin Flutter mobil uygulamasına ayrılmıştır.

## Geliştirici

Bu kısım **[Arkadaşın Adı]** tarafından geliştirilecektir.

---

## Hedef Özellikler

- [ ] JWT tabanlı giriş / kayıt
- [ ] Sipariş listesi ve sipariş verme
- [ ] Canlı kurye konumu takibi (SignalR + `flutter_map`)
- [ ] Kurye paneli (konum gönderme, sipariş durumu güncelleme)
- [ ] Restoran listesi ve menü görüntüleme

---

## Teknik Hedefler

| Konu | Hedef |
|------|-------|
| State Management | Provider / Riverpod |
| HTTP | `dio` |
| Harita | `flutter_map` + OpenStreetMap |
| Real-time | `signalr_netcore` |
| Auth | JWT — `flutter_secure_storage` |

---

## Backend Bağlantısı

Backend varsayılan olarak `http://localhost:5131` adresinde çalışır.

```dart
// lib/core/constants.dart
const String baseUrl = 'http://10.0.2.2:5131'; // Android emülatör için
// iOS simülatör: http://localhost:5131
```

Swagger dokümantasyonu: `http://localhost:5131/swagger`

---

## Kurulum (Flutter hazır olduktan sonra)

```bash
cd mobile
flutter pub get
flutter run
```

---

## Kök README

Tüm proje için → [../../README.md](../README.md)
