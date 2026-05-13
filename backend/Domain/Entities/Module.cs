using System.Collections.Generic;

namespace DocApi.Domain.Entities
{
    public class Module
    {
        public string Id { get; set; } = string.Empty;

        public List<int> OrganizationIds { get; set; } = new();

        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        public string? Icon { get; set; }

        public string MainTableViewId { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public int DisplayOrder { get; set; }

        public List<ModuleTableView> TableViews { get; set; } = new();

        public string? CreatedAt { get; set; }

        public string? UpdatedAt { get; set; }
    }
}
