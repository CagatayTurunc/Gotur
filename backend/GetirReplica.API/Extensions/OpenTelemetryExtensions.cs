using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using System.Diagnostics;

namespace GetirReplica.API.Extensions;

/// <summary>
/// OpenTelemetry dağıtık izleme konfigürasyonu.
///
/// Neden gerekli?
///   Prometheus/Grafana metrikleri "kaç istek geldi, ne kadar sürdü" sorusuna cevap verir.
///   Ama "bu belirli istek hangi serviste, hangi sorguda yavaşladı?" sorusuna cevap veremez.
///   OpenTelemetry her isteğe trace-id verir, bu ID SignalR mesajlarına,
///   Hangfire job'larına, EF Core sorgularına kadar taşınır.
///
/// Görselleştirme:
///   OTLP Exporter → Jaeger veya Grafana Tempo → span bazlı waterfall görünüm
///
/// Activity Source:
///   Uygulama kodunda ActivitySource.StartActivity() ile özel span'ler oluşturulabilir.
///   Örn: matching algoritması, outbox processing, location update
/// </summary>
public static class OpenTelemetryExtensions
{
    /// <summary>
    /// Uygulamanın tüm servisler arası trace ürettiği ActivitySource.
    /// Singleton — her yerden erişilebilir.
    /// </summary>
    public static readonly ActivitySource ActivitySource =
        new("GetirReplica.API", "1.0.0");

    public static IServiceCollection AddOpenTelemetryTracing(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var serviceName = configuration["OpenTelemetry:ServiceName"] ?? "GetirReplica.API";
        var serviceVersion = "1.0.0";
        var otlpEndpoint = configuration["OpenTelemetry:OtlpEndpoint"] ?? "http://localhost:4317";

        services.AddOpenTelemetry()
            .ConfigureResource(resource => resource
                .AddService(
                    serviceName: serviceName,
                    serviceVersion: serviceVersion)
                .AddAttributes(new Dictionary<string, object>
                {
                    ["deployment.environment"] =
                        Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"
                }))
            .WithTracing(tracing =>
            {
                tracing
                    // ASP.NET Core: her HTTP isteği için otomatik span
                    .AddAspNetCoreInstrumentation(options =>
                    {
                        // /metrics ve /health endpoint'lerini trace etme (gürültü)
                        options.Filter = ctx =>
                            !ctx.Request.Path.StartsWithSegments("/metrics") &&
                            !ctx.Request.Path.StartsWithSegments("/health");

                        // Hata durumlarında request body'yi kaydet
                        options.RecordException = true;
                    })

                    // EF Core: her DB sorgusu için span (hangi sorgu ne kadar sürdü)
                    .AddEntityFrameworkCoreInstrumentation(options =>
                    {
                        // SQL statement'ları trace'e ekle (production'da dikkatli — PII içerebilir)
                        options.SetDbStatementForText = true;
                    })

                    // Uygulama kodundan gelen özel span'ler (ActivitySource.StartActivity)
                    .AddSource(ActivitySource.Name)

                    // OTLP Exporter: Jaeger / Grafana Tempo
                    .AddOtlpExporter(options =>
                    {
                        options.Endpoint = new Uri(otlpEndpoint);
                    });

                // Development ortamında console'a da yaz (görsel debug)
                if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development")
                {
                    tracing.AddConsoleExporter();
                }
            });

        return services;
    }
}
