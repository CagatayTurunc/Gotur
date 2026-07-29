using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            // CorrelationId varsa log'a ekle
            var correlationId = context.Items.TryGetValue(
                CorrelationIdMiddleware.CorrelationIdItemKey, out var cid)
                ? cid?.ToString() : null;

            _logger.LogError(ex,
                "Unhandled exception: {Message} | CorrelationId: {CorrelationId}",
                ex.Message, correlationId);
            await HandleExceptionAsync(context, ex, _env.IsDevelopment());
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception, bool isDevelopment)
    {
        context.Response.ContentType = "application/json";

        string message;
        int statusCode;

        switch (exception)
        {
            case ArgumentException:
                statusCode = (int)HttpStatusCode.BadRequest;
                message = exception.Message;
                break;
            case KeyNotFoundException:
                statusCode = (int)HttpStatusCode.NotFound;
                message = exception.Message;
                break;
            case UnauthorizedAccessException:
                statusCode = (int)HttpStatusCode.Unauthorized;
                message = exception.Message;
                break;
            case InvalidOperationException ioe when ioe.Message.Contains("aktif"):
                statusCode = (int)HttpStatusCode.Conflict;
                message = ioe.Message;
                break;
            case InvalidOperationException ioe when ioe.Message.Contains("sık"):
                statusCode = (int)HttpStatusCode.TooManyRequests;
                message = ioe.Message;
                break;
            case InvalidOperationException:
                statusCode = (int)HttpStatusCode.UnprocessableEntity;
                message = exception.Message;
                break;
            case DbUpdateException dbEx:
                statusCode = (int)HttpStatusCode.InternalServerError;
                message = isDevelopment
                    ? $"Veritabanı hatası: {dbEx.InnerException?.Message ?? dbEx.Message}"
                    : "Sipariş kaydedilirken bir hata oluştu.";
                break;
            default:
                statusCode = (int)HttpStatusCode.InternalServerError;
                message = isDevelopment
                    ? exception.Message
                    : "Sunucu hatası oluştu.";
                break;
        }

        context.Response.StatusCode = statusCode;

        // CorrelationId'yi response body'ye ekle — client hata takibi için
        var correlationId = context.Items.TryGetValue(
            CorrelationIdMiddleware.CorrelationIdItemKey, out var cid)
            ? cid?.ToString() : null;

        var response = new
        {
            status = statusCode,
            message,
            correlationId
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}
