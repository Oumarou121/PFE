using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using DocApi.DTOs;
using DocApi.Repositories.Interfaces;
using DocApi.Services.Interfaces;

namespace DocApi.Services
{
    public class EditorService : IEditorService
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
        private readonly IEditorRepository _repository;

        public EditorService(IEditorRepository repository)
        {
            _repository = repository;
        }

        public Task<object?> LoginAsync(EditorLoginRequest request)
        {
            var identifier = (request.Identifier ?? "").Trim();
            var password = request.Password ?? "";
            var user = SeedUsers().FirstOrDefault(item =>
                (string.Equals((string)item["email"]!, identifier, StringComparison.OrdinalIgnoreCase)
                 || string.Equals((string)item["name"]!, identifier, StringComparison.OrdinalIgnoreCase))
                && (string)item["password"]! == password);

            return Task.FromResult<object?>(user is null ? null : PublicUser(user));
        }

        public object? GetUserFromCookie(string? cookieValue)
        {
            if (string.IsNullOrWhiteSpace(cookieValue)) return null;
            try
            {
                var json = Encoding.UTF8.GetString(Convert.FromBase64String(cookieValue));
                return JsonSerializer.Deserialize<Dictionary<string, object?>>(json, JsonOptions);
            }
            catch
            {
                return null;
            }
        }

        public async Task<IEnumerable<object>> GetFamiliesAsync()
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadFamiliesAsync();
        }

        public async Task<object?> GetFamilyByIdAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetFamilyByIdAsync(id);
        }

        public async Task<object> UpsertFamilyAsync(JsonObject family)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpsertFamilyAsync(family);
        }

        public async Task DeleteFamilyAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteFamilyAsync(id);
        }

        public async Task<IEnumerable<object>> GetTemplatesAsync()
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadTemplatesAsync();
        }

        public async Task<object?> GetTemplateByIdAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetTemplateByIdAsync(id);
        }

        public async Task<object> UpsertTemplateAsync(JsonObject template)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpsertTemplateAsync(template);
        }

        public async Task DeleteTemplateAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteTemplateAsync(id);
        }

        public async Task<IEnumerable<object>> GetGraphicChartersAsync()
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadGraphicChartersAsync();
        }

        public async Task<object?> GetGraphicCharterByIdAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetGraphicCharterByIdAsync(id);
        }

        public async Task<object> UpsertGraphicCharterAsync(JsonObject graphicCharter)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpsertGraphicCharterAsync(graphicCharter);
        }

        public async Task DeleteGraphicCharterAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteGraphicCharterAsync(id);
        }

        public async Task<IEnumerable<object>> GetTableViewConfigsAsync()
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadTableViewsAsync();
        }

        public async Task<object?> GetTableViewConfigByIdAsync(string id)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetTableViewConfigByIdAsync(id);
        }

        public async Task<object> LoadStateAsync(object? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            var graphicCharters = (await _repository.LoadGraphicChartersAsync()).ToArray();
            var organizations = (await _repository.LoadOrganizationsAsync())
                .Select(organization => new
                {
                    id = GetProperty(organization, "id"),
                    nom = GetProperty(organization, "nom"),
                    ville = GetProperty(organization, "ville"),
                    adresse = GetProperty(organization, "adresse"),
                    tel = GetProperty(organization, "tel"),
                    email = GetProperty(organization, "email"),
                    raw = GetObjectProperty(organization, "raw"),
                    graphicCharters = graphicCharters.Where(item => GetProperty(item, "organizationId") == GetProperty(organization, "id")).ToArray(),
                    createdAt = GetObjectProperty(organization, "createdAt"),
                    updatedAt = GetObjectProperty(organization, "updatedAt")
                })
                .ToArray();
            var state = new
            {
                organizations,
                admins = await _repository.LoadAdminsAsync(),
                families = await _repository.LoadFamiliesAsync(),
                templates = await _repository.LoadTemplatesAsync(),
                graphicCharters,
                tableViews = await _repository.LoadTableViewsAsync(),
                settings = await _repository.LoadSettingsAsync()
            };

            var role = GetUserString(currentUser, "role");
            if (string.IsNullOrWhiteSpace(role) || role == "supAdmin") return state;

            var organizationId = GetUserString(currentUser, "organizationId");
            return new
            {
                organizations = state.organizations.Where(item => GetProperty(item, "id") == organizationId),
                admins = state.admins.Where(item => GetProperty(item, "organizationId") == organizationId),
                state.families,
                templates = state.templates.Where(item => GetProperty(item, "organizationId") == organizationId),
                state.tableViews,
                state.settings
            };
        }

        public async Task<object> LoadSchemaAsync()
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadSchemaAsync();
        }

        public async Task ReplaceStateAsync(JsonObject state, object? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            var role = GetUserString(currentUser, "role");
            await _repository.ReplaceStateAsync(state, GetUserString(currentUser, "organizationId"), role == "supAdmin");
        }

        public async Task<IEnumerable<object>> RunSelectQueryAsync(string? sql, Dictionary<string, object?>? parameters)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.RunSelectQueryAsync(sql ?? "", parameters ?? []);
        }

        public async Task<IEnumerable<object>> GetTableViewRowsAsync(TableViewRowsRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetTableViewRowsAsync(request.ConfigId, request.Limit, request.Search, request.Config);
        }

        public async Task<object?> GetTableViewRecordAsync(TableViewRecordRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetTableViewRecordAsync(request.ConfigId, request.RowId);
        }

        public async Task<object?> UpdateTableViewRecordAsync(TableViewRecordRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpdateTableViewRecordAsync(request.ConfigId, request.RowId, request.Values ?? []);
        }

        public async Task<object?> CreateTableViewRecordAsync(TableViewRecordRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.CreateTableViewRecordAsync(request.ConfigId, request.Values ?? [], request.Config);
        }

        public async Task DeleteTableViewRecordAsync(TableViewRecordRequest request)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteTableViewRecordAsync(request.ConfigId, request.RowId);
        }

        public async Task<IEnumerable<object>> GetLookupOptionsAsync(TableViewLookupRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetLookupOptionsAsync(request.ConfigId, request.FieldName, request.Config);
        }

        public async Task<object> UpsertTableViewConfigAsync(JsonObject tableView)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpsertTableViewConfigAsync(tableView);
        }

        public async Task DeleteTableViewConfigAsync(string? id)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteTableViewConfigAsync(id);
        }

        public static string CreateCookieValue(object user)
        {
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(user, JsonOptions)));
        }

        private static string? GetProperty(object item, string propertyName)
        {
            var property = item.GetType().GetProperty(propertyName);
            return property?.GetValue(item)?.ToString();
        }

        private static object? GetObjectProperty(object item, string propertyName)
        {
            return item.GetType().GetProperty(propertyName)?.GetValue(item);
        }

        private static string? GetUserString(object? user, string key)
        {
            if (user is Dictionary<string, object?> dictionary && dictionary.TryGetValue(key, out var value)) return value?.ToString();
            if (user is IDictionary<string, object?> genericDictionary && genericDictionary.TryGetValue(key, out var genericValue)) return genericValue?.ToString();
            return user?.GetType().GetProperty(key)?.GetValue(user)?.ToString();
        }

        private static Dictionary<string, object?> PublicUser(Dictionary<string, object?> user) => new()
        {
            ["id"] = user["id"],
            ["name"] = user["name"],
            ["email"] = user["email"],
            ["organizationId"] = user["organizationId"],
            ["role"] = user["role"],
            ["profile"] = user["profile"]
        };

        private static IEnumerable<Dictionary<string, object?>> SeedUsers() =>
        [
            new() { ["id"] = "1", ["name"] = "Super Admin", ["email"] = "super.admin@gmail.com", ["password"] = "azerty", ["role"] = "supAdmin", ["organizationId"] = "2", ["profile"] = "" },
            new() { ["id"] = "2", ["name"] = "Admin", ["email"] = "admin@gmail.com", ["password"] = "azerty", ["role"] = "admin", ["organizationId"] = "2", ["profile"] = "" },
            new() { ["id"] = "3", ["name"] = "User", ["email"] = "user@gmail.com", ["password"] = "azerty", ["role"] = "user", ["organizationId"] = "2", ["profile"] = "" }
        ];
    }
}
