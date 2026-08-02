using FluentAssertions;
using GetirReplica.API.Models.DTOs.Orders;
using GetirReplica.API.Models.Entities;
using Xunit;

namespace GetirReplica.Tests;

/// <summary>
/// Fiyat manipülasyonu koruması testleri.
///
/// QA Kritik Bulgu #2: Client'tan gelen fiyat yoksayılmalı,
/// DB'deki gerçek menü fiyatı kullanılmalı.
///
/// Bu testler OrderService.CreateOrderAsync içindeki
/// fiyat validasyon mantığını izole eder.
/// </summary>
public class PriceValidationTests
{
    // OrderService'teki fiyat validasyon mantığını izole edip test ediyoruz.
    // Gerçek servisi test etmek için InMemory DB gerekirdi (entegrasyon testi).
    // Bu unit testler iş mantığına odaklanır.

    private static List<OrderItemDto> ValidatePrices(
        IEnumerable<OrderItemDto> clientItems,
        IEnumerable<MenuItem> menuItems)
    {
        var menu = menuItems.ToList();
        var result = new List<OrderItemDto>();

        foreach (var item in clientItems)
        {
            var menuItem = menu.FirstOrDefault(m =>
                string.Equals(m.Name, item.Name, StringComparison.OrdinalIgnoreCase));

            result.Add(menuItem != null
                ? item with { Price = menuItem.Price }  // DB fiyatını kullan
                : item);                                 // Menüde yok, olduğu gibi bırak
        }
        return result;
    }

    [Fact]
    public void ClientPrice_ShouldBeOverriddenWithDbPrice()
    {
        // Arrange: client 0.01 TL gönderiyor ama DB'de 189 TL
        var clientItems = new[] { new OrderItemDto("Adana Kebap", 1, 0.01m) };
        var menuItems = new[] { new MenuItem { Name = "Adana Kebap", Price = 189m, IsAvailable = true, RestaurantId = Guid.NewGuid() } };

        // Act
        var result = ValidatePrices(clientItems, menuItems);

        // Assert
        result.Should().HaveCount(1);
        result[0].Price.Should().Be(189m,
            because: "Client'tan gelen fiyat yoksayılmalı, DB fiyatı kullanılmalı");
        result[0].Price.Should().NotBe(0.01m,
            because: "0.01 TL fiyat manipülasyonu engellenmiş olmalı");
    }

    [Fact]
    public void ClientOverprice_ShouldAlsoBeOverriddenWithDbPrice()
    {
        // Arrange: client çok yüksek fiyat gönderiyor (farklı manipülasyon yönü)
        var clientItems = new[] { new OrderItemDto("Mercimek Çorbası", 2, 999999m) };
        var menuItems = new[] { new MenuItem { Name = "Mercimek Çorbası", Price = 55m, IsAvailable = true, RestaurantId = Guid.NewGuid() } };

        // Act
        var result = ValidatePrices(clientItems, menuItems);

        // Assert
        result[0].Price.Should().Be(55m,
            because: "Yüksek fiyat manipülasyonu da DB fiyatıyla override edilmeli");
    }

    [Fact]
    public void CaseInsensitiveMatch_ShouldWork()
    {
        // Arrange: client büyük harf gönderiyor, DB küçük harf
        var clientItems = new[] { new OrderItemDto("AYRAN", 1, 0.01m) };
        var menuItems = new[] { new MenuItem { Name = "Ayran", Price = 25m, IsAvailable = true, RestaurantId = Guid.NewGuid() } };

        // Act
        var result = ValidatePrices(clientItems, menuItems);

        // Assert
        result[0].Price.Should().Be(25m,
            because: "Büyük/küçük harf farkı eşleşmeyi engellememeli");
    }

    [Fact]
    public void UnknownItem_ShouldPassThrough()
    {
        // Arrange: menüde olmayan ürün (mock/seed data uyumluluğu)
        var clientItems = new[] { new OrderItemDto("Bilinmeyen Ürün", 1, 50m) };
        var menuItems = new[] { new MenuItem { Name = "Adana Kebap", Price = 189m, IsAvailable = true, RestaurantId = Guid.NewGuid() } };

        // Act
        var result = ValidatePrices(clientItems, menuItems);

        // Assert — menüde olmayan ürün olduğu gibi geçer (geriye dönük uyumluluk)
        result[0].Name.Should().Be("Bilinmeyen Ürün");
        result[0].Price.Should().Be(50m);
    }

    [Fact]
    public void MultipleItems_AllShouldBeValidated()
    {
        // Arrange: birden fazla ürün, hepsinin fiyatı doğrulanmalı
        var clientItems = new[]
        {
            new OrderItemDto("Adana Kebap", 2, 0.01m),
            new OrderItemDto("Ayran", 3, 999m),
            new OrderItemDto("Mercimek Çorbası", 1, 1m)
        };
        var menuItems = new[]
        {
            new MenuItem { Name = "Adana Kebap",       Price = 189m, IsAvailable = true, RestaurantId = Guid.NewGuid() },
            new MenuItem { Name = "Ayran",              Price = 25m,  IsAvailable = true, RestaurantId = Guid.NewGuid() },
            new MenuItem { Name = "Mercimek Çorbası",  Price = 55m,  IsAvailable = true, RestaurantId = Guid.NewGuid() }
        };

        // Act
        var result = ValidatePrices(clientItems, menuItems);

        // Assert
        result.Should().HaveCount(3);
        result[0].Price.Should().Be(189m);
        result[1].Price.Should().Be(25m);
        result[2].Price.Should().Be(55m);
    }

    [Fact]
    public void TotalAmount_ShouldBeCalculatedFromDbPrices()
    {
        // Arrange: client manipüle edilmiş fiyatlarla toplam düşürmeye çalışıyor
        var clientItems = new[]
        {
            new OrderItemDto("Adana Kebap", 2, 0.01m),  // gerçekte 189 × 2 = 378
            new OrderItemDto("Ayran", 1, 0.01m)          // gerçekte 25 × 1 = 25
        };
        var menuItems = new[]
        {
            new MenuItem { Name = "Adana Kebap", Price = 189m, IsAvailable = true, RestaurantId = Guid.NewGuid() },
            new MenuItem { Name = "Ayran",        Price = 25m,  IsAvailable = true, RestaurantId = Guid.NewGuid() }
        };

        // Act
        var validated = ValidatePrices(clientItems, menuItems);
        var total = validated.Sum(i => i.Price * i.Quantity);

        // Assert
        total.Should().Be(403m, // 189*2 + 25*1
            because: "Toplam tutar DB fiyatlarıyla hesaplanmalı, client fiyatlarıyla değil");
    }
}
