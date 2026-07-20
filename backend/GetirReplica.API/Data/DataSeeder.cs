using GetirReplica.API.Models.Entities;
using GetirReplica.API.Models.Enums;
using Microsoft.AspNetCore.Identity;

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
        if (await userManager.FindByEmailAsync("admin@getir.com") == null)
        {
            var admin = new AppUser { Email = "admin@getir.com", UserName = "admin@getir.com", FullName = "Admin", Role = "admin" };
            await userManager.CreateAsync(admin, "Admin123!");
            await userManager.AddToRoleAsync(admin, "admin");
        }

        // Müşteri
        if (await userManager.FindByEmailAsync("musteri@test.com") == null)
        {
            var customer = new AppUser { Email = "musteri@test.com", UserName = "musteri@test.com", FullName = "Test Müşteri", Role = "customer" };
            await userManager.CreateAsync(customer, "Test123!");
            await userManager.AddToRoleAsync(customer, "customer");
        }

        // Restoran kullanıcısı
        AppUser? restaurantUser = await userManager.FindByEmailAsync("restoran@test.com");
        if (restaurantUser == null)
        {
            restaurantUser = new AppUser { Email = "restoran@test.com", UserName = "restoran@test.com", FullName = "Test Restoran", Role = "restaurant" };
            await userManager.CreateAsync(restaurantUser, "Test123!");
            await userManager.AddToRoleAsync(restaurantUser, "restaurant");
        }

        // Test Restoran
        if (!db.Restaurants.Any(r => r.UserId == restaurantUser.Id))
        {
            db.Restaurants.Add(new Restaurant
            {
                UserId = restaurantUser.Id,
                Name = "Test Restoran",
                Address = "Kadıköy, İstanbul",
                LocationLat = 40.9906,
                LocationLng = 29.0287
            });
            await db.SaveChangesAsync();
        }

        // Demo restoranlar — seed kullanıcısı yoksa oluştur, sonra restoranları ekle
        await SeedDemoRestaurantsAsync(userManager, db);

        // Kuryeler
        var courierEmails = new[] { "kurye1@test.com", "kurye2@test.com" };
        foreach (var (email, i) in courierEmails.Select((e, i) => (e, i)))
        {
            AppUser? courierUser = await userManager.FindByEmailAsync(email);
            if (courierUser == null)
            {
                courierUser = new AppUser { Email = email, UserName = email, FullName = $"Kurye {i + 1}", Role = "courier" };
                await userManager.CreateAsync(courierUser, "Test123!");
                await userManager.AddToRoleAsync(courierUser, "courier");
            }

            if (!db.Couriers.Any(c => c.UserId == courierUser.Id))
            {
                db.Couriers.Add(new Courier
                {
                    UserId = courierUser.Id,
                    Status = CourierStatus.Available,
                    CurrentLocationLat = 40.990 + i * 0.005,
                    CurrentLocationLng = 29.025 + i * 0.005,
                    LastLocationAt = DateTime.UtcNow
                });
            }
        }

        await db.SaveChangesAsync();
    }

    private static async Task SeedDemoRestaurantsAsync(UserManager<AppUser> userManager, AppDbContext db)
    {
        // Her demo restoran için ayrı kullanıcı + restoran + menü oluştur
        var demos = new[]
        {
            new {
                Email    = "kebapci@demo.com",
                FullName = "Adana Sofrası",
                RestName = "Adana Sofrası",
                Address  = "Bağcılar, İstanbul",
                Lat      = 41.0355, Lng = 28.8561,
                Logo     = "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
                Desc     = "Gerçek Adana ve Urfa kebabı, közde pişmiş lezzetler.",
                Items    = new[]
                {
                    new { Name="Adana Kebap",       Desc="200g acılı kıyma kebap, lavaş ve söğüş ile",      Price=189m, Cat="Kebap",    Img="https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop" },
                    new { Name="Urfa Kebap",         Desc="200g acısız kıyma kebap, piyaz ile",              Price=179m, Cat="Kebap",    Img="https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop" },
                    new { Name="Şiş Kebap",          Desc="Dana şiş, közlenmiş biber ve domates ile",        Price=199m, Cat="Kebap",    Img="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop" },
                    new { Name="Tavuk Şiş",          Desc="Marine edilmiş tavuk göğsü şiş",                 Price=159m, Cat="Kebap",    Img="https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop" },
                    new { Name="Karışık Izgara",     Desc="Adana, şiş, kanat ve pirzola karışık",            Price=289m, Cat="Izgara",   Img="https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop" },
                    new { Name="Lahmacun",           Desc="El açması ince hamur, kıymalı",                  Price=45m,  Cat="Pide",     Img="https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop" },
                    new { Name="Künefe",             Desc="Antep fıstıklı, tel kadayıf ve peynirli",        Price=99m,  Cat="Tatlı",    Img="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop" },
                    new { Name="Ayran",              Desc="Soğuk ev yapımı ayran",                          Price=25m,  Cat="İçecek",   Img="https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=400&h=300&fit=crop" },
                }
            },
            new {
                Email    = "iskenderci@demo.com",
                FullName = "Bursa İskender",
                RestName = "Bursa İskender",
                Address  = "Üsküdar, İstanbul",
                Lat      = 41.0231, Lng = 29.0151,
                Logo     = "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=400&fit=crop",
                Desc     = "1867'den beri gelen özgün İskender kebabı tarifi.",
                Items    = new[]
                {
                    new { Name="İskender Kebap (Tam)",   Desc="300g döner, yoğurt, tereyağı sos ve domates",  Price=249m, Cat="İskender",  Img="https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop" },
                    new { Name="İskender Kebap (Yarım)",  Desc="150g döner, yoğurt ve tereyağı ile",           Price=149m, Cat="İskender",  Img="https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop" },
                    new { Name="Döner Dürüm",            Desc="İnce lavaşta döner, söğüş ve sos",             Price=120m, Cat="Dürüm",     Img="https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop" },
                    new { Name="Pide",                   Desc="Kıymalı ve kaşarlı karışık pide",              Price=130m, Cat="Pide",      Img="https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop" },
                    new { Name="Çorba",                  Desc="Günlük taze mercimek çorbası",                 Price=55m,  Cat="Çorba",     Img="https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop" },
                    new { Name="Sütlaç",                 Desc="Fırında üstü kızarmış sütlaç",                Price=65m,  Cat="Tatlı",     Img="https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop" },
                    new { Name="Şalgam Suyu",            Desc="Adana usulü acı şalgam",                      Price=30m,  Cat="İçecek",    Img="https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&h=300&fit=crop" },
                }
            },
            new {
                Email    = "baklavaci@demo.com",
                FullName = "Güllüoğlu Baklava",
                RestName = "Güllüoğlu Baklava",
                Address  = "Karaköy, İstanbul",
                Lat      = 41.0244, Lng = 28.9747,
                Logo     = "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=400&fit=crop",
                Desc     = "1871'den bu yana Antep fıstıklı el işi baklava.",
                Items    = new[]
                {
                    new { Name="Antep Fıstıklı Baklava", Desc="250g özel kesim, fıstıklı",                  Price=185m, Cat="Baklava",   Img="https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop" },
                    new { Name="Sütlü Nuriye",           Desc="Hafif sütlü baklava, 250g",                  Price=165m, Cat="Baklava",   Img="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop" },
                    new { Name="Şöbiyet",                Desc="Kaymak dolgu, çıtır baklava",               Price=175m, Cat="Baklava",   Img="https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop" },
                    new { Name="Kadayıf",                Desc="Tel kadayıf, cevizli ve fıstıklı",          Price=145m, Cat="Tatlı",     Img="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop" },
                    new { Name="Künefe",                 Desc="Sıcak servis, peynirli tel kadayıf",        Price=120m, Cat="Tatlı",     Img="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop" },
                    new { Name="Şerbetli Lokma",         Desc="Altın rengi, bol şerbetli lokma",            Price=75m,  Cat="Tatlı",     Img="https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop" },
                    new { Name="Türk Kahvesi",           Desc="Menengiç veya sade Türk kahvesi",            Price=55m,  Cat="İçecek",    Img="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop" },
                    new { Name="Baklava Tabağı (1kg)",   Desc="Karışık 1kg baklava, hediye kutusunda",      Price=580m, Cat="Baklava",   Img="https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&h=300&fit=crop" },
                }
            },
            new {
                Email    = "dondurmaci@demo.com",
                FullName = "Maraş Dondurma",
                RestName = "Maraş Dondurma",
                Address  = "Beyoğlu, İstanbul",
                Lat      = 41.0338, Lng = 28.9775,
                Logo     = "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=400&fit=crop",
                Desc     = "Gerçek salep ve keçi sütünden yapılan Maraş dondurması.",
                Items    = new[]
                {
                    new { Name="Tek Top Dondurma",       Desc="Seçtiğin 1 top Maraş dondurması",            Price=45m,  Cat="Dondurma",  Img="https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop" },
                    new { Name="Üç Top Dondurma",        Desc="3 top dondurma, külah veya kap seçimi",      Price=110m, Cat="Dondurma",  Img="https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&h=300&fit=crop" },
                    new { Name="Dondurmalı Waffle",      Desc="Waffle üstü 2 top dondurma ve çikolata sos", Price=145m, Cat="Özel",      Img="https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=400&h=300&fit=crop" },
                    new { Name="Dondurma Sandviç",       Desc="Sıkma dondurma, Maraş usulü",               Price=75m,  Cat="Dondurma",  Img="https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop" },
                    new { Name="Meyve Sorbe",            Desc="Çilek, mango veya limon sorbe",              Price=65m,  Cat="Sorbe",     Img="https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop" },
                    new { Name="Dondurmalı Profiterol",  Desc="Çikolata soslu, dondurma dolgulu profiterol", Price=120m, Cat="Özel",     Img="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop" },
                    new { Name="Meşrubat",               Desc="Kola, fanta, su — soğuk",                   Price=30m,  Cat="İçecek",    Img="https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=400&h=300&fit=crop" },
                }
            },
        };

        foreach (var d in demos)
        {
            // Kullanıcı yoksa oluştur
            AppUser? demoUser = await userManager.FindByEmailAsync(d.Email);
            if (demoUser == null)
            {
                demoUser = new AppUser { Email = d.Email, UserName = d.Email, FullName = d.FullName, Role = "restaurant" };
                await userManager.CreateAsync(demoUser, "Demo123!");
                await userManager.AddToRoleAsync(demoUser, "restaurant");
            }

            // Restoran yoksa oluştur
            if (!db.Restaurants.Any(r => r.UserId == demoUser.Id))
            {
                var rest = new Restaurant
                {
                    UserId      = demoUser.Id,
                    Name        = d.RestName,
                    Address     = d.Address,
                    Description = d.Desc,
                    LogoUrl     = d.Logo,
                    IsOpen      = true,
                    LocationLat = d.Lat,
                    LocationLng = d.Lng,
                };
                db.Restaurants.Add(rest);
                await db.SaveChangesAsync();

                // Menü ürünleri
                foreach (var item in d.Items)
                {
                    db.MenuItems.Add(new MenuItem
                    {
                        RestaurantId = rest.Id,
                        Name         = item.Name,
                        Description  = item.Desc,
                        Price        = item.Price,
                        Category     = item.Cat,
                        ImageUrl     = item.Img,
                        IsAvailable  = true,
                    });
                }
                await db.SaveChangesAsync();
            }
        }
    }

}
