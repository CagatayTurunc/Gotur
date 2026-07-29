namespace GetirReplica.API.Extensions;

/// <summary>
/// Secrets Management — Configuration Provider öncelik zinciri.
///
/// Katmanlı okuma sırası (sonraki öncekini override eder):
///   1. appsettings.json          — Varsayılan değerler (placeholder'lar)
///   2. appsettings.{Env}.json    — Ortam bazlı override
///   3. Environment Variables     — Docker / Kubernetes / CI inject eder
///   4. (Opsiyonel) Azure Key Vault / HashiCorp Vault
///
/// Production güvenlik kuralları:
///   - appsettings.json'da ASLA gerçek şifre/secret olmaz
///   - Connection string'ler env variable olarak inject edilir
///   - K8s Secret → Pod env → uygulama okur
///
/// Neden .NET built-in yeterli?
///   ASP.NET Core configuration sistemi zaten bu pattern'i destekler.
///   "CONNECTIONSTRINGS__DEFAULT=..." env variable, "ConnectionStrings:Default"
///   config key'ini override eder. Çift alt çizgi (:) separator'dır.
///
/// Örnek env variable'lar (docker-compose veya K8s Secret'tan):
///   ConnectionStrings__Default=Host=db;Password=secret123
///   Jwt__Secret=super-secret-key-32-chars-min
///   Google__ClientId=xxx.apps.googleusercontent.com
///
/// Azure Key Vault entegrasyonu (bonus):
///   builder.Configuration.AddAzureKeyVault(...)
///   Azure MSI ile şifresiz auth mümkün.
/// </summary>
public static class SecretsExtensions
{
    /// <summary>
    /// Uygulama başlarken kritik secret'ların mevcut olduğunu doğrula.
    /// Eksik secret varsa anlamsız runtime hatasından önce açıklayıcı mesaj ver.
    ///
    /// Production'da "Jwt__Secret env variable set edilmedi" demek
    /// "NullReferenceException at TokenService.cs:47"'den çok daha iyidir.
    /// </summary>
    public static void ValidateRequiredSecrets(this IConfiguration configuration, ILogger logger)
    {
        var required = new[]
        {
            ("ConnectionStrings:Default",  "PostgreSQL connection string"),
            ("ConnectionStrings:Redis",    "Redis connection string"),
            ("Jwt:Secret",                 "JWT signing secret (min 32 chars)"),
        };

        var missing = new List<string>();

        foreach (var (key, description) in required)
        {
            var value = configuration[key];
            if (string.IsNullOrWhiteSpace(value) || value.StartsWith("YOUR_") || value.StartsWith("CHANGE_"))
            {
                missing.Add($"  - {key} ({description})");
            }
        }

        if (missing.Count == 0) return;

        var msg = $"""
            ⚠️  Eksik veya yapılandırılmamış secret'lar tespit edildi:
            {string.Join(Environment.NewLine, missing)}

            Bu değerleri environment variable olarak inject edin:
              Docker: -e ConnectionStrings__Default="Host=db;..."
              K8s:    kubectl create secret generic gotur-api-secrets ...
              Local:  dotnet user-secrets set "Jwt:Secret" "..."

            Daha fazla bilgi: infra/k8s/secret.example.yaml
            """;

        logger.LogWarning(msg);
    }

    /// <summary>
    /// JWT Secret uzunluk güvenlik kontrolü.
    /// HMAC-SHA256 için minimum 32 karakter (256 bit) önerilir.
    /// </summary>
    public static void ValidateJwtSecret(this IConfiguration configuration, ILogger logger)
    {
        var secret = configuration["Jwt:Secret"] ?? string.Empty;
        if (secret.Length < 32)
        {
            logger.LogError(
                "Jwt:Secret çok kısa ({Length} karakter). Minimum 32 karakter gerekli. " +
                "Kısa secret brute-force saldırısına açık — token güvenliği tehlikede.",
                secret.Length);
        }
    }
}
