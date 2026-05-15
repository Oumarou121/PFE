namespace DocApi.Common.Tenant
{
    public interface ITenantProvider
    {
        int? GetOrganizationId();
        string? GetDatabaseName();
        string? GetRole();
        string? GetAcademicYearCode();
        void SetTenant(int organizationId, string databaseName, string? role = null);
        void SetAcademicYear(string? academicYearCode);
        void Clear();
    }

    public class TenantProvider : ITenantProvider
    {
        private readonly TenantContext _context = new();

        public int? GetOrganizationId() => _context.OrganizationId;

        public string? GetDatabaseName() => _context.DatabaseName;

        public string? GetRole() => _context.Role;

        public string? GetAcademicYearCode() => _context.AcademicYearCode;

        public void SetTenant(int organizationId, string databaseName, string? role = null)
        {
            _context.OrganizationId = organizationId;
            _context.DatabaseName = databaseName;
            _context.Role = role;
        }

        public void SetAcademicYear(string? academicYearCode)
        {
            _context.AcademicYearCode = string.IsNullOrWhiteSpace(academicYearCode)
                ? null
                : academicYearCode.Trim();
        }

        public void Clear()
        {
            _context.OrganizationId = null;
            _context.DatabaseName = null;
            _context.Role = null;
            _context.AcademicYearCode = null;
        }
    }
}
