using DocApi.DTOs;
using DocApi.Repositories.Interfaces;
using DocApi.Services.Interfaces;

namespace DocApi.Services
{
    public class EditorService : IEditorService
    {
        private readonly IEditorRepository _repository;

        public EditorService(IEditorRepository repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<FamilyResponse>> GetFamiliesAsync()
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadFamiliesAsync();
        }

        public async Task<FamilyResponse?> GetFamilyByIdAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetFamilyByIdAsync(id);
        }

        public async Task<FamilyResponse> UpsertFamilyAsync(FamilyRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpsertFamilyAsync(request);
        }

        public async Task DeleteFamilyAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteFamilyAsync(id);
        }

        public async Task<IEnumerable<OrganizationResponse>> GetOrganizationsAsync()
        {
            await _repository.EnsureSchemaAsync();
            var graphicCharters = (await _repository.LoadGraphicChartersAsync()).ToArray();
            return (await _repository.LoadOrganizationsAsync())
                .Select(organization =>
                {
                    organization.GraphicCharters = graphicCharters
                        .Where(item => item.OrganizationId == organization.Id)
                        .ToList();
                    return organization;
                })
                .ToArray();
        }

        public async Task<IEnumerable<AdminResponse>> GetAdminsAsync()
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadAdminsAsync();
        }

        public async Task<IEnumerable<TemplateResponse>> GetTemplatesAsync(AuthUserResponse? currentUser = null)
        {
            await _repository.EnsureSchemaAsync();
            var templates = (await _repository.LoadTemplatesAsync()).ToArray();
            if (string.IsNullOrWhiteSpace(currentUser?.Role) || currentUser.Role == "supAdmin") return templates;

            return templates.Where(item => item.OrganizationId == currentUser.OrganizationId).ToArray();
        }

        public async Task<TemplateResponse?> GetTemplateByIdAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetTemplateByIdAsync(id);
        }

        public async Task<TemplateResponse> UpsertTemplateAsync(TemplateRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpsertTemplateAsync(request);
        }

        public async Task DeleteTemplateAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteTemplateAsync(id);
        }

        public async Task<IEnumerable<GraphicCharterResponse>> GetGraphicChartersAsync()
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadGraphicChartersAsync();
        }

        public async Task<GraphicCharterResponse?> GetGraphicCharterByIdAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetGraphicCharterByIdAsync(id);
        }

        public async Task<GraphicCharterResponse> UpsertGraphicCharterAsync(GraphicCharterRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpsertGraphicCharterAsync(request);
        }

        public async Task DeleteGraphicCharterAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteGraphicCharterAsync(id);
        }

        public async Task<IEnumerable<TableViewConfigResponse>> GetTableViewConfigsAsync()
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadTableViewsAsync();
        }

        public async Task<TableViewConfigResponse?> GetTableViewConfigByIdAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetTableViewConfigByIdAsync(id);
        }

        public async Task<EditorStateResponse> LoadStateAsync(AuthUserResponse? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            var graphicCharters = (await _repository.LoadGraphicChartersAsync()).ToArray();
            var organizations = (await GetOrganizationsAsync()).ToArray();
            var state = new EditorStateResponse
            {
                Organizations = organizations,
                Admins = await _repository.LoadAdminsAsync(),
                Families = await _repository.LoadFamiliesAsync(),
                Templates = await _repository.LoadTemplatesAsync(),
                GraphicCharters = graphicCharters,
                TableViews = await _repository.LoadTableViewsAsync(),
                Settings = await _repository.LoadSettingsAsync()
            };

            if (string.IsNullOrWhiteSpace(currentUser?.Role) || currentUser.Role == "supAdmin") return state;

            return new EditorStateResponse
            {
                Organizations = state.Organizations.Where(item => item.Id == currentUser.OrganizationId).ToArray(),
                Admins = state.Admins.Where(item => item.OrganizationId == currentUser.OrganizationId).ToArray(),
                Families = state.Families,
                Templates = state.Templates.Where(item => item.OrganizationId == currentUser.OrganizationId).ToArray(),
                GraphicCharters = state.GraphicCharters.Where(item => item.OrganizationId == currentUser.OrganizationId).ToArray(),
                TableViews = state.TableViews,
                Settings = state.Settings
            };
        }

        public async Task<DatabaseSchemaResponse> LoadSchemaAsync()
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadSchemaAsync();
        }

        public async Task ReplaceStateAsync(EditorStateResponse state, AuthUserResponse? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.ReplaceStateAsync(state, currentUser?.OrganizationId, currentUser?.Role == "supAdmin");
        }

        public async Task<IEnumerable<IDictionary<string, object?>>> RunSelectQueryAsync(string? sql, Dictionary<string, object?>? parameters)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.RunSelectQueryAsync(sql ?? string.Empty, parameters ?? []);
        }

        public async Task<IEnumerable<IDictionary<string, object?>>> GetTableViewRowsAsync(TableViewRowsRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetTableViewRowsAsync(request.ConfigId, request.Limit, request.Search, request.Config);
        }

        public async Task<IDictionary<string, object?>?> GetTableViewRecordAsync(TableViewRecordRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetTableViewRecordAsync(request.ConfigId, request.RowId);
        }

        public async Task<IDictionary<string, object?>?> UpdateTableViewRecordAsync(TableViewRecordRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpdateTableViewRecordAsync(request.ConfigId, request.RowId, request.Values);
        }

        public async Task<IDictionary<string, object?>?> CreateTableViewRecordAsync(TableViewRecordRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.CreateTableViewRecordAsync(request.ConfigId, request.Values, request.Config);
        }

        public async Task DeleteTableViewRecordAsync(TableViewRecordRequest request)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteTableViewRecordAsync(request.ConfigId, request.RowId);
        }

        public async Task<IEnumerable<LookupOptionResponse>> GetLookupOptionsAsync(TableViewLookupRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetLookupOptionsAsync(request.ConfigId, request.FieldName, request.Config);
        }

        public async Task<TableViewConfigResponse> UpsertTableViewConfigAsync(TableViewConfigRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpsertTableViewConfigAsync(request);
        }

        public async Task DeleteTableViewConfigAsync(string? id)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteTableViewConfigAsync(id);
        }
    }
}
