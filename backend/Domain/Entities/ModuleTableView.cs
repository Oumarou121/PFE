namespace DocApi.Domain.Entities
{
    public class ModuleTableView
    {
        public string Id { get; set; } = string.Empty;

        public string ModuleId { get; set; } = string.Empty;

        public string TableViewConfigId { get; set; } = string.Empty;

        public bool IsPrimary { get; set; }

        public bool IsManagementTable { get; set; }

        public int OrderIndex { get; set; }
    }
}
