namespace DocApi.Domain.Entities
{
    public class EditorUser
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? OrganizationId { get; set; }
        public string Role { get; set; } = "user";
        public string Profile { get; set; } = string.Empty;
    }
}
