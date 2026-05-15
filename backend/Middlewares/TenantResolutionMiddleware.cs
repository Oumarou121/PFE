using DocApi.Common.Tenant;
using System.Text.Json;

namespace DocApi.Middlewares
{
    public sealed class TenantResolutionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<TenantResolutionMiddleware> _logger;

        public TenantResolutionMiddleware(RequestDelegate next, ILogger<TenantResolutionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, ITenantResolver tenantResolver, ITenantProvider tenantProvider)
        {
            // Skip tenant resolution for certain paths
            var path = context.Request.Path.Value?.ToLower() ?? "";
            if (path.StartsWith("/swagger") || path.StartsWith("/api/login") || path.StartsWith("/api/register") || path == "/health")
            {
                await _next(context);
                return;
            }

            try
            {
                var overrideOrgId = context.Request.Headers["X-Organization-Id"].FirstOrDefault();
                var isAuthenticated = context.User?.Identity?.IsAuthenticated == true;
                
                if (isAuthenticated && context.User != null)
                {
                    var resolved = await tenantResolver.ResolveAsync(context.User, overrideOrgId, context.RequestAborted);
                    if (!resolved)
                    {
                        _logger.LogWarning("Failed to resolve tenant for authenticated user: {User}", context.User?.Identity?.Name);
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        await context.Response.WriteAsJsonAsync(new { error = "Unable to resolve tenant. Please ensure your organization is properly configured." });
                        return;
                    }

                    var academicYearCode = context.Request.Headers["X-Academic-Year"].FirstOrDefault();
                    tenantProvider.SetAcademicYear(academicYearCode);
                }
                else
                {
                    // For unauthenticated requests to protected endpoints, let them proceed and get 401 from [Authorize] attribute
                    _logger.LogDebug("Unauthenticated request to {Path}", context.Request.Path);
                }
            }
            catch (UnauthorizedAccessException ex)
            {
                _logger.LogWarning("Unauthorized tenant resolution: {Message}", ex.Message);
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new { error = "Tenant resolution failed: " + ex.Message });
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError("Unexpected error during tenant resolution: {Message}", ex.Message);
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.WriteAsJsonAsync(new { error = "An error occurred during tenant resolution." });
                return;
            }

            await _next(context);
        }
    }
}
