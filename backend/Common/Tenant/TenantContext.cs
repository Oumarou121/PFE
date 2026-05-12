namespace DocApi.Common.Tenant
{
    public sealed class TenantContext
    {
        public int? OrganizationId { get; set; }
        public string? DatabaseName { get; set; }
        public string? Role { get; set; }
        public bool IsResolved => OrganizationId.HasValue && !string.IsNullOrWhiteSpace(DatabaseName);
    }
}