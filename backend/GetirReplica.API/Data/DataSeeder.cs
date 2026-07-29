using GetirReplica.API.Models.Entities;
using GetirReplica.API.Models.Enums;
using GetirReplica.API.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Data;

public static class DataSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Rolleri oluştur
        string[] roles = ["admin", "customer", "courier", "restaurant"];
        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole<Guid> { Name = role, NormalizedName = role.ToUpper() });
        }

        // Admin
        if (await userManager.FindByEmailAsync("admin@gotur.com") == null)
        {
            var admin = new AppUser { Email = "admin@gotur.com", UserName = "admin@gotur.com", FullName = "Sistem Yöneticisi", Role = "admin" };
            await userManager.CreateAsync(admin, "Admin123!");
            await userManager.AddToRoleAsync(admin, "admin");
        }

        // Müşteriler
        var customers = new[]
        {
            ("ahmet.yilmaz@gotur.com", "Ahmet Yılmaz"),
            ("elif.kaya@gotur.com", "Elif Kaya"),
            ("mehmet.demir@gotur.com", "Mehmet Demir"),
            ("zeynep.arslan@gotur.com", "Zeynep Arslan"),
            ("can.ozturk@gotur.com", "Can Öztürk"),
        };
        foreach (var (email, fullName) in customers)
        {
            if (await userManager.FindByEmailAsync(email) == null)
            {
                var c = new AppUser { Email = email, UserName = email, FullName = fullName, Role = "customer" };
                await userManager.CreateAsync(c, "Test123!");
                await userManager.AddToRoleAsync(c, "customer");
            }
        }

        // Kuryeler
        var courierDefs = new[]
        {
            ("kurye.istanbul1@gotur.com", "Serkan Çelik",   41.0082, 28.9784),
            ("kurye.istanbul2@gotur.com", "Burak Şahin",    41.0422, 29.0083),
            ("kurye.ankara1@gotur.com",   "Fatih Erdoğan",  39.9208, 32.8541),
            ("kurye.ankara2@gotur.com",   "Hakan Koç",      39.9334, 32.8597),
        };
        foreach (var (email, fullName, lat, lng) in courierDefs)
        {
            AppUser? cu = await userManager.FindByEmailAsync(email);
            if (cu == null)
            {
                cu = new AppUser { Email = email, UserName = email, FullName = fullName, Role = "courier" };
                await userManager.CreateAsync(cu, "Test123!");
                await userManager.AddToRoleAsync(cu, "courier");
            }
            if (!db.Couriers.Any(c => c.UserId == cu.Id))
            {
                db.Couriers.Add(new Courier { UserId = cu.Id, Status = CourierStatus.Available,
                    CurrentLocationLat = lat, CurrentLocationLng = lng, LastLocationAt = DateTime.UtcNow });
            }
            else
            {
                var ec = db.Couriers.First(c => c.UserId == cu.Id);
                ec.LastLocationAt = DateTime.UtcNow;
                // Offline veya Busy (aktif siparişi yoksa) olan kuryeleri Available yap
                if (ec.Status == CourierStatus.Offline || ec.Status == CourierStatus.Busy)
                {
                    var hasActiveOrder = db.Orders.Any(o =>
                        o.CourierId == ec.Id &&
                        (o.Status == OrderStatus.Assigned || o.Status == OrderStatus.Picked));
                    if (!hasActiveOrder)
                        ec.Status = CourierStatus.Available;
                }
            }
        }
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        await SeedAllRestaurantsAsync(userManager, db);
        await SeedFeatureFlagsAsync(db);
    }

    private static async Task SeedFeatureFlagsAsync(AppDbContext db)
    {
        // Varsayılan flag'ler — sadece yoksa ekle (idempotent)
        var flags = new[]
        {
            new FeatureFlag
            {
                Name             = FeatureFlagService.Flags.NewMatchingAlgorithm,
                IsEnabled        = false,
                RolloutPercentage= 0,
                Description      = "Yeni kurye eşleştirme algoritması. Önce %10 ile test edilir."
            },
            new FeatureFlag
            {
                Name             = FeatureFlagService.Flags.MaintenanceMode,
                IsEnabled        = false,
                RolloutPercentage= 100,
                Description      = "Bakım modu — açıksa tüm sipariş yaratma istekelri reddedilir."
            },
            new FeatureFlag
            {
                Name             = FeatureFlagService.Flags.CourierSurgePricing,
                IsEnabled        = false,
                RolloutPercentage= 0,
                Description      = "Yoğun saatlerde dinamik teslimat ücreti. Pilot aşamada."
            },
            new FeatureFlag
            {
                Name             = FeatureFlagService.Flags.AdvancedOutboxRetry,
                IsEnabled        = true,
                RolloutPercentage= 100,
                Description      = "Outbox processor için exponential backoff retry stratejisi."
            },
        };

        foreach (var flag in flags)
        {
            if (!await db.FeatureFlags.AnyAsync(f => f.Name == flag.Name))
                db.FeatureFlags.Add(flag);
        }

        await db.SaveChangesAsync();
    }


    private static async Task SeedAllRestaurantsAsync(UserManager<AppUser> userManager, AppDbContext db)
    {
        var restaurants = GetRestaurantDefinitions();
        foreach (var d in restaurants)
        {
            // 1. Kullanıcı yoksa oluştur (UserManager kendi transaction'ını yönetir)
            var existing = await userManager.FindByEmailAsync(d.Email);
            if (existing == null)
            {
                var newUser = new AppUser
                {
                    Email    = d.Email,
                    UserName = d.Email,
                    FullName = d.OwnerName,
                    Role     = "restaurant"
                };
                var result = await userManager.CreateAsync(newUser, "Rest123!");
                if (result.Succeeded)
                    await userManager.AddToRoleAsync(newUser, "restaurant");
            }

            // 2. Kullanıcıyı DB'den doğrudan çek (UserManager cache'ini bypass et)
            db.ChangeTracker.Clear();
            var userId = await db.Users
                .Where(u => u.NormalizedEmail == d.Email.ToUpper() && !u.IsDeleted)
                .Select(u => u.Id)
                .FirstOrDefaultAsync();

            if (userId == Guid.Empty) continue; // kullanıcı oluşturulamadıysa geç

            // 3. Restoran zaten varsa atla
            if (await db.Restaurants.AnyAsync(r => r.UserId == userId)) continue;

            // 4. Restoranı ekle ve kaydet
            var rest = new Restaurant
            {
                UserId      = userId,
                Name        = d.Name,
                Address     = d.Address,
                Description = d.Description,
                LogoUrl     = d.LogoUrl,
                IsOpen      = true,
                LocationLat = d.Lat,
                LocationLng = d.Lng,
            };
            db.Restaurants.Add(rest);
            await db.SaveChangesAsync();

            // 5. Menü ürünlerini ekle
            int sort = 0;
            foreach (var item in d.MenuItems)
            {
                db.MenuItems.Add(new MenuItem
                {
                    RestaurantId = rest.Id,
                    Name         = item.Name,
                    Description  = item.Description,
                    Price        = item.Price,
                    Category     = item.Category,
                    ImageUrl     = item.ImageUrl,
                    IsAvailable  = true,
                    SortOrder    = sort++,
                });
            }
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
        }
    }

    record MenuItemDef(string Name, string Description, decimal Price, string Category, string ImageUrl);
    record RestaurantDef(string Email, string OwnerName, string Name, string Address,
        double Lat, double Lng, string Description, string LogoUrl, MenuItemDef[] MenuItems);


    private static RestaurantDef[] GetRestaurantDefinitions() => new[]
    {
        // ════════════════════════════════════════════════════════════════
        // İSTANBUL RESTORANLAR (50 adet)
        // ════════════════════════════════════════════════════════════════

        // 1 — Kadıköy · Kebap
        new RestaurantDef(
            Email: "karadeniz.mangal@gotur.com", OwnerName: "Mustafa Karadeniz",
            Name: "Karadeniz Mangal", Address: "Bahariye Cad. No:14, Kadıköy, İstanbul",
            Lat: 40.9911, Lng: 29.0267,
            Description: "Kadıköy'ün köklü mangal lezzetleri. Her gün taze yakılan közde pişen etler.",
            LogoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Adana Kebap",      "200g acılı kıyma kebap, lavaş ve söğüş",        189m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Urfa Kebap",        "200g acısız kıyma kebap, piyaz ve turşu",       179m, "Kebap",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Dana Şiş",          "Küp dana bonfile şiş, közde pişmiş",            219m, "Kebap",    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Şiş",         "Marine edilmiş tavuk göğsü şiş",               159m, "Kebap",    "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop"),
                new MenuItemDef("Kaburga Kebabı",    "Fırında yavaş pişirilmiş dana kaburga",         259m, "Özel",     "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Lahmacun (3'lü)",  "El açması ince hamur, kıymalı",                 90m,  "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Ezogelin Çorbası",  "Kırmızı mercimek, nane ve kırmızı biber",       55m,  "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",             "Soğuk ev yapımı ayran 400ml",                  25m,  "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
                new MenuItemDef("Baklava (2 dilim)", "Antep fıstıklı ev baklavası",                  75m,  "Tatlı",    "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop"),
            }
        ),

        // 2 — Beşiktaş · Dürüm & Döner
        new RestaurantDef(
            Email: "besiktas.donercisi@gotur.com", OwnerName: "Erkan Yıldız",
            Name: "Yıldız Dönerci", Address: "Sinanpaşa Mah. Beşiktaş, İstanbul",
            Lat: 41.0428, Lng: 29.0066,
            Description: "35 yıllık geleneksel döner ustasından et döner ve tavuk dürüm.",
            LogoUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Et Döner Porsiyon",  "200g dana döner, pilav ve söğüş",             169m, "Döner",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Döner Dürüm",  "İnce lavaşta tavuk döner, sos ve söğüş",      99m,  "Dürüm",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Et Döner Dürüm",     "İnce lavaşta et döner, acı sos",              119m, "Dürüm",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Yarım Ekmek Döner",  "Somun ekmeğinde et veya tavuk döner",         79m,  "Döner",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Döner + Ayran Set",  "Dürüm döner ve soğuk ayran",                 115m, "Set Menü", "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",              "Soğuk ayran 400ml",                           25m,  "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
                new MenuItemDef("Kola",               "Kutu kola 330ml",                             30m,  "İçecek",   "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 3 — Üsküdar · İskender
        new RestaurantDef(
            Email: "uskudar.iskender@gotur.com", OwnerName: "Ramazan Güneş",
            Name: "Uludağ İskender", Address: "Hakimiyet-i Milliye Cad. Üsküdar, İstanbul",
            Lat: 41.0231, Lng: 29.0151,
            Description: "Bursa usulü gerçek İskender kebabı, tereyağı ve domates sosuyla.",
            LogoUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("İskender (Tam)",     "300g döner, yoğurt, tereyağı sos, domates",   249m, "İskender", "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("İskender (Yarım)",   "150g döner, yoğurt ve tereyağı ile",           149m, "İskender", "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Döner Dürüm",        "İnce lavaşta döner ve söğüş",                 120m, "Dürüm",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Pide",       "El açması kıymalı pide",                      130m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",   "Günlük taze mercimek çorbası",                 55m,  "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Sütlaç",             "Fırında üstü kızarmış sütlaç",                65m,  "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Şalgam Suyu",        "Adana usulü acı şalgam",                      30m,  "İçecek",   "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop"),
            }
        ),


        // 4 — Karaköy · Baklava
        new RestaurantDef(
            Email: "gulluo.karakoy@gotur.com", OwnerName: "Murat Güllüoğlu",
            Name: "Güllüoğlu Baklava", Address: "Mumhane Cad. No:171, Karaköy, İstanbul",
            Lat: 41.0244, Lng: 28.9747,
            Description: "1871'den bu yana el yapımı Antep fıstıklı baklava ve şerbetli tatlılar.",
            LogoUrl: "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Antep Fıstıklı Baklava 250g", "Özel kesim, bol fıstıklı",           185m, "Baklava",  "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop"),
                new MenuItemDef("Sütlü Nuriye 250g",           "Hafif sütlü baklava",                165m, "Baklava",  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Şöbiyet",                     "Kaymak dolgulu çıtır baklava",       175m, "Baklava",  "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop"),
                new MenuItemDef("Karışık Baklava 1kg",         "Hediye kutusunda karışık 1kg",       580m, "Baklava",  "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop"),
                new MenuItemDef("Künefe",                      "Sıcak servis, peynirli tel kadayıf", 120m, "Tatlı",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Şerbetli Lokma",              "Altın rengi bol şerbetli lokma",      75m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Tel Kadayıf",                 "Cevizli ve fıstıklı tel kadayıf",   145m, "Tatlı",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Türk Kahvesi",                "Menengiç veya sade Türk kahvesi",    55m,  "İçecek",   "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
            }
        ),

        // 5 — Beyoğlu · Dondurma
        new RestaurantDef(
            Email: "mado.beyoglu@gotur.com", OwnerName: "Levent Özdemir",
            Name: "Mado Dondurma", Address: "İstiklal Cad. No:57, Beyoğlu, İstanbul",
            Lat: 41.0338, Lng: 28.9775,
            Description: "Gerçek salep ve keçi sütünden yapılan Maraş usulü dondurma.",
            LogoUrl: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Tek Top Dondurma",        "Maraş dondurması 1 top, külah/kap",      45m,  "Dondurma", "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop"),
                new MenuItemDef("Üç Top Dondurma",         "3 top dondurma, çeşit seçiminize göre", 110m,  "Dondurma", "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&h=300&fit=crop"),
                new MenuItemDef("Dondurmalı Waffle",       "Waffle + 2 top dondurma + çikolata sos",145m,  "Özel",     "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=400&h=300&fit=crop"),
                new MenuItemDef("Dondurma Sandviç",        "Sıkma dondurma Maraş usulü",             75m,  "Dondurma", "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop"),
                new MenuItemDef("Meyve Sorbe",             "Çilek, mango veya limon sorbe",           65m,  "Sorbe",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Dondurmalı Profiterol",   "Çikolata soslu dondurma dolgulu",        120m,  "Özel",     "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Sıcak Çikolata",          "Kremalı sıcak çikolata, marshmallow ile", 75m,  "İçecek",  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
            }
        ),

        // 6 — Fatih · Balık
        new RestaurantDef(
            Email: "kumkapi.balik@gotur.com", OwnerName: "Hüseyin Deniz",
            Name: "Kumkapı Balık Evi", Address: "Kumkapı Meydan, Fatih, İstanbul",
            Lat: 41.0050, Lng: 28.9598,
            Description: "Boğaz'dan günlük gelen taze balık. Lüfer, çipura, levrek mevsiminde.",
            LogoUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Izgara Lüfer",         "Mevsim balığı, salata ve limon ile",          289m, "Balık",    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Çipura Buğulama",      "Zeytinyağlı, sebzeli buğulama",               229m, "Balık",    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Kalamares Tava",       "Çıtır kalamares, tarator sos ile",            149m, "Meze",     "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Midye Dolma (6 adet)", "Pirinçli midye dolma",                         60m,  "Meze",     "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Balık Ekmek",          "Izgara balık fileto, ekmekte",                 95m,  "Sandviç",  "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Çoban Salata",         "Domates, salatalık, biber, soğan",             65m,  "Salata",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Rakı (Şişe)",          "Tekirdağ rakısı, mezeylle",                   195m, "İçecek",   "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),


        // 7 — Şişli · McDonald's
        new RestaurantDef(
            Email: "mcdonalds.sisli@gotur.com", OwnerName: "McDonald's Türkiye A.Ş.",
            Name: "McDonald's Şişli", Address: "Büyükdere Cad. No:1, Şişli, İstanbul",
            Lat: 41.0622, Lng: 28.9873,
            Description: "Dünyaca ünlü lezzetler kapınızda. Big Mac, McChicken ve daha fazlası.",
            LogoUrl: "https://images.unsplash.com/photo-1619881590738-a111d176d906?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Big Mac",             "Çift köfte, özel sos, marul ve turşu",        139m, "Burger",   "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("McChicken",           "Çıtır tavuk, mayo ve marul",                  109m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Cheeseburger",        "Sığır köfte, kaşar peyniri, turşu, hardal",   69m,  "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("McTurco",             "Dönerli sandviç, özel Türk sosu ile",         129m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("McNuggets 9'lu",      "9 adet çıtır tavuk nugget, sos seçimi",       119m, "Chicken",  "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"),
                new MenuItemDef("Patates Kızartması L","Büyük boy patates kızartması",                 59m,  "Yan Ürün", "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("McFlurry Oreo",       "Vanilyalı dondurma, Oreo parçaları",           75m,  "Tatlı",    "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop"),
                new MenuItemDef("Büyük Boy Menü",      "Burger + L patates + L içecek",               199m, "Menü",     "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Coca-Cola L",         "Büyük boy kola 500ml",                         39m,  "İçecek",   "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 8 — Bağcılar · Pizza
        new RestaurantDef(
            Email: "dominos.bagcilar@gotur.com", OwnerName: "Domino's Pizza Türkiye",
            Name: "Domino's Pizza Bağcılar", Address: "Güneşli Mah. Bağcılar, İstanbul",
            Lat: 41.0355, Lng: 28.8561,
            Description: "Sıcak ve çıtır pizza 30 dakikada kapınızda.",
            LogoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Karışık Pizza L",     "Sucuk, pastırma, biber, mantar, zeytin",      259m, "Pizza",    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop"),
                new MenuItemDef("Margarita Pizza L",   "Domates sos, mozzarella, fesleğen",           199m, "Pizza",    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("Sucuklu Pizza M",     "Türk sucuğu ve kaşar peyniri",                189m, "Pizza",    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuklu Pizza L",     "Barbekü soslu tavuk, mısır, biber",           249m, "Pizza",    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("Garlik Bread",        "Sarımsaklı tereyağlı ekmek, 4 dilim",         79m,  "Yan Ürün", "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Patates Kızartması",  "Çıtır patates kızartması, ketçap ile",         69m,  "Yan Ürün", "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("2'li Pizza Kampanyası","2 adet L boy pizza seçimi",                  419m, "Kampanya", "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop"),
                new MenuItemDef("Kola 1L",             "Büyük boy kola şişe",                          45m,  "İçecek",   "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 9 — Sarıyer · Börek
        new RestaurantDef(
            Email: "sariyer.borekci@gotur.com", OwnerName: "Sema Aydın",
            Name: "Sarıyer Börekçisi", Address: "Merkez Mah. Sarıyer, İstanbul",
            Lat: 41.1671, Lng: 29.0519,
            Description: "Eller hamurdan el açması börekler. Ispanaklı, peynirli ve kıymalı.",
            LogoUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Ispanak Böreği (5 dilim)","El açması, ıspanak ve beyaz peynirli",     95m,  "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Börek (5 dilim)", "Kıyma, soğan ve baharatlı iç harcı",      95m,  "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Patatesli Börek (5 dilim)","Baharatlı patates iç harçlı",             85m,  "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Su Böreği",               "Haşlanmış hamur, beyaz peynirli",         110m,  "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Sigara Böreği (8 adet)",  "Çıtır sigara böreği, beyaz peynirli",     89m,  "Börek",    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Simit",                   "Taze fırından simit",                      15m,  "Fırın",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay",                     "Demli çay, bardak",                        15m,  "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",                   "Soğuk ayran 400ml",                        25m,  "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 10 — Maltepe · Burger
        new RestaurantDef(
            Email: "burgerkral.maltepe@gotur.com", OwnerName: "Burger Kral A.Ş.",
            Name: "Burger Kral Maltepe", Address: "Bağlarbaşı Mah. Maltepe, İstanbul",
            Lat: 40.9374, Lng: 29.1306,
            Description: "Türkiye'nin lezzet zinciri. Whopper ve daha fazlası.",
            LogoUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Whopper",             "Dana köfte, marul, domates, soğan",           149m, "Burger",   "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Crispy Chicken",      "Çıtır tavuk sandviç, mayo ve marul",          119m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Whopper Menü",        "Whopper + L patates + L içecek",              219m, "Menü",     "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Onion Rings",         "Çıtır soğan halkaları",                        79m,  "Yan Ürün", "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Patates Kızartması M","Orta boy patates kızartması",                  49m,  "Yan Ürün", "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Milkshake Çikolata",  "Kremalı çikolatalı milkshake",                 85m,  "İçecek",   "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&h=300&fit=crop"),
            }
        ),


        // 11 — Taksim · Kahvaltı
        new RestaurantDef(
            Email: "taksim.kahvalti@gotur.com", OwnerName: "Güneş Yıldırım",
            Name: "Van Kahvaltı Evi", Address: "Sıraselviler Cad. Taksim, İstanbul",
            Lat: 41.0369, Lng: 28.9857,
            Description: "Van usulü serpme kahvaltı, bal, kaymak, otlu peynir ve daha fazlası.",
            LogoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Serpme Kahvaltı (2 kişi)","20 çeşit Van yöresi ürün, bal, kaymak",  480m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Tek Kişilik Kahvaltı",    "10 çeşit ürün, yumurta, çay dahil",     249m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Otlu Peynir Tabağı",      "Van'ın meşhur otlu peynirleri",          120m, "Peynir",   "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Bal ve Kaymak",           "Çiçek balı ve tam yağlı kaymak",         110m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Menemen",                 "Domates, biber, yumurta kavurma",         95m,  "Sıcak",    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Taze Sıkılmış Portakal",  "Taze sıkılmış portakal suyu 300ml",      55m,  "İçecek",   "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay (Demlik)",            "2 kişilik demlik çay",                    40m,  "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
            }
        ),

        // 12 — Kartal · Pide
        new RestaurantDef(
            Email: "kartal.pidecisi@gotur.com", OwnerName: "Ahmet Trabzonlu",
            Name: "Karadeniz Pide Evi", Address: "Topselvi Mah. Kartal, İstanbul",
            Lat: 40.9063, Lng: 29.1866,
            Description: "Karadeniz usulü taş fırında pide. Kiymali, peynirli, kuşbaşılı.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kıymalı Pide",        "İnce hamur, kıyma ve soğan",                 130m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kaşarlı Pide",        "Bol kaşar peynirli, tereyağlı",              125m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuşbaşılı Pide",      "Dana kuşbaşı, biber ve domates",             159m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Yumurtalı Pide",      "Yumurta ve kaşar peyniri",                   120m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Lahmacun (4'lü)",     "El açması ince lahmacun",                    110m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Çorba",               "Günlük mercimek veya paça çorbası",           55m,  "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                 25m,  "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 13 — Avcılar · Kumpir
        new RestaurantDef(
            Email: "avcilar.kumpir@gotur.com", OwnerName: "Nilgün Çetin",
            Name: "Ortaköy Kumpir", Address: "Cihangir Mah. Avcılar, İstanbul",
            Lat: 40.9797, Lng: 28.7219,
            Description: "Ortaköy usulü kumpir. 20'den fazla malzeme seçeneğiyle.",
            LogoUrl: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Klasik Kumpir",       "Tereyağı, kaşar, 5 malzeme seçimi",          110m, "Kumpir",   "https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&h=300&fit=crop"),
                new MenuItemDef("Mega Kumpir",         "Tereyağı, kaşar, 10 malzeme seçimi",         149m, "Kumpir",   "https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&h=300&fit=crop"),
                new MenuItemDef("Vejeteryan Kumpir",   "Sebze, mantar, mısır, zeytin, turşu",        119m, "Kumpir",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Patates Kızartması",  "Çıtır patates, ketçap ile",                   65m,  "Yan Ürün", "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Waffle",              "Çikolata veya meyveli waffle",                95m,  "Tatlı",    "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran / Kola",        "Soğuk ayran veya kola",                       30m,  "İçecek",   "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 14 — Pendik · Tantuni
        new RestaurantDef(
            Email: "pendik.tantuni@gotur.com", OwnerName: "Orhan Mersin",
            Name: "Mersin Tantunisi", Address: "Kurtköy Mah. Pendik, İstanbul",
            Lat: 40.8845, Lng: 29.2405,
            Description: "Gerçek Mersin tantunisi. Lavaşta veya ekmekte, baharatlı.",
            LogoUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Tantuni Dürüm",       "Lavaşta tantuni, domates, maydanoz",          99m,  "Tantuni",  "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Tantuni Ekmek",       "Somunda tantuni, bol soslu",                   89m,  "Tantuni",  "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Çift Et Tantuni",     "200g et, bol baharatlı",                      129m,  "Tantuni",  "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Patates Kızartması",  "Çıtır patates",                                55m,  "Yan Ürün", "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Şalgam Suyu",         "Acı şalgam suyu",                              30m,  "İçecek",   "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m,  "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 15 — Bakırköy · Sushi
        new RestaurantDef(
            Email: "bakirkoy.sushi@gotur.com", OwnerName: "Kenji Yılmaz",
            Name: "Tokyo Sushi", Address: "İncirli Cad. Bakırköy, İstanbul",
            Lat: 40.9800, Lng: 28.8700,
            Description: "Taze malzemelerle hazırlanan Japon mutfağı. Sushi, sashimi, ramen.",
            LogoUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Salmon Nigiri (8 adet)","Taze somon üstü pirinç",                   199m, "Sushi",    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=300&fit=crop"),
                new MenuItemDef("California Roll (8 adet)","Yengeç, avokado, salatalık",             179m, "Maki",     "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=400&h=300&fit=crop"),
                new MenuItemDef("Spicy Tuna Roll",       "Acılı ton, salatalık, avokado",            189m, "Maki",     "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=400&h=300&fit=crop"),
                new MenuItemDef("Miso Çorba",            "Geleneksel miso, tofu ve deniz yosunu",     65m,  "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Gyoza (6 adet)",        "Buharda pişmiş sebzeli Japon mantısı",     115m, "Meze",     "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Chicken Ramen",         "Tavuk suyu, noodle, yumurta, bambu",       175m, "Ramen",    "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Japon Çayı",            "Yeşil çay, ıhlamur veya sarı çay",          45m,  "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
            }
        ),


        // 16 — Ataşehir · Çiğ Köfte
        new RestaurantDef(
            Email: "ataşehir.cigkofteci@gotur.com", OwnerName: "Barış Demirci",
            Name: "Harbi Çiğ Köfte", Address: "Barbaros Mah. Ataşehir, İstanbul",
            Lat: 40.9924, Lng: 29.1245,
            Description: "Acı-tatlı dengesiyle özenle hazırlanan el yapımı çiğ köfte.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Dürüm (Orta Acı)",   "Marul, nar ekşisi, limon ile dürüm",          55m,  "Dürüm",    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Dürüm (Sade)",       "Acısız çiğ köfte dürüm",                      55m,  "Dürüm",    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Dürüm (Çok Acı)",    "Acı sos bol eklenmiş özel dürüm",             55m,  "Dürüm",    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Tabak (Büyük)",      "200g çiğ köfte, limon, nar ekşisi",            90m,  "Tabak",    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("5'li Set",            "5 adet dürüm, aile boyu",                    245m,  "Set",      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                 25m,  "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 17 — Beykoz · Balık
        new RestaurantDef(
            Email: "beykoz.balikevi@gotur.com", OwnerName: "Serdar Balıkçı",
            Name: "Boğaz Balık Evi", Address: "Merkez Mah. Beykoz, İstanbul",
            Lat: 41.1247, Lng: 29.1013,
            Description: "Boğaz kıyısında taze balık. Lüfer mevsiminde sofrayı taçlandırır.",
            LogoUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Izgara Çipura",       "Taze çipura, salata ve pilav ile",            259m, "Balık",    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Levrek Buğulama",     "Zeytinyağlı levrek, sebzeli",                 279m, "Balık",    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Hamsi Tava",          "Bol hamsi tava, mısır unu ile",               149m, "Balık",    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Deniz Mahsulleri Tava","Kalamar, karides, midye karışık tava",       219m, "Meze",     "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Rakı Balık Set",      "2 adet balık, meze ve içki dahil",            450m, "Set",      "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
                new MenuItemDef("Salata",              "Çoban salata veya roka salatası",              65m,  "Salata",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
            }
        ),

        // 18 — Şile · Mangal
        new RestaurantDef(
            Email: "sile.kasap@gotur.com", OwnerName: "Ferit Kasap",
            Name: "Şile Kasap ve Mangal", Address: "Üvezli Mah. Şile, İstanbul",
            Lat: 41.1756, Lng: 29.6114,
            Description: "Köy ortamında taş mangalda pişen et lezzetleri.",
            LogoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kuzu Pirzola",        "4 adet kuzu pirzola, közlenmiş sebze ile",   299m, "Izgara",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Antrikot",            "300g dana antrikot, orta pişmiş",             349m, "Izgara",   "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"),
                new MenuItemDef("Köfte",               "El yapımı köfte, 6 adet, söğüş ile",         189m, "Izgara",   "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Kanat",               "Marine edilmiş tavuk kanat, 8 adet",          165m, "Tavuk",    "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop"),
                new MenuItemDef("Pilav",               "Tereyağlı pirinç pilavı",                      45m,  "Yan Ürün", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m,  "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 19 — Eyüp · Köfte
        new RestaurantDef(
            Email: "eyup.kofte@gotur.com", OwnerName: "Tahsin Yiğit",
            Name: "Eyüp Köftecisi", Address: "Düğmeciler Mah. Eyüp, İstanbul",
            Lat: 41.0500, Lng: 28.9374,
            Description: "1952'den beri aynı tariften hazırlanan Eyüp usulü ızgara köfte.",
            LogoUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Izgara Köfte",        "6 adet ızgara köfte, ekmek ve söğüş",        145m, "Köfte",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Çiğ Köfte (Tabak)",  "Porsiyonluk ızgara öncesi köfte",              89m, "Köfte",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Köfte Ekmek",         "3 köfte, somun ekmek, sos",                    79m, "Sandviç",  "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Piyaz",               "Fasulye, soğan, maydanoz, sirke sosu",         55m, "Salata",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m, "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
                new MenuItemDef("Su",                  "500ml şişe su",                                10m, "İçecek",   "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 20 — Zeytinburnu · Kokoreç
        new RestaurantDef(
            Email: "zeytinburnu.kokorec@gotur.com", OwnerName: "Cemal Usta",
            Name: "Cemal Usta Kokoreç", Address: "Beştelsiz Mah. Zeytinburnu, İstanbul",
            Lat: 40.9959, Lng: 28.9068,
            Description: "İstanbul'un efsane kokoreçcisi. Sabahtan akşama kadar.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kokoreç Yarım",       "1/2 ekmek kokoreç, kekik ve kırmızı biber",   85m, "Kokoreç",  "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kokoreç Tam",         "Tam ekmek kokoreç",                           150m, "Kokoreç",  "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kokoreç Tabak",       "Tabakta kokoreç ve ekmek",                    120m, "Kokoreç",  "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Sucuklu Yumurta",     "Sote sucuk ve yumurta",                        95m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay",                 "Demli çay bardak",                             15m, "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m, "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),


        // 21 — Esenyurt · Pide
        new RestaurantDef(
            Email: "esenyurt.firin@gotur.com", OwnerName: "Kemal Fırıncı",
            Name: "Karadeniz Fırın", Address: "Pınar Mah. Esenyurt, İstanbul",
            Lat: 41.0321, Lng: 28.6752,
            Description: "Taş fırında ekmek, simit ve her türlü börek.",
            LogoUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Poğaça (Peynirli)",   "Fırından taze peynirli poğaça",               25m, "Fırın",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Simit",               "Susamlı taze simit",                           15m, "Fırın",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Açma",                "Tereyağlı taze açma",                          20m, "Fırın",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Börek",       "El açması kıymalı börek dilimi",              45m,  "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Peynirli Börek",      "El açması peynirli börek dilimi",             45m,  "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Ekmek (Somun)",       "Taze pişmiş somun ekmek",                     20m,  "Fırın",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay",                 "Demli çay",                                    15m,  "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
            }
        ),

        // 22 — Sultanbeyli · Kuzu Çevirme
        new RestaurantDef(
            Email: "sultanbeyli.ocakbasi@gotur.com", OwnerName: "Ramazan Gürbüz",
            Name: "Sultanbeyli Ocakbaşı", Address: "Bankacılar Mah. Sultanbeyli, İstanbul",
            Lat: 40.9655, Lng: 29.2652,
            Description: "Ocakbaşında pişen kuzu eti, karışık ızgara ve mangal.",
            LogoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Karışık Izgara",      "Köfte, şiş, kanat, pilav ve salata",          279m, "Izgara",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuzu Şiş",            "Marine kuzu şiş, közde pişmiş",               229m, "Izgara",   "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"),
                new MenuItemDef("Patlıcanlı Kebap",    "Közlenmiş patlıcan üstü kıyma",               219m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Pilav",               "Tereyağlı şehriyeli pilav",                    45m,  "Yan Ürün", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Çorba",               "Mercimek çorbası",                             55m,  "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m,  "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 23 — Gaziosmanpaşa · KFC
        new RestaurantDef(
            Email: "kfc.gaziosmanpasa@gotur.com", OwnerName: "KFC Türkiye A.Ş.",
            Name: "KFC Gaziosmanpaşa", Address: "Merkez Mah. Gaziosmanpaşa, İstanbul",
            Lat: 41.0655, Lng: 28.9100,
            Description: "Orijinal tarifte çıtır tavuk. Bucket, Zinger ve daha fazlası.",
            LogoUrl: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Bucket 8'li",         "8 adet orijinal çıtır tavuk parça",           299m, "Bucket",   "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"),
                new MenuItemDef("Zinger Burger",       "Çıtır tavuk burger, özel sos",                129m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Zinger Menü",         "Zinger + patates + içecek",                   189m, "Menü",     "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Strips 5'li",   "5 adet çıtır tavuk strip, dip sos ile",      119m, "Strips",   "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"),
                new MenuItemDef("Coleslaw",            "Lahana salatası, özel sos",                    49m,  "Salata",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Patates Kızartması L","Büyük boy patates",                            59m,  "Yan Ürün", "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Pepsi L",             "Büyük boy Pepsi",                              39m,  "İçecek",   "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 24 — Bayrampaşa · Tatlıcı
        new RestaurantDef(
            Email: "bayrampasa.tatli@gotur.com", OwnerName: "Süheyla Tatlı",
            Name: "Konya Tatlıcısı", Address: "Yıldırım Mah. Bayrampaşa, İstanbul",
            Lat: 41.0454, Lng: 28.9077,
            Description: "Konya usulü irmik tatlısı, sütlaç ve dondurmalı tatlılar.",
            LogoUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("İrmik Helvası",       "Tereyağlı irmik helvası, çam fıstıklı",       85m, "Tatlı",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Sütlaç",              "Fırın sütlaç, tarçınlı",                       75m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Kazandibi",           "Hafif yanmış sütlü tatlı",                     80m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Muhallebi",           "Gül suyu ve fıstık ile muhallebi",             70m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Dondurmalı Profiterol","Çikolata soslu profiterol",                  120m, "Tatlı",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Türk Kahvesi",        "Sade veya orta şekerli",                       55m, "İçecek",   "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
            }
        ),

        // 25 — Küçükçekmece · Pizza
        new RestaurantDef(
            Email: "kucukcekmece.pizza@gotur.com", OwnerName: "Ali Veli Pizza A.Ş.",
            Name: "Pizza Pizza Küçükçekmece", Address: "Mehmet Akif Mah. Küçükçekmece, İstanbul",
            Lat: 40.9980, Lng: 28.7752,
            Description: "Bol malzeme, çıtır hamur. 30 dakikada sıcak pizza.",
            LogoUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Karışık Pizza M",     "Sucuk, mantar, zeytin, biber",               189m, "Pizza",    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop"),
                new MenuItemDef("BBQ Tavuklu Pizza M", "Barbekü soslu tavuk, mısır",                 199m, "Pizza",    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("4 Peynirli Pizza M",  "Mozzarella, gouda, cheddar, parmesan",       219m, "Pizza",    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("Garlic Bread",        "Sarımsaklı tereyağlı ekmek",                  79m,  "Yan Ürün", "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Kola 1L",             "Şişe kola",                                    45m,  "İçecek",   "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),


        // 26 — Tuzla · Deniz Mahsülleri
        new RestaurantDef(
            Email: "tuzla.deniz@gotur.com", OwnerName: "İbrahim Tuzla",
            Name: "Tuzla Deniz Sofrası", Address: "Aydınlı Mah. Tuzla, İstanbul",
            Lat: 40.8120, Lng: 29.3060,
            Description: "Tuzla kıyısında taze deniz ürünleri ve balık.",
            LogoUrl: "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Karides Güveç",       "Tereyağlı karides güveç, ekmek ile",          199m, "Deniz",    "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Ahtapot Izgara",       "Zeytinyağlı ızgara ahtapot",                 229m, "Deniz",    "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Midye Tava",           "Çıtır midye tava, tarator ile",              149m, "Meze",     "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Balık Çorbası",        "Taze balık ve sebzeli çorba",                  85m, "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Çoban Salata",         "Taze sebze salatası",                          65m, "Salata",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Limonata",             "Taze sıkım limonata",                          55m, "İçecek",   "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
            }
        ),

        // 27 — Silivri · Et Lokantası
        new RestaurantDef(
            Email: "silivri.lokanta@gotur.com", OwnerName: "Hasan Bey",
            Name: "Silivri Et Lokantası", Address: "Alibey Mah. Silivri, İstanbul",
            Lat: 41.0730, Lng: 28.2490,
            Description: "Tarladan çatala. Yerel üreticiden günlük et ve sebze.",
            LogoUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Günlük Yemek",        "2 çeşit yemek + pilav + çorba + ekmek",      165m, "Tabldot",  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuzu Tandır",         "Fırında yavaş pişmiş kuzu tandır",           279m, "Izgara",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Nohutlu Pilav",       "Tavuklu nohut pilavı",                       95m,  "Pilav",    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",    "Taze mercimek çorbası",                       55m,  "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Komposto",            "Mevsim meyvesi kompostosu",                    35m,  "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m,  "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 28 — Büyükçekmece · Cafe
        new RestaurantDef(
            Email: "buyukcekmece.cafe@gotur.com", OwnerName: "Cemre Yıldız",
            Name: "Gölpark Cafe", Address: "Gölpark Mah. Büyükçekmece, İstanbul",
            Lat: 41.0210, Lng: 28.5820,
            Description: "Göl manzarasında kahve ve hafif atıştırmalıklar.",
            LogoUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Cappuccino",          "Çift shot espresso, sütlü köpük",             75m,  "Kahve",    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Latte",               "Espresso ve sıcak süt, 300ml",                75m,  "Kahve",    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Americano",           "Uzun espresso, sıcak su ile",                 65m,  "Kahve",    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Cheesecake",          "New York usulü cheesecake dilimi",            110m, "Pasta",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Brownie",             "Çikolatalı ıslak brownie",                     85m, "Pasta",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Tost",                "Kaşar peynirli tost",                          75m, "Sandviç",  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Waffle",              "Meyveli waffle, dondurma ile",                110m, "Tatlı",    "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=400&h=300&fit=crop"),
            }
        ),

        // 29 — Çatalca · Köy Sofrası
        new RestaurantDef(
            Email: "catalca.koy@gotur.com", OwnerName: "Nermin Hanım",
            Name: "Çatalca Köy Sofrası", Address: "Ferhatpaşa Mah. Çatalca, İstanbul",
            Lat: 41.1433, Lng: 28.4600,
            Description: "Köy yumurtası, taze tereyağı ve ev yapımı lezzetler.",
            LogoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Köy Kahvaltısı",      "Ev yumurta, köy peyniri, bal, kaymak",       220m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Menemen",             "Taze domates, biber, yumurta kavurma",         95m, "Sıcak",    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ev Makarnası",        "El açması mantı veya erişte",                120m, "Ana Yemek","https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Tandır Ekmek",        "Köy tandırında pişmiş ekmek",                 30m, "Fırın",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Ev yapımı soğuk ayran",                        30m, "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 30 — Adalar · Tatlıcı
        new RestaurantDef(
            Email: "adalar.tatli@gotur.com", OwnerName: "Madam Rosa",
            Name: "Büyükada Pastanesi", Address: "23 Nisan Mah. Büyükada, İstanbul",
            Lat: 40.8779, Lng: 29.1245,
            Description: "Ada atmosferinde el yapımı pastalar, tartlar ve dondurma.",
            LogoUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Çilek Tart",          "Taze çilek, vanilya kreması, pâte sablée",    130m, "Tart",     "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Profiterol",          "Çikolata soslu profiterol",                   120m, "Pasta",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Cheesecake Dilimi",   "Mango soslu cheesecake",                      115m, "Pasta",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Macarons (3'lü)",     "Fransız usulü macaron, 3 farklı tat",        120m, "Kurabiye", "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Dondurma 2 Top",      "Ev yapımı dondurma",                           85m, "Dondurma", "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop"),
                new MenuItemDef("Sıcak Çikolata",      "Kremalı sıcak çikolata",                       75m, "İçecek",   "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Latte",               "Oat milk latte opsiyonlu",                     80m, "Kahve",    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
            }
        ),


        // 31 — Pendik · Vegan
        new RestaurantDef(
            Email: "pendik.vegan@gotur.com", OwnerName: "Ece Doğal",
            Name: "Yeşil Sofra Vegan", Address: "Yayalar Mah. Pendik, İstanbul",
            Lat: 40.8743, Lng: 29.2266,
            Description: "Yüzde yüz bitkisel. Sağlıklı ve lezzetli vegan mutfak.",
            LogoUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Falafel Wrap",        "Nohut köftesi, humus, tahini, marul",        115m, "Wrap",     "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Buddha Bowl",         "Kinoa, avokado, edamame, sebze",             155m, "Bowl",     "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Vegan Burger",        "Nohut patatesi, marul, domates, vegan sos", 139m,  "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Hummus Tabak",        "Zeytinyağlı humus, pita ekmeği ile",         99m,  "Meze",     "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Taze Meyve Suyu",     "Günlük taze sıkım meyve suyu",               65m,  "İçecek",   "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
                new MenuItemDef("Smoothie",            "Muz, ıspanak, zencefil smoothie",             75m,  "İçecek",   "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
            }
        ),

        // 32 — Gaziosmanpaşa · Döner
        new RestaurantDef(
            Email: "gop.donercisi@gotur.com", OwnerName: "Yaşar Usta",
            Name: "Yaşar Usta Dönerci", Address: "Karadeniz Mah. Gaziosmanpaşa, İstanbul",
            Lat: 41.0755, Lng: 28.9186,
            Description: "45 yıllık döner ustasından el döneri.",
            LogoUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Et Döner Tabak",      "200g döner, pilav, salata",                  165m, "Döner",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Karışık Döner Tabak", "Et + tavuk döner, pilav",                    185m, "Döner",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Yarım Ekmek Döner",   "Ekmekte döner, acı sos",                      85m, "Döner",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m, "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
                new MenuItemDef("Çorba",               "Günlük çorba",                                 50m, "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
            }
        ),

        // 33 — Beykoz · Kahvaltı
        new RestaurantDef(
            Email: "beykoz.kahvalti@gotur.com", OwnerName: "Filiz Hanım",
            Name: "Boğaz Kahvaltı", Address: "Paşabahçe Mah. Beykoz, İstanbul",
            Lat: 41.0800, Lng: 29.0900,
            Description: "Boğaz manzaralı serpme kahvaltı. Hafta sonu kuyruk bekleniyor.",
            LogoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Serpme Kahvaltı 2 kişi","20+ çeşit, bal, kaymak, peynirler",       450m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Sahanda Yumurta",     "Tereyağlı sahanda, sucuklu veya sade",        75m, "Sıcak",    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Omlet",               "Mantar veya peynirli omlet",                  85m, "Sıcak",    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Taze Meyve Suyu",     "Portakal veya elma suyu 300ml",               50m, "İçecek",   "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay Bardağı",         "Demli çay",                                    15m, "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
            }
        ),

        // 34 — Beylikdüzü · Burger
        new RestaurantDef(
            Email: "beylikduzu.smokedbull@gotur.com", OwnerName: "Cem Ateş",
            Name: "Smoked Bull Burger", Address: "Yakuplu Mah. Beylikdüzü, İstanbul",
            Lat: 41.0054, Lng: 28.6422,
            Description: "El yapımı smash burger. Taze günlük ezilmiş et köftesi.",
            LogoUrl: "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Smash Burger",        "Çift smash köfte, cheddar, turşu, sos",      165m, "Burger",   "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Single Smash",        "Tek smash köfte, marul, domates",             129m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("BBQ Burger",          "Dana köfte, barbekü sos, soğan",             155m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Truffle Fries",       "Truffle yağlı patates kızartması",             89m, "Yan Ürün", "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Onion Rings",         "Çıtır soğan halkaları, ranch sos",             79m, "Yan Ürün", "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Milkshake",           "Çikolata, çilek veya vanilyalı",               95m, "İçecek",   "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&h=300&fit=crop"),
                new MenuItemDef("Menü (Burger+Patates+İçecek)","Smash Burger tam menü",              245m, "Menü",     "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
            }
        ),

        // 35 — Bakırköy · Starbucks
        new RestaurantDef(
            Email: "starbucks.bakirkoy@gotur.com", OwnerName: "Starbucks Türkiye",
            Name: "Starbucks Bakırköy", Address: "İstasyon Cad. Bakırköy, İstanbul",
            Lat: 40.9820, Lng: 28.8766,
            Description: "Dünyanın en sevilen kahve zinciri. Frappuccino, latte ve daha fazlası.",
            LogoUrl: "https://images.unsplash.com/photo-1485808191679-5f86510bd9d4?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Caramel Frappuccino", "Karamel soslu buz kahve, kremalı",           135m, "Frappe",   "https://images.unsplash.com/photo-1485808191679-5f86510bd9d4?w=400&h=300&fit=crop"),
                new MenuItemDef("Pumpkin Spice Latte", "Balkabağı soslu sütlü kahve",                130m, "Latte",    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Vanilla Latte",       "Vanilyalı espresso latte",                   120m, "Latte",    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Cold Brew",           "Soğuk demleme kahve",                        115m, "Soğuk",    "https://images.unsplash.com/photo-1485808191679-5f86510bd9d4?w=400&h=300&fit=crop"),
                new MenuItemDef("Croissant",           "Tereyağlı çıtır kruvasan",                    75m,  "Atıştırma","https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Cake Pop",            "Çikolotalı kek pop",                           55m, "Atıştırma","https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Sandwich",            "Ton balıklı veya sebzeli sandviç",             99m, "Sandviç",  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
            }
        ),


        // 36 — Ümraniye · Mantı
        new RestaurantDef(
            Email: "umraniye.manti@gotur.com", OwnerName: "Hacer Teyze",
            Name: "Hacer Teyze Mantıcısı", Address: "Mimar Sinan Mah. Ümraniye, İstanbul",
            Lat: 41.0167, Lng: 29.1167,
            Description: "El açması, el kesilmiş küçük Kayseri mantısı. Günde sınırlı porsiyonla.",
            LogoUrl: "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kayseri Mantısı",     "El kesilmiş mantı, yoğurt ve tereyağı",      145m, "Mantı",    "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Mantı",       "Kıymalı iç harcı, sarımsaklı yoğurt",        155m, "Mantı",    "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Vejetaryen Mantı",    "Ispanak dolgulu, domates sosuyla",            135m, "Mantı",    "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Çorba",               "Günlük mercimek çorbası",                      55m, "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m, "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 37 — Arnavutköy · Börek
        new RestaurantDef(
            Email: "arnavutkoy.borek@gotur.com", OwnerName: "Pınar Uslu",
            Name: "Arnavutköy Börekçisi", Address: "İslambey Mah. Arnavutköy, İstanbul",
            Lat: 41.1837, Lng: 28.7389,
            Description: "Taş fırında el açması börek. Her sabah taze.",
            LogoUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Su Böreği",           "Haşlanmış hamur, peynirli veya kıymalı",     110m, "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Talaş Böreği",        "Pastane usulü talaş böreği",                  95m, "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Gözleme (Peynirli)",  "El açması gözleme, beyaz peynir",              75m, "Gözleme",  "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Gözleme (Kıymalı)",   "El açması gözleme, kıyma",                    85m, "Gözleme",  "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay",                 "Demli çay",                                    15m, "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
            }
        ),

        // 38 — Çekmeköy · Nargile Cafe
        new RestaurantDef(
            Email: "cekmekoy.nargile@gotur.com", OwnerName: "Tarık Şahin",
            Name: "Orient Nargile Cafe", Address: "Reşatbey Mah. Çekmeköy, İstanbul",
            Lat: 41.0400, Lng: 29.1800,
            Description: "Dinlenme ortamında atıştırmalıklar ve nargile.",
            LogoUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Karışık Sandviç",     "Kaşar, sucuk, domates, marul",                85m, "Sandviç",  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Tost",                "Kaşar ve domates tost",                        65m, "Sandviç",  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay Bardağı",         "Demli çay",                                    15m, "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
                new MenuItemDef("Türk Kahvesi",        "Sade veya orta şekerli",                       45m, "İçecek",   "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Limonata",            "Taze sıkım limonata",                          55m, "İçecek",   "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
            }
        ),

        // 39 — Kadıköy · Vegan
        new RestaurantDef(
            Email: "kadikoy.vegan@gotur.com", OwnerName: "Dilan Doğa",
            Name: "Ot & Bakla", Address: "Moda Cad. Kadıköy, İstanbul",
            Lat: 40.9861, Lng: 29.0278,
            Description: "Mevsimlik sebze ve baklagille yapılan sağlıklı öğünler.",
            LogoUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Mercimek Köftesi (10 adet)","Limonlu mercimek köftesi, marul",      95m,  "Köfte",    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Çig Fasulye Salatası", "Mısır, fasulye, kiraz domates, nar",        110m, "Salata",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Yeşil Smoothie",      "Ispanak, elma, zencefil, limon",              75m, "İçecek",   "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
                new MenuItemDef("Avokado Toast",       "Ekşi maya ekmek, avokado, çeri domates",     125m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Granola Bowl",        "Yoğurt, granola, muz, chia",                  99m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
            }
        ),

        // 40 — Maltepe · Balık Ekmek
        new RestaurantDef(
            Email: "maltepe.balikekmek@gotur.com", OwnerName: "Demir Ağa",
            Name: "Demir Ağa Balık Ekmek", Address: "Cevizli Mah. Maltepe, İstanbul",
            Lat: 40.9325, Lng: 29.1438,
            Description: "Günlük taze balık ekmeği. Limon ve maydanoz ile.",
            LogoUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Balık Ekmek",         "Izgara balık, limon, soğan, ekmek",           95m, "Balık",    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Çift Balık Ekmek",    "2 dilim balık fileto, büyük ekmek",           155m, "Balık",   "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Midye Dolma (10 adet)","Pirinçli midye dolma",                       90m, "Meze",     "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Balık Çorbası",       "Ev yapımı balık çorbası",                      75m, "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m, "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),


        // 41 — Sancaktepe · Kebap
        new RestaurantDef(
            Email: "sancaktepe.kebap@gotur.com", OwnerName: "Necati Usta",
            Name: "Sancak Ocakbaşı", Address: "Emek Mah. Sancaktepe, İstanbul",
            Lat: 41.0000, Lng: 29.2333,
            Description: "Sancaktepe'nin vazgeçilmez ocakbaşısı. Her gün taze yakılan ateşte.",
            LogoUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Adana Kebap",         "250g acılı kıyma kebap",                     199m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Canadı",        "Marineli ızgara kanat 8 adet",               175m, "Tavuk",    "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop"),
                new MenuItemDef("Köfte",               "El yapımı ızgara köfte 6 adet",              160m, "Köfte",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Pilav",               "Tereyağlı pirinç pilavı",                     40m, "Yan Ürün", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                 25m, "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 42 — Taksim · Burger King
        new RestaurantDef(
            Email: "burgerking.taksim@gotur.com", OwnerName: "Burger King Türkiye",
            Name: "Burger King Taksim", Address: "İstiklal Cad. No:5, Taksim, İstanbul",
            Lat: 41.0369, Lng: 28.9880,
            Description: "Flame-grilled lezzet. Whopper ve ötesi.",
            LogoUrl: "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Whopper",             "Dana köfte, domates, marul, soğan",           149m, "Burger",   "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Double Whopper",      "Çift köfte, tüm malzeme ile",                 199m, "Burger",   "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Whopper Menü",        "Whopper + patates + içecek",                  219m, "Menü",     "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Crispy Chicken",      "Çıtır tavuk sandviç",                         119m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Nuggets 9'lu",        "9 adet tavuk nugget, sos seçimi",             119m, "Chicken",  "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"),
                new MenuItemDef("Patates L",           "Büyük boy patates",                            59m, "Yan Ürün", "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Kola L",              "Büyük boy kola",                               39m, "İçecek",   "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 43 — Beşiktaş · Lahmacun
        new RestaurantDef(
            Email: "besiktas.lahmacun@gotur.com", OwnerName: "Şanlıurfa Usul",
            Name: "Urfa Lahmacun Evi", Address: "Akaretler Sıra Evler, Beşiktaş, İstanbul",
            Lat: 41.0455, Lng: 29.0057,
            Description: "Şanlıurfa usulü incecik lahmacun. El dövme kıymalı.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Lahmacun (4'lü)",     "İnce el açması kıymalı lahmacun",            110m, "Lahmacun", "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Lahmacun Dürüm",      "Rulo yapılmış lahmacun, maydanoz, limon",     55m, "Dürüm",    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Pide",        "Geleneksel el açması kıymalı pide",          130m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",    "Taze çorba",                                   55m, "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Şalgam Suyu",         "Acı şalgam",                                   30m, "İçecek",   "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m, "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 44 — Sarıyer · Tatlıcı
        new RestaurantDef(
            Email: "sariyer.dondurmaci@gotur.com", OwnerName: "Meliha Hanım",
            Name: "Bosphorus Dondurma", Address: "Emirgan Mah. Sarıyer, İstanbul",
            Lat: 41.1083, Lng: 29.0514,
            Description: "Emirgan korusunda dondurma ve tatlı keyfi.",
            LogoUrl: "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Dondurma Külah (2 top)","Seçimlilik 2 top dondurma",                 85m, "Dondurma", "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop"),
                new MenuItemDef("Sundae",              "Dondurma, karamel sos, fındık",               110m, "Tatlı",    "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&h=300&fit=crop"),
                new MenuItemDef("Waffle + Dondurma",   "Çikolatalı waffle, 2 top dondurma",          145m, "Tatlı",    "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=400&h=300&fit=crop"),
                new MenuItemDef("Cheesecake Dilimi",   "Ev yapımı cheesecake",                        110m, "Pasta",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Limonata",            "Taze limonata",                                55m, "İçecek",   "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
            }
        ),

        // 45 — Sultanbeyli · Pide
        new RestaurantDef(
            Email: "sultanbeyli.pidecisi@gotur.com", OwnerName: "Musa Karadenizli",
            Name: "Taş Fırın Pide", Address: "Hasanpaşa Mah. Sultanbeyli, İstanbul",
            Lat: 40.9545, Lng: 29.2752,
            Description: "Taş fırında Trabzon usulü pide. Günde sınırlı porsiyonla.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Peynirli Pide",       "Kaşar ve beyaz peynir karışık",               125m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Pide",        "İnce kıyma ve soğan iç harcı",               135m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kavurmalı Pide",      "Dana kavurma ve biber",                       155m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Tereyağlı Pide",      "Sade tereyağlı pide",                          95m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Çorba",               "Günlük çorba",                                  55m, "Çorba",   "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),


        // 46 — Şişli · Noodle
        new RestaurantDef(
            Email: "sisli.noodle@gotur.com", OwnerName: "Wang Li",
            Name: "Panda Noodle House", Address: "Halaskargazi Cad. Şişli, İstanbul",
            Lat: 41.0589, Lng: 28.9870,
            Description: "Otantik Çin noodle ve dim sum. Taze malzeme, hızlı servis.",
            LogoUrl: "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Beef Noodle Soup",    "Dana etli noodle çorbası, bok choy",          175m, "Noodle",   "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Pad Thai",            "Pirinç eriştesi, karides, yerfıstığı",        189m, "Noodle",   "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Kung Pao Tavuk",      "Acılı biber, yer fıstığı, zencefil",         169m, "Ana Yemek","https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"),
                new MenuItemDef("Dim Sum (6 adet)",    "Buharda pişmiş çeşitli dim sum",              145m, "Meze",     "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Wonton Çorbası",      "Karides dolgulu wonton",                       99m, "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Yeşil Çay",           "Geleneksel Çin yeşil çayı",                    45m, "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
            }
        ),

        // 47 — Üsküdar · Muhallebici
        new RestaurantDef(
            Email: "uskudar.muhallebici@gotur.com", OwnerName: "Servet Ağa",
            Name: "Kanaat Muhallebicisi", Address: "Selmanipak Cad. Üsküdar, İstanbul",
            Lat: 41.0230, Lng: 29.0164,
            Description: "1933'ten bu yana geleneksel Türk tatlıları ve muhallebicisi.",
            LogoUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Muhallebi",           "Gül suyu ve fıstık ile",                       70m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Sütlaç",              "Fırın sütlaç, tarçınlı",                       75m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Kazandibi",           "Hafif yanmış sütlü tatlı",                     80m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Göğsü",        "Gerçek tavuk göğsü tatlısı",                   85m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Aşure",               "40 malzeme ile geleneksel aşure",               75m, "Tatlı",   "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Türk Kahvesi",        "Sade Türk kahvesi, lokum ile",                  55m, "İçecek",  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Boza",                "Geleneksel boza, leblebi ile",                  55m, "İçecek",  "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop"),
            }
        ),

        // 48 — Fatih · Türk Mutfağı
        new RestaurantDef(
            Email: "fatih.tarihi@gotur.com", OwnerName: "Emin Bey",
            Name: "Tarihi Hünkar Lokantası", Address: "Akdeniz Cad. Fatih, İstanbul",
            Lat: 41.0100, Lng: 28.9500,
            Description: "Osmanlı ve geleneksel Türk mutfağından seçmeler. Hünkar beğendi şahane.",
            LogoUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Hünkar Beğendi",      "Dana kavurma, közlenmiş patlıcan püresi",     235m, "Ana Yemek","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("İmam Bayıldı",        "Zeytinyağlı patlıcan dolması",                145m, "Meze",     "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Karnıyarık",          "Kıymalı patlıcan, salça ve biber",            175m, "Ana Yemek","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Pilav Üstü Tavuk",    "Pirinç pilavı, tavuk sote",                   155m, "Ana Yemek","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Revani",              "İrmikli şerbetli tatlı, fıstıklı",             75m, "Tatlı",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m, "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 49 — Kağıthane · Lahmacun
        new RestaurantDef(
            Email: "kagithane.lahmacun@gotur.com", OwnerName: "Veysel Çetinkaya",
            Name: "Antep Sofrası", Address: "Çağlayan Mah. Kağıthane, İstanbul",
            Lat: 41.0728, Lng: 28.9780,
            Description: "Gaziantep usulü lahmacun, kebap ve baklava. Gerçek Antep lezzetleri.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Lahmacun (5'li)",     "El açması Antep usulü lahmacun",              125m, "Lahmacun", "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Antep Kebabı",        "200g kıyma kebap, fıstıklı",                  199m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Antep Baklavası",     "250g Antep fıstıklı baklava",                 189m, "Tatlı",    "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop"),
                new MenuItemDef("Ezme Salata",         "Antep usulü acılı ezme",                       65m, "Salata",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Şalgam Suyu",         "Soğuk acı şalgam",                             30m, "İçecek",   "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                  25m, "İçecek",   "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 50 — Pendik · McDonald's
        new RestaurantDef(
            Email: "mcdonalds.pendik@gotur.com", OwnerName: "McDonald's Türkiye A.Ş.",
            Name: "McDonald's Pendik", Address: "Osmangazi Mah. Pendik, İstanbul",
            Lat: 40.8740, Lng: 29.2261,
            Description: "Pendik'te Big Mac lezzeti. Hızlı servis, sıcak yemek.",
            LogoUrl: "https://images.unsplash.com/photo-1619881590738-a111d176d906?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Big Mac",             "Çift köfte, özel sos, marul, turşu",          139m, "Burger",   "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("McChicken",           "Çıtır tavuk, mayo ve marul",                  109m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Double Big Mac",      "4 köfte, özel sos, tam takım",                179m, "Burger",   "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("McTurco",             "Dönerli sandviç, Türk sosu",                  129m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("McNuggets 6'lı",      "6 adet nugget, sos seçimi",                    89m, "Chicken",  "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"),
                new MenuItemDef("Büyük Boy Menü",      "Burger + L patates + L içecek",               199m, "Menü",     "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("McFlurry",            "Vanilyalı dondurma, Oreo veya M&M",            75m, "Tatlı",    "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop"),
                new MenuItemDef("Kola L",              "Büyük boy kola",                               39m, "İçecek",   "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),


        // ════════════════════════════════════════════════════════════════
        // ANKARA RESTORANLAR (50 adet)
        // ════════════════════════════════════════════════════════════════

        // 51 — Çankaya · Kebap
        new RestaurantDef(
            Email: "cankaya.kebapci@gotur.com", OwnerName: "Mevlüt Özcan",
            Name: "Çankaya Kebap Evi", Address: "Tunalı Hilmi Cad. No:32, Çankaya, Ankara",
            Lat: 39.9080, Lng: 32.8597,
            Description: "Ankara'nın kalbinde otantik kebap lezzetleri. 30 yıllık usta.",
            LogoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Adana Kebap",         "200g acılı kıyma kebap, lavaş ile",           189m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Urfa Kebap",          "200g acısız kıyma kebap",                     179m, "Kebap",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Şiş",           "Marine edilmiş tavuk göğsü",                  159m, "Kebap",    "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop"),
                new MenuItemDef("Karışık Izgara",      "Adana, şiş, kanat, köfte karışık",            289m, "Izgara",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Lahmacun (4'lü)",     "El açması ince lahmacun",                     100m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",    "Taze mercimek çorbası",                         55m, "Çorba",   "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran 400ml",                             25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 52 — Keçiören · Döner
        new RestaurantDef(
            Email: "kecioren.donercisi@gotur.com", OwnerName: "Suat Usta",
            Name: "Suat Usta Dönerci", Address: "Subayevleri Mah. Keçiören, Ankara",
            Lat: 39.9795, Lng: 32.8598,
            Description: "Keçiören'in gözde döner ustası. Et döner ve tavuk dürüm.",
            LogoUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Et Döner Tabak",      "200g döner, pilav, salata",                   165m, "Döner",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Dürüm",         "Lavaşta tavuk döner, sos ile",                 99m, "Dürüm",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Et Dürüm",            "Lavaşta et döner, acı sos",                   119m, "Dürüm",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Yarım Ekmek Döner",   "Somun ekmeğinde döner",                        80m, "Döner",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
                new MenuItemDef("Çorba",               "Günlük taze çorba",                             50m, "Çorba",   "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
            }
        ),

        // 53 — Mamak · Pide
        new RestaurantDef(
            Email: "mamak.pidecisi@gotur.com", OwnerName: "Hüseyin Demir",
            Name: "Mamak Pide Fırını", Address: "Şahintepe Mah. Mamak, Ankara",
            Lat: 39.9431, Lng: 32.9167,
            Description: "Taş fırında Karadeniz usulü pide. Her gün taze hamur.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kıymalı Pide",        "İnce kıyma, soğan, biber",                    130m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kaşarlı Pide",        "Bol erimiş kaşar peyniri",                    125m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuşbaşılı Pide",      "Dana kuşbaşı, biber, domates",                155m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Lahmacun (4'lü)",     "El açması ince lahmacun",                     100m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Çorba",               "Günlük çorba",                                  50m, "Çorba",   "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 54 — Etimesgut · Pide & Kebap (Gerçek)
        new RestaurantDef(
            Email: "cagdas.pide.etimesgut@gotur.com", OwnerName: "Çağdaş Pide",
            Name: "Çağdaş Pide Kebap Salonu", Address: "Atakent Mah. Şht. Celal İşen Sk. No:2, Etimesgut, Ankara",
            Lat: 39.9478, Lng: 32.6612,
            Description: "Etimesgut'un vazgeçilmez pide ve kebap durağı. Odun ateşinde pişen pideler.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kavurmalı Pide",      "Dana kavurma dolgulu, fırından taze",          185m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Pide",        "Kıyma ve soğan harcı, fırında pişmiş",        165m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kaşarlı Pide",        "Bol erimiş kaşar peynirli",                   155m, "Pide",     "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("Adana Kebap",         "200g acılı kıyma kebap, lavaş ve söğüş",      195m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Karışık Izgara",      "Adana, şiş, kanat, köfte tabağı",             285m, "Izgara",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",    "Günlük taze mercimek çorbası",                  55m, "Çorba",   "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Cacık",               "Sarımsaklı yoğurt, salatalık, nane",            50m, "Meze",    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ev yapımı ayran 400ml",                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 55 — Altındağ · Kebap
        new RestaurantDef(
            Email: "altindag.kebapci@gotur.com", OwnerName: "Zeynel Abidin",
            Name: "Hacı Arif'in Yeri", Address: "Atıfbey Mah. Altındağ, Ankara",
            Lat: 39.9590, Lng: 32.8694,
            Description: "Ankara'nın eski mahallelerinde kuşaktan kuşağa geçen kebap lezzeti.",
            LogoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Beyti Kebap",         "Lavaşa sarılı kıyma kebap, domates sos",      219m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Patlıcanlı Kebap",    "Közlenmiş patlıcan, kıyma sos",               209m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Dana Şiş",            "Küp dana bonfile, közde",                      219m, "Kebap",    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"),
                new MenuItemDef("Köfte Tabak",         "6 adet ızgara köfte, ekmek, söğüş",           160m, "Köfte",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Pilav",               "Tereyağlı pirinç pilavı",                       40m, "Yan Ürün","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),


        // 56 — Yenimahalle · Burger
        new RestaurantDef(
            Email: "yenimahalle.burger@gotur.com", OwnerName: "Koray Kaya",
            Name: "Ankara Smash Burger", Address: "Demetevler Mah. Yenimahalle, Ankara",
            Lat: 39.9916, Lng: 32.7935,
            Description: "El yapımı smash burger. Günlük taze dana eti ile.",
            LogoUrl: "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Double Smash",        "Çift smash köfte, cheddar, özel sos",         165m, "Burger",   "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Single Smash",        "Tek smash köfte, turşu, marul",               129m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Mushroom Burger",     "Mantarlı burger, karamelize soğan",            155m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Patates Kızartması",  "Klasik patates kızartması",                     65m, "Yan Ürün","https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Menü",                "Burger + patates + içecek",                    235m, "Menü",     "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Milkshake",           "Çikolata, çilek veya vanilyalı",               95m, "İçecek",   "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&h=300&fit=crop"),
            }
        ),

        // 57 — Çankaya · Baklava
        new RestaurantDef(
            Email: "cankaya.baklava@gotur.com", OwnerName: "Mustafa Kocaeli",
            Name: "İmam Çağdaş Ankara Şubesi", Address: "Kızılay Meydanı, Çankaya, Ankara",
            Lat: 39.9188, Lng: 32.8544,
            Description: "Gaziantep'in efsane baklavacısı Ankara'da. Fıstıklı, sütlü ve şöbiyet.",
            LogoUrl: "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Fıstıklı Baklava 250g","Antep fıstığı dolgulu özel baklava",         190m, "Baklava",  "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop"),
                new MenuItemDef("Sütlü Nuriye 250g",   "Hafif sütlü nuriye baklava",                  170m, "Baklava",  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Şöbiyet",             "Kaymak dolgulu şöbiyet",                      180m, "Baklava",  "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop"),
                new MenuItemDef("Karışık Baklava 1kg", "Hediye kutusunda karışık 1kg",                590m, "Baklava",  "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop"),
                new MenuItemDef("Künefe",              "Sıcak servis, peynirli tel kadayıf",           125m, "Tatlı",   "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Türk Kahvesi",        "Sade veya orta şekerli",                        55m, "İçecek",  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
            }
        ),

        // 58 — Sincan · Pizza
        new RestaurantDef(
            Email: "sincan.pizza@gotur.com", OwnerName: "Domino's Pizza Türkiye",
            Name: "Domino's Pizza Sincan", Address: "Fatih Mah. Sincan, Ankara",
            Lat: 39.9746, Lng: 32.5830,
            Description: "Sincan'da 30 dakikada sıcak pizza kapında.",
            LogoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Karışık Pizza L",     "Sucuk, pastırma, biber, mantar, zeytin",      259m, "Pizza",    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop"),
                new MenuItemDef("Margarita Pizza L",   "Domates, mozzarella, fesleğen",               199m, "Pizza",    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("BBQ Tavuklu L",       "Barbekü soslu tavuk, mısır, biber",           249m, "Pizza",    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("4 Peynirli L",        "Mozzarella, gouda, cheddar, parmesan",        229m, "Pizza",    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("Garlic Bread",        "Sarımsaklı tereyağlı ekmek",                    79m, "Yan Ürün","https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("2'li Kampanya",       "2 adet L boy pizza",                           419m, "Kampanya","https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop"),
                new MenuItemDef("Kola 1L",             "Şişe kola",                                     45m, "İçecek",  "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 59 — Polatlı · Et Lokantası
        new RestaurantDef(
            Email: "polatli.lokanta@gotur.com", OwnerName: "Ramazan Polat",
            Name: "Polatlı Et Sofrası", Address: "Cumhuriyet Mah. Polatlı, Ankara",
            Lat: 39.5775, Lng: 32.1475,
            Description: "Polatlı bozkırından gelen taze et. Kuzu tandır ve köfte şahane.",
            LogoUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kuzu Tandır",         "Fırında yavaş pişmiş kuzu tandır",            285m, "Izgara",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Izgara Köfte",        "El yapımı köfte 6 adet, söğüş ile",           155m, "Köfte",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Günlük Tabldot",      "2 yemek, pilav, çorba, ekmek",                155m, "Tabldot",  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Nohutlu Pilav",       "Tavuklu nohut pilavı",                          90m, "Pilav",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",    "Günlük taze çorba",                              55m, "Çorba",  "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                    25m, "İçecek", "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 60 — Çankaya · Starbucks
        new RestaurantDef(
            Email: "starbucks.cankaya@gotur.com", OwnerName: "Starbucks Türkiye",
            Name: "Starbucks Kızılay", Address: "Kızılay Meydanı, Çankaya, Ankara",
            Lat: 39.9200, Lng: 32.8540,
            Description: "Dünyanın en sevilen kahvesi Ankara'nın kalbinde.",
            LogoUrl: "https://images.unsplash.com/photo-1485808191679-5f86510bd9d4?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Caramel Frappuccino", "Karamel soslu buz kahve, kremalı",            135m, "Frappe",   "https://images.unsplash.com/photo-1485808191679-5f86510bd9d4?w=400&h=300&fit=crop"),
                new MenuItemDef("Pumpkin Spice Latte", "Balkabağı soslu sütlü kahve",                 130m, "Latte",    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Vanilla Latte",       "Vanilyalı espresso latte",                    120m, "Latte",    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Cold Brew",           "Soğuk demleme kahve",                         115m, "Soğuk",    "https://images.unsplash.com/photo-1485808191679-5f86510bd9d4?w=400&h=300&fit=crop"),
                new MenuItemDef("Croissant",           "Tereyağlı çıtır kruvasan",                     75m, "Atıştırma","https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Brownie",             "Çikolatalı ıslak brownie",                     75m, "Atıştırma","https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Sandwich",            "Ton balıklı veya sebzeli sandviç",              99m, "Sandviç", "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
            }
        ),


        // 61 — Keçiören · Börek
        new RestaurantDef(
            Email: "kecioren.borekci@gotur.com", OwnerName: "Fatma Hanım",
            Name: "Fatma Hanım Börekçisi", Address: "Bağlum Mah. Keçiören, Ankara",
            Lat: 40.0050, Lng: 32.8500,
            Description: "El açması börekler. Her sabah taze hazırlanan çeşitler.",
            LogoUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Su Böreği",           "Haşlanmış hamur, peynirli",                   110m, "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Börek",       "El açması kıymalı börek dilimi",               45m, "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Ispanaklı Börek",     "Ispanak ve beyaz peynirli",                     45m, "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Patatesli Börek",     "Baharatlı patates iç harçlı",                   40m, "Börek",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Simit",               "Taze susamlı simit",                            15m, "Fırın",    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay",                 "Demli çay bardak",                              15m, "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 62 — Gölbaşı · Balık
        new RestaurantDef(
            Email: "golbasi.balik@gotur.com", OwnerName: "Sezer Göl",
            Name: "Gölbaşı Balık Evi", Address: "Tulumtaş Mah. Gölbaşı, Ankara",
            Lat: 39.7931, Lng: 32.8105,
            Description: "Gölbaşı Gölü kıyısında taze alabalık ve sazan.",
            LogoUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Izgara Alabalık",     "Taze alabalık, salata ve pilav ile",           225m, "Balık",    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Sazan Tava",          "Çıtır sazan tava, mısır unu ile",              195m, "Balık",    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Karides Güveç",       "Tereyağlı karides güveç",                     199m, "Deniz",    "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Balık Çorbası",       "Taze balık ve sebzeli çorba",                   85m, "Çorba",   "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Çoban Salata",        "Taze sebze salatası",                            65m, "Salata",  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                    25m, "İçecek", "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 63 — Yenimahalle · KFC
        new RestaurantDef(
            Email: "kfc.yenimahalle@gotur.com", OwnerName: "KFC Türkiye A.Ş.",
            Name: "KFC Demetevler", Address: "Demetevler Mah. Yenimahalle, Ankara",
            Lat: 39.9968, Lng: 32.7880,
            Description: "Orijinal çıtır tavuk lezzeti Demetevler'de.",
            LogoUrl: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Bucket 8'li",         "8 adet orijinal çıtır tavuk parça",           299m, "Bucket",   "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"),
                new MenuItemDef("Zinger Burger",       "Çıtır tavuk burger, özel sos",                129m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Zinger Menü",         "Zinger + patates + içecek",                   189m, "Menü",     "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Strips 5'li",   "5 adet çıtır strip, dip sos",                 119m, "Strips",   "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"),
                new MenuItemDef("Coleslaw",            "Lahana salatası",                               49m, "Salata",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Patates L",           "Büyük boy patates",                             59m, "Yan Ürün","https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Pepsi L",             "Büyük boy Pepsi",                               39m, "İçecek",  "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 64 — Altındağ · Mantı
        new RestaurantDef(
            Email: "altindag.manti@gotur.com", OwnerName: "Zübeyde Hanım",
            Name: "Kayseri Mantı Evi", Address: "Hacettepe Mah. Altındağ, Ankara",
            Lat: 39.9530, Lng: 32.8750,
            Description: "El kesilmiş Kayseri mantısı. 40 tanesi bir kaşıkta.",
            LogoUrl: "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kayseri Mantısı",     "El kesilmiş, yoğurt ve tereyağı",             145m, "Mantı",    "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Mantı",       "Kıymalı iç, sarımsaklı yoğurt",               155m, "Mantı",    "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Tarhana Çorbası",     "Ev yapımı tarhana",                             60m, "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
                new MenuItemDef("Composto",            "Mevsim meyvesi kompostosu",                     35m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
            }
        ),

        // 65 — Çankaya · Sushi
        new RestaurantDef(
            Email: "cankaya.sushi@gotur.com", OwnerName: "Hiro Nakamura",
            Name: "Sakura Sushi", Address: "Kavaklıdere Mah. Çankaya, Ankara",
            Lat: 39.9020, Lng: 32.8610,
            Description: "Ankara'nın premium Japon restoranı. Sushi, sashimi ve ramen.",
            LogoUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Salmon Nigiri (8 adet)","Taze somon, pirinç",                        199m, "Sushi",    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=300&fit=crop"),
                new MenuItemDef("Dragon Roll (8 adet)", "Avokado, karides, tempura",                  219m, "Maki",     "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=400&h=300&fit=crop"),
                new MenuItemDef("Spicy Tuna Roll",      "Acılı ton, salatalık, avokado",              189m, "Maki",     "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=400&h=300&fit=crop"),
                new MenuItemDef("Tonkotsu Ramen",       "Domuz kemik suyu, noodle, yumurta",          185m, "Ramen",    "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Gyoza (6 adet)",       "Buharda pişmiş sebzeli Japon mantısı",       115m, "Meze",     "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Miso Çorba",           "Tofu ve deniz yosunlu miso",                  65m, "Çorba",    "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Japon Yeşil Çayı",     "Geleneksel yeşil çay",                        45m, "İçecek",   "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
            }
        ),


        // 66 — Pursaklar · Köfte
        new RestaurantDef(
            Email: "pursaklar.kofteci@gotur.com", OwnerName: "Tahsin Aydın",
            Name: "Pursaklar Köftecisi", Address: "İstasyon Mah. Pursaklar, Ankara",
            Lat: 40.0376, Lng: 32.8977,
            Description: "El yapımı ızgara köfte. 25 yıllık köfte ustası.",
            LogoUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Izgara Köfte",        "6 adet köfte, ekmek, söğüş",                  145m, "Köfte",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Köfte Ekmek",         "3 köfte, somun ekmek",                         79m, "Sandviç",  "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Piyaz",               "Fasulye, soğan, maydanoz",                     55m, "Salata",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",    "Taze çorba",                                    55m, "Çorba",   "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 67 — Etimesgut · Ev Yemekleri (Gerçek)
        new RestaurantDef(
            Email: "annem.elvan.sofrasi@gotur.com", OwnerName: "Elvan Sofrası",
            Name: "Annem Elvan Sofrası", Address: "Elvan Mah. Ahi Elvan Cd. No:2/C, Etimesgut, Ankara",
            Lat: 39.9410, Lng: 32.6720,
            Description: "Ev sıcaklığında günlük yemekler. Annenizin mutfağından lezzetler kapınızda.",
            LogoUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Günlük Tabldot",      "2 çeşit yemek, pilav veya makarna, çorba, ekmek", 175m, "Tabldot", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuru Fasulye + Pilav","Ev yapımı kuru fasulye, pirinç pilav",        110m, "Yemek",    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("İzmir Köfte",         "Patatesli soslu köfte, ekmek",                 145m, "Yemek",   "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Etli Taze Fasulye",   "Kemikli et, zeytinyağlı taze fasulye",         135m, "Yemek",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",    "Günlük taze mercimek çorbası",                  55m, "Çorba",   "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Sütlaç",              "Fırın sütlaç, üstü kızarmış",                   70m, "Tatlı",   "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 68 — Çankaya · Kahvaltı
        new RestaurantDef(
            Email: "cankaya.kahvalti@gotur.com", OwnerName: "Emine Hanım",
            Name: "Çankaya Kahvaltı Salonu", Address: "Bahçelievler Mah. Çankaya, Ankara",
            Lat: 39.9100, Lng: 32.8280,
            Description: "Her sabah taze hazırlanan zengin Türk kahvaltısı.",
            LogoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Serpme Kahvaltı 2 kişi","20 çeşit, bal, kaymak dahil",              450m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Tek Kişilik Kahvaltı", "10 çeşit, yumurta, çay dahil",              249m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Sahanda Sucuklu",      "Tereyağlı sahanda, sucuklu",                  85m, "Sıcak",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Omlet",                "Peynirli veya mantarlı omlet",                85m, "Sıcak",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Taze Portakal Suyu",   "300ml taze sıkım",                            55m, "İçecek",  "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay Demliği",          "2 kişilik demlik çay",                        40m, "İçecek",  "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
            }
        ),

        // 69 — Sincan · Kebap
        new RestaurantDef(
            Email: "sincan.kebapevi@gotur.com", OwnerName: "Celal Ateş",
            Name: "Sincan Ateş Ocakbaşı", Address: "Malazgirt Mah. Sincan, Ankara",
            Lat: 39.9691, Lng: 32.5762,
            Description: "Sincan'ın köklü ocakbaşısı. Her gün sabah yakılan ateşte.",
            LogoUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Adana Kebap",         "250g acılı kıyma kebap, lavaş",               195m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Şiş",           "Marine tavuk göğsü şiş",                      165m, "Kebap",    "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop"),
                new MenuItemDef("Köfte",               "El yapımı köfte 6 adet",                      155m, "Köfte",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Karışık Izgara",      "Şiş, köfte, kanat, pilav",                    289m, "Izgara",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Lahmacun (4'lü)",     "El açması lahmacun",                          100m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 70 — Çankaya · Tatlıcı
        new RestaurantDef(
            Email: "cankaya.tatli@gotur.com", OwnerName: "Hanife Tatlı",
            Name: "Ankara Muhallebicisi", Address: "Kızılay Mah. Çankaya, Ankara",
            Lat: 39.9195, Lng: 32.8550,
            Description: "Ankara'nın köklü muhallebicisi. Sütlaç, kazandibi ve muhallebi.",
            LogoUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Sütlaç",              "Fırın sütlaç, tarçınlı",                       75m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Kazandibi",           "Hafif yanmış sütlü tatlı",                     80m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Muhallebi",           "Gül suyu ve fıstık ile",                       70m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Göğsü",         "Geleneksel tavuk göğsü tatlısı",               85m, "Tatlı",    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Profiterol",          "Çikolata soslu profiterol",                   120m, "Tatlı",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Türk Kahvesi",        "Sade veya şekerli",                             55m, "İçecek",  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
            }
        ),


        // 71 — Mamak · Burger King
        new RestaurantDef(
            Email: "burgerking.mamak@gotur.com", OwnerName: "Burger King Türkiye",
            Name: "Burger King Mamak", Address: "Turgut Özal Bulvarı, Mamak, Ankara",
            Lat: 39.9417, Lng: 32.9230,
            Description: "Flame-grilled lezzet Mamak'ta. Whopper ve daha fazlası.",
            LogoUrl: "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Whopper",             "Dana köfte, domates, marul, soğan",           149m, "Burger",   "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Double Whopper",      "Çift köfte, tüm malzeme",                     199m, "Burger",   "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Whopper Menü",        "Whopper + patates + içecek",                  219m, "Menü",     "https://images.unsplash.com/photo-1551782450-17144efb9c50?w=400&h=300&fit=crop"),
                new MenuItemDef("Crispy Chicken",      "Çıtır tavuk sandviç",                         119m, "Burger",   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"),
                new MenuItemDef("Onion Rings",         "Çıtır soğan halkaları",                        79m, "Yan Ürün","https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Patates L",           "Büyük boy patates",                             59m, "Yan Ürün","https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Kola L",              "Büyük boy kola",                                39m, "İçecek",  "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 72 — Gölbaşı · Mangal
        new RestaurantDef(
            Email: "golbasi.mangal@gotur.com", OwnerName: "İsmail Gürbüz",
            Name: "Gölpark Mangal", Address: "Gölbaşı Gölü Çevresi, Gölbaşı, Ankara",
            Lat: 39.7882, Lng: 32.8064,
            Description: "Göl manzarasında mangal keyfi. Kuzu ve dana ızgara.",
            LogoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Karışık Izgara",      "Kuzu, dana, tavuk karışık, pilav",            295m, "Izgara",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuzu Kaburga",        "Fırında yavaş pişmiş kuzu kaburga",           325m, "Izgara",   "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Kanat",         "Marine edilmiş ızgara kanat 8 adet",          175m, "Tavuk",    "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop"),
                new MenuItemDef("Pilav",               "Tereyağlı pirinç pilavı",                       45m, "Yan Ürün","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Çoban Salata",        "Taze sebze salatası",                            65m, "Salata",  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                    25m, "İçecek", "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 73 — Çankaya · Vegan
        new RestaurantDef(
            Email: "cankaya.vegan@gotur.com", OwnerName: "Aylin Doğan",
            Name: "Yeşil Tabak", Address: "Çetin Emeç Mah. Çankaya, Ankara",
            Lat: 39.9140, Lng: 32.8490,
            Description: "Taze sebze ve baklagille hazırlanan sağlıklı vegan tabaklar.",
            LogoUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Buddha Bowl",         "Kinoa, avokado, edamame, sebze",              155m, "Bowl",     "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Falafel Wrap",        "Nohut köftesi, humus, tahini",                115m, "Wrap",     "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Avokado Toast",       "Ekşi maya ekmek, avokado",                   125m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Köftesi",    "Limonlu mercimek köftesi, marul ile",          95m, "Meze",     "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Taze Meyve Suyu",     "Günlük sıkım meyve suyu",                      65m, "İçecek",  "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
                new MenuItemDef("Smoothie",            "Muz, ıspanak, zencefil",                       75m, "İçecek",   "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
            }
        ),

        // 74 — Keçiören · Tatlı
        new RestaurantDef(
            Email: "kecioren.baklava@gotur.com", OwnerName: "Mehmet Ali Bey",
            Name: "Keçiören Baklavacısı", Address: "Öğretmenevleri Mah. Keçiören, Ankara",
            Lat: 39.9930, Lng: 32.8530,
            Description: "El yapımı baklava ve şerbetli tatlılar. Günlük üretim.",
            LogoUrl: "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Fıstıklı Baklava 250g","Antep fıstığı dolgulu",                     185m, "Baklava",  "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop"),
                new MenuItemDef("Cevizli Baklava 250g","Ceviz dolgulu baklava",                      175m, "Baklava",  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Şöbiyet 250g",        "Kaymak dolgulu şöbiyet",                     180m, "Baklava",  "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop"),
                new MenuItemDef("Künefe",              "Sıcak künefe, peynirli",                      120m, "Tatlı",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Lokma",               "Altın rengi şerbetli lokma",                   75m, "Tatlı",   "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Türk Kahvesi",        "Sade Türk kahvesi",                             55m, "İçecek",  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
            }
        ),

        // 75 — Yenimahalle · Lahmacun
        new RestaurantDef(
            Email: "yenimahalle.lahmacun@gotur.com", OwnerName: "Kasım Usul",
            Name: "Diyarbakır Sofrası", Address: "Şentepe Mah. Yenimahalle, Ankara",
            Lat: 39.9860, Lng: 32.7780,
            Description: "Diyarbakır usulü kara fırında lahmacun ve kaburga.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Lahmacun (5'li)",     "Kara fırında Diyarbakır lahmacun",            130m, "Lahmacun", "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kaburga Kebabı",      "Kara fırında pişmiş dana kaburga",            265m, "Kebap",    "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Pide",        "El açması kıymalı pide",                      135m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Çiğ Köfte Dürüm",    "Bitkisel çiğ köfte dürüm",                     55m, "Dürüm",   "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Şalgam Suyu",         "Acı şalgam",                                    30m, "İçecek",  "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),


        // 76 — Çankaya · Cafe
        new RestaurantDef(
            Email: "cankaya.cafe@gotur.com", OwnerName: "Pelin Yıldız",
            Name: "Tunalı Cafe & Bistro", Address: "Tunalı Hilmi Cad. Çankaya, Ankara",
            Lat: 39.9075, Lng: 32.8605,
            Description: "Tunalı'nın sevilen cafésu. Kahve, pasta ve hafif yemekler.",
            LogoUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Cappuccino",          "Çift shot espresso, sütlü köpük",              75m, "Kahve",    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Latte",               "Espresso ve sıcak süt",                         75m, "Kahve",   "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("Cold Brew",           "Soğuk demleme kahve",                          85m, "Soğuk",    "https://images.unsplash.com/photo-1485808191679-5f86510bd9d4?w=400&h=300&fit=crop"),
                new MenuItemDef("Cheesecake Dilimi",   "New York usulü cheesecake",                   110m, "Pasta",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Brownie",             "Çikolatalı ıslak brownie",                     85m, "Pasta",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Croque Monsieur",     "Jambon ve kaşarlı fransız tost",               95m, "Sandviç",  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Taze Limonata",       "Taze sıkım limonata",                           55m, "İçecek",  "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
            }
        ),

        // 77 — Pursaklar · Pide
        new RestaurantDef(
            Email: "pursaklar.pide@gotur.com", OwnerName: "Rıza Karadeniz",
            Name: "Rıza Usta Pide Salonu", Address: "Fatih Mah. Pursaklar, Ankara",
            Lat: 40.0335, Lng: 32.8972,
            Description: "Karadeniz usulü pide, taş fırın.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kıymalı Pide",        "Kıyma, soğan, baharatlı",                    130m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kaşarlı Pide",        "Bol kaşar peynirli",                          125m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuşbaşılı Pide",      "Dana kuşbaşı, biber, domates",                155m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Lahmacun (4'lü)",     "El açması ince lahmacun",                     100m, "Pide",     "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",    "Taze çorba",                                    55m, "Çorba",   "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 78 — Etimesgut · Ciğerci & Köfteci (Gerçek)
        new RestaurantDef(
            Email: "idris.usta.etimesgut@gotur.com", OwnerName: "İdris Usta",
            Name: "Meşhur Ciğerci & Köfteci İdris Usta", Address: "Elvan Mah. Ahi Elvan Cd. No:34/B, Etimesgut, Ankara",
            Lat: 39.9418, Lng: 32.6708,
            Description: "Etimesgut'un efsane ciğercisi. Taze dana ciğeri ve el yapımı köfte.",
            LogoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Dana Ciğer Tava",     "Taze dana ciğeri, soğan, biber ile",           155m, "Ciğer",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Ciğer Dürüm",         "Lavaşta ciğer, maydanoz, acı biber",            99m, "Dürüm",   "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("El Yapımı Köfte",     "6 adet el yapımı dana köfte, ekmek, söğüş",    160m, "Köfte",   "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Köfte Dürüm",         "İnce lavaşta köfte, sos ve söğüş",              110m, "Dürüm",  "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Ciğer + Köfte Tabak", "Karma tabak, pilav, söğüş",                    195m, "Tabak",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Piyaz",               "Haşlanmış fasulye, soğan, maydanoz salatası",   50m, "Meze",    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ev yapımı ayran",                          25m, "İçecek", "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 79 — Mamak · Kokoreç
        new RestaurantDef(
            Email: "mamak.kokorec@gotur.com", OwnerName: "Cemil Usta",
            Name: "Cemil Usta Kokoreç", Address: "Hüseyingazi Mah. Mamak, Ankara",
            Lat: 39.9380, Lng: 32.9320,
            Description: "Sabahın köründen gece yarısına kadar açık. Efsane kokoreç.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kokoreç Yarım",       "1/2 ekmek kokoreç, kekik, biber",              85m, "Kokoreç",  "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Kokoreç Tam",         "Tam ekmek kokoreç",                            150m, "Kokoreç",  "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Sucuklu Yumurta",     "Sote sucuk ve yumurta, ekmek ile",              95m, "Kahvaltı","https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay",                 "Demli çay",                                     15m, "İçecek",  "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 80 — Altındağ · Lokanta
        new RestaurantDef(
            Email: "altindag.esnaf@gotur.com", OwnerName: "Mevlüt Çorbacı",
            Name: "Esnaf Lokantası Hasan Bey", Address: "Ulucanlar Cad. Altındağ, Ankara",
            Lat: 39.9620, Lng: 32.8560,
            Description: "Günlük ev yemeği. Pilav, çorba ve mevsim yemekleri.",
            LogoUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Günlük Tabldot",      "2 çeşit yemek, pilav, çorba, ekmek",          145m, "Tabldot",  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuru Fasulye + Pilav","Ev yapımı kuru fasulye, pilav",                 99m, "Yemek",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("İzmir Köfte",         "Patatesli soslu köfte, ekmek",                 130m, "Yemek",   "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",    "Günlük taze çorba",                              55m, "Çorba",  "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Komposto",            "Mevsim meyvesi kompostosu",                      35m, "Tatlı",  "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                    25m, "İçecek", "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),


        // 81 — Çankaya · Dondurma
        new RestaurantDef(
            Email: "cankaya.mado@gotur.com", OwnerName: "Mado Türkiye",
            Name: "Mado Çankaya", Address: "Kızılay Mah. Çankaya, Ankara",
            Lat: 39.9211, Lng: 32.8537,
            Description: "Maraş usulü gerçek dondurma. Sıcak ve soğuk tatlılar.",
            LogoUrl: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Tek Top Dondurma",    "Maraş dondurması, külah veya kap",             45m, "Dondurma", "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop"),
                new MenuItemDef("Üç Top Dondurma",     "3 top dondurma, çeşit seçimi",                110m, "Dondurma", "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&h=300&fit=crop"),
                new MenuItemDef("Dondurmalı Waffle",   "Waffle + 2 top dondurma + çikolata",          145m, "Özel",     "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=400&h=300&fit=crop"),
                new MenuItemDef("Künefe",              "Sıcak servis, peynirli künefe",                120m, "Tatlı",    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Dondurma Sandviç",    "Sıkma dondurma, Maraş usulü",                  75m, "Dondurma", "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop"),
                new MenuItemDef("Türk Kahvesi",        "Sade Türk kahvesi",                             55m, "İçecek",  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
            }
        ),

        // 82 — Sincan · Kahvaltı
        new RestaurantDef(
            Email: "sincan.kahvalti@gotur.com", OwnerName: "Güler Hanım",
            Name: "Güler Hanım Kahvaltı", Address: "Şehit Ömer Halisdemir Mah. Sincan, Ankara",
            Lat: 39.9710, Lng: 32.5810,
            Description: "Ev sıcaklığında kahvaltı. Köy ürünleri ile zengin sofra.",
            LogoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Serpme Kahvaltı 2 kişi","Taze ürünlerle 20 çeşit serpme",            430m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Tek Kişilik Kahvaltı","10 çeşit ürün, yumurta dahil",                235m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Menemen",             "Taze domates, biber, yumurta",                  95m, "Sıcak",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Sahanda Sucuklu",     "Tereyağlı sahanda, sucuklu",                    85m, "Sıcak",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay Demliği",         "2 kişilik demlik çay",                          40m, "İçecek",  "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
            }
        ),

        // 83 — Çankaya · Kebap (farklı)
        new RestaurantDef(
            Email: "cankaya.kebap2@gotur.com", OwnerName: "Kadir Şahin",
            Name: "Şahin Kebap Evi", Address: "Balgat Mah. Çankaya, Ankara",
            Lat: 39.8980, Lng: 32.8090,
            Description: "Balgat'ın gözde kebapçısı. Et ve tavuk çeşitleri.",
            LogoUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Adana Kebap",         "250g acılı kıyma kebap",                      195m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Kanat",         "8 adet marine kanat, acılı sos ile",           175m, "Tavuk",   "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop"),
                new MenuItemDef("Köfte",               "El yapımı köfte 6 adet",                       155m, "Köfte",   "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Patlıcanlı Kebap",    "Közlenmiş patlıcan, kıyma sos",                210m, "Kebap",   "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Pilav",               "Tereyağlı pirinç pilavı",                       40m, "Yan Ürün","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 84 — Yenimahalle · Döner (farklı)
        new RestaurantDef(
            Email: "yenimahalle.donercisi@gotur.com", OwnerName: "Ufuk Usta",
            Name: "Ufuk Usta Et Dönerci", Address: "Batıkent Mah. Yenimahalle, Ankara",
            Lat: 39.9830, Lng: 32.7340,
            Description: "Batıkent'in ünlü et döner ustası. 20 yıllık tecrübe.",
            LogoUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Et Döner Tabak",      "200g döner, pilav, salata",                   165m, "Döner",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Et Dürüm",            "Lavaşta et döner, acı sos",                   119m, "Dürüm",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Karışık Tabak",       "Et + tavuk döner, pilav",                     185m, "Döner",    "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Yarım Ekmek",         "Somun ekmekte döner",                           80m, "Döner",   "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 85 — Gölbaşı · Tatlıcı
        new RestaurantDef(
            Email: "golbasi.tatli@gotur.com", OwnerName: "Sevgi Hanım",
            Name: "Gölbaşı Şeker Dükkanı", Address: "Atatürk Mah. Gölbaşı, Ankara",
            Lat: 39.7900, Lng: 32.8135,
            Description: "El yapımı şeker, akide ve çikolata. Ev yapımı kurabiyeler.",
            LogoUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Ev Yapımı Kurabiye 10'lu","Tereyağlı karışık kurabiye",               120m, "Kurabiye","https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Çikolatalı Brownie",   "Islak çikolatalı brownie",                      85m, "Pasta",  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Trüf Çikolata 6'lı",  "El yapımı trüf çikolata",                      110m, "Çikolata","https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Revani",              "İrmikli şerbetli tatlı",                          75m, "Tatlı",  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Sütlaç",              "Fırın sütlaç, tarçınlı",                          75m, "Tatlı",  "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Türk Kahvesi",        "Sade Türk kahvesi",                               55m, "İçecek", "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
            }
        ),


        // 86 — Çankaya · Türk Mutfağı
        new RestaurantDef(
            Email: "cankaya.turk@gotur.com", OwnerName: "Neriman Hanım",
            Name: "Anatolian Kitchen", Address: "Gaziosmanpaşa Mah. Çankaya, Ankara",
            Lat: 39.9050, Lng: 32.8690,
            Description: "Anadolu'nun dört bir yanından seçme lezzetler.",
            LogoUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Hünkar Beğendi",      "Dana kavurma, köz patlıcan püresi",            235m, "Ana Yemek","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Karnıyarık",          "Kıymalı patlıcan, salça ve biber",             175m, "Ana Yemek","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Testi Kebabı",        "Kapalı testi içinde pişmiş et",                275m, "Kebap",    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Çiğ Börek",           "Kıymalı çiğ börek",                             95m, "Börek",   "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Aşure",               "Geleneksel aşure, 40 malzeme",                  80m, "Tatlı",   "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 87 — Mamak · Pizza
        new RestaurantDef(
            Email: "mamak.pizza@gotur.com", OwnerName: "Pizza Pizza Türkiye",
            Name: "Pizza Pizza Mamak", Address: "Siteler Mah. Mamak, Ankara",
            Lat: 39.9460, Lng: 32.9180,
            Description: "Mamak'ta bol malzeme, çıtır pizza.",
            LogoUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Karışık Pizza M",     "Sucuk, mantar, zeytin, biber",                189m, "Pizza",    "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop"),
                new MenuItemDef("BBQ Tavuklu M",       "Barbekü soslu tavuk, mısır",                  199m, "Pizza",    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("4 Peynirli M",        "4 çeşit peynir",                              219m, "Pizza",    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("Garlic Bread",        "Sarımsaklı tereyağlı ekmek",                    79m, "Yan Ürün","https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Kola 1L",             "Şişe kola",                                     45m, "İçecek",  "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),

        // 88 — Keçiören · Mantı
        new RestaurantDef(
            Email: "kecioren.manti@gotur.com", OwnerName: "Hatice Hanım",
            Name: "Hatice Hanım Mutfağı", Address: "Kalecik Mah. Keçiören, Ankara",
            Lat: 40.0100, Lng: 32.8600,
            Description: "El açması mantı ve ev yemekleri. Sıcacık ev ortamı.",
            LogoUrl: "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Kayseri Mantısı",     "El kesilmiş mantı, yoğurt tereyağı",           145m, "Mantı",  "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Mantı",       "Kıymalı iç, sarımsaklı yoğurt",                155m, "Mantı",  "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuru Fasulye",        "Ev yapımı kuru fasulye, pilav ile",             110m, "Yemek",  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Tarhana Çorbası",     "Ev yapımı tarhana",                              60m, "Çorba",  "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                    25m, "İçecek", "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 89 — Etimesgut · Piknik & Mangal (Gerçek)
        new RestaurantDef(
            Email: "hocam.piknik.etimesgut@gotur.com", OwnerName: "Hocam Piknik",
            Name: "Hocam Piknik", Address: "Piyade Mah. İstasyon Cad. No:215, Etimesgut, Ankara",
            Lat: 39.9502, Lng: 32.6648,
            Description: "Etimesgut'un gözde mangal ve piknik restoranı. Taze közde etler, bahçede yemek.",
            LogoUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Karışık Mangal Tabağı","Adana, şiş, kanat, sucuk ve pilav",          295m, "Mangal",   "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuzu Şiş",            "Marine edilmiş kuzu but şiş, közde pişmiş",   245m, "Kebap",    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Şiş",           "Marine edilmiş tavuk göğsü şiş",              185m, "Kebap",    "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop"),
                new MenuItemDef("Sucuk Izgara",        "Geleneksel Türk sucuğu, közde pişmiş",        155m, "Izgara",   "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Çoban Salata",        "Domates, salatalık, biber, soğan, zeytinyağı", 65m, "Salata",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Pilav",               "Tereyağlı pirinç pilavı",                       45m, "Yan Ürün","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ev yapımı ayran 400ml",                   25m, "İçecek",  "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
                new MenuItemDef("Şalgam Suyu",         "Adana usulü acı şalgam",                        30m, "İçecek",  "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop"),
            }
        ),

        // 90 — Çankaya · İtalyan
        new RestaurantDef(
            Email: "cankaya.pasta@gotur.com", OwnerName: "Marco Rossini",
            Name: "La Bella Italia", Address: "Arjantin Cad. Çankaya, Ankara",
            Lat: 39.9035, Lng: 32.8665,
            Description: "Gerçek İtalyan pastaları ve pizzaları. Her gün taze hamur.",
            LogoUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Spaghetti Carbonara", "Guanciale, yumurta, pecorino, karabiber",      195m, "Pasta",   "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Penne Arrabbiata",    "Domates sos, sarımsak, kırmızı biber",         175m, "Pasta",   "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=400&h=300&fit=crop"),
                new MenuItemDef("Pizza Margherita",    "San Marzano domates, mozzarella, fesleğen",    215m, "Pizza",   "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop"),
                new MenuItemDef("Tiramisu",            "Mascarpone, kahve, kakao ile",                 120m, "Tatlı",   "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Bruschetta",          "Domates, sarımsak, fesleğen, zeytinyağı",       95m, "Meze",    "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Espresso",            "Çift shot İtalyan espresosu",                   65m, "Kahve",   "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"),
                new MenuItemDef("San Pellegrino",      "İtalyan maden suyu 500ml",                      45m, "İçecek",  "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),


        // 91 — Yenimahalle · Balık
        new RestaurantDef(
            Email: "yenimahalle.balik@gotur.com", OwnerName: "Deniz Baba",
            Name: "Deniz Baba Balık", Address: "Ostim Mah. Yenimahalle, Ankara",
            Lat: 39.9990, Lng: 32.7640,
            Description: "Ankara'da taze deniz ürünleri. Çarşı sabahı gelen balıklar.",
            LogoUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Izgara Çipura",       "Taze çipura, pilav ve salata",                 259m, "Balık",   "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Hamsi Tava",          "Çıtır hamsi tava, mısır unu ile",              149m, "Balık",   "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop"),
                new MenuItemDef("Kalamares",           "Çıtır kalamar, tarator sos",                   149m, "Meze",    "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Balık Çorbası",       "Taze balık çorbası",                             85m, "Çorba",  "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Roka Salatası",       "Roka, çeri domates, parmesan",                  75m, "Salata",  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Limonata",            "Taze limonata",                                  55m, "İçecek", "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
            }
        ),

        // 92 — Altındağ · Döner
        new RestaurantDef(
            Email: "altindag.donercisi@gotur.com", OwnerName: "Nevzat Usta",
            Name: "Nevzat Usta Et Döner", Address: "Ulus Meydanı, Altındağ, Ankara",
            Lat: 39.9465, Lng: 32.8590,
            Description: "Ulus'un tarihi et döner ustası. 40 yıllık tecrübe.",
            LogoUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Et Döner Tabak",      "200g döner, pilav, söğüş",                    165m, "Döner",   "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Yarım Ekmek",         "Somun ekmekte et döner",                        85m, "Döner",   "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Et Dürüm",            "Lavaşta et döner, acı sos",                    119m, "Dürüm",  "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Çorba",               "Günlük çorba",                                   50m, "Çorba", "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                    25m, "İçecek","https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 93 — Pursaklar · Çiğ Köfte
        new RestaurantDef(
            Email: "pursaklar.cigkofte@gotur.com", OwnerName: "Deniz Kırmızı",
            Name: "Kırmızı Çiğ Köfte", Address: "Merkez Mah. Pursaklar, Ankara",
            Lat: 40.0400, Lng: 32.8930,
            Description: "El yapımı çiğ köfte. Lavaşta veya tabakta.",
            LogoUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Dürüm Orta Acı",      "Marul, nar ekşisi, limon ile",                  55m, "Dürüm",  "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Dürüm Sade",          "Acısız çiğ köfte dürüm",                         55m, "Dürüm", "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Büyük Tabak",         "200g çiğ köfte, limon, nar",                     90m, "Tabak", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("5'li Set",            "5 adet dürüm, aile boyu",                       245m, "Set",   "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                    25m, "İçecek","https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 94 — Sincan · Kebap (farklı)
        new RestaurantDef(
            Email: "sincan.kebap2@gotur.com", OwnerName: "Turgay Bey",
            Name: "Turgay Bey'in Yeri", Address: "Yenikent Mah. Sincan, Ankara",
            Lat: 39.9780, Lng: 32.5680,
            Description: "Yenikent'in lezzet durağı. Ocakbaşında pişen etler.",
            LogoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Karışık Izgara",      "Adana, şiş, kanat, köfte, pilav",              285m, "Izgara",  "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuzu Şiş",            "Marine kuzu şiş, orman mantarlı",              235m, "Kebap",   "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"),
                new MenuItemDef("Köfte",               "6 adet el yapımı köfte",                        155m, "Köfte",  "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Pilav",               "Tereyağlı pirinç pilavı",                        40m, "Yan Ürün","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                    25m, "İçecek", "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 95 — Çankaya · Steak
        new RestaurantDef(
            Email: "cankaya.steak@gotur.com", OwnerName: "Hakan Et",
            Name: "Steakhouse Ankara", Address: "Nenehatun Cad. Çankaya, Ankara",
            Lat: 39.9155, Lng: 32.8530,
            Description: "Premium et restoranı. Dry-aged dana antrikot ve fileto.",
            LogoUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Dry-Aged Antrikot 300g","28 günlük dry-aged dana antrikot",          489m, "Steak",   "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"),
                new MenuItemDef("Fileto Mignon 200g",   "Tender fileto, garnitür ile",                 419m, "Steak",  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"),
                new MenuItemDef("T-Bone 400g",          "T-bone biftek, medium rare",                  549m, "Steak",  "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"),
                new MenuItemDef("Kuşkonmaz Garnitür",   "Izgara kuşkonmaz, tereyağlı",                  95m, "Yan Ürün","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Truffle Patates",      "Truffle yağlı patates püresi",                 95m, "Yan Ürün","https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"),
                new MenuItemDef("Cheesecake",           "New York cheesecake dilimi",                   120m, "Tatlı",  "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Kırmızı Şarap (Kadeh)","Seçilmiş yerli kırmızı şarap",               150m, "İçecek", "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop"),
            }
        ),


        // 96 — Gölbaşı · Kahvaltı
        new RestaurantDef(
            Email: "golbasi.kahvalti@gotur.com", OwnerName: "Leyla Hanım",
            Name: "Leyla Hanım Kahvaltı Bahçesi", Address: "Gölbaşı İlçe Merkezi, Ankara",
            Lat: 39.7945, Lng: 32.8085,
            Description: "Göl manzarasında bahçede taze serpme kahvaltı.",
            LogoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Serpme Kahvaltı 2 kişi","20+ çeşit köy ürünü, bahçede servis",      460m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Tek Kişilik",          "10 çeşit, yumurta, çay dahil",               245m, "Kahvaltı", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop"),
                new MenuItemDef("Köy Yumurtası Sahanda","Köy yumurtası, tereyağlı",                    80m, "Sıcak",   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Taze Meyve Tabağı",    "Mevsim meyveleri, bol ve taze",               75m, "Tatlı",   "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay Demliği",          "Demlik çay, 2 kişilik",                       40m, "İçecek",  "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
            }
        ),

        // 97 — Mamak · Döner
        new RestaurantDef(
            Email: "mamak.donercisi@gotur.com", OwnerName: "Özgür Usta",
            Name: "Özgür Usta Döner", Address: "Abidinpaşa Mah. Mamak, Ankara",
            Lat: 39.9490, Lng: 32.9000,
            Description: "Mamak'ın sevilen döner ustası.",
            LogoUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Et Döner Tabak",      "200g döner, pilav, salata",                   165m, "Döner",   "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Tavuk Dürüm",         "Lavaşta tavuk döner, sos",                     99m, "Dürüm",   "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Karışık Dürüm",       "Et + tavuk lavaşta",                           129m, "Dürüm",  "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Yarım Ekmek",         "Ekmekte döner",                                 80m, "Döner",  "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek", "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 98 — Yenimahalle · Börek
        new RestaurantDef(
            Email: "yenimahalle.borekci@gotur.com", OwnerName: "Nesrin Hanım",
            Name: "Nesrin Hanım Börekçisi", Address: "Karşıyaka Mah. Yenimahalle, Ankara",
            Lat: 40.0010, Lng: 32.7870,
            Description: "El açması börek. Her sabah taze hazırlanır.",
            LogoUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Su Böreği",           "Haşlanmış hamur, peynirli",                   110m, "Börek",   "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Kıymalı Börek",       "El açması kıymalı",                             45m, "Börek",  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Peynirli Börek",      "El açması peynirli",                             45m, "Börek", "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"),
                new MenuItemDef("Gözleme",             "El açması peynirli veya kıymalı",               75m, "Gözleme","https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop"),
                new MenuItemDef("Çay",                 "Demli çay",                                     15m, "İçecek", "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                   25m, "İçecek", "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),

        // 99 — Çankaya · Vegan (2. şube)
        new RestaurantDef(
            Email: "cankaya.vegan2@gotur.com", OwnerName: "Zehra Güneş",
            Name: "Bitkisel Sofra", Address: "Kavaklıdere Mah. Çankaya, Ankara",
            Lat: 39.9010, Lng: 32.8630,
            Description: "Bitkisel protein ve taze sebzeyle hazırlanan sağlıklı tabaklar.",
            LogoUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Acı Soslu Tofu",      "Marine tofu, sebze karışık, pirinç",           145m, "Ana Yemek","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Nohut Köri",          "Kremalı nane, nohut köri, nan ekmek",          155m, "Ana Yemek","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Tabağı",     "Yeşil mercimek, zeytinyağlı",                  110m, "Meze",    "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&h=300&fit=crop"),
                new MenuItemDef("Taze Salata Bowl",    "Roka, kinoa, ceviz, nar tanesi",               125m, "Salata",  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Smoothie",            "Muz, ıspanak, elma smoothie",                   75m, "İçecek",  "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
                new MenuItemDef("Taze Meyve Suyu",     "Günlük sıkım",                                  65m, "İçecek",  "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=400&h=300&fit=crop"),
            }
        ),

        // 100 — Çankaya · Restoran (Genel)
        new RestaurantDef(
            Email: "cankaya.general@gotur.com", OwnerName: "Ahmet Niyazi Bey",
            Name: "Ankara Sofrası", Address: "Kızılay Mah. Çankaya, Ankara",
            Lat: 39.9200, Lng: 32.8560,
            Description: "Ankara'nın geleneksel lezzetleri. Testi kebabı ve Ankara tava şart.",
            LogoUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop",
            MenuItems: new[]
            {
                new MenuItemDef("Ankara Tava",         "Dana kavurma, sarımsak, tereyağlı sos",        245m, "Ana Yemek","https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop"),
                new MenuItemDef("Testi Kebabı",        "Kapalı testi içinde kuzu eti",                 275m, "Kebap",   "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop"),
                new MenuItemDef("Beypazarı Kurusu",    "Geleneksel Beypazarı kurusu, 200g",             95m, "Atıştırma","https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Mercimek Çorbası",    "Taze çorba, limonlu",                            55m, "Çorba",  "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop"),
                new MenuItemDef("Pilav",               "Tereyağlı pirinç pilavı",                        40m, "Yan Ürün","https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop"),
                new MenuItemDef("Revani",              "İrmikli şerbetli tatlı",                         75m, "Tatlı",  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop"),
                new MenuItemDef("Ayran",               "Soğuk ayran",                                    25m, "İçecek", "https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop"),
            }
        ),
    };
}
