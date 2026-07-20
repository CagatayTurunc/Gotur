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
using Serilog;
using ITokenService = GetirReplica.API.Services.ITokenService;
using TokenService = GetirReplica.API.Services.TokenService;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ──────────────────────────────────────────────────────────────────
builder.Host.UseSerilog((context, config) =>
    config.ReadFrom.Configuration(context.Configuration));

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

// ── CORS (React frontend için) ────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins("http://localhost:3000", "http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()); // SignalR için gerekli
});

// ─────────────────────────────────────────────────────────────────────────────
var app = builder.Build();
// ─────────────────────────────────────────────────────────────────────────────

// ── Middleware Pipeline ───────────────────────────────────────────────────────
app.UseMiddleware<ExceptionMiddleware>();
app.UseSerilogRequestLogging();

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

// ── Hangfire Dashboard (sadece development) ───────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard("/hangfire");
}

app.MapControllers();
app.MapHub<TrackingHub>("/hubs/tracking");

// ── Seed Data ─────────────────────────────────────────────────────────────────
await DataSeeder.SeedAsync(app.Services);

app.Run();
