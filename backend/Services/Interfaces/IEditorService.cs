using DocApi.DTOs;
using DocApi.Domain.ValueObjects;

namespace DocApi.Services.Interfaces
{
    public interface IEditorService
    {
        Task EnsureSchemaAsync();
        Task<IEnumerable<FamilyResponse>> GetFamiliesAsync();
        Task<FamilyResponse?> GetFamilyByIdAsync(string id);
        Task<FamilyResponse> UpsertFamilyAsync(FamilyRequest request);
        Task DeleteFamilyAsync(string id);
        Task<IEnumerable<OrganizationResponse>> GetOrganizationsAsync();
        Task<IEnumerable<AdminResponse>> GetAdminsAsync();
        Task<IEnumerable<TemplateResponse>> GetTemplatesAsync(AuthUserResponse? currentUser = null);
        Task<TemplateResponse?> GetTemplateByIdAsync(string id);
        Task<TemplateResponse> UpsertTemplateAsync(TemplateRequest request);
        Task DeleteTemplateAsync(string id);
        Task<IEnumerable<GraphicCharterResponse>> GetGraphicChartersAsync();
        Task<GraphicCharterResponse?> GetGraphicCharterByIdAsync(string id);
        Task<GraphicCharterResponse> UpsertGraphicCharterAsync(GraphicCharterRequest request);
        Task DeleteGraphicCharterAsync(string id);
        Task<IEnumerable<TableViewConfigResponse>> GetTableViewConfigsAsync();
        Task<TableViewConfigResponse?> GetTableViewConfigByIdAsync(string id);
        Task<TableViewConfigResponse> UpsertTableViewConfigAsync(TableViewConfigRequest request);
        Task DeleteTableViewConfigAsync(string? id);
        Task<IEnumerable<TableFilterOption>> GetTableFilterOptionsAsync(TableFilterSqlBuilder sqlBuilder, string? databaseName = null);
        Task<EditorStateResponse> LoadStateAsync(AuthUserResponse? currentUser);
        Task<DatabaseSchemaResponse> LoadSchemaAsync(string? databaseName = null);
        Task<AcademicYearConfigResponse?> GetAcademicYearConfigAsync(int organizationId);
        Task<AcademicYearConfigResponse> UpsertAcademicYearConfigAsync(AcademicYearConfigRequest request, AuthUserResponse? currentUser);
        Task<IEnumerable<AcademicYearResponse>> GetAcademicYearsAsync(AuthUserResponse? currentUser);
        Task<AcademicYearResponse> CreateAcademicYearAsync(AcademicYearCreateRequest request, AuthUserResponse? currentUser);
        Task CloseAcademicYearAsync(string code, AuthUserResponse? currentUser);
        Task ReplaceStateAsync(EditorStateResponse state, AuthUserResponse? currentUser);
        Task<IEnumerable<IDictionary<string, object?>>> RunSelectQueryAsync(string? sql, Dictionary<string, object?>? parameters, string? databaseName = null);
        Task<IEnumerable<IDictionary<string, object?>>> GetTableViewRowsAsync(TableViewRowsRequest request);
        Task<IDictionary<string, object?>?> GetTableViewRecordAsync(TableViewRecordRequest request);
        Task<IDictionary<string, object?>?> UpdateTableViewRecordAsync(TableViewRecordRequest request);
        Task<IDictionary<string, object?>?> CreateTableViewRecordAsync(TableViewRecordRequest request);
        Task DeleteTableViewRecordAsync(TableViewRecordRequest request);
        Task<IEnumerable<LookupOptionResponse>> GetLookupOptionsAsync(TableViewLookupRequest request);
        Task<IEnumerable<DocumentResponse>> GetDocumentsAsync(DocumentListRequest request, AuthUserResponse? currentUser);
        Task<DocumentListResponse> GetDocumentsPagedAsync(DocumentListRequest request, AuthUserResponse? currentUser);
        Task<DocumentResponse?> GetDocumentByIdAsync(string id, AuthUserResponse? currentUser);
        Task<DocumentResponse> CreateDocumentAsync(DocumentCreateRequest request, AuthUserResponse? currentUser);
        Task DeleteDocumentAsync(string id, AuthUserResponse? currentUser);
    }
}
