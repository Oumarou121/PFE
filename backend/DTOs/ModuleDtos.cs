using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace DocApi.DTOs
{
    public class ModuleRequest
    {
        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;

        public List<int> OrganizationIds { get; set; } = new();

        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        [MaxLength(64)]
        public string MainTableViewId { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public int DisplayOrder { get; set; }

        public List<ModuleTableViewDto> TableViews { get; set; } = new();

        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
    }

    public class ModuleResponse : ModuleRequest
    {
    }

    public class ModuleTableViewDto
    {
        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;

        [MaxLength(64)]
        public string ModuleId { get; set; } = string.Empty;

        [Required]
        [MaxLength(64)]
        public string TableViewConfigId { get; set; } = string.Empty;

        public bool IsPrimary { get; set; }

        public bool IsManagementTable { get; set; }

        public int OrderIndex { get; set; }
    }
}
