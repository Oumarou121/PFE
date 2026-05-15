using System.Data;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Dapper;
using DocApi.Common;
using DocApi.Common.Tenant;
using DocApi.Domain.ValueObjects;
using DocApi.DTOs;
using DocApi.Infrastructure;
using DocApi.Repositories.Interfaces;
using Microsoft.Extensions.Options;

namespace DocApi.Repositories
{
    /// <summary>
    /// Repository multi-tenant :
    /// - ConfigDB  (IConfigDbConnectionFactory)  → family, graphic_charter, template, table_view_config, app_setting
    /// - TenantDB  (ITenantConnectionFactory)     → RunSelectQuery, GetTableViewRows*, LoadSchema (données métier)
    /// - AuthDB    (IAuthDbConnectionFactory)     → Organization, User (via cross-db)
    /// </summary>
    public class EditorRepository : IEditorRepository
    {
        private readonly ILogger<EditorRepository> _logger;
        private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();
        private const string AcademicYearConfigsSettingKey = "academicYearConfigs";
        private const string AcademicYearTable = "ANNEEUNIV";
        private const string AcademicYearCodeColumn = "CODE";
        private const string AcademicYearStartDateColumn = "DATEDEBUT";
        private const string AcademicYearEndDateColumn = "DATEFIN";
        private const string AcademicYearStatusColumn = "ETATPLANETUDES";

        private readonly IConfigDbConnectionFactory _configFactory;
        private readonly ITenantConnectionFactory _tenantFactory;
        private readonly ITenantProvider _tenantProvider;
        private readonly IWebHostEnvironment _environment;
        private readonly EditorDatabaseOptions _options;

        public EditorRepository(
            IConfigDbConnectionFactory configFactory,
            ITenantConnectionFactory tenantFactory,
            ITenantProvider tenantProvider,
            IWebHostEnvironment environment,
            IOptions<EditorDatabaseOptions> options,
            ILogger<EditorRepository> logger)
        {
            _configFactory = configFactory;
            _tenantFactory = tenantFactory;
            _tenantProvider = tenantProvider;
            _environment = environment;
            _options = options.Value;
            _logger = logger;
        }

        // ─── Helpers : connexions ────────────────────────────────────────────────

        /// <summary>Connexion vers la base de configuration globale.</summary>
        private IDbConnection ConfigConnection() => _configFactory.CreateConnection();

        /// <summary>
        /// Connexion vers la DB métier du tenant courant ou une DB spécifique.
        /// Lance InvalidOperationException si aucun tenant n'est résolu et databaseName est nul.
        /// </summary>
        private IDbConnection TenantConnection(string? databaseName = null)
            => string.IsNullOrEmpty(databaseName)
                ? _tenantFactory.CreateConnection()
                : _tenantFactory.CreateConnection(databaseName);

        // ─── Schema bootstrap (ConfigDB) ─────────────────────────────────────────

        public async Task EnsureSchemaAsync()
        {
            var schemaPath = Path.Combine(_environment.ContentRootPath, "Database", "EditorSchema.sql");
            if (!File.Exists(schemaPath)) return;

            var sql = await File.ReadAllTextAsync(schemaPath);

            // Apply schema to ConfigDB (for families, templates, graphic_charters, table_view_config, app_settings)
            using var configConnection = ConfigConnection();
            await configConnection.ExecuteAsync(sql);

            // Apply schema to TenantDB (for documents table within organization database)
            try
            {
                using var tenantConnection = TenantConnection();
                await tenantConnection.ExecuteAsync(sql);
            }
            catch
            {
                // TenantDB schema application is non-critical; continue if no tenant is resolved
            }
        }

        // ─── Families (ConfigDB) ─────────────────────────────────────────────────

        public async Task<IEnumerable<FamilyResponse>> LoadFamiliesAsync()
        {
            if (!await ConfigTableExistsAsync("family")) return [];
            var hasBeneficiaryMode = await ConfigTableHasColumnAsync("family", "beneficiary_mode");
            var hasBeneficiaryTable = await ConfigTableHasColumnAsync("family", "beneficiary_table");
            var hasBeneficiaryTableLabel = await ConfigTableHasColumnAsync("family", "beneficiary_table_label");
            var hasBeneficiaryLinkColumn = await ConfigTableHasColumnAsync("family", "beneficiary_link_column");
            var hasBeneficiaryDisplayColumn1 = await ConfigTableHasColumnAsync("family", "beneficiary_display_column_1");
            var hasBeneficiaryDisplayColumn2 = await ConfigTableHasColumnAsync("family", "beneficiary_display_column_2");
            var hasBeneficiarySql = await ConfigTableHasColumnAsync("family", "beneficiary_sql_text");
            var hasFilterCatalog = await ConfigTableHasColumnAsync("family", "filter_catalog_json");
            var hasOrganizationIds = await ConfigTableHasColumnAsync("family", "organization_ids_json");
            var sql = $"""
                SELECT id, nom, description,
                       {(hasBeneficiaryMode ? "beneficiary_mode" : "'table'")} AS beneficiary_mode,
                       {(hasBeneficiaryTable ? "beneficiary_table" : "NULL")} AS beneficiary_table,
                       {(hasBeneficiaryTableLabel ? "beneficiary_table_label" : "NULL")} AS beneficiary_table_label,
                       {(hasBeneficiaryLinkColumn ? "beneficiary_link_column" : "NULL")} AS beneficiary_link_column,
                       {(hasBeneficiaryDisplayColumn1 ? "beneficiary_display_column_1" : "NULL")} AS beneficiary_display_column_1,
                       {(hasBeneficiaryDisplayColumn2 ? "beneficiary_display_column_2" : "NULL")} AS beneficiary_display_column_2,
                       {(hasBeneficiarySql ? "beneficiary_sql_text" : "''")} AS beneficiary_sql_text,
                       {(hasFilterCatalog ? "filter_catalog_json" : "'[]'")} AS filter_catalog_json,
                       {(hasOrganizationIds ? "organization_ids_json" : "'[]'")} AS organization_ids_json,
                       sql_text, created_at, classes_json
                FROM family
                ORDER BY nom
                """;
            using var connection = ConfigConnection();
            var rows = await connection.QueryAsync(sql);
            return rows.Select(row =>
            {
                var item = Row(row);
                var mode = Str(item, "beneficiary_mode") == "organization" ? BeneficiaryMode.Organization : BeneficiaryMode.Table;
                return new FamilyResponse
                {
                    Id = Str(item, "id") ?? string.Empty,
                    OrganizationIds = JsonValue(item, "organization_ids_json", new List<int>()),
                    Nom = Str(item, "nom") ?? string.Empty,
                    Description = Str(item, "description"),
                    BeneficiaryMode = mode,
                    BeneficiaryTable = mode == BeneficiaryMode.Organization ? null : Str(item, "beneficiary_table"),
                    BeneficiaryTableLabel = Str(item, "beneficiary_table_label") ?? string.Empty,
                    BeneficiaryLinkColumn = Str(item, "beneficiary_link_column"),
                    BeneficiaryDisplayColumn1 = Str(item, "beneficiary_display_column_1"),
                    BeneficiaryDisplayColumn2 = Str(item, "beneficiary_display_column_2"),
                    BeneficiarySql = Str(item, "beneficiary_sql_text"),
                    FilterCatalog = JsonValue(item, "filter_catalog_json", new List<FilterDefinition>()),
                    Sql = Str(item, "sql_text"),
                    CreatedAt = Str(item, "created_at"),
                    Classes = JsonValue(item, "classes_json", new List<FamilyClass>())
                };
            });
        }

        public async Task<FamilyResponse?> GetFamilyByIdAsync(string id)
            => (await LoadFamiliesAsync()).FirstOrDefault(item => item.Id == id);

        public async Task<FamilyResponse> UpsertFamilyAsync(FamilyRequest request)
        {
            var family = NormalizeFamily(request);
            using var connection = ConfigConnection();
            await connection.ExecuteAsync("""
                MERGE family AS target
                USING (SELECT @id AS id) AS src ON target.id = src.id
                WHEN MATCHED THEN UPDATE SET nom = @nom, description = @description,
                  beneficiary_mode = @beneficiary_mode, beneficiary_table = @beneficiary_table,
                  beneficiary_table_label = @beneficiary_table_label,
                  beneficiary_link_column = @beneficiary_link_column,
                  beneficiary_display_column_1 = @beneficiary_display_column_1,
                  beneficiary_display_column_2 = @beneficiary_display_column_2,
                  beneficiary_sql_text = @beneficiary_sql_text, filter_catalog_json = @filter_catalog_json,
                  sql_text = @sql_text, classes_json = @classes_json, organization_ids_json = @organization_ids_json
                  WHEN NOT MATCHED THEN INSERT (id, nom, description, beneficiary_mode, beneficiary_table,
                  beneficiary_table_label, beneficiary_link_column, beneficiary_display_column_1,
                  beneficiary_display_column_2, beneficiary_sql_text, filter_catalog_json, sql_text, created_at, classes_json, organization_ids_json)
                  VALUES (@id, @nom, @description, @beneficiary_mode, @beneficiary_table,
                  @beneficiary_table_label, @beneficiary_link_column, @beneficiary_display_column_1,
                  @beneficiary_display_column_2, @beneficiary_sql_text, @filter_catalog_json, @sql_text, @created_at, @classes_json, @organization_ids_json);

                """, FamilyParams(family));
            return (await GetFamilyByIdAsync(family.Id))!;
        }

        public async Task DeleteFamilyAsync(string id)
        {
            using var connection = ConfigConnection();
            await connection.ExecuteAsync(
                "DELETE FROM template WHERE family_id = @id; DELETE FROM family WHERE id = @id",
                new { id });
        }

        // ─── Organizations (AuthDB via cross-db) ─────────────────────────────────

        public async Task<IEnumerable<OrganizationResponse>> LoadOrganizationsAsync()
        {
            try
            {
                using var connection = ConfigConnection();
                var rows = await connection.QueryAsync($"SELECT * FROM {AuthTable("Organization")} ORDER BY 1");
                return rows.Select(row =>
                {
                    var item = Row(row);
                    return new OrganizationResponse
                    {
                        Id = FirstInt(item, "Id", "ID", "id", "OrganizationId", "IdOrganization") ?? 0,
                        Nom = FirstString(item, "NameFr", "Name", "Nom", "Libelle", "Label", "Title", "Acronym") ?? "Organisation",
                        NameFr = FirstString(item, "NameFr"),
                        NameAr = FirstString(item, "NameAr"),
                        Acronym = FirstString(item, "Acronym"),
                        DatabaseName = FirstString(item, "DatabaseName"),
                        OrganizationLogo = FirstString(item, "OrganisationLogo", "OrganizationLogo"),
                        Affiliation = FirstString(item, "Affiliation"),
                        AffiliationLogo = FirstString(item, "AffiliationLogo"),
                        FieldOfActivity = FirstString(item, "FieldOfActivity"),
                        Ville = FirstString(item, "City", "Ville", "Town"),
                        Adresse = FirstString(item, "Adress", "Address", "Adresse", "Address1"),
                        PostalCode = FirstString(item, "PostalCode", "ZipCode", "Postal_Code"),
                        Country = FirstString(item, "Country", "Pays"),
                        Tel = FirstString(item, "Phone", "Telephone", "Tel", "Mobile"),
                        Email = FirstString(item, "Email", "Mail"),
                        PersonToContact = FirstString(item, "PersonToContact", "ContactPerson"),
                        ContactMail = FirstString(item, "ContactMail"),
                        ContactPhone = FirstString(item, "ContactPhone"),
                        ContactPosition = FirstString(item, "ContactPosition"),
                        AccountType = FirstString(item, "AccountType"),
                        AccountStatus = FirstString(item, "AccountStatus"),
                        ParDiffusionEmail = FirstString(item, "ParDiffusionEmail"),
                        ParDiffusionEmailPw = FirstString(item, "ParDiffusionEmailPW"),
                        ParOutgoingMailChar = FirstString(item, "ParOutgoingMailChar"),
                        ParIngoingMailChar = FirstString(item, "ParIngoingMailChar"),
                        OrganizationSystemPrefix = FirstString(item, "OrganizationSystemPrefix"),
                        MailSignature = FirstString(item, "MailSignature"),
                        NameUniversityFr = FirstString(item, "NameUniversityFr"),
                        NameUniversityAr = FirstString(item, "NameUniversityAr"),
                        NameMinisterFr = FirstString(item, "NameMinisterFr"),
                        NameMinisterAr = FirstString(item, "NameMinisterAr"),
                        Raw = CleanRow(row),
                        GraphicCharters = [],
                        CreatedAt = FormatValue(FirstObject(item, "CreatedAt", "CreatedDate")),
                        UpdatedAt = FormatValue(FirstObject(item, "UpdatedAt", "ModifiedDate"))
                    };
                });
            }
            catch
            {
                return [];
            }
        }

        // ─── Admins (AuthDB via cross-db) ────────────────────────────────────────

        public async Task<IEnumerable<AdminResponse>> LoadAdminsAsync()
        {
            try
            {
                using var connection = ConfigConnection();
                var rows = await connection.QueryAsync($"""
                    SELECT *
                    FROM {AuthTable("User")}
                    WHERE LOWER(Role) IN ('admin', 'supadmin', 'superadmin')
                    ORDER BY Name
                    """);

                return rows.Select(row =>
                {
                    var item = Row(row);
                    return new AdminResponse
                    {
                        Id = FirstString(item, "Id", "ID", "id") ?? string.Empty,
                        OrganizationId = FirstInt(item, "IdOrganization", "OrganizationId", "organizationId"),
                        Nom = FirstString(item, "Name", "Nom", "Username") ?? string.Empty,
                        Email = FirstString(item, "Email", "Mail") ?? string.Empty,
                        Role = FirstString(item, "Role", "role") ?? "admin",
                        Profile = FirstString(item, "Profil", "Profile"),
                        ProfileDetail = FirstString(item, "ProfilDetail", "ProfileDetail"),
                        AccessAllYears = FirstBool(item, "AccessAllYears"),
                        AccessYearList = FirstString(item, "AccessYearList"),
                        CreatedAt = FormatValue(FirstObject(item, "AccountCreationDate", "CreatedAt")),
                        Raw = CleanRow(row)
                    };
                });
            }
            catch
            {
                return [];
            }
        }

        // ─── GraphicCharters (ConfigDB) ──────────────────────────────────────────

        public async Task<IEnumerable<GraphicCharterResponse>> LoadGraphicChartersAsync()
        {
            if (!await ConfigTableExistsAsync("graphic_charter")) return [];
            using var connection = ConfigConnection();
            var rows = await connection.QueryAsync("""
                SELECT id, etablissement_id, nom, description, is_default, config_json, created_at, updated_at
                FROM graphic_charter
                ORDER BY etablissement_id, is_default DESC, nom ASC
                """);
            return rows.Select(row =>
            {
                var item = Row(row);
                return new GraphicCharterResponse
                {
                    Id = Str(item, "id") ?? string.Empty,
                    OrganizationId = IntOrNull(item, "etablissement_id"),
                    Name = Str(item, "nom") ?? string.Empty,
                    Description = Str(item, "description") ?? string.Empty,
                    IsDefault = Bool(item, "is_default"),
                    Config = JsonValue(item, "config_json", new GraphicCharterConfig()),
                    CreatedAt = Str(item, "created_at"),
                    UpdatedAt = Str(item, "updated_at")
                };
            });
        }

        public async Task<GraphicCharterResponse?> GetGraphicCharterByIdAsync(string id)
            => (await LoadGraphicChartersAsync()).FirstOrDefault(item => item.Id == id);

        public async Task<GraphicCharterResponse> UpsertGraphicCharterAsync(GraphicCharterRequest request)
        {
            var graphicCharter = NormalizeGraphicCharter(request);
            using var connection = ConfigConnection();
            await connection.ExecuteAsync("""
                MERGE graphic_charter AS target
                USING (SELECT @id AS id) AS src ON target.id = src.id
                WHEN MATCHED THEN UPDATE SET etablissement_id = @etablissement_id, nom = @nom,
                  description = @description, is_default = @is_default, config_json = @config_json,
                  updated_at = @updated_at
                WHEN NOT MATCHED THEN INSERT (id, etablissement_id, nom, description, is_default, config_json, created_at, updated_at)
                  VALUES (@id, @etablissement_id, @nom, @description, @is_default, @config_json, @created_at, @updated_at);
                """, GraphicCharterParams(graphicCharter));
            return (await GetGraphicCharterByIdAsync(graphicCharter.Id))!;
        }

        public async Task DeleteGraphicCharterAsync(string id)
        {
            using var connection = ConfigConnection();
            await connection.ExecuteAsync(
                "UPDATE template SET graphic_charter_id = NULL WHERE graphic_charter_id = @id; DELETE FROM graphic_charter WHERE id = @id",
                new { id });
        }

        // ─── Templates (ConfigDB) ────────────────────────────────────────────────

        public async Task<IEnumerable<TemplateResponse>> LoadTemplatesAsync()
        {
            if (!await ConfigTableExistsAsync("template")) return [];
            var hasGraphicCharterId = await ConfigTableHasColumnAsync("template", "graphic_charter_id");
            var hasOrientation = await ConfigTableHasColumnAsync("template", "orientation");
            var hasFilterProfile = await ConfigTableHasColumnAsync("template", "filter_profile_json");
            var hasSectionDirections = await ConfigTableHasColumnAsync("template", "section_directions_json");
            var hasHeaderFooterDistances = await ConfigTableHasColumnAsync("template", "header_footer_distances_json");
            var hasHeaderDisplay = await ConfigTableHasColumnAsync("template", "header_display");
            var hasFooterDisplay = await ConfigTableHasColumnAsync("template", "footer_display");
            var sql = $"""
                SELECT id, family_id, etablissement_id, nom, updated_at, has_header, has_footer,
                       {(hasGraphicCharterId ? "graphic_charter_id" : "NULL")} AS graphic_charter_id,
                       {(hasOrientation ? "orientation" : "'portrait'")} AS orientation,
                       {(hasFilterProfile ? "filter_profile_json" : "'[]'")} AS filter_profile_json,
                       {(hasSectionDirections ? "section_directions_json" : "'{}'")} AS section_directions_json,
                       {(hasHeaderFooterDistances ? "header_footer_distances_json" : "'{}'")} AS header_footer_distances_json,
                       {(hasHeaderDisplay ? "header_display" : "'all'")} AS header_display,
                       {(hasFooterDisplay ? "footer_display" : "'all'")} AS footer_display,
                       page_margins_json,
                       header_html, body_html, footer_html
                FROM template
                ORDER BY updated_at DESC, nom ASC
                """;
            using var connection = ConfigConnection();
            var rows = await connection.QueryAsync(sql);
            return rows.Select(row =>
            {
                var item = Row(row);
                return new TemplateResponse
                {
                    Id = Str(item, "id") ?? string.Empty,
                    FamilyId = Str(item, "family_id") ?? string.Empty,
                    OrganizationId = IntOrNull(item, "etablissement_id"),
                    Nom = Str(item, "nom") ?? string.Empty,
                    UpdatedAt = Str(item, "updated_at"),
                    HasHeader = Bool(item, "has_header"),
                    HasFooter = Bool(item, "has_footer"),
                    GraphicCharterId = StrOrNull(item, "graphic_charter_id"),
                    FilterProfile = JsonValue(item, "filter_profile_json", new List<TemplateFilterProfileEntry>()),
                    SectionDirections = JsonValue(item, "section_directions_json", new SectionDirections()),
                    HeaderFooterDistances = JsonValue(item, "header_footer_distances_json", new HeaderFooterDistances()),
                    Orientation = ParseOrientation(Str(item, "orientation")),
                    HeaderDisplay = ParseSectionDisplayMode(Str(item, "header_display")),
                    FooterDisplay = ParseSectionDisplayMode(Str(item, "footer_display")),
                    PageMargins = JsonValue(item, "page_margins_json", new PageMargins()),
                    Header = Str(item, "header_html") ?? string.Empty,
                    Body = Str(item, "body_html") ?? string.Empty,
                    Footer = Str(item, "footer_html") ?? string.Empty
                };
            });
        }

        public async Task<TemplateResponse?> GetTemplateByIdAsync(string id)
            => (await LoadTemplatesAsync()).FirstOrDefault(item => item.Id == id);

        public async Task<TemplateResponse> UpsertTemplateAsync(TemplateRequest request)
        {
            var template = NormalizeTemplate(request);
            using var connection = ConfigConnection();
            await connection.ExecuteAsync("""
                MERGE template AS target
                USING (SELECT @id AS id) AS src ON target.id = src.id
                WHEN MATCHED THEN UPDATE SET family_id = @family_id, etablissement_id = @etablissement_id,
                  graphic_charter_id = @graphic_charter_id, nom = @nom, updated_at = @updated_at,
                  has_header = @has_header, has_footer = @has_footer, orientation = @orientation,
                  filter_profile_json = @filter_profile_json, section_directions_json = @section_directions_json,
                                    page_margins_json = @page_margins_json, header_footer_distances_json = @header_footer_distances_json,
                                    header_display = @header_display, footer_display = @footer_display,
                                    header_html = @header_html, body_html = @body_html, footer_html = @footer_html
                WHEN NOT MATCHED THEN INSERT (id, family_id, etablissement_id, graphic_charter_id, nom, updated_at,
                  has_header, has_footer, orientation, filter_profile_json, section_directions_json,
                                    page_margins_json, header_footer_distances_json, header_display, footer_display,
                                    header_html, body_html, footer_html)
                  VALUES (@id, @family_id, @etablissement_id, @graphic_charter_id, @nom, @updated_at,
                  @has_header, @has_footer, @orientation, @filter_profile_json, @section_directions_json,
                                    @page_margins_json, @header_footer_distances_json, @header_display, @footer_display,
                                    @header_html, @body_html, @footer_html);
                """, TemplateParams(template, template.OrganizationId));
            return (await GetTemplateByIdAsync(template.Id))!;
        }

        public async Task DeleteTemplateAsync(string id)
        {
            using var connection = ConfigConnection();
            await connection.ExecuteAsync("DELETE FROM template WHERE id = @id", new { id });
        }

        // ─── TableViewConfig (ConfigDB) ──────────────────────────────────────────

        public async Task<IEnumerable<TableViewConfigResponse>> LoadTableViewsAsync()
        {
            if (!await ConfigTableExistsAsync("table_view_config")) return [];
            var hasFieldSettings = await ConfigTableHasColumnAsync("table_view_config", "field_settings_json");
            var hasFieldLabels = await ConfigTableHasColumnAsync("table_view_config", "field_labels_json");
            var hasOrganizationIds = await ConfigTableHasColumnAsync("table_view_config", "organization_ids_json");
            var hasFilters = await ConfigTableHasColumnAsync("table_view_config", "filters_json");
            var sql = $"""
                SELECT id, table_name, label, visible_fields_json, editable_fields_json,
                       preview_fields_json,
                       {(hasFieldLabels ? "field_labels_json" : "'{}'")} AS field_labels_json,
                       {(hasFieldSettings ? "field_settings_json" : "'{}'")} AS field_settings_json,
                       {(hasFilters ? "filters_json" : "'[]'")} AS filters_json,
                       {(hasOrganizationIds ? "organization_ids_json" : "'[]'")} AS organization_ids_json,
                       created_at, updated_at
                FROM table_view_config
                ORDER BY label ASC, table_name ASC
                """;
            using var connection = ConfigConnection();
            var rows = await connection.QueryAsync(sql);
            return rows.Select(row =>
            {
                var item = Row(row);
                return new TableViewConfigResponse
                {
                    Id = Str(item, "id") ?? string.Empty,
                    OrganizationIds = JsonValue(item, "organization_ids_json", new List<int>()),
                    TableName = Str(item, "table_name") ?? string.Empty,
                    Label = Str(item, "label") ?? string.Empty,
                    VisibleFields = JsonValue(item, "visible_fields_json", new List<string>()),
                    EditableFields = JsonValue(item, "editable_fields_json", new List<string>()),
                    PreviewFields = JsonValue(item, "preview_fields_json", new List<string>()),
                    FieldLabels = JsonValue(item, "field_labels_json", new Dictionary<string, string>()),
                    FieldSettings = JsonValue(item, "field_settings_json", new Dictionary<string, TableViewFieldSetting>()),
                    Filters = JsonValue(item, "filters_json", new List<TableViewFilter>()),
                    CreatedAt = Str(item, "created_at"),
                    UpdatedAt = Str(item, "updated_at")
                };
            });
        }

        public async Task<TableViewConfigResponse?> GetTableViewConfigByIdAsync(string id)
            => (await LoadTableViewsAsync()).FirstOrDefault(item => item.Id == id);

        public async Task<TableViewConfigResponse> UpsertTableViewConfigAsync(TableViewConfigRequest request)
        {
            var normalized = NormalizeTableView(request);
            using var connection = ConfigConnection();
            await connection.ExecuteAsync("""
                MERGE table_view_config AS target
                USING (SELECT @id AS id) AS src ON target.id = src.id
                WHEN MATCHED THEN UPDATE SET table_name = @table_name, label = @label,
                  visible_fields_json = @visible_fields_json, editable_fields_json = @editable_fields_json,
                  preview_fields_json = @preview_fields_json, field_labels_json = @field_labels_json, 
                  field_settings_json = @field_settings_json, filters_json = @filters_json, 
                  organization_ids_json = @organization_ids_json, updated_at = @updated_at
                WHEN NOT MATCHED THEN INSERT (id, table_name, label, visible_fields_json, editable_fields_json, preview_fields_json, field_labels_json, field_settings_json, filters_json, organization_ids_json, created_at, updated_at)
                  VALUES (@id, @table_name, @label, @visible_fields_json, @editable_fields_json, @preview_fields_json, @field_labels_json, @field_settings_json, @filters_json, @organization_ids_json, @created_at, @updated_at);
                """, TableViewParams(normalized));
            return normalized;
        }

        public async Task DeleteTableViewConfigAsync(string? id)
        {
            using var connection = ConfigConnection();
            await connection.ExecuteAsync("DELETE FROM table_view_config WHERE id = @id", new { id });
        }

        // ─── AppSettings (ConfigDB) ──────────────────────────────────────────────

        public async Task<Dictionary<string, object?>> LoadSettingsAsync()
        {
            if (!await ConfigTableExistsAsync("app_setting")) return [];
            using var connection = ConfigConnection();
            var rows = await connection.QueryAsync("SELECT [key], value_json FROM app_setting");
            var settings = new Dictionary<string, object?>();
            foreach (var row in rows)
            {
                var item = Row(row);
                settings[Str(item, "key") ?? string.Empty] = ParseJsonValue(Str(item, "value_json"));
            }
            return settings;
        }

        public async Task<AcademicYearConfigResponse?> GetAcademicYearConfigAsync(int organizationId)
        {
            var configs = await LoadAcademicYearConfigsAsync();
            return configs.FirstOrDefault(config => config.OrganizationId == organizationId);
        }

        public async Task<AcademicYearConfigResponse> UpsertAcademicYearConfigAsync(AcademicYearConfigRequest request)
        {
            var configs = (await LoadAcademicYearConfigsAsync()).ToList();
            configs.RemoveAll(config => config.OrganizationId == request.OrganizationId);
            var next = new AcademicYearConfigResponse
            {
                OrganizationId = request.OrganizationId,
                AffectedTables = request.AffectedTables
                    .Where(item => IsSafeIdentifier(item.TableName) && IsSafeIdentifier(item.YearColumn))
                    .Select(item => new AcademicYearAffectedTableConfig
                    {
                        TableName = item.TableName,
                        YearColumn = item.YearColumn
                    })
                    .ToList(),
                UpdatedAt = DateTimeOffset.UtcNow.ToString("O")
            };
            configs.Add(next);
            await UpsertSettingAsync(AcademicYearConfigsSettingKey, configs.OrderBy(config => config.OrganizationId).ToArray());
            return next;
        }

        public async Task<IEnumerable<AcademicYearResponse>> LoadAcademicYearsAsync()
        {
            await EnsureAcademicYearTableIsValidAsync();
            var select = new List<string>
            {
                $"{Quote(AcademicYearCodeColumn)} AS Code",
                $"{Quote(AcademicYearStartDateColumn)} AS StartDate",
                $"{Quote(AcademicYearEndDateColumn)} AS EndDate",
                $"{Quote(AcademicYearStatusColumn)} AS Status"
            };

            using var connection = TenantConnection();
            var rows = await connection.QueryAsync(
                $"SELECT {string.Join(", ", select)} FROM {Quote(AcademicYearTable)} ORDER BY {Quote(AcademicYearCodeColumn)} DESC");

            return rows.Select(row =>
            {
                var item = Row(row);
                var status = Str(item, "Status");
                return new AcademicYearResponse
                {
                    Code = Str(item, "Code") ?? string.Empty,
                    StartDate = DateString(item, "StartDate"),
                    EndDate = DateString(item, "EndDate"),
                    Status = status,
                    IsClosed = IsClosedStatus(status)
                };
            }).Where(item => !string.IsNullOrWhiteSpace(item.Code)).ToArray();
        }

        public async Task<AcademicYearResponse> CreateAcademicYearAsync(AcademicYearCreateRequest request)
        {
            await EnsureAcademicYearTableIsValidAsync();
            var parameters = new DynamicParameters();
            parameters.Add("code", request.Code);
            parameters.Add("startDate", NormalizeParameterValue(request.StartDate));
            parameters.Add("endDate", NormalizeParameterValue(request.EndDate));
            parameters.Add("status", request.Status);

            using var connection = TenantConnection();
            await connection.ExecuteAsync(
                $"""
                INSERT INTO {Quote(AcademicYearTable)}
                    ({Quote(AcademicYearCodeColumn)}, {Quote(AcademicYearStartDateColumn)}, {Quote(AcademicYearEndDateColumn)}, {Quote(AcademicYearStatusColumn)})
                VALUES (@code, @startDate, @endDate, @status)
                """,
                parameters);

            return (await LoadAcademicYearsAsync()).First(year => string.Equals(year.Code, request.Code, StringComparison.OrdinalIgnoreCase));
        }

        public async Task CloseAcademicYearAsync(string code)
        {
            await EnsureAcademicYearTableIsValidAsync();

            using var connection = TenantConnection();
            await connection.ExecuteAsync(
                $"UPDATE {Quote(AcademicYearTable)} SET {Quote(AcademicYearStatusColumn)} = @status WHERE {Quote(AcademicYearCodeColumn)} = @code",
                new { status = "Cloturee", code });
        }

        // ─── LoadSchema (TenantDB) ────────────────────────────────────────────────

        public async Task<DatabaseSchemaResponse> LoadSchemaAsync(string? databaseName = null)
        {
            using var connection = TenantConnection(databaseName);
            var tables = await connection.QueryAsync<DatabaseTableInfo>("""
                SELECT t.TABLE_NAME AS name, ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS comment
                FROM INFORMATION_SCHEMA.TABLES t
                LEFT JOIN sys.extended_properties ep ON ep.major_id = OBJECT_ID(t.TABLE_NAME) AND ep.minor_id = 0 AND ep.name = 'MS_Description'
                WHERE t.TABLE_TYPE = 'BASE TABLE'
                ORDER BY t.TABLE_NAME
                """);
            var columns = await connection.QueryAsync<DatabaseColumnInfo>("""
                SELECT c.TABLE_NAME AS [table], c.COLUMN_NAME AS name, c.DATA_TYPE AS type,
                       ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS comment,
                       CASE WHEN c.IS_NULLABLE = 'YES' THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS nullable,
                       CASE WHEN kcu.COLUMN_NAME IS NOT NULL THEN 'PRI' ELSE '' END AS [key]
                FROM INFORMATION_SCHEMA.COLUMNS c
                LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON kcu.TABLE_NAME = c.TABLE_NAME AND kcu.COLUMN_NAME = c.COLUMN_NAME
                LEFT JOIN sys.extended_properties ep ON ep.major_id = OBJECT_ID(c.TABLE_NAME)
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(c.TABLE_NAME), c.COLUMN_NAME, 'ColumnId')
                 AND ep.name = 'MS_Description'
                ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
                """);
            var relations = await connection.QueryAsync<DatabaseRelationInfo>("""
                SELECT fk_tab.name AS [table], fk_col.name AS [column], pk_tab.name AS referencedTable, pk_col.name AS referencedColumn
                FROM sys.foreign_key_columns fkc
                JOIN sys.tables fk_tab ON fkc.parent_object_id = fk_tab.object_id
                JOIN sys.columns fk_col ON fkc.parent_object_id = fk_col.object_id AND fkc.parent_column_id = fk_col.column_id
                JOIN sys.tables pk_tab ON fkc.referenced_object_id = pk_tab.object_id
                JOIN sys.columns pk_col ON fkc.referenced_object_id = pk_col.object_id AND fkc.referenced_column_id = pk_col.column_id
                ORDER BY fk_tab.name
                """);
            return new DatabaseSchemaResponse
            {
                Tables = tables.ToArray(),
                Columns = columns.ToArray(),
                Relations = relations.ToArray()
            };
        }

        // ─── ReplaceState (ConfigDB — données config) ────────────────────────────

        public async Task ReplaceStateAsync(EditorStateResponse state, int? scopedOrganizationId, bool isSuperAdmin)
        {
            using var connection = ConfigConnection();
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                if (isSuperAdmin)
                {
                    await connection.ExecuteAsync(
                        "DELETE FROM graphic_charter; DELETE FROM template; DELETE FROM family; DELETE FROM table_view_config; DELETE FROM app_setting;",
                        transaction: transaction);
                    await SaveSettingsAsync(connection, transaction, state.Settings);
                    foreach (var family in state.Families) await InsertFamilyAsync(connection, transaction, family);
                    foreach (var tableView in state.TableViews) await InsertTableViewAsync(connection, transaction, tableView);
                }
                else
                {
                    if (scopedOrganizationId == null)
                        throw new InvalidOperationException("Organisation admin introuvable pour la sauvegarde.");
                    await connection.ExecuteAsync(
                        "DELETE FROM graphic_charter WHERE etablissement_id = @OrgId; DELETE FROM template WHERE etablissement_id = @OrgId;",
                        new { OrgId = scopedOrganizationId }, transaction);
                }

                foreach (var organization in state.Organizations)
                {
                    if (!isSuperAdmin && organization.Id != scopedOrganizationId) continue;
                    foreach (var charter in organization.GraphicCharters)
                        await InsertGraphicCharterAsync(connection, transaction, charter, organization.Id);
                }

                foreach (var template in state.Templates)
                {
                    var organizationId = template.OrganizationId ?? scopedOrganizationId;
                    if (!isSuperAdmin && organizationId != scopedOrganizationId) continue;
                    await InsertTemplateAsync(connection, transaction, template, organizationId);
                }

                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        // ─── RunSelectQuery (TenantDB — données métier) ──────────────────────────

        public async Task<IEnumerable<IDictionary<string, object?>>> RunSelectQueryAsync(string sql, Dictionary<string, object?> parameters, string? databaseName = null)
        {
            var cleaned = NormalizeSelectQueryForSqlServer((sql ?? string.Empty).Trim().TrimEnd(';'));
            if (!IsSelectQuery(cleaned))
            {
                try { _logger.LogWarning("Rejected non-SELECT query: {Sql}", sql); } catch { }
                throw new InvalidOperationException("Seules les requetes SELECT sont autorisees.");
            }
            var dynamicParameters = new DynamicParameters();
            if (!parameters.ContainsKey("organizationId")) parameters["organizationId"] = null;
            if (!parameters.ContainsKey("academicYear")) parameters["academicYear"] = _tenantProvider.GetAcademicYearCode();
            cleaned = CompileNamedParameters(cleaned, parameters, dynamicParameters);
            cleaned = await ApplyAutomaticAcademicYearFilterAsync(cleaned, dynamicParameters, parameters, databaseName);
            _logger.LogInformation("Query final SQL after academic year injection. Sql: {Sql} Params: {Params}", cleaned, JsonSerializer.Serialize(dynamicParameters.ParameterNames.ToDictionary(name => name, name => dynamicParameters.Get<object?>(name))));

            using var connection = TenantConnection(databaseName);
            return (await connection.QueryAsync(cleaned, dynamicParameters))
                .Select(row => (IDictionary<string, object?>)CleanRow(row))
                .ToArray();
        }

        // ─── GetTableViewRows (TenantDB — données métier) ────────────────────────

        public async Task<IEnumerable<IDictionary<string, object?>>> GetTableViewRowsAsync(string? configId, string? search, TableViewConfigRequest? config, string? databaseName = null, Dictionary<string, List<string>>? selectedFilters = null)
        {
            var tableView = await ResolveTableViewAsync(configId, config)
                ?? throw new InvalidOperationException("Configuration introuvable.");
            if (string.IsNullOrWhiteSpace(tableView.TableName) || !await TenantTableExistsAsync(tableView.TableName, databaseName)) return [];

            var columns = await GetTenantColumnsAsync(tableView.TableName, databaseName);
            var pk = await GetRowKeyAsync(tableView.TableName, columns, useTenant: true, databaseName: databaseName);
            var allowed = columns.Select(c => c.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var previewFields = tableView.PreviewFields.Where(allowed.Contains).ToArray();
            var selectFields = new[] { pk }
                .Concat(tableView.VisibleFields)
                .Concat(tableView.EditableFields)
                .Concat(previewFields)
                .Where(allowed.Contains)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            if (selectFields.Length == 0) return [];

            var parameters = new DynamicParameters();
            
            var whereClauses = new List<string>();
            if (!string.IsNullOrWhiteSpace(search) && previewFields.Length > 0)
            {
                parameters.Add("search", $"%{search}%");
                whereClauses.Add("(" + string.Join(" OR ", previewFields.Select(field => $"CONVERT(NVARCHAR(MAX), {Quote(field)}) LIKE @search")) + ")");
            }

            if (selectedFilters != null && selectedFilters.Any())
            {
                foreach (var filterPair in selectedFilters)
                {
                    var filterDef = tableView.Filters.FirstOrDefault(f => f.Id == filterPair.Key);
                    if (filterDef != null && !string.IsNullOrWhiteSpace(filterDef.LinkColumn) && filterPair.Value.Any())
                    {
                        var paramName = $"filter_{filterDef.Id.Replace("-", "_")}";
                        parameters.Add(paramName, filterPair.Value);
                        whereClauses.Add($"{Quote(filterDef.LinkColumn)} IN @{paramName}");
                    }
                }
            }

            var academicYearFilter = await GetAcademicYearFilterAsync(tableView.TableName, databaseName);
            if (academicYearFilter is not null)
            {
                parameters.Add("academicYearCode", academicYearFilter.Value.YearCode);
                whereClauses.Add($"{Quote(academicYearFilter.Value.ColumnName)} = @academicYearCode");
            }

            var where = whereClauses.Any() ? "WHERE " + string.Join(" AND ", whereClauses) : "";

            using var connection = TenantConnection(databaseName);
            var rows = await connection.QueryAsync(
                $"SELECT {string.Join(", ", selectFields.Select(Quote))} FROM {Quote(tableView.TableName)} {where} ORDER BY {Quote(pk)} DESC",
                parameters);
            return rows.Select(row => (IDictionary<string, object?>)CleanRow(row)).ToArray();
        }

        public async Task<IDictionary<string, object?>?> GetTableViewRecordAsync(string? configId, string? rowId, string? databaseName = null)
        {
            var tableView = await ResolveTableViewAsync(configId, null)
                ?? throw new InvalidOperationException("Configuration introuvable.");
            if (string.IsNullOrWhiteSpace(tableView.TableName) || !await TenantTableExistsAsync(tableView.TableName, databaseName)) return null;

            var columns = await GetTenantColumnsAsync(tableView.TableName, databaseName);
            var pk = await GetRowKeyAsync(tableView.TableName, columns, useTenant: true, databaseName: databaseName);
            var allowed = columns.Select(c => c.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var selectFields = new[] { pk }
                .Concat(tableView.VisibleFields)
                .Concat(tableView.EditableFields)
                .Where(allowed.Contains)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            if (selectFields.Length == 0) return null;

            var parameters = new DynamicParameters();
            parameters.Add("rowId", NormalizeParameterValue(rowId));
            var where = new List<string> { $"{Quote(pk)} = @rowId" };
            var academicYearFilter = await GetAcademicYearFilterAsync(tableView.TableName, databaseName);
            if (academicYearFilter is not null)
            {
                parameters.Add("academicYearCode", academicYearFilter.Value.YearCode);
                where.Add($"{Quote(academicYearFilter.Value.ColumnName)} = @academicYearCode");
            }

            using var connection = TenantConnection(databaseName);
            var row = await connection.QueryFirstOrDefaultAsync(
                $"SELECT TOP (1) {string.Join(", ", selectFields.Select(Quote))} FROM {Quote(tableView.TableName)} WHERE {string.Join(" AND ", where)}",
                parameters);
            return row is null ? null : CleanRow(row);
        }

        public async Task<IDictionary<string, object?>?> UpdateTableViewRecordAsync(string? configId, string? rowId, Dictionary<string, object?> values, string? databaseName = null)
        {
            var tableView = await ResolveTableViewAsync(configId, null)
                ?? throw new InvalidOperationException("Configuration introuvable.");
            if (string.IsNullOrWhiteSpace(tableView.TableName) || !await TenantTableExistsAsync(tableView.TableName, databaseName)) return null;
            await EnsureCurrentAcademicYearIsWritableAsync(tableView.TableName, databaseName);

            var editable = tableView.EditableFields.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var tableColumns = await GetTenantColumnsAsync(tableView.TableName, databaseName);
            var columns = tableColumns.Where(column => editable.Contains(column.Name) && values.ContainsKey(column.Name)).ToArray();
            var normalizedRowId = NormalizeParameterValue(rowId);
            if (columns.Length > 0)
            {
                var parameters = new DynamicParameters();
                parameters.Add("rowId", normalizedRowId);
                foreach (var column in columns)
                {
                    var raw = values.TryGetValue(column.Name, out var v) ? v : null;
                    parameters.Add(column.Name, NormalizeParameterValue(raw));
                }
                using var connection = TenantConnection(databaseName);
                var pk = await GetRowKeyAsync(tableView.TableName, tableColumns, useTenant: true, databaseName: databaseName);
                var where = new List<string> { $"{Quote(pk)} = @rowId" };
                var academicYearFilter = await GetAcademicYearFilterAsync(tableView.TableName, databaseName);
                if (academicYearFilter is not null)
                {
                    parameters.Add("academicYearCode", academicYearFilter.Value.YearCode);
                    where.Add($"{Quote(academicYearFilter.Value.ColumnName)} = @academicYearCode");
                }
                await connection.ExecuteAsync(
                    $"UPDATE {Quote(tableView.TableName)} SET {string.Join(", ", columns.Select(c => $"{Quote(c.Name)} = @{c.Name}"))} WHERE {string.Join(" AND ", where)}",
                    parameters);
            }
            return await GetTableViewRecordAsync(configId, normalizedRowId?.ToString(), databaseName);
        }

        public async Task<IDictionary<string, object?>?> CreateTableViewRecordAsync(string? configId, Dictionary<string, object?> values, TableViewConfigRequest? config, string? databaseName = null)
        {
            var tableView = await ResolveTableViewAsync(configId, config)
                ?? throw new InvalidOperationException("Configuration introuvable.");
            if (string.IsNullOrWhiteSpace(tableView.TableName) || !await TenantTableExistsAsync(tableView.TableName, databaseName)) return null;
            await EnsureCurrentAcademicYearIsWritableAsync(tableView.TableName, databaseName);

            var editable = tableView.EditableFields.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var tableColumns = await GetTenantColumnsAsync(tableView.TableName, databaseName);
            var columns = tableColumns.Where(column => editable.Contains(column.Name) && !column.IsIdentity && values.ContainsKey(column.Name)).ToList();
            var academicYearFilter = await GetAcademicYearFilterAsync(tableView.TableName, databaseName);
            if (academicYearFilter is not null
                && !columns.Any(column => string.Equals(column.Name, academicYearFilter.Value.ColumnName, StringComparison.OrdinalIgnoreCase)))
            {
                var yearColumn = tableColumns.FirstOrDefault(column => string.Equals(column.Name, academicYearFilter.Value.ColumnName, StringComparison.OrdinalIgnoreCase));
                if (yearColumn is not null && !yearColumn.IsIdentity) columns.Add(yearColumn);
            }
            var pk = await GetRowKeyAsync(tableView.TableName, tableColumns, useTenant: true, databaseName: databaseName);
            var parameters = new DynamicParameters();
            var normalizedValues = new Dictionary<string, object?>();
            foreach (var column in columns)
            {
                var raw = academicYearFilter is not null
                    && string.Equals(column.Name, academicYearFilter.Value.ColumnName, StringComparison.OrdinalIgnoreCase)
                    ? academicYearFilter.Value.YearCode
                    : values.TryGetValue(column.Name, out var v) ? v : null;
                var norm = NormalizeParameterValue(raw);
                normalizedValues[column.Name] = norm;
                parameters.Add(column.Name, norm);
            }
            var insertSql = columns.Count == 0
                ? $"INSERT INTO {Quote(tableView.TableName)} OUTPUT INSERTED.{Quote(pk)} AS inserted_id DEFAULT VALUES"
                : $"INSERT INTO {Quote(tableView.TableName)} ({string.Join(", ", columns.Select(c => Quote(c.Name)))}) OUTPUT INSERTED.{Quote(pk)} AS inserted_id VALUES ({string.Join(", ", columns.Select(c => "@" + c.Name))})";

            try { _logger.LogDebug("CreateTableViewRecord SQL: {Sql}", insertSql); } catch { }

            using var connection = TenantConnection(databaseName);
            var insertedId = await connection.ExecuteScalarAsync<object>(insertSql, parameters);
            return await GetTableViewRecordAsync(tableView.Id, insertedId?.ToString(), databaseName);
        }

        public async Task DeleteTableViewRecordAsync(string? configId, string? rowId, string? databaseName = null)
        {
            var tableView = await ResolveTableViewAsync(configId, null)
                ?? throw new InvalidOperationException("Configuration introuvable.");
            if (string.IsNullOrWhiteSpace(tableView.TableName) || !await TenantTableExistsAsync(tableView.TableName, databaseName)) return;
            await EnsureCurrentAcademicYearIsWritableAsync(tableView.TableName, databaseName);

            var pk = await GetRowKeyAsync(tableView.TableName, await GetTenantColumnsAsync(tableView.TableName, databaseName), useTenant: true, databaseName: databaseName);
            var parameters = new DynamicParameters();
            parameters.Add("rowId", NormalizeParameterValue(rowId));
            var where = new List<string> { $"{Quote(pk)} = @rowId" };
            var academicYearFilter = await GetAcademicYearFilterAsync(tableView.TableName, databaseName);
            if (academicYearFilter is not null)
            {
                parameters.Add("academicYearCode", academicYearFilter.Value.YearCode);
                where.Add($"{Quote(academicYearFilter.Value.ColumnName)} = @academicYearCode");
            }
            using var connection = TenantConnection(databaseName);
            await connection.ExecuteAsync(
                $"DELETE FROM {Quote(tableView.TableName)} WHERE {string.Join(" AND ", where)}",
                parameters);
        }

        public async Task<IEnumerable<LookupOptionResponse>> GetLookupOptionsAsync(string? configId, string? fieldName, TableViewConfigRequest? config, string? databaseName = null)
        {
            var tableView = await ResolveTableViewAsync(configId, config)
                ?? throw new InvalidOperationException("Configuration introuvable.");
            if (string.IsNullOrWhiteSpace(fieldName)
                || !tableView.FieldSettings.TryGetValue(fieldName, out var field)
                || field.DisplayMode != TableViewDisplayMode.Lookup) return [];

            var table = field.LookupTable;
            var valueColumn = field.LookupValueColumn;
            var labelColumn = field.LookupLabelColumn;
            var labelColumn2 = field.LookupLabelColumn2;
            if (string.IsNullOrWhiteSpace(table) || string.IsNullOrWhiteSpace(valueColumn) || string.IsNullOrWhiteSpace(labelColumn)) return [];
            if (!await TenantTableExistsAsync(table, databaseName)) return [];

            var lookupColumns = (await GetTenantColumnsAsync(table, databaseName)).Select(c => c.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (!lookupColumns.Contains(valueColumn) || !lookupColumns.Contains(labelColumn)) return [];
            if (!string.IsNullOrWhiteSpace(labelColumn2) && !lookupColumns.Contains(labelColumn2)) return [];

            using var connection = TenantConnection(databaseName);
            var labelExpr = string.IsNullOrWhiteSpace(labelColumn2)
                ? $"CONVERT(NVARCHAR(4000), {Quote(labelColumn)})"
                : $"LTRIM(RTRIM(CONCAT(CONVERT(NVARCHAR(4000), {Quote(labelColumn)}), ' ', CONVERT(NVARCHAR(4000), {Quote(labelColumn2)}))))";
            var parameters = new DynamicParameters();
            var where = new List<string> { $"{Quote(valueColumn)} IS NOT NULL" };
            var academicYearFilter = await GetAcademicYearFilterAsync(table, databaseName);
            if (academicYearFilter is not null)
            {
                parameters.Add("academicYearCode", academicYearFilter.Value.YearCode);
                where.Add($"{Quote(academicYearFilter.Value.ColumnName)} = @academicYearCode");
            }
            var rows = await connection.QueryAsync(
                $"SELECT CONVERT(NVARCHAR(4000), {Quote(valueColumn)}) AS value, {labelExpr} AS label FROM {Quote(table)} WHERE {string.Join(" AND ", where)} ORDER BY {labelExpr} ASC",
                parameters);
            return rows.Select(row =>
            {
                var item = Row(row);
                return new LookupOptionResponse { Value = Str(item, "value") ?? string.Empty, Label = Str(item, "label") ?? string.Empty };
            });
        }

        // ─── Documents (TenantDB - Organization Database) ─────────────────────────

        public async Task<IEnumerable<DocumentResponse>> LoadDocumentsAsync(int? organizationId = null, string? familyId = null, string? beneficiaryTable = null, string? beneficiaryId = null)
        {
            if (!await TenantTableExistsAsync("document")) return [];

            var where = new List<string> { "is_deleted = 0" };
            var parameters = new DynamicParameters();

            // Note: organizationId parameter is now implicit via TenantConnection
            // Only filter by organizationId if explicitly needed for cross-org queries
            if (organizationId.HasValue && organizationId.Value != _tenantProvider.GetOrganizationId())
            {
                where.Add("etablissement_id = @organizationId");
                parameters.Add("organizationId", organizationId.Value);
            }

            if (!string.IsNullOrWhiteSpace(familyId))
            {
                where.Add("family_id = @familyId");
                parameters.Add("familyId", familyId);
            }

            if (!string.IsNullOrWhiteSpace(beneficiaryTable))
            {
                where.Add("beneficiary_table = @beneficiaryTable");
                parameters.Add("beneficiaryTable", beneficiaryTable);
            }

            if (!string.IsNullOrWhiteSpace(beneficiaryId))
            {
                where.Add("beneficiary_id = @beneficiaryId");
                parameters.Add("beneficiaryId", beneficiaryId);
            }

            using var connection = TenantConnection();
            var rows = await connection.QueryAsync($"""
                SELECT id, etablissement_id, family_id, template_id, graphic_charter_id,
                       beneficiary_id, beneficiary_mode, beneficiary_table, beneficiary_table_label, beneficiary_link_column,
                       beneficiary_display_column_1, beneficiary_display_column_2,
                       beneficiary_display_value_1, beneficiary_display_value_2,
                       title, header_html, body_html, footer_html, full_html,
                       mime_type, status, generated_by_id, generated_by_name, generated_by_email, generated_by_role,
                       generated_at, created_at, updated_at, deleted_at, deleted_by_id, deleted_by_name
                FROM document
                WHERE {string.Join(" AND ", where)}
                ORDER BY generated_at DESC, created_at DESC
                """, parameters);

            return rows.Select(MapDocumentRow).ToArray();
        }

        public async Task<DocumentListResponse> LoadDocumentsPagedAsync(DocumentListRequest request)
        {
            if (!await TenantTableExistsAsync("document"))
                return new DocumentListResponse { Data = new List<DocumentListItemResponse>(), Total = 0, Page = request.Page, Limit = 0, TotalPages = 0 };

            // Build WHERE clause
            var where = new List<string> { "is_deleted = 0" };
            var parameters = new DynamicParameters();

            // Note: organizationId is now implicit via TenantConnection
            if (request.OrganizationId.HasValue && request.OrganizationId.Value != _tenantProvider.GetOrganizationId())
            {
                where.Add("etablissement_id = @organizationId");
                parameters.Add("organizationId", request.OrganizationId.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.FamilyId))
            {
                where.Add("family_id = @familyId");
                parameters.Add("familyId", request.FamilyId);
            }

            if (!string.IsNullOrWhiteSpace(request.BeneficiaryTable))
            {
                where.Add("beneficiary_table = @beneficiaryTable");
                parameters.Add("beneficiaryTable", request.BeneficiaryTable);
            }

            if (!string.IsNullOrWhiteSpace(request.BeneficiaryId))
            {
                where.Add("beneficiary_id = @beneficiaryId");
                parameters.Add("beneficiaryId", request.BeneficiaryId);
            }

            // Normalize sort column to valid SQL column name
            var sortColumn = request.SortBy switch
            {
                "title" => "title",
                "familyId" => "family_id",
                "generatedBy" => "generated_by_name",
                "generatedAt" => "generated_at",
                _ => "generated_at"
            };

            var sortOrder = request.SortOrder?.ToLower() == "asc" ? "ASC" : "DESC";

            // Get total count
            using (var connection = TenantConnection())
            {
                var countQuery = $"SELECT COUNT(*) FROM document WHERE {string.Join(" AND ", where)}";
                var total = await connection.ExecuteScalarAsync<int>(countQuery, parameters);

                var dataQuery = $"""
                    SELECT id, family_id, title, beneficiary_id, beneficiary_table, beneficiary_table_label,
                           beneficiary_display_value_1, beneficiary_display_value_2,
                           generated_by_id, generated_by_name, generated_by_email, generated_by_role, generated_at
                    FROM document
                    WHERE {string.Join(" AND ", where)}
                    ORDER BY {sortColumn} {sortOrder}
                    """;

                var rows = await connection.QueryAsync(dataQuery, parameters);

                var documents = rows.Select(row => new DocumentListItemResponse
                {
                    Id = Str(row, "id"),
                    Title = Str(row, "title"),
                    FamilyId = Str(row, "family_id"),
                    BeneficiaryId = StrOrNull(row, "beneficiary_id"),
                    BeneficiaryTable = StrOrNull(row, "beneficiary_table"),
                    BeneficiaryTableLabel = StrOrNull(row, "beneficiary_table_label"),
                    BeneficiaryDisplayValue1 = StrOrNull(row, "beneficiary_display_value_1"),
                    BeneficiaryDisplayValue2 = StrOrNull(row, "beneficiary_display_value_2"),
                    GeneratedById = Str(row, "generated_by_id"),
                    GeneratedByName = Str(row, "generated_by_name"),
                    GeneratedByEmail = StrOrNull(row, "generated_by_email"),
                    GeneratedByRole = StrOrNull(row, "generated_by_role"),
                    GeneratedAt = Str(row, "generated_at")
                }).ToList();

                return new DocumentListResponse
                {
                    Data = documents,
                    Total = total,
                    Page = request.Page,
                    Limit = total,
                    TotalPages = total > 0 ? 1 : 0
                };
            }
        }

        public async Task<DocumentResponse?> GetDocumentByIdAsync(string id)
        {
            if (!await TenantTableExistsAsync("document")) return null;
            using var connection = TenantConnection();
            var row = await connection.QueryFirstOrDefaultAsync("""
                SELECT TOP (1) id, etablissement_id, family_id, template_id, graphic_charter_id,
                               beneficiary_id, beneficiary_mode, beneficiary_table, beneficiary_table_label, beneficiary_link_column,
                               beneficiary_display_column_1, beneficiary_display_column_2,
                               beneficiary_display_value_1, beneficiary_display_value_2,
                               title, header_html, body_html, footer_html, full_html,
                               mime_type, status, generated_by_id, generated_by_name, generated_by_email, generated_by_role,
                               generated_at, created_at, updated_at, deleted_at, deleted_by_id, deleted_by_name
                FROM document
                WHERE id = @id AND is_deleted = 0
                """, new { id });
            return row is null ? null : MapDocumentRow(row);
        }

        public async Task<DocumentResponse> CreateDocumentAsync(DocumentCreateRequest request)
        {
            var document = NormalizeDocument(request);
            using var connection = TenantConnection();
            await connection.ExecuteAsync("""
                INSERT INTO document (
                  id, etablissement_id, family_id, template_id, graphic_charter_id,
                  beneficiary_id, beneficiary_mode, beneficiary_table, beneficiary_table_label, beneficiary_link_column,
                  beneficiary_display_column_1, beneficiary_display_column_2,
                  beneficiary_display_value_1, beneficiary_display_value_2,
                  title, header_html, body_html, footer_html, full_html,
                  mime_type, status, generated_by_id, generated_by_name, generated_by_email, generated_by_role,
                  generated_at, created_at, updated_at, is_deleted
                )
                VALUES (
                  @id, @etablissement_id, @family_id, @template_id, @graphic_charter_id,
                  @beneficiary_id, @beneficiary_mode, @beneficiary_table, @beneficiary_table_label, @beneficiary_link_column,
                  @beneficiary_display_column_1, @beneficiary_display_column_2,
                  @beneficiary_display_value_1, @beneficiary_display_value_2,
                  @title, @header_html, @body_html, @footer_html, @full_html,
                  @mime_type, @status, @generated_by_id, @generated_by_name, @generated_by_email, @generated_by_role,
                  @generated_at, @created_at, @updated_at, 0
                )
                """, DocumentParams(document));

            return (await GetDocumentByIdAsync(document.Id)) ?? document;
        }

        public async Task DeleteDocumentAsync(string id, AuthUserResponse? deletedBy = null)
        {
            if (!await TenantTableExistsAsync("document")) return;
            using var connection = TenantConnection();
            await connection.ExecuteAsync(
                """
                UPDATE document
                SET is_deleted = 1,
                    updated_at = @updatedAt,
                    deleted_at = @updatedAt,
                    deleted_by_id = @deletedById,
                    deleted_by_name = @deletedByName
                WHERE id = @id
                """,
                new
                {
                    id,
                    updatedAt = DateTimeOffset.UtcNow.ToString("O"),
                    deletedById = deletedBy?.Id,
                    deletedByName = deletedBy?.Name
                });
        }

        // ─── Private helpers : ConfigDB introspection ────────────────────────────

        private async Task<bool> ConfigTableExistsAsync(string tableName)
        {
            using var connection = ConfigConnection();
            var count = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName AND TABLE_TYPE = 'BASE TABLE'",
                new { tableName });
            return count > 0;
        }

        private async Task<bool> ConfigTableHasColumnAsync(string tableName, string columnName)
        {
            using var connection = ConfigConnection();
            var count = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName AND COLUMN_NAME = @columnName",
                new { tableName, columnName });
            return count > 0;
        }

        // ─── Private helpers : TenantDB introspection ────────────────────────────

        private async Task<bool> TenantTableExistsAsync(string tableName, string? databaseName = null)
        {
            using var connection = TenantConnection(databaseName);
            var count = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName AND TABLE_TYPE = 'BASE TABLE'",
                new { tableName });
            return count > 0;
        }

        private async Task<ColumnInfo[]> GetTenantColumnsAsync(string tableName, string? databaseName = null)
        {
            using var connection = TenantConnection(databaseName);
            var rows = await connection.QueryAsync<ColumnInfo>("""
                SELECT c.COLUMN_NAME AS Name, c.DATA_TYPE AS Type,
                       CASE WHEN c.IS_NULLABLE = 'YES' THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS Nullable,
                       COLUMNPROPERTY(OBJECT_ID(c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS IsIdentity
                FROM INFORMATION_SCHEMA.COLUMNS c
                WHERE TABLE_NAME = @tableName
                ORDER BY ORDINAL_POSITION
                """, new { tableName });
            return rows.ToArray();
        }

        private async Task<string> GetPrimaryKeyAsync(string tableName, bool useTenant, string? databaseName = null)
        {
            IDbConnection Conn() => useTenant ? TenantConnection(databaseName) : ConfigConnection();
            using var connection = Conn();
            return await connection.ExecuteScalarAsync<string?>("""
                SELECT TOP (1) kcu.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_NAME = kcu.TABLE_NAME
                WHERE tc.TABLE_NAME = @tableName AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                ORDER BY kcu.ORDINAL_POSITION
                """, new { tableName }) ?? "id";
        }

        private async Task<string> GetRowKeyAsync(string tableName, IReadOnlyCollection<ColumnInfo> columns, bool useTenant = false, string? databaseName = null)
        {
            var primaryKey = await GetPrimaryKeyAsync(tableName, useTenant, databaseName);
            if (!string.IsNullOrWhiteSpace(primaryKey) && columns.Any(c => string.Equals(c.Name, primaryKey, StringComparison.OrdinalIgnoreCase)))
                return primaryKey;
            return columns.FirstOrDefault(c => string.Equals(c.Name, "id", StringComparison.OrdinalIgnoreCase))?.Name
                ?? columns.FirstOrDefault(c => c.IsIdentity)?.Name
                ?? columns.FirstOrDefault()?.Name
                ?? throw new InvalidOperationException("Cle primaire introuvable.");
        }

        // ─── ResolveTableView (ConfigDB) ──────────────────────────────────────────

        private async Task<TableViewConfigResponse?> ResolveTableViewAsync(string? configId, TableViewConfigRequest? provided)
        {
            if (provided is not null && !string.IsNullOrWhiteSpace(provided.TableName))
            {
                if (string.IsNullOrWhiteSpace(provided.Id) && !string.IsNullOrWhiteSpace(configId))
                    provided.Id = configId;
                return NormalizeTableView(provided);
            }
            using var connection = ConfigConnection();
            var row = await connection.QueryFirstOrDefaultAsync(
                "SELECT TOP (1) * FROM table_view_config WHERE id = @configId", new { configId });
            if (row is null) return null;
            var item = Row(row);
            return NormalizeTableView(new TableViewConfigRequest
            {
                Id = Str(item, "id"),
                TableName = Str(item, "table_name") ?? string.Empty,
                Label = Str(item, "label") ?? string.Empty,
                VisibleFields = JsonValue(item, "visible_fields_json", new List<string>()),
                EditableFields = JsonValue(item, "editable_fields_json", new List<string>()),
                PreviewFields = JsonValue(item, "preview_fields_json", new List<string>()),
                FieldLabels = JsonValue(item, "field_labels_json", new Dictionary<string, string>()),
                FieldSettings = JsonValue(item, "field_settings_json", new Dictionary<string, TableViewFieldSetting>()),
                CreatedAt = Str(item, "created_at"),
                UpdatedAt = Str(item, "updated_at")
            });
        }

        // ─── Static insert helpers (ConfigDB, used in ReplaceState) ─────────────

        private static async Task SaveSettingsAsync(IDbConnection connection, IDbTransaction transaction, Dictionary<string, object?> settings)
        {
            foreach (var (key, value) in settings)
            {
                await connection.ExecuteAsync(
                    "INSERT INTO app_setting ([key], value_json) VALUES (@key, @value)",
                    new { key, value = JsonSerializer.Serialize(value, JsonOptions) }, transaction);
            }
        }

        private static Task InsertFamilyAsync(IDbConnection connection, IDbTransaction transaction, FamilyRequest family)
            => connection.ExecuteAsync("""
                INSERT INTO family (id, nom, description, beneficiary_mode, beneficiary_table, beneficiary_table_label, beneficiary_link_column,
                  beneficiary_display_column_1, beneficiary_display_column_2, beneficiary_sql_text, filter_catalog_json,
                  sql_text, created_at, classes_json, organization_ids_json)
                VALUES (@id, @nom, @description, @beneficiary_mode, @beneficiary_table, @beneficiary_table_label, @beneficiary_link_column,
                  @beneficiary_display_column_1, @beneficiary_display_column_2, @beneficiary_sql_text, @filter_catalog_json,
                  @sql_text, @created_at, @classes_json, @organization_ids_json)
                """, FamilyParams(family), transaction);

        private static Task InsertTableViewAsync(IDbConnection connection, IDbTransaction transaction, TableViewConfigRequest tableView)
            => connection.ExecuteAsync("""
                                INSERT INTO table_view_config (id, table_name, label, visible_fields_json, editable_fields_json,
                                    preview_fields_json, field_labels_json, field_settings_json, organization_ids_json, created_at, updated_at)
                                VALUES (@id, @table_name, @label, @visible_fields_json, @editable_fields_json,
                                    @preview_fields_json, @field_labels_json, @field_settings_json, @organization_ids_json, @created_at, @updated_at)
                """, TableViewParams(NormalizeTableView(tableView)), transaction);

        private static Task InsertGraphicCharterAsync(IDbConnection connection, IDbTransaction transaction, GraphicCharterRequest charter, int? organizationId)
            => connection.ExecuteAsync("""
                INSERT INTO graphic_charter (id, etablissement_id, nom, description, is_default, config_json, created_at, updated_at)
                VALUES (@id, @etablissement_id, @nom, @description, @is_default, @config_json, @created_at, @updated_at)
                """, new
                {
                    id = charter.Id,
                    etablissement_id = organizationId,
                    nom = charter.Name,
                    description = charter.Description ?? string.Empty,
                    is_default = charter.IsDefault,
                    config_json = JsonString(charter.Config, "{}"),
                    created_at = charter.CreatedAt,
                    updated_at = charter.UpdatedAt ?? charter.CreatedAt
                }, transaction);

        private static Task InsertTemplateAsync(IDbConnection connection, IDbTransaction transaction, TemplateRequest template, int? organizationId)
            => connection.ExecuteAsync("""
                INSERT INTO template (id, family_id, etablissement_id, graphic_charter_id, nom, updated_at, has_header,
                                    has_footer, orientation, filter_profile_json, section_directions_json, page_margins_json,
                                    header_footer_distances_json, header_display, footer_display, header_html, body_html, footer_html)
                VALUES (@id, @family_id, @etablissement_id, @graphic_charter_id, @nom, @updated_at, @has_header,
                                    @has_footer, @orientation, @filter_profile_json, @section_directions_json, @page_margins_json,
                                    @header_footer_distances_json, @header_display, @footer_display, @header_html, @body_html, @footer_html)
                """, new
                {
                    id = template.Id,
                    family_id = template.FamilyId,
                    etablissement_id = organizationId,
                    graphic_charter_id = template.GraphicCharterId,
                    nom = template.Nom,
                    updated_at = template.UpdatedAt,
                    has_header = template.HasHeader,
                    has_footer = template.HasFooter,
                    orientation = ToDatabaseString(template.Orientation),
                    filter_profile_json = JsonString(template.FilterProfile, "[]"),
                    section_directions_json = JsonString(template.SectionDirections, "{}"),
                    page_margins_json = JsonString(template.PageMargins, "{}"),
                    header_footer_distances_json = JsonString(template.HeaderFooterDistances, "{}"),
                    header_display = ToDatabaseString(template.HeaderDisplay),
                    footer_display = ToDatabaseString(template.FooterDisplay),
                    header_html = template.Header,
                    body_html = template.Body,
                    footer_html = template.Footer
                }, transaction);

        // ─── Params helpers ───────────────────────────────────────────────────────

        private static object GraphicCharterParams(GraphicCharterRequest charter) => new
        {
            id = charter.Id,
            etablissement_id = charter.OrganizationId,
            nom = charter.Name,
            description = charter.Description ?? string.Empty,
            is_default = charter.IsDefault,
            config_json = JsonString(charter.Config, "{}"),
            created_at = charter.CreatedAt ?? DateTimeOffset.UtcNow.ToString("O"),
            updated_at = DateTimeOffset.UtcNow.ToString("O")
        };

        private static object TableViewParams(TableViewConfigRequest tableView) => new
        {
            id = tableView.Id,
            table_name = tableView.TableName,
            label = string.IsNullOrWhiteSpace(tableView.Label) ? tableView.TableName : tableView.Label,
            visible_fields_json = JsonString(tableView.VisibleFields, "[]"),
            editable_fields_json = JsonString(tableView.EditableFields, "[]"),
            preview_fields_json = JsonString(tableView.PreviewFields, "[]"),
            field_labels_json = JsonString(tableView.FieldLabels, "{}"),
            field_settings_json = JsonString(tableView.FieldSettings, "{}"),
            filters_json = JsonString(tableView.Filters, "[]"),
            organization_ids_json = JsonString(tableView.OrganizationIds, "[]"),
            created_at = tableView.CreatedAt ?? DateTimeOffset.UtcNow.ToString("O"),
            updated_at = DateTimeOffset.UtcNow.ToString("O")
        };

        private static object FamilyParams(FamilyRequest family) => new
        {
            id = family.Id,
            nom = family.Nom,
            description = family.Description ?? string.Empty,
            beneficiary_mode = family.BeneficiaryMode == BeneficiaryMode.Organization ? "organization" : "table",
            beneficiary_table = family.BeneficiaryMode == BeneficiaryMode.Organization ? null : family.BeneficiaryTable,
            beneficiary_table_label = family.BeneficiaryTableLabel,
            beneficiary_link_column = family.BeneficiaryLinkColumn,
            beneficiary_display_column_1 = family.BeneficiaryDisplayColumn1,
            beneficiary_display_column_2 = family.BeneficiaryDisplayColumn2,
            beneficiary_sql_text = family.BeneficiarySql ?? string.Empty,
            filter_catalog_json = JsonString(family.FilterCatalog, "[]"),
            sql_text = family.Sql ?? string.Empty,
            created_at = family.CreatedAt ?? DateTimeOffset.UtcNow.ToString("O"),
            classes_json = JsonString(family.Classes, "[]"),
            organization_ids_json = JsonString(family.OrganizationIds, "[]")
        };

        private static object TemplateParams(TemplateRequest template, int? organizationId) => new
        {
            id = template.Id,
            family_id = template.FamilyId,
            etablissement_id = organizationId,
            graphic_charter_id = template.GraphicCharterId,
            nom = template.Nom,
            updated_at = DateTimeOffset.UtcNow.ToString("O"),
            has_header = template.HasHeader,
            has_footer = template.HasFooter,
            orientation = ToDatabaseString(template.Orientation),
            filter_profile_json = JsonString(template.FilterProfile, "[]"),
            section_directions_json = JsonString(template.SectionDirections, "{}"),
            page_margins_json = JsonString(template.PageMargins, "{}"),
            header_footer_distances_json = JsonString(template.HeaderFooterDistances, "{}"),
            header_display = ToDatabaseString(template.HeaderDisplay),
            footer_display = ToDatabaseString(template.FooterDisplay),
            header_html = template.Header,
            body_html = template.Body,
            footer_html = template.Footer
        };

        private static object DocumentParams(DocumentResponse document) => new
        {
            id = document.Id,
            etablissement_id = document.OrganizationId,
            family_id = document.FamilyId,
            template_id = document.TemplateId,
            graphic_charter_id = document.GraphicCharterId,
            beneficiary_id = document.BeneficiaryId,
            beneficiary_mode = document.BeneficiaryMode,
            beneficiary_table = document.BeneficiaryTable,
            beneficiary_table_label = document.BeneficiaryTableLabel,
            beneficiary_link_column = document.BeneficiaryLinkColumn,
            beneficiary_display_column_1 = document.BeneficiaryDisplayColumn1,
            beneficiary_display_column_2 = document.BeneficiaryDisplayColumn2,
            beneficiary_display_value_1 = document.BeneficiaryDisplayValue1,
            beneficiary_display_value_2 = document.BeneficiaryDisplayValue2,
            title = document.Title,
            header_html = document.HeaderHtml,
            body_html = document.BodyHtml,
            footer_html = document.FooterHtml,
            full_html = document.FullHtml,
            mime_type = document.MimeType,
            status = document.Status,
            generated_by_id = document.GeneratedById,
            generated_by_name = document.GeneratedByName,
            generated_by_email = document.GeneratedByEmail,
            generated_by_role = document.GeneratedByRole,
            generated_at = document.GeneratedAt,
            created_at = document.CreatedAt,
            updated_at = document.UpdatedAt
        };

        // ─── Normalizers ──────────────────────────────────────────────────────────

        private static FamilyResponse NormalizeFamily(FamilyRequest source) => new()
        {
            Id = string.IsNullOrWhiteSpace(source.Id) ? $"fam_{Guid.NewGuid():N}" : source.Id,
            Nom = source.Nom,
            Description = source.Description,
            OrganizationIds = source.OrganizationIds ?? new List<int>(),
            BeneficiaryMode = source.BeneficiaryMode,
            BeneficiaryTable = source.BeneficiaryMode == BeneficiaryMode.Organization ? null : source.BeneficiaryTable,
            BeneficiaryTableLabel = source.BeneficiaryTableLabel,
            BeneficiaryLinkColumn = source.BeneficiaryLinkColumn,
            BeneficiaryDisplayColumn1 = source.BeneficiaryDisplayColumn1,
            BeneficiaryDisplayColumn2 = source.BeneficiaryDisplayColumn2,
            BeneficiarySql = source.BeneficiarySql,
            FilterCatalog = source.FilterCatalog ?? [],
            Sql = source.Sql,
            CreatedAt = source.CreatedAt,
            Classes = source.Classes ?? []
        };

        private static TemplateResponse NormalizeTemplate(TemplateRequest source) => new()
        {
            Id = string.IsNullOrWhiteSpace(source.Id) ? $"tpl_{Guid.NewGuid():N}" : source.Id,
            FamilyId = source.FamilyId,
            OrganizationId = source.OrganizationId,
            GraphicCharterId = source.GraphicCharterId,
            Nom = source.Nom,
            UpdatedAt = source.UpdatedAt,
            HasHeader = source.HasHeader,
            HasFooter = source.HasFooter,
            Orientation = source.Orientation,
            FilterProfile = source.FilterProfile ?? [],
            SectionDirections = source.SectionDirections ?? new SectionDirections(),
            PageMargins = source.PageMargins ?? new PageMargins(),
            HeaderFooterDistances = source.HeaderFooterDistances ?? new HeaderFooterDistances(),
            HeaderDisplay = source.HeaderDisplay,
            FooterDisplay = source.FooterDisplay,
            Header = source.Header,
            Body = source.Body,
            Footer = source.Footer
        };

        private static GraphicCharterResponse NormalizeGraphicCharter(GraphicCharterRequest source) => new()
        {
            Id = string.IsNullOrWhiteSpace(source.Id) ? $"gch_{Guid.NewGuid():N}" : source.Id,
            OrganizationId = source.OrganizationId,
            Name = source.Name,
            Description = source.Description,
            IsDefault = source.IsDefault,
            Config = source.Config ?? new GraphicCharterConfig(),
            CreatedAt = source.CreatedAt,
            UpdatedAt = source.UpdatedAt
        };

        private static TableViewConfigResponse NormalizeTableView(TableViewConfigRequest source) => new()
        {
            Id = string.IsNullOrWhiteSpace(source.Id) ? $"tvw_{Guid.NewGuid():N}" : source.Id,
            OrganizationIds = source.OrganizationIds ?? new List<int>(),
            TableName = source.TableName,
            Label = source.Label,
            VisibleFields = NormalizeFieldList(source.VisibleFields),
            EditableFields = NormalizeFieldList(source.EditableFields),
            PreviewFields = NormalizeFieldList(source.PreviewFields).Take(3).ToList(),
            FieldLabels = source.FieldLabels ?? [],
            FieldSettings = source.FieldSettings ?? [],
            Filters = NormalizeTableViewFilters(source.Filters),
            CreatedAt = source.CreatedAt,
            UpdatedAt = source.UpdatedAt
        };

        private static DocumentResponse NormalizeDocument(DocumentCreateRequest source)
        {
            var now = DateTimeOffset.UtcNow.ToString("O");
            return new DocumentResponse
            {
                Id = string.IsNullOrWhiteSpace(source.Id) ? $"doc_{Guid.NewGuid():N}" : source.Id,
                OrganizationId = source.OrganizationId,
                FamilyId = source.FamilyId,
                TemplateId = source.TemplateId,
                GraphicCharterId = source.GraphicCharterId,
                BeneficiaryId = source.BeneficiaryId,
                BeneficiaryMode = string.IsNullOrWhiteSpace(source.BeneficiaryMode) ? "table" : source.BeneficiaryMode,
                BeneficiaryTable = source.BeneficiaryTable,
                BeneficiaryTableLabel = source.BeneficiaryTableLabel,
                BeneficiaryLinkColumn = source.BeneficiaryLinkColumn,
                BeneficiaryDisplayColumn1 = source.BeneficiaryDisplayColumn1,
                BeneficiaryDisplayColumn2 = source.BeneficiaryDisplayColumn2,
                BeneficiaryDisplayValue1 = source.BeneficiaryDisplayValue1,
                BeneficiaryDisplayValue2 = source.BeneficiaryDisplayValue2,
                Title = source.Title,
                HeaderHtml = source.HeaderHtml ?? string.Empty,
                BodyHtml = source.BodyHtml ?? string.Empty,
                FooterHtml = source.FooterHtml ?? string.Empty,
                FullHtml = source.FullHtml ?? string.Empty,
                MimeType = string.IsNullOrWhiteSpace(source.MimeType) ? "text/html" : source.MimeType,
                Status = string.IsNullOrWhiteSpace(source.Status) ? "generated" : source.Status,
                GeneratedById = source.GeneratedById,
                GeneratedByName = source.GeneratedByName,
                GeneratedByEmail = source.GeneratedByEmail,
                GeneratedByRole = source.GeneratedByRole,
                GeneratedAt = string.IsNullOrWhiteSpace(source.GeneratedAt) ? now : source.GeneratedAt,
                CreatedAt = now,
                UpdatedAt = now
            };
        }

        private static DocumentResponse MapDocumentRow(object row)
        {
            var item = Row(row);
            return new DocumentResponse
            {
                Id = Str(item, "id") ?? string.Empty,
                OrganizationId = IntOrNull(item, "etablissement_id"),
                FamilyId = Str(item, "family_id") ?? string.Empty,
                TemplateId = Str(item, "template_id") ?? string.Empty,
                GraphicCharterId = StrOrNull(item, "graphic_charter_id"),
                BeneficiaryId = StrOrNull(item, "beneficiary_id"),
                BeneficiaryMode = Str(item, "beneficiary_mode") ?? "table",
                BeneficiaryTable = StrOrNull(item, "beneficiary_table"),
                BeneficiaryTableLabel = StrOrNull(item, "beneficiary_table_label"),
                BeneficiaryLinkColumn = StrOrNull(item, "beneficiary_link_column"),
                BeneficiaryDisplayColumn1 = StrOrNull(item, "beneficiary_display_column_1"),
                BeneficiaryDisplayColumn2 = StrOrNull(item, "beneficiary_display_column_2"),
                BeneficiaryDisplayValue1 = StrOrNull(item, "beneficiary_display_value_1"),
                BeneficiaryDisplayValue2 = StrOrNull(item, "beneficiary_display_value_2"),
                Title = Str(item, "title") ?? string.Empty,
                HeaderHtml = Str(item, "header_html") ?? string.Empty,
                BodyHtml = Str(item, "body_html") ?? string.Empty,
                FooterHtml = Str(item, "footer_html") ?? string.Empty,
                FullHtml = Str(item, "full_html") ?? string.Empty,
                MimeType = Str(item, "mime_type") ?? "text/html",
                Status = Str(item, "status") ?? "generated",
                GeneratedById = Str(item, "generated_by_id") ?? string.Empty,
                GeneratedByName = Str(item, "generated_by_name") ?? string.Empty,
                GeneratedByEmail = StrOrNull(item, "generated_by_email"),
                GeneratedByRole = StrOrNull(item, "generated_by_role"),
                GeneratedAt = Str(item, "generated_at") ?? string.Empty,
                CreatedAt = Str(item, "created_at"),
                UpdatedAt = Str(item, "updated_at"),
                DeletedAt = StrOrNull(item, "deleted_at"),
                DeletedById = StrOrNull(item, "deleted_by_id"),
                DeletedByName = StrOrNull(item, "deleted_by_name")
            };
        }

        private static List<string> NormalizeFieldList(IEnumerable<string>? fields)
            => (fields ?? [])
                .Select(f => f?.Trim() ?? string.Empty)
                .Where(f => !string.IsNullOrWhiteSpace(f))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

        private static List<TableViewFilter> NormalizeTableViewFilters(IEnumerable<TableViewFilter>? filters)
        {
            if (filters == null || !filters.Any()) return [];

            return filters.Select(f => new TableViewFilter
            {
                Id = string.IsNullOrWhiteSpace(f.Id) ? $"tvf_{Guid.NewGuid():N}" : f.Id,
                Name = f.Name,
                LinkColumn = f.LinkColumn,
                SourceType = f.SourceType,
                StaticOptions = f.StaticOptions ?? [],
                SqlBuilder = f.SqlBuilder ?? new TableFilterSqlBuilder(),
                HelpText = f.HelpText ?? string.Empty,
                Enabled = f.Enabled
            }).ToList();
        }

        // ─── TableView Filters ────────────────────────────────────────────────────

        public async Task<IEnumerable<TableFilterOption>> GetTableFilterOptionsAsync(TableFilterSqlBuilder sqlBuilder, string? databaseName = null)
        {
            if (sqlBuilder == null || string.IsNullOrWhiteSpace(sqlBuilder.TableName) ||
                string.IsNullOrWhiteSpace(sqlBuilder.ValueColumn) || string.IsNullOrWhiteSpace(sqlBuilder.LabelColumn))
                return [];

            try
            {
                var distinctKeyword = sqlBuilder.Distinct ? "DISTINCT" : "";
                var sql = $"""
                    SELECT {distinctKeyword} 
                      {sqlBuilder.ValueColumn} AS value, 
                      {sqlBuilder.LabelColumn} AS label
                    FROM {sqlBuilder.TableName}
                    ORDER BY label ASC
                    """;

                using var connection = TenantConnection(databaseName);
                var rows = await connection.QueryAsync(sql);
                return rows.Select(row =>
                {
                    var item = Row(row);
                    return new TableFilterOption
                    {
                        Value = Str(item, "value") ?? string.Empty,
                        Label = Str(item, "label") ?? string.Empty
                    };
                });
            }
            catch
            {
                return [];
            }
        }

        // ─── Query helpers ────────────────────────────────────────────────────────

        private async Task<List<AcademicYearConfigResponse>> LoadAcademicYearConfigsAsync()
        {
            if (!await ConfigTableExistsAsync("app_setting")) return [];
            using var connection = ConfigConnection();
            var raw = await connection.ExecuteScalarAsync<string?>(
                "SELECT TOP (1) value_json FROM app_setting WHERE [key] = @key",
                new { key = AcademicYearConfigsSettingKey });
            if (string.IsNullOrWhiteSpace(raw)) return [];
            try
            {
                return JsonSerializer.Deserialize<List<AcademicYearConfigResponse>>(raw, JsonOptions) ?? [];
            }
            catch
            {
                return [];
            }
        }

        private async Task UpsertSettingAsync<T>(string key, T value)
        {
            using var connection = ConfigConnection();
            await connection.ExecuteAsync("""
                MERGE app_setting AS target
                USING (SELECT @key AS [key]) AS src ON target.[key] = src.[key]
                WHEN MATCHED THEN UPDATE SET value_json = @value
                WHEN NOT MATCHED THEN INSERT ([key], value_json) VALUES (@key, @value);
                """, new { key, value = JsonString(value, "null") });
        }

        private async Task EnsureAcademicYearTableIsValidAsync()
        {
            if (!await TenantTableExistsAsync(AcademicYearTable))
                throw new InvalidOperationException($"Table des annees universitaires introuvable: {AcademicYearTable}");

            var columns = (await GetTenantColumnsAsync(AcademicYearTable)).Select(c => c.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var requiredColumns = new[]
            {
                AcademicYearCodeColumn,
                AcademicYearStartDateColumn,
                AcademicYearEndDateColumn,
                AcademicYearStatusColumn
            };

            var missing = requiredColumns.FirstOrDefault(column => !columns.Contains(column));
            if (!string.IsNullOrWhiteSpace(missing))
                throw new InvalidOperationException($"Colonne introuvable dans {AcademicYearTable}: {missing}");
        }

        private async Task<(string ColumnName, string YearCode)?> GetAcademicYearFilterAsync(string tableName, string? databaseName = null)
        {
            var yearCode = _tenantProvider.GetAcademicYearCode();
            var organizationId = _tenantProvider.GetOrganizationId();
            if (string.IsNullOrWhiteSpace(yearCode) || !organizationId.HasValue) return null;

            var config = await GetAcademicYearConfigAsync(organizationId.Value);
            var tableConfig = config?.AffectedTables.FirstOrDefault(item => string.Equals(item.TableName, tableName, StringComparison.OrdinalIgnoreCase));
            if (tableConfig is null || string.IsNullOrWhiteSpace(tableConfig.YearColumn)) return null;

            var columns = await GetTenantColumnsAsync(tableName, databaseName);
            var column = columns.FirstOrDefault(item => string.Equals(item.Name, tableConfig.YearColumn, StringComparison.OrdinalIgnoreCase));
            return column is null ? null : (column.Name, yearCode);
        }

        private async Task EnsureCurrentAcademicYearIsWritableAsync(string tableName, string? databaseName = null)
        {
            var filter = await GetAcademicYearFilterAsync(tableName, databaseName);
            if (filter is null) return;

            var organizationId = _tenantProvider.GetOrganizationId();
            if (!organizationId.HasValue) return;

            var year = (await LoadAcademicYearsAsync())
                .FirstOrDefault(item => string.Equals(item.Code, filter.Value.YearCode, StringComparison.OrdinalIgnoreCase));
            if (year?.IsClosed == true)
                throw new InvalidOperationException("Cette annee universitaire est cloturee. Les modifications sont bloquees.");
        }

        private async Task<string> ApplyAutomaticAcademicYearFilterAsync(
            string sql,
            DynamicParameters parameters,
            IDictionary<string, object?> requestParameters,
            string? databaseName = null)
        {
            var yearCode = ResolveAcademicYearCode(requestParameters);
            var organizationId = ResolveOrganizationId(requestParameters);
            if (string.IsNullOrWhiteSpace(yearCode) || !organizationId.HasValue) return sql;

            var config = await GetAcademicYearConfigAsync(organizationId.Value);
            if (config is null || config.AffectedTables.Count == 0) return sql;

            parameters.Add("__academicYearCode", yearCode);
            foreach (var table in config.AffectedTables)
            {
                if (HasExplicitAcademicYearPredicate(sql, table.YearColumn)) return sql;

                var columns = await GetTenantColumnsAsync(table.TableName, databaseName);
                var column = columns.FirstOrDefault(item => string.Equals(item.Name, table.YearColumn, StringComparison.OrdinalIgnoreCase));
                if (column is null) continue;

                sql = InsertAcademicYearPredicatesForTable(sql, table.TableName, column.Name);
            }

            return sql;
        }

        private string? ResolveAcademicYearCode(IDictionary<string, object?> requestParameters)
        {
            if (requestParameters.TryGetValue("academicYear", out var value))
            {
                var text = NormalizeParameterValue(value)?.ToString();
                if (!string.IsNullOrWhiteSpace(text)) return text.Trim();
            }

            return _tenantProvider.GetAcademicYearCode();
        }

        private int? ResolveOrganizationId(IDictionary<string, object?> requestParameters)
        {
            if (requestParameters.TryGetValue("organizationId", out var value))
            {
                var normalized = NormalizeParameterValue(value);
                if (normalized is int intValue) return intValue;
                if (normalized is long longValue && longValue >= int.MinValue && longValue <= int.MaxValue) return (int)longValue;
                if (normalized is decimal decimalValue && decimalValue >= int.MinValue && decimalValue <= int.MaxValue) return (int)decimalValue;
                if (int.TryParse(normalized?.ToString(), out var parsed)) return parsed;
            }

            return _tenantProvider.GetOrganizationId();
        }

        private static string InsertAcademicYearPredicatesForTable(string sql, string tableName, string yearColumn)
        {
            var references = FindTableReferences(sql, tableName).ToArray();
            if (references.Length == 0) return sql;

            for (var i = references.Length - 1; i >= 0; i--)
            {
                var reference = references[i];
                var qualifier = string.IsNullOrWhiteSpace(reference.Alias)
                    ? Quote(tableName)
                    : Quote(reference.Alias);
                var predicate = $"{qualifier}.{Quote(yearColumn)} = @__academicYearCode";
                if (ContainsPredicateNearReference(sql, reference.Index, predicate)) continue;
                sql = InsertWherePredicateNearReference(sql, reference.Index, predicate);
            }

            return sql;
        }

        private static IEnumerable<(string TableName, string? Alias, int Index)> FindTableReferences(string sql, string tableName)
        {
            var escapedTable = Regex.Escape(tableName);
            var matches = Regex.Matches(
                sql,
                $@"\b(?:FROM|JOIN)\s+(?:(?:\[[^\]]+\]|[A-Za-z_]\w*)\s*\.\s*)?(?:\[{escapedTable}\]|{escapedTable})(?:\s+(?:AS\s+)?(?<alias>[A-Za-z_]\w*))?",
                RegexOptions.IgnoreCase);
            foreach (Match match in matches)
            {
                var alias = match.Groups["alias"].Value;
                yield return (tableName, IsSqlClauseKeyword(alias) ? null : alias, match.Index);
            }
        }

        private static string InsertWherePredicate(string sql, string predicate)
        {
            var clauseMatch = Regex.Match(sql, @"\b(GROUP\s+BY|HAVING|ORDER\s+BY)\b", RegexOptions.IgnoreCase);
            var whereMatch = Regex.Match(sql, @"\bWHERE\b", RegexOptions.IgnoreCase);

            if (whereMatch.Success)
            {
                var insertAt = clauseMatch.Success && clauseMatch.Index > whereMatch.Index ? clauseMatch.Index : sql.Length;
                var before = sql[..insertAt].TrimEnd();
                var after = sql[insertAt..].TrimStart();
                return string.IsNullOrWhiteSpace(after)
                    ? $"{before} AND {predicate}"
                    : $"{before} AND {predicate} {after}";
            }

            if (clauseMatch.Success)
            {
                var before = sql[..clauseMatch.Index].TrimEnd();
                var after = sql[clauseMatch.Index..].TrimStart();
                return $"{before} WHERE {predicate} {after}";
            }

            return $"{sql} WHERE {predicate}";
        }

        private static string InsertWherePredicateNearReference(string sql, int referenceIndex, string predicate)
        {
            var blockEnd = FindEndOfLocalSelect(sql, referenceIndex);
            var localSql = sql[referenceIndex..blockEnd];
            var whereMatch = Regex.Match(localSql, @"\bWHERE\b", RegexOptions.IgnoreCase);
            if (!whereMatch.Success)
            {
                var clauseMatchWithoutWhere = Regex.Match(localSql, @"\b(GROUP\s+BY|HAVING|ORDER\s+BY|FOR\s+JSON)\b", RegexOptions.IgnoreCase);
                var insertWhereAt = clauseMatchWithoutWhere.Success
                    ? referenceIndex + clauseMatchWithoutWhere.Index
                    : blockEnd;
                var beforeWhere = sql[..insertWhereAt].TrimEnd();
                var afterWhere = sql[insertWhereAt..].TrimStart();
                return string.IsNullOrWhiteSpace(afterWhere)
                    ? $"{beforeWhere} WHERE {predicate}"
                    : $"{beforeWhere} WHERE {predicate} {afterWhere}";
            }

            var absoluteWhereIndex = referenceIndex + whereMatch.Index;
            var localTail = sql[absoluteWhereIndex..blockEnd];
            var clauseMatch = Regex.Match(localTail, @"\b(GROUP\s+BY|HAVING|ORDER\s+BY|FOR\s+JSON)\b", RegexOptions.IgnoreCase);
            var insertAt = clauseMatch.Success
                ? absoluteWhereIndex + clauseMatch.Index
                : blockEnd;
            var before = sql[..insertAt].TrimEnd();
            var after = sql[insertAt..].TrimStart();
            return string.IsNullOrWhiteSpace(after)
                ? $"{before} AND {predicate}"
                : $"{before} AND {predicate} {after}";
        }

        private static int FindEndOfLocalSelect(string sql, int startIndex)
        {
            var nextProjectedSubquery = Regex.Match(sql[startIndex..], @"\)\s+AS\s+\[", RegexOptions.IgnoreCase);
            return nextProjectedSubquery.Success ? startIndex + nextProjectedSubquery.Index : sql.Length;
        }

        private static bool ContainsPredicateNearReference(string sql, int referenceIndex, string predicate)
        {
            var blockEnd = FindEndOfLocalSelect(sql, referenceIndex);
            return sql[referenceIndex..blockEnd].Contains(predicate, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsSqlClauseKeyword(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "where", "join", "inner", "left", "right", "full", "cross", "on",
                "group", "having", "order", "union", "except", "intersect"
            }.Contains(value);
        }

        private static bool HasExplicitAcademicYearPredicate(string sql, string yearColumn)
            => Regex.IsMatch(sql, @"[@:]academicYear\b", RegexOptions.IgnoreCase)
               || Regex.IsMatch(sql, $@"\b{Regex.Escape(yearColumn)}\b\s*(=|IN\b|LIKE\b)", RegexOptions.IgnoreCase);

        private static bool IsSafeIdentifier(string? value)
            => !string.IsNullOrWhiteSpace(value) && Regex.IsMatch(value, @"^[A-Za-z0-9_]+$");

        private static string? CleanIdentifierOrNull(string? value)
            => IsSafeIdentifier(value) ? value : null;

        private static bool IsClosedStatus(string? status)
        {
            if (string.IsNullOrWhiteSpace(status)) return false;
            var normalized = status.Normalize(NormalizationForm.FormD);
            normalized = Regex.Replace(normalized, @"\p{Mn}", "").ToLowerInvariant();
            return normalized.Contains("clot") || normalized.Contains("clos") || normalized.Contains("ferme");
        }

        private static string? DateString(IDictionary<string, object?> row, string key)
        {
            if (!row.TryGetValue(key, out var value) || value is null) return null;
            return value switch
            {
                DateTime date => date.ToString("yyyy-MM-dd"),
                DateTimeOffset date => date.ToString("yyyy-MM-dd"),
                _ => value.ToString()
            };
        }

        private static string CompileNamedParameters(string querySql, Dictionary<string, object?> values, DynamicParameters output)
            => Regex.Replace(querySql, @":([a-zA-Z_]\w*)", match =>
            {
                var key = match.Groups[1].Value;
                output.Add(key, values.TryGetValue(key, out var value) ? NormalizeParameterValue(value) : null);
                return "@" + key;
            });

        private static bool IsSelectQuery(string sql)
        {
            if (string.IsNullOrWhiteSpace(sql)) return false;
            var s = sql.Trim();
            s = Regex.Replace(s, @"^\s*/\*.*?\*/\s*", "", RegexOptions.Singleline);
            s = Regex.Replace(s, @"^\s*(?:--.*?$\s*)+", "", RegexOptions.Multiline);
            while (s.StartsWith("(")) s = s[1..].TrimStart();
            return Regex.IsMatch(s, "^(select|with)\\b", RegexOptions.IgnoreCase);
        }

        private static string NormalizeSelectQueryForSqlServer(string querySql)
        {
            var raw = (querySql ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(raw)) return raw;
            raw = ConvertIdentifierQuotes(raw);
            raw = ConvertLegacyFunctions(raw);
            raw = ApplyTopLevelLimit(raw);
            return StripDanglingSelectCommas(raw);
        }

        private static string ConvertIdentifierQuotes(string sql)
            => Regex.Replace(sql, @"`([^`]+)`", m => Quote(m.Groups[1].Value));

        private static string ConvertLegacyFunctions(string sql)
            => Regex.Replace(sql, @"\bIFNULL\s*\(", "ISNULL(", RegexOptions.IgnoreCase);

        private static string ApplyTopLevelLimit(string sql)
        {
            var match = Regex.Match(sql, @"\s+LIMIT\s+(\d+)\s*$", RegexOptions.IgnoreCase);
            if (!match.Success) return sql;
            var withoutLimit = sql[..match.Index].TrimEnd();
            return withoutLimit;
        }

        private static string StripDanglingSelectCommas(string sql)
            => Regex.Replace(sql, @",\s+FROM\s+", " FROM ", RegexOptions.IgnoreCase);

        private static object? NormalizeParameterValue(object? value)
        {
            if (value is JsonElement element)
            {
                return element.ValueKind switch
                {
                    JsonValueKind.String => element.GetString(),
                    JsonValueKind.Number when element.TryGetInt64(out var l) => l,
                    JsonValueKind.Number when element.TryGetDouble(out var d) => d,
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Null => null,
                    _ => element.GetRawText()
                };
            }
            return value;
        }

        // ─── JSON helpers ─────────────────────────────────────────────────────────

        private static JsonSerializerOptions CreateJsonOptions()
        {
            var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
            options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
            return options;
        }

        private static T JsonValue<T>(IDictionary<string, object?> row, string key, T fallback)
        {
            try
            {
                var raw = Str(row, key);
                return string.IsNullOrWhiteSpace(raw)
                    ? CloneValue(fallback)
                    : JsonSerializer.Deserialize<T>(raw, JsonOptions) ?? CloneValue(fallback);
            }
            catch { return CloneValue(fallback); }
        }

        private static T CloneValue<T>(T value)
        {
            if (value is null) return value;
            return JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, JsonOptions), JsonOptions) ?? value;
        }

        private static object? ParseJsonValue(string? raw)
        {
            try { return string.IsNullOrWhiteSpace(raw) ? null : JsonSerializer.Deserialize<object?>(raw, JsonOptions); }
            catch { return null; }
        }

        private static string JsonString<T>(T value, string fallback)
        {
            try { return JsonSerializer.Serialize(value, JsonOptions); }
            catch { return fallback; }
        }

        // ─── Row helpers ──────────────────────────────────────────────────────────

        private static PageOrientation ParseOrientation(string? value)
            => string.Equals(value, "landscape", StringComparison.OrdinalIgnoreCase)
                ? PageOrientation.Landscape : PageOrientation.Portrait;

        private static SectionDisplayMode ParseSectionDisplayMode(string? value)
            => Enum.TryParse<SectionDisplayMode>(value, true, out var mode) ? mode : SectionDisplayMode.All;

        private static string ToDatabaseString(PageOrientation orientation)
            => orientation == PageOrientation.Landscape ? "landscape" : "portrait";

        private static string ToDatabaseString(SectionDisplayMode mode)
            => mode.ToString().ToLowerInvariant();

        private static string Quote(string name) => $"[{name.Replace("]", "]]")}]";

        private static IDictionary<string, object?> Row(object row)
        {
            if (row is IDictionary<string, object?> d) return d;
            return ((IDictionary<string, object>)row).ToDictionary(p => p.Key, p => (object?)p.Value);
        }

        private static Dictionary<string, object?> CleanRow(object row)
            => Row(row).ToDictionary(p => p.Key, p => p.Value switch
            {
                DateTime dt => (object?)dt.ToString("O"),
                DateTimeOffset dto => dto.ToString("O"),
                _ => p.Value
            });

        private static string? Str(IDictionary<string, object?> row, string key)
            => row.TryGetValue(key, out var v) && v is not null && v is not DBNull ? v.ToString() : null;
        private static string? StrOrNull(IDictionary<string, object?> row, string key)
            => string.IsNullOrWhiteSpace(Str(row, key)) ? null : Str(row, key);
        private static int? IntOrNull(IDictionary<string, object?> row, string key)
            => int.TryParse(Str(row, key), out var i) ? i : null;
        private static int? FirstInt(IDictionary<string, object?> row, params string[] keys)
            => keys.Select(k => IntOrNull(row, k)).FirstOrDefault(v => v.HasValue);
        private static object? Obj(IDictionary<string, object?> row, string key)
            => row.TryGetValue(key, out var v) && v is not DBNull ? v : null;
        private static bool Bool(IDictionary<string, object?> row, string key)
            => row.TryGetValue(key, out var v) && v is not null && v is not DBNull && Convert.ToBoolean(v);
        private static string? FirstString(IDictionary<string, object?> row, params string[] keys)
            => keys.Select(k => Str(row, k)).FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));
        private static object? FirstObject(IDictionary<string, object?> row, params string[] keys)
            => keys.Select(k => Obj(row, k)).FirstOrDefault(v => v is not null);
        private static bool FirstBool(IDictionary<string, object?> row, params string[] keys)
            => keys.Select(k => Obj(row, k)).FirstOrDefault(v => v is not null) is { } v && Convert.ToBoolean(v);
        private static string? FormatValue(object? value) => value switch
        {
            null => null,
            DateTime dt => dt.ToString("O"),
            DateTimeOffset dto => dto.ToString("O"),
            _ => value.ToString()
        };

        private string AuthTable(string tableName)
            => $"[{EscapeIdentifier(_options.AuthDatabaseName)}].[dbo].[{EscapeIdentifier(tableName)}]";
        private static string EscapeIdentifier(string value) => value.Replace("]", "]]");

        private sealed class ColumnInfo
        {
            public string Name { get; set; } = "";
            public string Type { get; set; } = "";
            public bool Nullable { get; set; }
            public bool IsIdentity { get; set; }
        }
    }
}
