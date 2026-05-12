using DocApi.DTOs;

namespace DocApi.Services.Interfaces
{
    public interface IEditorService
    {
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
        Task<EditorStateResponse> LoadStateAsync(AuthUserResponse? currentUser);
        Task<DatabaseSchemaResponse> LoadSchemaAsync(string? databaseName = null);
        Task ReplaceStateAsync(EditorStateResponse state, AuthUserResponse? currentUser);
        Task<IEnumerable<IDictionary<string, object?>>> RunSelectQueryAsync(string? sql, Dictionary<string, object?>? parameters, string? databaseName = null);
        Task<IEnumerable<IDictionary<string, object?>>> GetTableViewRowsAsync(TableViewRowsRequest request);
        Task<IDictionary<string, object?>?> GetTableViewRecordAsync(TableViewRecordRequest request);
        Task<IDictionary<string, object?>?> UpdateTableViewRecordAsync(TableViewRecordRequest request);
        Task<IDictionary<string, object?>?> CreateTableViewRecordAsync(TableViewRecordRequest request);
        Task DeleteTableViewRecordAsync(TableViewRecordRequest request);
        Task<IEnumerable<LookupOptionResponse>> GetLookupOptionsAsync(TableViewLookupRequest request);
    }
}
