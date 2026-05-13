using DocApi.Common.Tenant;

namespace DocApi.Middlewares
{
    public sealed class TenantResolutionMiddleware
    {
        private readonly RequestDelegate _next;

        public TenantResolutionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, ITenantResolver tenantResolver)
        {
            try
            {
                var overrideOrgId = context.Request.Headers["X-Organization-Id"].FirstOrDefault();
                await tenantResolver.ResolveAsync(context.User, overrideOrgId, context.RequestAborted);
            }
            catch (UnauthorizedAccessException)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("Tenant resolution failed.");
                return;
            }

            await _next(context);
        }
    }
}