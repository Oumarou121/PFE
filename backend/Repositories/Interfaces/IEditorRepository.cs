using System.Text.Json.Nodes;

namespace DocApi.Repositories.Interfaces
{
    public interface IEditorRepository
    {
        Task EnsureSchemaAsync();
        Task<IEnumerable<object>> LoadFamiliesAsync();
        Task<object?> GetFamilyByIdAsync(string id);
        Task<object> UpsertFamilyAsync(JsonObject family);
        Task DeleteFamilyAsync(string id);
        Task<IEnumerable<object>> LoadOrganizationsAsync();
        Task<IEnumerable<object>> LoadAdminsAsync();
        Task<IEnumerable<object>> LoadGraphicChartersAsync();
        Task<object?> GetGraphicCharterByIdAsync(string id);
        Task<object> UpsertGraphicCharterAsync(JsonObject graphicCharter);
        Task DeleteGraphicCharterAsync(string id);
        Task<IEnumerable<object>> LoadTemplatesAsync();
        Task<object?> GetTemplateByIdAsync(string id);
        Task<object> UpsertTemplateAsync(JsonObject template);
        Task DeleteTemplateAsync(string id);
        Task<IEnumerable<object>> LoadTableViewsAsync();
        Task<object?> GetTableViewConfigByIdAsync(string id);
        Task<IDictionary<string, object?>> LoadSettingsAsync();
        Task<object> LoadSchemaAsync();
        Task ReplaceStateAsync(JsonObject state, string? scopedOrganizationId, bool isSuperAdmin);
        Task<IEnumerable<object>> RunSelectQueryAsync(string sql, Dictionary<string, object?> parameters);
        Task<IEnumerable<object>> GetTableViewRowsAsync(string? configId, int? limit, string? search, JsonObject? config);
        Task<object?> GetTableViewRecordAsync(string? configId, object? rowId);
        Task<object?> UpdateTableViewRecordAsync(string? configId, object? rowId, Dictionary<string, object?> values);
        Task<object?> CreateTableViewRecordAsync(string? configId, Dictionary<string, object?> values, JsonObject? config);
        Task DeleteTableViewRecordAsync(string? configId, object? rowId);
        Task<IEnumerable<object>> GetLookupOptionsAsync(string? configId, string? fieldName, JsonObject? config);
        Task<object> UpsertTableViewConfigAsync(JsonObject tableView);
        Task DeleteTableViewConfigAsync(string? id);
    }
}
