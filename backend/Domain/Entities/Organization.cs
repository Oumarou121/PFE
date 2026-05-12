namespace DocApi.Domain.Entities
{
    public class Organization
    {
        public int Id { get; set; }
        public required string NameFr { get; set; }
        public string? Acronym { get; set; }
        public required string DatabaseName { get; set; }
        public string? OrganizationSystemPrefix { get; set; }
        public string? Email { get; set; }
    }
}
