using System.Text.Json.Nodes;

namespace DocApi.Domain.Entities
{
    public class Family
    {
        public string Id { get; set; } = string.Empty;
        public string Nom { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string BeneficiaryMode { get; set; } = "table";
        public string? BeneficiaryTable { get; set; }
        public string? BeneficiaryLinkColumn { get; set; }
        public string? BeneficiaryDisplayColumn1 { get; set; }
        public string? BeneficiaryDisplayColumn2 { get; set; }
        public string? BeneficiarySql { get; set; }
        public JsonArray FilterCatalog { get; set; } = new();
        public string? Sql { get; set; }
        public string? CreatedAt { get; set; }
        public JsonArray Classes { get; set; } = new();
    }
}
