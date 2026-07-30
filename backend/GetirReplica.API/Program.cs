using GetirReplica.API.Data;
using GetirReplica.API.Extensions;
using GetirReplica.API.Hubs;
using GetirReplica.API.Middleware;
using GetirReplica.API.Models.Entities;
using GetirReplica.API.Services;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Prometheus;
using Serilog;
using StackExchange.Redis;
using System.Reflection;
using ITokenService = GetirReplica.API.Services.ITokenService;
using TokenService = GetirReplica.API.Services.TokenService;
using GetirReplica.API.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ──────────────────────────────────────────────────────────────────
builder.Host.UseSerilog((context, config) =>
    config.ReadFrom.Configuration(context.Configuration)
          .Enrich.FromLogContext()      // CorrelationId + diğer pushed properties
          .Enrich.WithMachineName()
          .Enrich.WithThreadId());

// ── Veritabanı (PostgreSQL + PostGIS) ────────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' not found.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// ── ASP.NET Core Identity ─────────────────────────────────────────────────────
builder.Services.AddIdentity<AppUser, IdentityRole<Guid>>(options =>
{
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// ── JWT Kimlik Doğrulama ──────────────────────────────────────────────────────
builder.Services.AddJwtAuthentication(builder.Configuration);

// ── SignalR + Redis Backplane ─────────────────────────────────────────────────
var redisConnection = builder.Configuration.GetConnectionString("Redis")
    ?? "localhost:6379";

builder.Services.AddSignalR()
    .AddStackExchangeRedis(redisConnection);

// ── Redis Cache ───────────────────────────────────────────────────────────────
builder.Services.AddStackExchangeRedisCache(options =>
    options.Configuration = redisConnection);

// ── Hangfire (Background Jobs) ────────────────────────────────────────────────
builder.Services.AddHangfire(config =>
    config.UsePostgreSqlStorage(c =>
        c.UseNpgsqlConnection(connectionString)));
builder.Services.AddHangfireServer();

// ── Controllers + Swagger ─────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddSwaggerWithJwtSupport();
builder.Services.AddEndpointsApiExplorer();

// ── Application Services ──────────────────────────────────────────────────────
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<ILocationService, LocationService>();
builder.Services.AddScoped<IMatchingService, MatchingService>();
builder.Services.AddScoped<IFeatureFlagService, FeatureFlagService>();

// ── Distributed Lock (Redis SET NX) ─────────────────────────────────────────
// Race condition koruması: aynı kuryeye iki sipariş aynı anda atanamaz.
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
    ConnectionMultiplexer.Connect(redisConnection));
builder.Services.AddSingleton<IDistributedLockService, RedisDistributedLockService>();

// ── Polly Resilience Pipelines ────────────────────────────────────────────────
// Redis veya başka bağımlılık anlık down olursa retry + circuit breaker devreye girer.
builder.Services.AddRedisResiliencePipeline();
builder.Services.AddResilientDistributedCache();

// ── Outbox Processor ──────────────────────────────────────────────────────────
// Outbox event'lerini Hangfire ile periyodik işler.
builder.Services.AddScoped<OutboxProcessor>();

// ── OpenTelemetry Tracing ─────────────────────────────────────────────────────
// Her isteğe trace-id verir; EF Core sorguları, SignalR, Hangfire'a kadar taşır.
builder.Services.AddOpenTelemetryTracing(builder.Configuration);

// ── Rate Limiting (API Gateway katmanı) ──────────────────────────────────────
// Controller'dan bağımsız — mikroservise geçişte gateway'e taşınabilir.
builder.Services.AddApiRateLimiting();

builder.Services.AddScoped<IFavoriteService, FavoriteService>();
builder.Services.AddScoped<IReviewService, ReviewService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();

// ── CORS (React frontend için) ────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:5173",
                "https://gotur.site",
                "https://www.gotur.site")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()); // SignalR için gerekli
});

// ─────────────────────────────────────────────────────────────────────────────
var app = builder.Build();
// ─────────────────────────────────────────────────────────────────────────────

// ── Startup doğrulamaları ─────────────────────────────────────────────────────
// Secret'lar eksik/placeholder ise log uyarısı ver (uygulama yine de başlar).
app.Configuration.ValidateRequiredSecrets(app.Logger);
app.Configuration.ValidateJwtSecret(app.Logger);

// ── Middleware Pipeline ───────────────────────────────────────────────────────
// Sıra önemli: CorrelationId ilk olmalı ki tüm sonraki middleware'ler ID'yi görsün.
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<IdempotencyMiddleware>();
app.UseSerilogRequestLogging(opts =>
{
    // Her request log satırına CorrelationId'yi ekle
    opts.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        if (httpContext.Items.TryGetValue(
            CorrelationIdMiddleware.CorrelationIdItemKey, out var cid))
        {
            diagnosticContext.Set("CorrelationId", cid?.ToString() ?? "");
        }
    };
});

// Prometheus HTTP metriklerini toplar.
// Bu middleware her isteği sayar ve süresini ölçer.
// /metrics endpoint'i Prometheus tarafından scrape edilir.
// ÖNEMLI: UseRouting()'den sonra, MapControllers()'dan önce gelmeli.
app.UseHttpMetrics(options =>
{
    // /metrics ve /health endpoint'leri kendi kendini saymasın —
    // bunlar internal araçlar, iş metriği değil.
    options.ReduceStatusCodeCardinality();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Getir Replica API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// ── Hangfire Dashboard (sadece development) ───────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard("/hangfire");
}

// ── Hangfire Recurring Jobs ───────────────────────────────────────────────────
// Outbox Processor: işlenmemiş OutboxEvent'leri her 5 saniyede bir gönderir.
// Bu sayede "DB yazıldı ama SignalR patladı" senaryosunda event kaybolmaz.
// app.Services üzerinden IRecurringJobManager alınır — statik API yerine DI tabanlı.
using (var scope = app.Services.CreateScope())
{
    var recurringJobManager = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();
    recurringJobManager.AddOrUpdate<OutboxProcessor>(
        "outbox-processor",
        processor => processor.ProcessPendingEventsAsync(),
        "*/5 * * * * *");
}

app.MapControllers();
app.MapHub<TrackingHub>("/hubs/tracking");

// Prometheus scrape endpoint'i.
// Grafana → Prometheus → burası zinciri bu endpoint üzerinden kurulur.
// Örnek çıktı:
//   http_requests_total{method="POST",route="/api/auth/login",status="200"} 1523
//   http_request_duration_seconds_bucket{le="0.5",...} 1489
// /health ve /swagger gibi internal yollar Swagger'da görünmez.
app.MapMetrics("/metrics").ExcludeFromDescription();

// Kubernetes probe'ları ve operasyonel görünürlük.
// Liveness yalnızca process'in cevap verdiğini, readiness ise bağımlılıkların
// istek kabul etmeye hazır olduğunu doğrular.
app.MapGet("/health/live", () => Results.Ok(new
{
    status = "live",
    timestamp = DateTime.UtcNow
}));

app.MapGet("/health/ready", async (
    AppDbContext db,
    IDistributedCache cache,
    CancellationToken cancellationToken) =>
{
    try
    {
        if (!await db.Database.CanConnectAsync(cancellationToken))
            return Results.Json(new { status = "not_ready", dependency = "postgresql" }, statusCode: 503);

        const string readinessKey = "health:readiness";
        await cache.SetStringAsync(
            readinessKey,
            DateTime.UtcNow.ToString("O"),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(15)
            },
            cancellationToken);

        if (await cache.GetStringAsync(readinessKey, cancellationToken) is null)
            return Results.Json(new { status = "not_ready", dependency = "redis" }, statusCode: 503);

        return Results.Ok(new
        {
            status = "ready",
            dependencies = new[] { "postgresql", "redis" },
            timestamp = DateTime.UtcNow
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Readiness kontrolü başarısız.");
        return Results.Json(new { status = "not_ready" }, statusCode: 503);
    }
}).ExcludeFromDescription();

app.MapGet("/api/meta/version", () =>
{
    var assembly = Assembly.GetExecutingAssembly().GetName();
    return Results.Ok(new
    {
        service = "GetirReplica.API",
        apiVersion = "v1",
        applicationVersion = assembly.Version?.ToString(3) ?? "unknown",
        framework = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription
    });
}).ExcludeFromDescription();

// ── Seed Data ─────────────────────────────────────────────────────────────────
// Production/Kubernetes ortamında migration ayrı bir release adımı olarak
// çalıştırılır; birden fazla replica'nın aynı anda schema değiştirmesi önlenir.
if (app.Environment.IsDevelopment())
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DataSeeder.SeedAsync(app.Services);
}

app.Run();
