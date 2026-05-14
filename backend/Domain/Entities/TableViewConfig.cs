using DocApi.Domain.ValueObjects;

namespace DocApi.Domain.Entities
{
    public class TableViewConfig
    {
        public string Id { get; set; } = string.Empty;
        public List<int> OrganizationIds { get; set; } = new List<int>();
        public string TableName { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public List<string> VisibleFields { get; set; } = [];
        public List<string> EditableFields { get; set; } = [];
        public List<string> PreviewFields { get; set; } = [];
        public Dictionary<string, string> FieldLabels { get; set; } = [];
        public Dictionary<string, TableViewFieldSetting> FieldSettings { get; set; } = [];
        public List<TableViewFilter> Filters { get; set; } = [];
        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
    }
}
