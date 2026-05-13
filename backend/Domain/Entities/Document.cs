namespace DocApi.Domain.Entities
{
    public class Document
    {
        public string Id { get; set; } = string.Empty;
        public int? OrganizationId { get; set; }
        public string FamilyId { get; set; } = string.Empty;
        public string TemplateId { get; set; } = string.Empty;
        public string? GraphicCharterId { get; set; }
        public string? BeneficiaryId { get; set; }
        public string BeneficiaryMode { get; set; } = "table";
        public string? BeneficiaryTable { get; set; }
        public string? BeneficiaryLinkColumn { get; set; }
        public string? BeneficiaryDisplayColumn1 { get; set; }
        public string? BeneficiaryDisplayColumn2 { get; set; }
        public string? BeneficiaryDisplayValue1 { get; set; }
        public string? BeneficiaryDisplayValue2 { get; set; }
        public string Title { get; set; } = string.Empty;
        public string HeaderHtml { get; set; } = string.Empty;
        public string BodyHtml { get; set; } = string.Empty;
        public string FooterHtml { get; set; } = string.Empty;
        public string FullHtml { get; set; } = string.Empty;
        public string MimeType { get; set; } = "text/html";
        public string Status { get; set; } = "generated";
        public string GeneratedById { get; set; } = string.Empty;
        public string GeneratedByName { get; set; } = string.Empty;
        public string? GeneratedByEmail { get; set; }
        public string GeneratedAt { get; set; } = string.Empty;
        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
        public bool IsDeleted { get; set; }
    }
}
