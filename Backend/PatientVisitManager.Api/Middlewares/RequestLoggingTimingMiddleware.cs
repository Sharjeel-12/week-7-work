using System.Diagnostics;

namespace PatientVisitManager.Api.Middlewares;

public class RequestLoggingTimingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingTimingMiddleware> _logger;
    public RequestLoggingTimingMiddleware(RequestDelegate next, ILogger<RequestLoggingTimingMiddleware> logger)
    { _next = next; _logger = logger; }

    public async Task Invoke(HttpContext context)
    {
        var sw = Stopwatch.StartNew();
        await _next(context);
        sw.Stop();
        var user = context.User?.Identity?.IsAuthenticated == true ? context.User.Identity?.Name : "anonymous";
        _logger.LogInformation("{Method} {Path} by {User} -> {Status} in {Elapsed} ms",
            context.Request.Method, context.Request.Path, user, context.Response.StatusCode, sw.ElapsedMilliseconds);
    }
}
