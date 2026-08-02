using FluentAssertions;
using Xunit;

namespace GetirReplica.Tests;

/// <summary>
/// Haversine mesafe algoritması testleri.
///
/// Neden bu testler önemli?
/// Eşleştirme algoritması, en yakın kuryeyi bulmak için Haversine kullanır.
/// Hesaplama yanlışsa yanlış kurye atanır (uzaktaki kurye yakın görünebilir).
/// Bilinen koordinatlar ve gerçek mesafeler ile doğrulanır.
/// </summary>
public class HaversineTests
{
    // MatchingService'ten alınan Haversine implementasyonu
    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371;
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
    private static double ToRad(double deg) => deg * Math.PI / 180;

    [Fact]
    public void SamePoint_ShouldReturnZeroDistance()
    {
        // Aynı koordinat → 0 km
        var result = HaversineKm(41.0082, 28.9784, 41.0082, 28.9784);
        result.Should().BeApproximately(0.0, precision: 0.001);
    }

    [Fact]
    public void IstanbulToAnkara_ShouldBeApprox350km()
    {
        // İstanbul (41.0082, 28.9784) → Ankara (39.9208, 32.8541)
        // Gerçek mesafe: ~349-352 km
        var result = HaversineKm(41.0082, 28.9784, 39.9208, 32.8541);
        result.Should().BeInRange(340, 360,
            because: "İstanbul-Ankara arası yaklaşık 350 km olmalıdır");
    }

    [Fact]
    public void NearbyPoints_ShouldBeWithin10km()
    {
        // Etimesgut (39.9478, 32.6612) → Etimesgut yakını (39.9418, 32.6708)
        // Yaklaşık 1 km içinde olmalı
        var result = HaversineKm(39.9478, 32.6612, 39.9418, 32.6708);
        result.Should().BeLessThan(2.0,
            because: "Aynı mahalle içindeki iki nokta 2 km'den yakın olmalıdır");
    }

    [Fact]
    public void DistanceIsSymmetric()
    {
        // A→B mesafesi B→A mesafesine eşit olmalı
        var ab = HaversineKm(41.0082, 28.9784, 39.9208, 32.8541);
        var ba = HaversineKm(39.9208, 32.8541, 41.0082, 28.9784);
        ab.Should().BeApproximately(ba, precision: 0.001,
            because: "Mesafe simetrik olmalıdır");
    }

    [Theory]
    [InlineData(41.0082, 28.9784, 41.0422, 29.0083, 5.0)]   // İstanbul içi iki nokta < 5km
    [InlineData(39.9208, 32.8541, 39.9334, 32.8597, 2.0)]   // Ankara içi iki nokta < 2km
    public void CityPoints_ShouldBeWithinExpectedRange(
        double lat1, double lon1, double lat2, double lon2, double maxKm)
    {
        var result = HaversineKm(lat1, lon1, lat2, lon2);
        result.Should().BeLessThan(maxKm,
            because: $"Şehir içi iki nokta {maxKm} km'den yakın olmalıdır");
    }
}
