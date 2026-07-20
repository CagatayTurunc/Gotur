using Microsoft.OpenApi.Models;

namespace GetirReplica.API.Extensions;

public static class SwaggerExtensions
{
    public static IServiceCollection AddSwaggerWithJwtSupport(this IServiceCollection services)
    {
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "Getir Replica API",
                Version = "v1",
                Description = "Sipariş eşleştirme ve kurye anlık takip sistemi REST API"
            });

            // JWT Bearer tanımı
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "JWT token giriniz: Bearer {token}"
            });

            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference
                        {
                            Type = ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                    },
                    Array.Empty<string>()
                }
            });
        });

        return services;
    }
}
