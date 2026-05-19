using System.ComponentModel.DataAnnotations;

namespace DocApi.DTOs
{
    public class AdminUserResponse
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public required string Email { get; set; }
        public required string Role { get; set; }
        public int? OrganizationId { get; set; }
        public string? Profile { get; set; }
        public string? ProfileDetail { get; set; }
        public bool AccessAllYears { get; set; }
        public string? AccessYearList { get; set; }
        public List<string> ModuleIds { get; set; } = new();
        public List<UserDataAccessRuleDto> DataAccessRules { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public bool IsActive { get; set; }
    }

    public class UserDataAccessRuleDto
    {
        public string ModuleId { get; set; } = string.Empty;
        public string TableViewId { get; set; } = string.Empty;
        public string? TableName { get; set; }
        public string Field { get; set; } = string.Empty;
        public List<string> Values { get; set; } = new();
    }

    public class AdminUserCreateRequest
    {
        [Required]
        [MinLength(3)]
        public required string Name { get; set; }

        [Required]
        [EmailAddress]
        public required string Email { get; set; }

        [Required]
        [MinLength(6)]
        public required string Password { get; set; }

        public string Role { get; set; } = "user";
        public int? OrganizationId { get; set; }
        public string? Profile { get; set; }
        public string? ProfileDetail { get; set; }
        public bool AccessAllYears { get; set; } = true;
        public string? AccessYearList { get; set; } = "[]";
        public List<string> ModuleIds { get; set; } = new();
        public List<UserDataAccessRuleDto> DataAccessRules { get; set; } = new();
    }

    public class AdminUserUpdateRequest
    {
        [Required]
        [MinLength(3)]
        public required string Name { get; set; }

        [Required]
        [EmailAddress]
        public required string Email { get; set; }

        [MinLength(6)]
        public string? Password { get; set; }

        public string Role { get; set; } = "user";
        public int? OrganizationId { get; set; }
        public string? Profile { get; set; }
        public string? ProfileDetail { get; set; }
        public bool AccessAllYears { get; set; } = true;
        public string? AccessYearList { get; set; } = "[]";
        public List<string> ModuleIds { get; set; } = new();
        public List<UserDataAccessRuleDto> DataAccessRules { get; set; } = new();
        public bool IsActive { get; set; } = true;
    }
}
