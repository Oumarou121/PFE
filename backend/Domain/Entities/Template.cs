using System.Text.Json.Nodes;

namespace DocApi.Domain.Entities
{
    public class Template
    {
        public string Id { get; set; } = string.Empty;
        public string FamilyId { get; set; } = string.Empty;
        public string? OrganizationId { get; set; }
        public string? GraphicCharterId { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string? UpdatedAt { get; set; }
        public bool HasHeader { get; set; }
        public bool HasFooter { get; set; }
        public string Orientation { get; set; } = "portrait";
        public JsonArray FilterProfile { get; set; } = new();
        public JsonObject SectionDirections { get; set; } = new();
        public JsonObject PageMargins { get; set; } = new();
        public string Header { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string Footer { get; set; } = string.Empty;
    }
}
