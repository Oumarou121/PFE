using System.ComponentModel.DataAnnotations;
using DocApi.Domain.ValueObjects;

namespace DocApi.DTOs
{
    public record EditorApiResponse(
        bool Ok,
        EditorStateResponse? State = null,
        AuthUserResponse? User = null,
        DatabaseSchemaResponse? Schema = null,
        IEnumerable<IDictionary<string, object?>>? Rows = null,
        IDictionary<string, object?>? Record = null,
        IEnumerable<LookupOptionResponse>? Options = null,
        TableViewConfigResponse? TableView = null,
        IEnumerable<ModuleResponse>? Modules = null,
        ModuleResponse? Module = null,
        string? Token = null,
        string? Error = null,
        string? RedirectTo = null,
        object? Data = null);

    public class EditorLoginRequest
    {
        [Required]
        public string Identifier { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class EditorStateRequest
    {
        [Required]
        public EditorStateResponse? State { get; set; }
    }

    public class EditorQueryRequest
    {
        [Required]
        public string Sql { get; set; } = string.Empty;

        public Dictionary<string, object?> Params { get; set; } = [];

        public string? DatabaseName { get; set; }
    }

    public class SearchBeneficiariesRequest
    {
        [Required]
        [MaxLength(64)]
        public string FamilyId { get; set; } = string.Empty;

        public int? OrganizationId { get; set; }

        public Dictionary<string, object?> Filters { get; set; } = [];

        [MaxLength(255)]
        public string? Search { get; set; }

        public int Limit { get; set; } = 200;

        public string? DatabaseName { get; set; }
    }

    public class TableViewRowsRequest
    {
        [MaxLength(64)]
        public string? ConfigId { get; set; }

        [MaxLength(255)]
        public string? Search { get; set; }

        public TableViewConfigRequest? Config { get; set; }

        public string? DatabaseName { get; set; }

        public Dictionary<string, List<string>>? SelectedFilters { get; set; }
    }

    public class TableViewRecordRequest
    {
        [MaxLength(64)]
        public string? ConfigId { get; set; }

        public string? RowId { get; set; }

        public Dictionary<string, object?> Values { get; set; } = [];

        public TableViewConfigRequest? Config { get; set; }

        public string? DatabaseName { get; set; }
    }

    public class TableViewLookupRequest
    {
        [MaxLength(64)]
        public string? ConfigId { get; set; }

        [MaxLength(128)]
        public string? FieldName { get; set; }

        public TableViewConfigRequest? Config { get; set; }

        public string? DatabaseName { get; set; }
    }

    public class TableViewConfigEnvelopeRequest
    {
        public TableViewConfigRequest? TableView { get; set; }

        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;
    }

    public class GetFilterOptionsRequest
    {
        public TableViewFilter? Filter { get; set; }

        [MaxLength(128)]
        public string? DatabaseName { get; set; }
    }

    public class PreviewRequest
    {
        [MaxLength(64)]
        public string? TemplateId { get; set; }

        public string? BeneficiaryId { get; set; }

        [MaxLength(128)]
        public string? BeneficiaryTable { get; set; }

        public int? OrganizationId { get; set; }

        public Dictionary<string, object?> Filters { get; set; } = [];

        public string? DatabaseName { get; set; }
    }

    public class DocumentListRequest
    {
        public int? OrganizationId { get; set; }

        [MaxLength(64)]
        public string? FamilyId { get; set; }

        [MaxLength(128)]
        public string? BeneficiaryTable { get; set; }

        public string? BeneficiaryId { get; set; }

        // Pagination
        public int Page { get; set; } = 1;

        // Sorting
        [MaxLength(64)]
        public string SortBy { get; set; } = "generatedAt";
        
        [MaxLength(4)]
        public string SortOrder { get; set; } = "desc"; // asc or desc
    }

    public class DocumentListResponse
    {
        public IEnumerable<DocumentListItemResponse> Data { get; set; } = new List<DocumentListItemResponse>();
        public int Total { get; set; }
        public int Page { get; set; }
        public int Limit { get; set; }
        public int TotalPages { get; set; }
    }

    public class DocumentCreateRequest
    {
        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;

        public int? OrganizationId { get; set; }

        [Required]
        [MaxLength(64)]
        public string FamilyId { get; set; } = string.Empty;

        [Required]
        [MaxLength(64)]
        public string TemplateId { get; set; } = string.Empty;

        [MaxLength(64)]
        public string? GraphicCharterId { get; set; }

        public string? BeneficiaryId { get; set; }

        [MaxLength(32)]
        public string BeneficiaryMode { get; set; } = "table";

        [MaxLength(128)]
        public string? BeneficiaryTable { get; set; }

        [MaxLength(255)]
        public string? BeneficiaryTableLabel { get; set; }

        [MaxLength(128)]
        public string? BeneficiaryLinkColumn { get; set; }

        [MaxLength(128)]
        public string? BeneficiaryDisplayColumn1 { get; set; }

        [MaxLength(128)]
        public string? BeneficiaryDisplayColumn2 { get; set; }

        [MaxLength(255)]
        public string? BeneficiaryDisplayValue1 { get; set; }

        [MaxLength(255)]
        public string? BeneficiaryDisplayValue2 { get; set; }

        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        public string HeaderHtml { get; set; } = string.Empty;
        public string BodyHtml { get; set; } = string.Empty;
        public string FooterHtml { get; set; } = string.Empty;

        [Required]
        public string FullHtml { get; set; } = string.Empty;

        [MaxLength(127)]
        public string MimeType { get; set; } = "text/html";

        [MaxLength(32)]
        public string Status { get; set; } = "generated";

        [MaxLength(64)]
        public string GeneratedById { get; set; } = string.Empty;

        [MaxLength(255)]
        public string GeneratedByName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? GeneratedByEmail { get; set; }

        [MaxLength(64)]
        public string? GeneratedByRole { get; set; }

        [MaxLength(64)]
        public string? GeneratedAt { get; set; }
    }

    public class DocumentResponse
    {
        public string Id { get; set; } = string.Empty;
        public int? OrganizationId { get; set; }
        public string FamilyId { get; set; } = string.Empty;
        public string TemplateId { get; set; } = string.Empty;
        public string? GraphicCharterId { get; set; }
        public string? BeneficiaryId { get; set; }
        public string BeneficiaryMode { get; set; } = "table";
        public string? BeneficiaryTable { get; set; }
        public string? BeneficiaryTableLabel { get; set; }
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
        public string? GeneratedByRole { get; set; }
        public string GeneratedAt { get; set; } = string.Empty;
        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
        public string? DeletedAt { get; set; }
        public string? DeletedById { get; set; }
        public string? DeletedByName { get; set; }
    }

    public class DocumentListItemResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string FamilyId { get; set; } = string.Empty;
        public string? BeneficiaryId { get; set; }
        public string? BeneficiaryTable { get; set; }
        public string? BeneficiaryTableLabel { get; set; }
        public string? BeneficiaryDisplayValue1 { get; set; }
        public string? BeneficiaryDisplayValue2 { get; set; }
        public string GeneratedById { get; set; } = string.Empty;
        public string GeneratedByName { get; set; } = string.Empty;
        public string? GeneratedByEmail { get; set; }
        public string? GeneratedByRole { get; set; }
        public string GeneratedAt { get; set; } = string.Empty;
    }

    public class FamilyRequest
    {
        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;

        public List<int> OrganizationIds { get; set; } = new List<int>();

        [Required]
        [MaxLength(255)]
        public string Nom { get; set; } = string.Empty;

        public string? Description { get; set; }
        public BeneficiaryMode BeneficiaryMode { get; set; } = BeneficiaryMode.Table;

        [MaxLength(128)]
        public string? BeneficiaryTable { get; set; }

        [MaxLength(255)]
        public string? BeneficiaryTableLabel { get; set; }

        [MaxLength(128)]
        public string? BeneficiaryLinkColumn { get; set; }

        [MaxLength(128)]
        public string? BeneficiaryDisplayColumn1 { get; set; }

        [MaxLength(128)]
        public string? BeneficiaryDisplayColumn2 { get; set; }

        public string? BeneficiarySql { get; set; }
        public List<FilterDefinition> FilterCatalog { get; set; } = [];
        public string? Sql { get; set; }
        public string? CreatedAt { get; set; }
        public List<FamilyClass> Classes { get; set; } = [];
    }

    public class FamilyResponse : FamilyRequest
    {
    }

    public class TemplateRequest
    {
        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;

        [Required]
        [MaxLength(64)]
        public string FamilyId { get; set; } = string.Empty;

        public int? OrganizationId { get; set; }

        [MaxLength(64)]
        public string? GraphicCharterId { get; set; }

        [Required]
        [MaxLength(255)]
        public string Nom { get; set; } = string.Empty;

        public string? UpdatedAt { get; set; }
        public bool HasHeader { get; set; }
        public bool HasFooter { get; set; }
        public PageOrientation Orientation { get; set; } = PageOrientation.Portrait;
        public List<TemplateFilterProfileEntry> FilterProfile { get; set; } = [];
        public SectionDirections SectionDirections { get; set; } = new();
        public PageMargins PageMargins { get; set; } = new();
        public HeaderFooterDistances HeaderFooterDistances { get; set; } = new();
        public SectionDisplayMode HeaderDisplay { get; set; } = SectionDisplayMode.All;
        public SectionDisplayMode FooterDisplay { get; set; } = SectionDisplayMode.All;
        public string Header { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string Footer { get; set; } = string.Empty;
    }

    public class TemplateResponse : TemplateRequest
    {
    }

    public class GraphicCharterRequest
    {
        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;

        public int? OrganizationId { get; set; }

        [Required]
        [MaxLength(255)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }
        public bool IsDefault { get; set; }
        public GraphicCharterConfig Config { get; set; } = new();
        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
    }

    public class GraphicCharterResponse : GraphicCharterRequest
    {
    }

    public class TableViewConfigRequest
    {
        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;

        public List<int> OrganizationIds { get; set; } = new List<int>();

        [Required]
        [MaxLength(128)]
        public string TableName { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
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

    public class TableViewConfigResponse : TableViewConfigRequest
    {
    }

    public class AppSettingRequest
    {
        [Required]
        [MaxLength(100)]
        public string Key { get; set; } = string.Empty;

        public object? Value { get; set; }
    }

    public class AcademicYearAffectedTableConfig
    {
        [Required]
        [MaxLength(128)]
        public string TableName { get; set; } = string.Empty;

        [Required]
        [MaxLength(128)]
        public string YearColumn { get; set; } = string.Empty;
    }

    public class AcademicYearConfigRequest
    {
        [Required]
        public int OrganizationId { get; set; }

        public List<AcademicYearAffectedTableConfig> AffectedTables { get; set; } = [];
    }

    public class AcademicYearConfigResponse : AcademicYearConfigRequest
    {
        public string? UpdatedAt { get; set; }
    }

    public class AcademicYearResponse
    {
        public string Code { get; set; } = string.Empty;
        public string? StartDate { get; set; }
        public string? EndDate { get; set; }
        public string? Status { get; set; }
        public bool IsClosed { get; set; }
    }

    public class AcademicYearCreateRequest
    {
        [Required]
        [MaxLength(64)]
        public string Code { get; set; } = string.Empty;

        [MaxLength(64)]
        public string? StartDate { get; set; }

        [MaxLength(64)]
        public string? EndDate { get; set; }

        [MaxLength(128)]
        public string Status { get; set; } = "En cours";
    }

    public class OrganizationResponse
    {
        public int Id { get; set; }
        public string DatabaseName { get; set; } = string.Empty;
        public string? Nom { get; set; }
        public string? NameFr { get; set; }
        public string? NameAr { get; set; }
        public string? Acronym { get; set; }
        public string? OrganizationLogo { get; set; }
        public string? Affiliation { get; set; }
        public string? AffiliationLogo { get; set; }
        public string? FieldOfActivity { get; set; }
        public string? Ville { get; set; }
        public string? Adresse { get; set; }
        public string? PostalCode { get; set; }
        public string? Country { get; set; }
        public string? Tel { get; set; }
        public string? Email { get; set; }
        public string? PersonToContact { get; set; }
        public string? ContactMail { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactPosition { get; set; }
        public string? AccountType { get; set; }
        public string? AccountStatus { get; set; }
        public string? ParDiffusionEmail { get; set; }
        public string? ParDiffusionEmailPw { get; set; }
        public string? ParOutgoingMailChar { get; set; }
        public string? ParIngoingMailChar { get; set; }
        public string? OrganizationSystemPrefix { get; set; }
        public string? MailSignature { get; set; }
        public string? NameUniversityFr { get; set; }
        public string? NameUniversityAr { get; set; }
        public string? NameMinisterFr { get; set; }
        public string? NameMinisterAr { get; set; }
        public Dictionary<string, object?> Raw { get; set; } = [];
        public List<GraphicCharterResponse> GraphicCharters { get; set; } = [];
        public string? CreatedAt { get; set; }
        public string? UpdatedAt { get; set; }
    }

    public class AdminResponse
    {
        public string Id { get; set; } = string.Empty;
        public int? OrganizationId { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = "admin";
        public string? Profile { get; set; }
        public string? ProfileDetail { get; set; }
        public bool AccessAllYears { get; set; }
        public string? AccessYearList { get; set; }
        public string? CreatedAt { get; set; }
        public Dictionary<string, object?> Raw { get; set; } = [];
    }

    public class EditorStateResponse
    {
        public IEnumerable<OrganizationResponse> Organizations { get; set; } = [];
        public IEnumerable<AdminResponse> Admins { get; set; } = [];
        public IEnumerable<FamilyResponse> Families { get; set; } = [];
        public IEnumerable<TemplateResponse> Templates { get; set; } = [];
        public IEnumerable<GraphicCharterResponse> GraphicCharters { get; set; } = [];
        public IEnumerable<TableViewConfigResponse> TableViews { get; set; } = [];
        public IEnumerable<ModuleResponse> Modules { get; set; } = [];
        public Dictionary<string, object?> Settings { get; set; } = [];
    }

    public class DatabaseSchemaResponse
    {
        public IEnumerable<DatabaseTableInfo> Tables { get; set; } = [];
        public IEnumerable<DatabaseColumnInfo> Columns { get; set; } = [];
        public IEnumerable<DatabaseRelationInfo> Relations { get; set; } = [];
    }

    public class DatabaseTableInfo
    {
        public string Name { get; set; } = string.Empty;
        public string Comment { get; set; } = string.Empty;
    }

    public class DatabaseColumnInfo
    {
        public string Table { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Comment { get; set; } = string.Empty;
        public bool Nullable { get; set; }
        public string Key { get; set; } = string.Empty;
    }

    public class DatabaseRelationInfo
    {
        public string Table { get; set; } = string.Empty;
        public string Column { get; set; } = string.Empty;
        public string ReferencedTable { get; set; } = string.Empty;
        public string ReferencedColumn { get; set; } = string.Empty;
    }

    public class LookupOptionResponse
    {
        public string Value { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
    }
}
