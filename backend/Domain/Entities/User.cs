namespace DocApi.Domain.Entities
{
    public class User
    {
        public int Id { get; set; }
        public required string Username { get; set; }
        public required string Email { get; set; }
        public required string PasswordHash { get; set; }
        public required string Role { get; set; }
        public string? OrganizationId { get; set; }
        public string? Profile { get; set; }
        public string? ProfileDetail { get; set; }
        public bool AccessAllYears { get; set; }
        public string? AccessYearList { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
