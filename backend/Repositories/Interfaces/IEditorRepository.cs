using DocApi.DTOs;

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
        Task<DatabaseSchemaResponse> LoadSchemaAsync();
        Task ReplaceStateAsync(EditorStateResponse state, int? scopedOrganizationId, bool isSuperAdmin);
        Task<IEnumerable<IDictionary<string, object?>>> RunSelectQueryAsync(string sql, Dictionary<string, object?> parameters);
        Task<IEnumerable<IDictionary<string, object?>>> GetTableViewRowsAsync(string? configId, int? limit, string? search, TableViewConfigRequest? config);
        Task<IDictionary<string, object?>?> GetTableViewRecordAsync(string? configId, string? rowId);
        Task<IDictionary<string, object?>?> UpdateTableViewRecordAsync(string? configId, string? rowId, Dictionary<string, object?> values);
        Task<IDictionary<string, object?>?> CreateTableViewRecordAsync(string? configId, Dictionary<string, object?> values, TableViewConfigRequest? config);
        Task DeleteTableViewRecordAsync(string? configId, string? rowId);
        Task<IEnumerable<LookupOptionResponse>> GetLookupOptionsAsync(string? configId, string? fieldName, TableViewConfigRequest? config);
        Task<TableViewConfigResponse> UpsertTableViewConfigAsync(TableViewConfigRequest request);
        Task DeleteTableViewConfigAsync(string? id);
    }
}
