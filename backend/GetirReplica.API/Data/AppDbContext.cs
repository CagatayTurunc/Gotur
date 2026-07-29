using GetirReplica.API.Models.Entities;
using GetirReplica.API.Models.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Data;

public class AppDbContext : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Courier> Couriers => Set<Courier>();
    public DbSet<Restaurant> Restaurants => Set<Restaurant>();
    public DbSet<RestaurantApplication> RestaurantApplications => Set<RestaurantApplication>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<CourierLocationHistory> CourierLocationHistory => Set<CourierLocationHistory>();
    public DbSet<OutboxEvent> OutboxEvents => Set<OutboxEvent>();
    public DbSet<FeatureFlag> FeatureFlags => Set<FeatureFlag>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Silinmiş kullanıcıları tüm sorgulardan otomatik filtrele
        builder.Entity<AppUser>().HasQueryFilter(u => !u.IsDeleted);

        // ── Courier ──────────────────────────────────────────────
        builder.Entity<Courier>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Status)
                .HasConversion<string>()
                .HasDefaultValue(CourierStatus.Available);
            // PostGIS aktif olduğunda: .HasColumnType("geography(Point, 4326)") + GIST index
            e.HasOne(c => c.User)
                .WithOne()
                .HasForeignKey<Courier>(c => c.UserId);
        });

        // ── Restaurant ───────────────────────────────────────────
        builder.Entity<Restaurant>(e =>
        {
            e.HasKey(r => r.Id);
            e.HasOne(r => r.User)
                .WithOne()
                .HasForeignKey<Restaurant>(r => r.UserId);
            e.HasMany(r => r.MenuItems)
                .WithOne(m => m.Restaurant)
                .HasForeignKey(m => m.RestaurantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ── MenuItem ─────────────────────────────────────────────
        builder.Entity<MenuItem>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.Price).HasColumnType("numeric(10,2)");
            e.HasIndex(m => new { m.RestaurantId, m.IsAvailable });
        });

        // ── RestaurantApplication ────────────────────────────────
        builder.Entity<RestaurantApplication>(e =>
        {
            e.HasKey(a => a.Id);
            e.Property(a => a.Status).HasConversion<string>().HasDefaultValue(GetirReplica.API.Models.Enums.ApplicationStatus.Pending);
            e.HasIndex(a => a.Status);
            e.HasIndex(a => a.Email);
        });

        // ── Order ────────────────────────────────────────────────
        builder.Entity<Order>(e =>
        {
            e.HasKey(o => o.Id);
            e.Property(o => o.Status)
                .HasConversion<string>()
                .HasDefaultValue(OrderStatus.Pending);
            e.Property(o => o.ItemsJson)
                .HasColumnName("items")
                .HasColumnType("jsonb");
            e.HasIndex(o => o.Status);
            e.HasIndex(o => o.CustomerId);
            e.HasOne(o => o.Customer)
                .WithMany()
                .HasForeignKey(o => o.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(o => o.Restaurant)
                .WithMany(r => r.Orders)
                .HasForeignKey(o => o.RestaurantId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(o => o.Courier)
                .WithMany(c => c.Orders)
                .HasForeignKey(o => o.CourierId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ── CourierLocationHistory ───────────────────────────────
        builder.Entity<CourierLocationHistory>(e =>
        {
            e.HasKey(h => h.Id);
            // PostGIS aktif olduğunda: .HasColumnType("geography(Point, 4326)")
            e.HasIndex(h => new { h.CourierId, h.RecordedAt });
            e.HasOne(h => h.Courier)
                .WithMany(c => c.LocationHistory)
                .HasForeignKey(h => h.CourierId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(h => h.Order)
                .WithMany(o => o.LocationHistory)
                .HasForeignKey(h => h.OrderId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ── OutboxEvent ──────────────────────────────────────────
        // Outbox Pattern: DB yazma + event yayınlama tutarlılığı için.
        // ProcessedAt IS NULL olan satırlar işlenmemiş event'leri temsil eder.
        builder.Entity<OutboxEvent>(e =>
        {
            e.HasKey(o => o.Id);
            e.Property(o => o.Payload).HasColumnType("jsonb");
            // İşlenmemiş event'leri hızlı bulmak için partial index
            e.HasIndex(o => o.ProcessedAt)
                .HasFilter("\"ProcessedAt\" IS NULL");
            e.HasIndex(o => o.CreatedAt);
        });

        // ── FeatureFlag ──────────────────────────────────────────
        // Feature flag tablosu: kademeli rollout ve A/B test için.
        builder.Entity<FeatureFlag>(e =>
        {
            e.HasKey(f => f.Id);
            // Flag adı unique olmalı — aynı isimde iki flag olamaz
            e.HasIndex(f => f.Name).IsUnique();
            e.Property(f => f.Name).HasMaxLength(100);
            e.Property(f => f.Description).HasMaxLength(500);
        });
    }
}
