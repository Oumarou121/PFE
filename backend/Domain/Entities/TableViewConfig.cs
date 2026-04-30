using System.Text.Json.Nodes;

namespace DocApi.Domain.Entities
{
    public class TableViewConfig
    {
        public string Id { get; set; } = string.Empty;
        public string TableName { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public JsonArray VisibleFields { get; set; } = new();
        public JsonArray EditableFields { get; set; } = new();
        public JsonArray PreviewFields { get; set; } = new();
        public JsonObject FieldSettings { get; set; } = new();
        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
    }
}
