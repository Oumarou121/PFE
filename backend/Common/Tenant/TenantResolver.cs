using System.Security.Claims;
using DocApi.Repositories.Interfaces;

namespace DocApi.Common.Tenant
{
    public interface ITenantResolver
    {
        Task<bool> ResolveAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default);
    }

    public sealed class TenantResolver : ITenantResolver
    {
        private readonly IOrganizationRepository _organizationRepository;
        private readonly ITenantProvider _tenantProvider;

        public TenantResolver(IOrganizationRepository organizationRepository, ITenantProvider tenantProvider)
        {
            _organizationRepository = organizationRepository;
            _tenantProvider = tenantProvider;
        }

        public async Task<bool> ResolveAsync(ClaimsPrincipal user, CancellationToken cancellationToken = default)
        {
            if (user?.Identity?.IsAuthenticated != true)
            {
                return false;
            }

            var role = user.FindFirstValue(ClaimTypes.Role);
            var organizationClaim = user.FindFirstValue("organizationId");

            if (string.Equals(role, "supAdmin", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!int.TryParse(organizationClaim, out var organizationId))
            {
                throw new UnauthorizedAccessException("Tenant organization claim is missing or invalid.");
            }

            var organization = await _organizationRepository.GetByIdAsync(organizationId);
            if (organization == null || string.IsNullOrWhiteSpace(organization.DatabaseName))
            {
                throw new UnauthorizedAccessException("Tenant organization could not be resolved.");
            }

            _tenantProvider.SetTenant(organizationId, organization.DatabaseName, role);
            return true;
        }
    }
}