using DocApi.DTOs;
using DocApi.Common.Tenant;
using DocApi.Domain.ValueObjects;
using DocApi.Repositories.Interfaces;
using DocApi.Services.Interfaces;
using System.Text.Json;

namespace DocApi.Services
{
    public class EditorService : IEditorService
    {
        private readonly IEditorRepository _repository;
        private readonly IModuleRepository _moduleRepository;
        private readonly ITenantProvider _tenantProvider;
        private readonly IUserRepository _userRepository;

        public EditorService(IEditorRepository repository, IModuleRepository moduleRepository, ITenantProvider tenantProvider, IUserRepository userRepository)
        {
            _repository = repository;
            _moduleRepository = moduleRepository;
            _tenantProvider = tenantProvider;
            _userRepository = userRepository;
        }

        public async Task EnsureSchemaAsync()
        {
            await _repository.EnsureSchemaAsync();
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

        public async Task<IEnumerable<TableFilterOption>> GetTableFilterOptionsAsync(TableFilterSqlBuilder sqlBuilder, string? databaseName = null)
        {
            return await _repository.GetTableFilterOptionsAsync(sqlBuilder, databaseName);
        }

        public async Task<EditorStateResponse> LoadStateAsync(AuthUserResponse? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            var graphicCharters = (await _repository.LoadGraphicChartersAsync()).ToArray();
            var organizations = (await GetOrganizationsAsync()).ToArray();
            var modules = (await _moduleRepository.LoadModulesAsync()).ToArray();
            
            var state = new EditorStateResponse
            {
                Organizations = organizations,
                Admins = await _repository.LoadAdminsAsync(),
                Families = await _repository.LoadFamiliesAsync(),
                Templates = await _repository.LoadTemplatesAsync(),
                GraphicCharters = graphicCharters,
                TableViews = await _repository.LoadTableViewsAsync(),
                Modules = modules,
                Settings = await _repository.LoadSettingsAsync()
            };

            if (string.IsNullOrWhiteSpace(currentUser?.Role) || currentUser.Role == "supAdmin") return state;

            return new EditorStateResponse
            {
                Organizations = state.Organizations.Where(item => item.Id == currentUser.OrganizationId).ToArray(),
                Admins = state.Admins.Where(item => item.OrganizationId == currentUser.OrganizationId).ToArray(),
                Families = state.Families.Where(item => !item.OrganizationIds.Any() || item.OrganizationIds.Contains(currentUser.OrganizationId ?? 0)).ToArray(),
                Templates = state.Templates.Where(item => item.OrganizationId == currentUser.OrganizationId).ToArray(),
                GraphicCharters = state.GraphicCharters.Where(item => item.OrganizationId == currentUser.OrganizationId).ToArray(),
                TableViews = state.TableViews.Where(item => !item.OrganizationIds.Any() || item.OrganizationIds.Contains(currentUser.OrganizationId ?? 0)).ToArray(),
                Modules = state.Modules.Where(m => m.OrganizationIds == null || !m.OrganizationIds.Any() || m.OrganizationIds.Contains(currentUser.OrganizationId ?? 0)).ToArray(),
                Settings = state.Settings
            };
        }

        public async Task<DatabaseSchemaResponse> LoadSchemaAsync(string? databaseName = null)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.LoadSchemaAsync(databaseName);
        }

        public async Task<AcademicYearConfigResponse?> GetAcademicYearConfigAsync(int organizationId)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetAcademicYearConfigAsync(organizationId);
        }

        public async Task<AcademicYearConfigResponse> UpsertAcademicYearConfigAsync(AcademicYearConfigRequest request, AuthUserResponse? currentUser)
        {
            if (!string.Equals(currentUser?.Role, "supAdmin", StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Seul le super administrateur peut configurer les annees universitaires.");

            await _repository.EnsureSchemaAsync();
            return await _repository.UpsertAcademicYearConfigAsync(request);
        }

        public async Task<IEnumerable<AcademicYearResponse>> GetAcademicYearsAsync(AuthUserResponse? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            var organizationId = _tenantProvider.GetOrganizationId() ?? currentUser?.OrganizationId;
            if (!organizationId.HasValue) return [];

            AcademicYearResponse[] years;
            try
            {
                years = (await _repository.LoadAcademicYearsAsync()).ToArray();
            }
            catch
            {
                return [];
            }
            if (!string.Equals(currentUser?.Role, "user", StringComparison.OrdinalIgnoreCase)) return years;
            if (currentUser is null) return [];
            if (currentUser.AccessAllYears) return years;

            var allowed = ParseYearList(currentUser.AccessYearList);
            return years.Where(year => allowed.Contains(year.Code)).ToArray();
        }

        public async Task<AcademicYearResponse> CreateAcademicYearAsync(AcademicYearCreateRequest request, AuthUserResponse? currentUser)
        {
            if (!string.Equals(currentUser?.Role, "admin", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(currentUser?.Role, "supAdmin", StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Creation d'annee universitaire non autorisee.");

            await _repository.EnsureSchemaAsync();
            _ = _tenantProvider.GetOrganizationId() ?? currentUser?.OrganizationId
                ?? throw new InvalidOperationException("Organisation introuvable pour l'annee universitaire.");
            return await _repository.CreateAcademicYearAsync(request);
        }

        public async Task CloseAcademicYearAsync(string code, AuthUserResponse? currentUser)
        {
            if (!string.Equals(currentUser?.Role, "admin", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(currentUser?.Role, "supAdmin", StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Cloture d'annee universitaire non autorisee.");

            await _repository.EnsureSchemaAsync();
            _ = _tenantProvider.GetOrganizationId() ?? currentUser?.OrganizationId
                ?? throw new InvalidOperationException("Organisation introuvable pour l'annee universitaire.");
            await _repository.CloseAcademicYearAsync(code);
        }

        public async Task ReplaceStateAsync(EditorStateResponse state, AuthUserResponse? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.ReplaceStateAsync(state, currentUser?.OrganizationId, currentUser?.Role == "supAdmin");
        }

        public async Task<IEnumerable<IDictionary<string, object?>>> RunSelectQueryAsync(string? sql, Dictionary<string, object?>? parameters, string? databaseName = null, AuthUserResponse? currentUser = null)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.RunSelectQueryAsync(sql ?? string.Empty, parameters ?? [], databaseName, await ResolveDataAccessRulesAsync(currentUser));
        }

        public async Task<IEnumerable<IDictionary<string, object?>>> GetTableViewRowsAsync(TableViewRowsRequest request, AuthUserResponse? currentUser = null)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetTableViewRowsAsync(request.ConfigId, request.Search, request.Config, request.DatabaseName, request.SelectedFilters, request.Page, request.PageSize, await ResolveDataAccessRulesAsync(currentUser));
        }

        public async Task<IDictionary<string, object?>?> GetTableViewRecordAsync(TableViewRecordRequest request, AuthUserResponse? currentUser = null)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetTableViewRecordAsync(request.ConfigId, request.RowId, request.DatabaseName, await ResolveDataAccessRulesAsync(currentUser));
        }

        public async Task<IDictionary<string, object?>?> UpdateTableViewRecordAsync(TableViewRecordRequest request, AuthUserResponse? currentUser = null)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.UpdateTableViewRecordAsync(request.ConfigId, request.RowId, request.Values, request.DatabaseName, await ResolveDataAccessRulesAsync(currentUser));
        }

        public async Task<IDictionary<string, object?>?> CreateTableViewRecordAsync(TableViewRecordRequest request, AuthUserResponse? currentUser = null)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.CreateTableViewRecordAsync(request.ConfigId, request.Values, request.Config, request.DatabaseName, await ResolveDataAccessRulesAsync(currentUser));
        }

        public async Task DeleteTableViewRecordAsync(TableViewRecordRequest request, AuthUserResponse? currentUser = null)
        {
            await _repository.EnsureSchemaAsync();
            await _repository.DeleteTableViewRecordAsync(request.ConfigId, request.RowId, request.DatabaseName, await ResolveDataAccessRulesAsync(currentUser));
        }

        public async Task<IEnumerable<LookupOptionResponse>> GetLookupOptionsAsync(TableViewLookupRequest request)
        {
            await _repository.EnsureSchemaAsync();
            return await _repository.GetLookupOptionsAsync(request.ConfigId, request.FieldName, request.Config, request.DatabaseName);
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

        public async Task<IEnumerable<DocumentResponse>> GetDocumentsAsync(DocumentListRequest request, AuthUserResponse? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            var isSuperAdmin = string.Equals(currentUser?.Role, "supAdmin", StringComparison.OrdinalIgnoreCase);
            var isAdmin = string.Equals(currentUser?.Role, "admin", StringComparison.OrdinalIgnoreCase);
            var organizationId = isSuperAdmin ? request.OrganizationId : currentUser?.OrganizationId;
            var generatedById = isSuperAdmin || isAdmin
                ? request.GeneratedById
                : currentUser?.Id;
            return await _repository.LoadDocumentsAsync(organizationId, request.FamilyId, request.BeneficiaryTable, request.BeneficiaryId, generatedById);
        }

        public async Task<DocumentListResponse> GetDocumentsPagedAsync(DocumentListRequest request, AuthUserResponse? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            var isSuperAdmin = string.Equals(currentUser?.Role, "supAdmin", StringComparison.OrdinalIgnoreCase);
            var isAdmin = string.Equals(currentUser?.Role, "admin", StringComparison.OrdinalIgnoreCase);
            var organizationId = isSuperAdmin ? request.OrganizationId : currentUser?.OrganizationId;
            var generatedById = isSuperAdmin || isAdmin
                ? request.GeneratedById
                : currentUser?.Id;
            
            // Apply org-scoping to request
            var scopedRequest = new DocumentListRequest
            {
                OrganizationId = organizationId,
                FamilyId = request.FamilyId,
                BeneficiaryTable = request.BeneficiaryTable,
                BeneficiaryId = request.BeneficiaryId,
                GeneratedById = generatedById,
                Page = request.Page > 0 ? request.Page : 1,
                SortBy = request.SortBy,
                SortOrder = request.SortOrder
            };
            
            return await _repository.LoadDocumentsPagedAsync(scopedRequest);
        }

        public async Task<DocumentResponse?> GetDocumentByIdAsync(string id, AuthUserResponse? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            var document = await _repository.GetDocumentByIdAsync(id);
            if (document is null) return null;

            var isSuperAdmin = string.Equals(currentUser?.Role, "supAdmin", StringComparison.OrdinalIgnoreCase);
            var isAdmin = string.Equals(currentUser?.Role, "admin", StringComparison.OrdinalIgnoreCase);
            if (!isSuperAdmin && currentUser?.OrganizationId != document.OrganizationId) return null;
            if (!isSuperAdmin && !isAdmin && document.GeneratedById != currentUser?.Id) return null;
            return document;
        }

        public async Task<DocumentResponse> CreateDocumentAsync(DocumentCreateRequest request, AuthUserResponse? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            var isSuperAdmin = string.Equals(currentUser?.Role, "supAdmin", StringComparison.OrdinalIgnoreCase);
            request.OrganizationId = isSuperAdmin ? request.OrganizationId : currentUser?.OrganizationId;
            request.GeneratedById = string.IsNullOrWhiteSpace(request.GeneratedById) ? currentUser?.Id ?? string.Empty : request.GeneratedById;
            request.GeneratedByName = string.IsNullOrWhiteSpace(request.GeneratedByName) ? currentUser?.Name ?? string.Empty : request.GeneratedByName;
            request.GeneratedByEmail = string.IsNullOrWhiteSpace(request.GeneratedByEmail) ? currentUser?.Email : request.GeneratedByEmail;
            request.GeneratedByRole = string.IsNullOrWhiteSpace(request.GeneratedByRole) ? currentUser?.Role : request.GeneratedByRole;
            return await _repository.CreateDocumentAsync(request);
        }

        public async Task DeleteDocumentAsync(string id, AuthUserResponse? currentUser)
        {
            await _repository.EnsureSchemaAsync();
            var document = await _repository.GetDocumentByIdAsync(id);
            if (document is null) return;

            var isSuperAdmin = string.Equals(currentUser?.Role, "supAdmin", StringComparison.OrdinalIgnoreCase);
            var isAdmin = string.Equals(currentUser?.Role, "admin", StringComparison.OrdinalIgnoreCase);
            if (!isSuperAdmin && currentUser?.OrganizationId != document.OrganizationId)
            {
                throw new UnauthorizedAccessException("Suppression non autorisee pour ce document.");
            }
            if (!isSuperAdmin && !isAdmin && document.GeneratedById != currentUser?.Id)
            {
                throw new UnauthorizedAccessException("Suppression non autorisee pour ce document.");
            }

            await _repository.DeleteDocumentAsync(id, currentUser);
        }

        private static HashSet<string> ParseYearList(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                var list = JsonSerializer.Deserialize<List<string>>(raw);
                if (list is not null) return list.ToHashSet(StringComparer.OrdinalIgnoreCase);
            }
            catch { }

            return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        private async Task<List<UserDataAccessRuleDto>> ResolveDataAccessRulesAsync(AuthUserResponse? currentUser)
        {
            if (currentUser is null) return new List<UserDataAccessRuleDto>();
            if (!string.Equals(currentUser.Role, "user", StringComparison.OrdinalIgnoreCase))
            {
                return new List<UserDataAccessRuleDto>();
            }

            var currentRules = currentUser.DataAccessRules ?? new List<UserDataAccessRuleDto>();
            if (currentRules.Count > 0) return currentRules;
            if (!int.TryParse(currentUser.Id, out var userId)) return new List<UserDataAccessRuleDto>();

            var user = await _userRepository.GetByIdAsync(userId);
            if (string.IsNullOrWhiteSpace(user?.DataAccessRules)) return new List<UserDataAccessRuleDto>();

            try
            {
                return JsonSerializer.Deserialize<List<UserDataAccessRuleDto>>(user.DataAccessRules) ?? new List<UserDataAccessRuleDto>();
            }
            catch (JsonException)
            {
                return new List<UserDataAccessRuleDto>();
            }
        }

    }
}
