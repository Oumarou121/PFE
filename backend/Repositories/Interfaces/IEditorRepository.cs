using DocApi.DTOs;
using DocApi.Domain.ValueObjects;

namespace DocApi.Repositories.Interfaces
{
    public interface IEditorRepository
    {
        Task EnsureSchemaAsync();
        Task<IEnumerable<FamilyResponse>> LoadFamiliesAsync();
        Task<FamilyResponse?> GetFamilyByIdAsync(string id);
        Task<FamilyResponse> UpsertFamilyAsync(FamilyRequest request);
        Task DeleteFamilyAsync(string id);
        Task<IEnumerable<OrganizationResponse>> LoadOrganizationsAsync();
        Task<IEnumerable<AdminResponse>> LoadAdminsAsync();
        Task<IEnumerable<GraphicCharterResponse>> LoadGraphicChartersAsync();
        Task<GraphicCharterResponse?> GetGraphicCharterByIdAsync(string id);
        Task<GraphicCharterResponse> UpsertGraphicCharterAsync(GraphicCharterRequest request);
        Task DeleteGraphicCharterAsync(string id);
        Task<IEnumerable<TemplateResponse>> LoadTemplatesAsync();
        Task<TemplateResponse?> GetTemplateByIdAsync(string id);
        Task<TemplateResponse> UpsertTemplateAsync(TemplateRequest request);
        Task DeleteTemplateAsync(string id);
        Task<IEnumerable<TableViewConfigResponse>> LoadTableViewsAsync();
        Task<TableViewConfigResponse?> GetTableViewConfigByIdAsync(string id);
        Task<Dictionary<string, object?>> LoadSettingsAsync();
        Task<AcademicYearConfigResponse?> GetAcademicYearConfigAsync(int organizationId);
        Task<AcademicYearConfigResponse> UpsertAcademicYearConfigAsync(AcademicYearConfigRequest request);
        Task<IEnumerable<AcademicYearResponse>> LoadAcademicYearsAsync(AcademicYearConfigResponse config);
        Task<AcademicYearResponse> CreateAcademicYearAsync(AcademicYearConfigResponse config, AcademicYearCreateRequest request);
        Task CloseAcademicYearAsync(AcademicYearConfigResponse config, string code);
        Task<DatabaseSchemaResponse> LoadSchemaAsync(string? databaseName = null);
        Task ReplaceStateAsync(EditorStateResponse state, int? scopedOrganizationId, bool isSuperAdmin);
        Task<IEnumerable<IDictionary<string, object?>>> RunSelectQueryAsync(string sql, Dictionary<string, object?> parameters, string? databaseName = null);
        Task<IEnumerable<IDictionary<string, object?>>> GetTableViewRowsAsync(string? configId, int? limit, string? search, TableViewConfigRequest? config, string? databaseName = null, Dictionary<string, List<string>>? selectedFilters = null);
        Task<IDictionary<string, object?>?> GetTableViewRecordAsync(string? configId, string? rowId, string? databaseName = null);
        Task<IDictionary<string, object?>?> UpdateTableViewRecordAsync(string? configId, string? rowId, Dictionary<string, object?> values, string? databaseName = null);
        Task<IDictionary<string, object?>?> CreateTableViewRecordAsync(string? configId, Dictionary<string, object?> values, TableViewConfigRequest? config, string? databaseName = null);
        Task DeleteTableViewRecordAsync(string? configId, string? rowId, string? databaseName = null);
        Task<IEnumerable<LookupOptionResponse>> GetLookupOptionsAsync(string? configId, string? fieldName, TableViewConfigRequest? config, string? databaseName = null);
        Task<TableViewConfigResponse> UpsertTableViewConfigAsync(TableViewConfigRequest request);
        Task DeleteTableViewConfigAsync(string? id);
        Task<IEnumerable<TableFilterOption>> GetTableFilterOptionsAsync(TableFilterSqlBuilder sqlBuilder, string? databaseName = null);
        Task<IEnumerable<DocumentResponse>> LoadDocumentsAsync(int? organizationId = null, string? familyId = null, string? beneficiaryTable = null, string? beneficiaryId = null);
        Task<DocumentListResponse> LoadDocumentsPagedAsync(DocumentListRequest request);
        Task<DocumentResponse?> GetDocumentByIdAsync(string id);
        Task<DocumentResponse> CreateDocumentAsync(DocumentCreateRequest request);
        Task DeleteDocumentAsync(string id, AuthUserResponse? deletedBy = null);
    }
}
