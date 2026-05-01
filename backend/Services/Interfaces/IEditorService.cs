using DocApi.DTOs;
using System.Text.Json.Nodes;

namespace DocApi.Services.Interfaces
{
    public interface IEditorService
    {
        Task<IEnumerable<object>> GetFamiliesAsync();
        Task<object?> GetFamilyByIdAsync(string id);
        Task<object> UpsertFamilyAsync(JsonObject family);
        Task DeleteFamilyAsync(string id);
        Task<IEnumerable<object>> GetTemplatesAsync();
        Task<object?> GetTemplateByIdAsync(string id);
        Task<object> UpsertTemplateAsync(JsonObject template);
        Task DeleteTemplateAsync(string id);
        Task<IEnumerable<object>> GetGraphicChartersAsync();
        Task<object?> GetGraphicCharterByIdAsync(string id);
        Task<object> UpsertGraphicCharterAsync(JsonObject graphicCharter);
        Task DeleteGraphicCharterAsync(string id);
        Task<IEnumerable<object>> GetTableViewConfigsAsync();
        Task<object?> GetTableViewConfigByIdAsync(string id);
        Task<object> UpsertTableViewConfigAsync(JsonObject tableView);
        Task DeleteTableViewConfigAsync(string? id);
        Task<object> LoadStateAsync(object? currentUser);
        Task<object> LoadSchemaAsync();
        Task ReplaceStateAsync(JsonObject state, object? currentUser);
        Task<IEnumerable<object>> RunSelectQueryAsync(string? sql, Dictionary<string, object?>? parameters);
        Task<IEnumerable<object>> GetTableViewRowsAsync(TableViewRowsRequest request);
        Task<object?> GetTableViewRecordAsync(TableViewRecordRequest request);
        Task<object?> UpdateTableViewRecordAsync(TableViewRecordRequest request);
        Task<object?> CreateTableViewRecordAsync(TableViewRecordRequest request);
        Task DeleteTableViewRecordAsync(TableViewRecordRequest request);
        Task<IEnumerable<object>> GetLookupOptionsAsync(TableViewLookupRequest request);
    }
}
