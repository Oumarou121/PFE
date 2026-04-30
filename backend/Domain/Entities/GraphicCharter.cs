using System.Text.Json.Nodes;

namespace DocApi.Domain.Entities
{
    public class GraphicCharter
    {
        public string Id { get; set; } = string.Empty;
        public string? OrganizationId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsDefault { get; set; }
        public JsonObject Config { get; set; } = new();
        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
    }
}
