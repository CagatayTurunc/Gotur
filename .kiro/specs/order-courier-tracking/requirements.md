# Gereksinimler Dokümanı

## Giriş

Bu doküman, Yemeksepeti benzeri sipariş eşleştirme ve kurye anlık takip sisteminin MVP kapsamındaki gereksinimlerini tanımlar. Sistem; müşterilerin sipariş oluşturmasına, en yakın uygun kuryeye otomatik atama yapılmasına ve kuryenin gerçek zamanlı GPS konumunun web ve mobil istemcilere iletilmesine olanak tanır.

Sistem iki temel akış üzerine kurulmuştur:
1. **Sipariş Eşleştirme:** Sipariş oluşturulur → uygun kurye bulunur → kurye kabul eder → durum makinesi üzerinden teslimat tamamlanır.
2. **Anlık Kurye Takibi:** Kuryenin GPS konumu SignalR aracılığıyla web ve mobil istemcilere gerçek zamanlı aktarılır, harita üzerinde gösterilir.

Mimari değerlendirme kriteri: her teknoloji seçiminin trade-off gerekçesi ayrı bir `ARCHITECTURE.md` belgesinde ele alınacaktır.

---

## Sözlük

- **Sistem**: Tüm backend API, gerçek zamanlı altyapı ve frontend bileşenlerini kapsayan sipariş-kurye takip platformu.
- **API**: .NET Web API tabanlı, controller mimarisiyle uygulanan RESTful arka uç servisi.
- **Veritabanı**: PostgreSQL + PostGIS uzantısıyla çalışan ilişkisel veri deposu.
- **RealTime_Hub**: SignalR WebSocket altyapısı üzerinde çalışan gerçek zamanlı iletişim bileşeni.
- **Sipariş_Motoru**: Sipariş oluşturma, doğrulama ve durum geçişlerini yöneten bileşen.
- **Eşleştirme_Servisi**: Sipariş geldiğinde en yakın uygun kuryeyi hesaplayıp atayan bileşen.
- **Konum_Servisi**: Kuryenin GPS konumunu alan, depolayan ve yayınlayan bileşen.
- **Web_İstemcisi**: Leaflet + OpenStreetMap entegrasyonlu tarayıcı tabanlı arayüz (müşteri, restoran ve admin ekranları).
- **Mobil_İstemci**: Flutter ile geliştirilen mobil uygulama; aynı REST API'yi tüketir.
- **Müşteri**: Sipariş oluşturan ve kuryesini takip eden son kullanıcı.
- **Kurye**: GPS konumunu ileten, siparişleri kabul eden ve teslim eden saha çalışanı.
- **Admin**: Sipariş ve kurye yönetimini gerçekleştiren yetkili kullanıcı.
- **Sipariş_Durumu**: Sipariş yaşam döngüsünün geçerli adımı; `pending`, `assigned`, `picked`, `delivered` değerlerinden birini alır.
- **Coğrafi_Nokta**: PostGIS ile depolanan, enlem ve boylam içeren konum verisi.
- **JWT**: Kimlik doğrulama için kullanılan JSON Web Token.

---

## Gereksinimler

### Gereksinim 1: Kullanıcı Kimlik Doğrulama ve Yetkilendirme

**Kullanıcı Hikayesi:** Bir müşteri, kurye veya admin olarak sisteme giriş yapabilmek istiyorum; böylece kendi rolüme ait işlemleri gerçekleştirebileyim.

#### Kabul Kriterleri

1. WHEN bir kullanıcı geçerli kimlik bilgileriyle giriş isteği gönderdiğinde, THE API SHALL kullanıcıya rol bilgisini içeren bir JWT döndürür.
2. IF bir kullanıcı geçersiz kimlik bilgileriyle giriş isteği gönderirse, THEN THE API SHALL `401 Unauthorized` durum kodu ve açıklayıcı bir hata mesajı döndürür.
3. WHEN bir istemci yetkisiz bir uç noktaya JWT olmadan erişmeye çalıştığında, THE API SHALL `401 Unauthorized` yanıtı döndürür.
4. WHEN bir istemci yetersiz role sahip bir JWT ile kısıtlı bir uç noktaya erişmeye çalıştığında, THE API SHALL `403 Forbidden` yanıtı döndürür.
5. THE API SHALL JWT'yi en az 60 dakika geçerli olacak şekilde imzalar.
6. THE API SHALL parola bilgilerini veritabanında bcrypt ile hash'lenmiş biçimde saklar.

---

### Gereksinim 2: Sipariş Oluşturma

**Kullanıcı Hikayesi:** Bir müşteri olarak sipariş oluşturmak istiyorum; böylece yemek teslimatı talep edebileyim.

#### Kabul Kriterleri

1. WHEN bir müşteri geçerli bir sipariş isteği gönderdiğinde, THE Sipariş_Motoru SHALL siparişi `pending` durumunda Veritabanı'na kaydeder ve oluşturulan siparişin benzersiz kimliğini (UUID) döndürür.
2. IF bir sipariş isteğinde teslimat adresi, restoran kimliği veya ürün listesi eksikse, THEN THE Sipariş_Motoru SHALL `400 Bad Request` durum kodu ve eksik alan açıklamasını içeren bir hata mesajı döndürür.
3. WHEN bir sipariş başarıyla oluşturulduğunda, THE Sipariş_Motoru SHALL siparişin oluşturulma zaman damgasını UTC formatında kaydeder.
4. THE Sipariş_Motoru SHALL bir müşterinin aynı anda birden fazla `pending` veya `assigned` durumunda siparişi bulunmasına izin vermez ve bu durumda `409 Conflict` döndürür.

---

### Gereksinim 3: Kurye Eşleştirme

**Kullanıcı Hikayesi:** Bir sipariş oluşturulduğunda sistematik olarak en uygun kuryeye atanmasını istiyorum; böylece teslimat süreci hızla başlasın.

#### Kabul Kriterleri

1. WHEN `pending` durumunda bir sipariş oluşturulduğunda, THE Eşleştirme_Servisi SHALL Veritabanı'nda `müsait` durumundaki kuryeleri PostGIS `ST_Distance` fonksiyonu ile restoran konumuna göre sıralar ve en yakın kuryeyi belirler.
2. WHEN en yakın müsait kurye belirlendikten sonra, THE Eşleştirme_Servisi SHALL siparişi bu kuryeye atar, sipariş durumunu `assigned` olarak günceller ve kuryeye RealTime_Hub üzerinden atama bildirimi iletir.
3. IF sipariş oluşturulduğu anda 10 km yarıçap içinde müsait kurye bulunmazsa, THEN THE Eşleştirme_Servisi SHALL siparişi `pending` durumunda bırakır ve 60 saniye sonra eşleştirmeyi tekrar dener.
4. IF 3 ardışık eşleştirme denemesinin tamamı başarısız olursa, THEN THE Eşleştirme_Servisi SHALL siparişi `failed` durumuna geçirir ve müşteriye bildirim gönderir.
5. THE Eşleştirme_Servisi SHALL eşleştirme sürecini başlatmadan önce kuryenin `müsait` durumunu ve son konum güncellemesinin 5 dakikadan eski olmadığını doğrular.

---

### Gereksinim 4: Sipariş Durum Makinesi

**Kullanıcı Hikayesi:** Bir kurye veya sistem bileşeni olarak sipariş durumunu güncellemek istiyorum; böylece teslicat ilerleyişi tüm taraflara doğru yansısın.

#### Kabul Kriterleri

1. THE Sipariş_Motoru SHALL yalnızca aşağıdaki durum geçişlerine izin verir: `pending → assigned`, `assigned → picked`, `picked → delivered`.
2. IF Sipariş_Motoru geçersiz bir durum geçişi isteği alırsa, THEN THE Sipariş_Motoru SHALL `422 Unprocessable Entity` durum kodu ve mevcut geçerli geçişleri açıklayan bir hata mesajı döndürür.
3. WHEN bir sipariş durumu güncellendiğinde, THE Sipariş_Motoru SHALL güncelleme zaman damgasını UTC formatında Veritabanı'na kaydeder.
4. WHEN bir sipariş durumu güncellendiğinde, THE RealTime_Hub SHALL ilgili müşteri ve restoran bağlantılarına yeni durumu içeren bir bildirim yayınlar.
5. WHEN bir kurye siparişi teslim ettiğinde ve durum `delivered` olarak güncellendiğinde, THE Sipariş_Motoru SHALL kuryenin durumunu `müsait` olarak değiştirir.

---

### Gereksinim 5: Kurye Konum Güncelleme

**Kullanıcı Hikayesi:** Bir kurye olarak GPS konumumu sisteme iletmek istiyorum; böylece eşleştirme servisi ve müşteriler beni takip edebilelim.

#### Kabul Kriterleri

1. WHEN bir kurye geçerli bir JWT ile konum güncelleme isteği gönderdiğinde, THE Konum_Servisi SHALL gelen Coğrafi_Nokta verisini Veritabanı'nda kuryeye ait kayda günceller ve zaman damgasını UTC olarak kaydeder.
2. IF konum güncelleme isteğinde enlem veya boylam değeri geçerli aralık dışındaysa (enlem: -90 ile 90 arası, boylam: -180 ile 180 arası), THEN THE Konum_Servisi SHALL `400 Bad Request` ve açıklayıcı doğrulama hatası döndürür.
3. WHEN Konum_Servisi yeni bir Coğrafi_Nokta kaydettikten sonra, THE RealTime_Hub SHALL ilgili siparişi takip eden tüm bağlı istemcilere konum verisini 1 saniye içinde iletir.
4. THE Konum_Servisi SHALL kuryenin konum güncellemelerini en az 3 saniyede bir kabul eder; bu sürenin altındaki istekleri `429 Too Many Requests` ile reddeder.
5. WHILE bir kurye `picked` durumunda aktif bir siparişi teslim ediyorken, THE Konum_Servisi SHALL kuryenin son 100 konum noktasını Veritabanı'nda rota kaydı olarak saklar.

---

### Gereksinim 6: Anlık Kurye Takibi (Web ve Mobil İstemci)

**Kullanıcı Hikayesi:** Bir müşteri olarak siparişim yoldayken kuryenin konumunu harita üzerinde canlı takip etmek istiyorum; böylece teslimatın ne zaman geleceğini bileyim.

#### Kabul Kriterleri

1. WHEN bir müşteri aktif bir siparişi olan Web_İstemcisi veya Mobil_İstemci üzerinden takip ekranını açtığında, THE RealTime_Hub SHALL istemciyi ilgili siparişe ait bir SignalR grubuna ekler.
2. WHILE bir kurye `assigned` veya `picked` durumunda bir siparişi aktif olarak taşıyorken, THE RealTime_Hub SHALL bağlı istemcilere konum güncellemelerini 3 saniye içinde iletir.
3. WHEN müşteri takip ekranına bağlandığında, THE Konum_Servisi SHALL kuryenin en güncel Coğrafi_Nokta verisini HTTP yanıtında döndürür; böylece harita ilk yüklemede doğru konumu gösterir.
4. IF kuryenin konum verisi 30 saniyeden uzun süredir güncellenmemişse, THEN THE RealTime_Hub SHALL bağlı istemcilere `konum_zaman_aşımı` olayı gönderir.
5. THE Web_İstemcisi SHALL kurye konumunu Leaflet + OpenStreetMap tabanlı haritada bir işaretçi (marker) olarak gösterir ve konum güncellendiğinde işaretçiyi animasyonlu biçimde yeni konuma taşır.

---

### Gereksinim 7: Restoran ve Admin Paneli

**Kullanıcı Hikayesi:** Bir restoran yöneticisi veya admin olarak aktif siparişleri ve kuryeleri görüntülemek istiyorum; böylece operasyonu yönetebileyim.

#### Kabul Kriterleri

1. WHEN bir admin veya restoran rolüne sahip kullanıcı sipariş listesi isteği gönderdiğinde, THE API SHALL yalnızca o kullanıcının yetkisi dahilindeki siparişleri filtreli ve sayfalanmış biçimde döndürür.
2. THE API SHALL sipariş listesi uç noktasında `durum`, `tarih aralığı` ve `kurye kimliği` parametrelerine göre filtrelemeyi destekler.
3. WHEN bir admin aktif kurye listesini sorguladığında, THE API SHALL her kurye için mevcut durumu ve son konum güncelleme zaman damgasını döndürür.
4. WHEN bir admin bir kuryeyi `müsait dışı` olarak işaretlediğinde, THE Eşleştirme_Servisi SHALL o kuryeyi yeni eşleştirme hesaplamalarına dahil etmez.

---

### Gereksinim 8: Coğrafi Veri Depolama ve Sorgulama

**Kullanıcı Hikayesi:** Bir sistem bileşeni olarak konum verilerini verimli biçimde depolamak ve sorgulamak istiyorum; böylece eşleştirme ve takip hesaplamaları düşük gecikmeyle çalışsın.

#### Kabul Kriterleri

1. THE Veritabanı SHALL kurye konum verilerini PostGIS `geography(Point, 4326)` veri tipiyle saklar.
2. THE Veritabanı SHALL kurye konum sütunu üzerinde PostGIS GIST indeksi bulundurur; böylece mesafe sorguları 100 ms altında tamamlanır.
3. WHEN Eşleştirme_Servisi en yakın kuryeyi ararken, THE Veritabanı SHALL `ST_DWithin` fonksiyonuyla belirli yarıçap içindeki kayıtları filtreler ve `ST_Distance` ile sıralar.
4. THE Veritabanı SHALL rota kaydı için kurye konum geçmişini `JSONB` veya ayrı bir `courier_location_history` tablosunda saklar.

---

### Gereksinim 9: API Dokümantasyonu

**Kullanıcı Hikayesi:** Bir geliştirici (mobil ekip dahil) olarak API sözleşmesini kolayca keşfetmek istiyorum; böylece entegrasyonu hızlı tamamlayabilirim.

#### Kabul Kriterleri

1. THE API SHALL tüm REST uç noktalarını Swagger/OpenAPI 3.0 formatında belgeler ve `/swagger` yolundan erişilebilir kılar.
2. THE API SHALL her uç nokta için istek gövdesi şemasını, başarı ve hata yanıt kodlarını Swagger dokümanında tanımlar.
3. WHERE geliştirme ortamı aktifken, THE API SHALL Swagger arayüzünün kimlik doğrulaması gerektirmeden erişilebilir olmasını sağlar.
