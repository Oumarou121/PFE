using System.Data;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Dapper;
using DocApi.Infrastructure;
using DocApi.Repositories.Interfaces;
using Microsoft.Extensions.Options;

namespace DocApi.Repositories
{
    public class EditorDatabaseOptions
    {
        public string InternalDatabaseName { get; set; } = "UnivAdENIMDB";
        public string AuthDatabaseName { get; set; } = "DSSGAEIAM";
    }

    public class EditorRepository : IEditorRepository
    {
        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
        private readonly IEditorDbConnectionFactory _connectionFactory;
        private readonly IWebHostEnvironment _environment;
        private readonly EditorDatabaseOptions _options;

        public EditorRepository(IEditorDbConnectionFactory connectionFactory, IWebHostEnvironment environment, IOptions<EditorDatabaseOptions> options)
        {
            _connectionFactory = connectionFactory;
            _environment = environment;
            _options = options.Value;
        }

        public async Task EnsureSchemaAsync()
        {
            var schemaPath = Path.Combine(_environment.ContentRootPath, "Database", "EditorSchema.sql");
            if (!File.Exists(schemaPath)) return;

            using var connection = _connectionFactory.CreateConnection();
            await connection.ExecuteAsync(await File.ReadAllTextAsync(schemaPath));
        }

        public async Task<IEnumerable<object>> LoadFamiliesAsync()
        {
            if (!await TableExistsAsync("family")) return [];
            var hasBeneficiaryMode = await TableHasColumnAsync("family", "beneficiary_mode");
            var hasBeneficiaryTable = await TableHasColumnAsync("family", "beneficiary_table");
            var hasBeneficiaryLinkColumn = await TableHasColumnAsync("family", "beneficiary_link_column");
            var hasBeneficiaryDisplayColumn1 = await TableHasColumnAsync("family", "beneficiary_display_column_1");
            var hasBeneficiaryDisplayColumn2 = await TableHasColumnAsync("family", "beneficiary_display_column_2");
            var hasBeneficiarySql = await TableHasColumnAsync("family", "beneficiary_sql_text");
            var hasFilterCatalog = await TableHasColumnAsync("family", "filter_catalog_json");
            var sql = $"""
                SELECT id, nom, icon, description,
                       {(hasBeneficiaryMode ? "beneficiary_mode" : "'table'")} AS beneficiary_mode,
                       {(hasBeneficiaryTable ? "beneficiary_table" : "NULL")} AS beneficiary_table,
                       {(hasBeneficiaryLinkColumn ? "beneficiary_link_column" : "NULL")} AS beneficiary_link_column,
                       {(hasBeneficiaryDisplayColumn1 ? "beneficiary_display_column_1" : "NULL")} AS beneficiary_display_column_1,
                       {(hasBeneficiaryDisplayColumn2 ? "beneficiary_display_column_2" : "NULL")} AS beneficiary_display_column_2,
                       {(hasBeneficiarySql ? "beneficiary_sql_text" : "''")} AS beneficiary_sql_text,
                       {(hasFilterCatalog ? "filter_catalog_json" : "'[]'")} AS filter_catalog_json,
                       sql_text, created_at, classes_json
                FROM family
                ORDER BY nom
                """;
            using var connection = _connectionFactory.CreateConnection();
            var rows = await connection.QueryAsync(sql);
            return rows.Select(row =>
            {
                var item = Row(row);
                return new
                {
                    id = Str(item, "id"),
                    nom = Str(item, "nom"),
                    icon = Str(item, "icon"),
                    description = Str(item, "description"),
                    beneficiaryMode = Str(item, "beneficiary_mode") == "organization" ? "organization" : "table",
                    beneficiaryTable = Str(item, "beneficiary_mode") == "organization" ? null : Str(item, "beneficiary_table"),
                    beneficiaryLinkColumn = Str(item, "beneficiary_link_column"),
                    beneficiaryDisplayColumn1 = Str(item, "beneficiary_display_column_1"),
                    beneficiaryDisplayColumn2 = Str(item, "beneficiary_display_column_2"),
                    beneficiarySql = Str(item, "beneficiary_sql_text"),
                    filterCatalog = JsonValue(item, "filter_catalog_json", new JsonArray()),
                    sql = Str(item, "sql_text"),
                    createdAt = Obj(item, "created_at"),
                    classes = JsonValue(item, "classes_json", new JsonArray())
                };
            });
        }

        public async Task<object?> GetFamilyByIdAsync(string id)
        {
            return (await LoadFamiliesAsync()).FirstOrDefault(item => GetAnonymousProperty(item, "id") == id);
        }

        public async Task<object> UpsertFamilyAsync(JsonObject family)
        {
            if (string.IsNullOrWhiteSpace(JString(family, "id"))) family["id"] = $"fam_{Guid.NewGuid():N}";
            using var connection = _connectionFactory.CreateConnection();
            await connection.ExecuteAsync("""
                MERGE family AS target
                USING (SELECT @id AS id) AS src ON target.id = src.id
                WHEN MATCHED THEN UPDATE SET nom = @nom, icon = @icon, description = @description,
                  beneficiary_mode = @beneficiary_mode, beneficiary_table = @beneficiary_table,
                  beneficiary_link_column = @beneficiary_link_column,
                  beneficiary_display_column_1 = @beneficiary_display_column_1,
                  beneficiary_display_column_2 = @beneficiary_display_column_2,
                  beneficiary_sql_text = @beneficiary_sql_text, filter_catalog_json = @filter_catalog_json,
                  sql_text = @sql_text, classes_json = @classes_json
                WHEN NOT MATCHED THEN INSERT (id, nom, icon, description, beneficiary_mode, beneficiary_table,
                  beneficiary_link_column, beneficiary_display_column_1, beneficiary_display_column_2,
                  beneficiary_sql_text, filter_catalog_json, sql_text, created_at, classes_json)
                  VALUES (@id, @nom, @icon, @description, @beneficiary_mode, @beneficiary_table,
                  @beneficiary_link_column, @beneficiary_display_column_1, @beneficiary_display_column_2,
                  @beneficiary_sql_text, @filter_catalog_json, @sql_text, @created_at, @classes_json);
                """, FamilyParams(family));
            return (await GetFamilyByIdAsync(JString(family, "id")!))!;
        }

        public async Task DeleteFamilyAsync(string id)
        {
            using var connection = _connectionFactory.CreateConnection();
            await connection.ExecuteAsync("DELETE FROM template WHERE family_id = @id; DELETE FROM family WHERE id = @id", new { id });
        }

        public async Task<IEnumerable<object>> LoadOrganizationsAsync()
        {
            try
            {
                using var connection = _connectionFactory.CreateConnection();
                var rows = await connection.QueryAsync($"SELECT * FROM [{_options.AuthDatabaseName}].[dbo].[Organization] ORDER BY 1");
                return rows.Select(row =>
                {
                    var item = Row(row);
                    return new
                    {
                        id = FirstString(item, "Id", "ID", "id", "OrganizationId", "IdOrganization"),
                        nom = FirstString(item, "Name", "Nom", "Libelle", "Label", "Title") ?? "Organisation",
                        ville = FirstString(item, "City", "Ville", "Town"),
                        adresse = FirstString(item, "Address", "Adresse", "Address1"),
                        tel = FirstString(item, "Phone", "Telephone", "Tel", "Mobile"),
                        email = FirstString(item, "Email", "Mail"),
                        raw = item,
                        graphicCharters = Array.Empty<object>(),
                        createdAt = FirstObject(item, "CreatedAt", "CreatedDate"),
                        updatedAt = FirstObject(item, "UpdatedAt", "ModifiedDate")
                    };
                });
            }
            catch
            {
                return [];
            }
        }

        public Task<IEnumerable<object>> LoadAdminsAsync()
        {
            var admins = SeedUsers().Where(user => (string)user["role"]! == "admin").Select(user => new
            {
                id = user["id"],
                organizationId = user["organizationId"],
                nom = user["name"],
                email = user["email"],
                role = user["role"],
                profile = user["profile"],
                raw = user
            });
            return Task.FromResult<IEnumerable<object>>(admins);
        }

        public async Task<IEnumerable<object>> LoadGraphicChartersAsync()
        {
            if (!await TableExistsAsync("graphic_charter")) return [];
            using var connection = _connectionFactory.CreateConnection();
            var rows = await connection.QueryAsync("""
                SELECT id, etablissement_id, nom, description, is_default, config_json, created_at, updated_at
                FROM graphic_charter
                ORDER BY etablissement_id, is_default DESC, nom ASC
                """);
            return rows.Select(row =>
            {
                var item = Row(row);
                return new
                {
                    id = Str(item, "id"),
                    organizationId = StrOrNull(item, "etablissement_id"),
                    name = Str(item, "nom") ?? "",
                    description = Str(item, "description") ?? "",
                    isDefault = Bool(item, "is_default"),
                    config = JsonValue(item, "config_json", new JsonObject()),
                    createdAt = Obj(item, "created_at"),
                    updatedAt = Obj(item, "updated_at")
                };
            });
        }

        public async Task<object?> GetGraphicCharterByIdAsync(string id)
        {
            return (await LoadGraphicChartersAsync()).FirstOrDefault(item => GetAnonymousProperty(item, "id") == id);
        }

        public async Task<object> UpsertGraphicCharterAsync(JsonObject graphicCharter)
        {
            if (string.IsNullOrWhiteSpace(JString(graphicCharter, "id"))) graphicCharter["id"] = $"gch_{Guid.NewGuid():N}";
            using var connection = _connectionFactory.CreateConnection();
            await connection.ExecuteAsync("""
                MERGE graphic_charter AS target
                USING (SELECT @id AS id) AS src ON target.id = src.id
                WHEN MATCHED THEN UPDATE SET etablissement_id = @etablissement_id, nom = @nom,
                  description = @description, is_default = @is_default, config_json = @config_json,
                  updated_at = @updated_at
                WHEN NOT MATCHED THEN INSERT (id, etablissement_id, nom, description, is_default, config_json, created_at, updated_at)
                  VALUES (@id, @etablissement_id, @nom, @description, @is_default, @config_json, @created_at, @updated_at);
                """, GraphicCharterParams(graphicCharter));
            return (await GetGraphicCharterByIdAsync(JString(graphicCharter, "id")!))!;
        }

        public async Task DeleteGraphicCharterAsync(string id)
        {
            using var connection = _connectionFactory.CreateConnection();
            await connection.ExecuteAsync("UPDATE template SET graphic_charter_id = NULL WHERE graphic_charter_id = @id; DELETE FROM graphic_charter WHERE id = @id", new { id });
        }

        public async Task<IEnumerable<object>> LoadTemplatesAsync()
        {
            if (!await TableExistsAsync("template")) return [];
            var hasGraphicCharterId = await TableHasColumnAsync("template", "graphic_charter_id");
            var hasOrientation = await TableHasColumnAsync("template", "orientation");
            var hasFilterProfile = await TableHasColumnAsync("template", "filter_profile_json");
            var hasSectionDirections = await TableHasColumnAsync("template", "section_directions_json");
            var sql = $"""
                SELECT id, family_id, etablissement_id, nom, updated_at, has_header, has_footer,
                       {(hasGraphicCharterId ? "graphic_charter_id" : "NULL")} AS graphic_charter_id,
                       {(hasOrientation ? "orientation" : "'portrait'")} AS orientation,
                       {(hasFilterProfile ? "filter_profile_json" : "'[]'")} AS filter_profile_json,
                       {(hasSectionDirections ? "section_directions_json" : "'{}'")} AS section_directions_json,
                       page_margins_json,
                       header_html, body_html, footer_html
                FROM template
                ORDER BY updated_at DESC, nom ASC
                """;
            using var connection = _connectionFactory.CreateConnection();
            var rows = await connection.QueryAsync(sql);
            return rows.Select(row =>
            {
                var item = Row(row);
                return new
                {
                    id = Str(item, "id"),
                    familyId = Str(item, "family_id"),
                    organizationId = StrOrNull(item, "etablissement_id"),
                    nom = Str(item, "nom"),
                    updatedAt = Obj(item, "updated_at"),
                    hasHeader = Bool(item, "has_header"),
                    hasFooter = Bool(item, "has_footer"),
                    graphicCharterId = StrOrNull(item, "graphic_charter_id"),
                    filterProfile = JsonValue(item, "filter_profile_json", new JsonArray()),
                    sectionDirections = JsonValue(item, "section_directions_json", new JsonObject()),
                    orientation = Str(item, "orientation") ?? "portrait",
                    pageMargins = JsonValue(item, "page_margins_json", new JsonObject()),
                    header = Str(item, "header_html"),
                    body = Str(item, "body_html"),
                    footer = Str(item, "footer_html")
                };
            });
        }

        public async Task<object?> GetTemplateByIdAsync(string id)
        {
            return (await LoadTemplatesAsync()).FirstOrDefault(item => GetAnonymousProperty(item, "id") == id);
        }

        public async Task<object> UpsertTemplateAsync(JsonObject template)
        {
            if (string.IsNullOrWhiteSpace(JString(template, "id"))) template["id"] = $"tpl_{Guid.NewGuid():N}";
            using var connection = _connectionFactory.CreateConnection();
            await connection.ExecuteAsync("""
                MERGE template AS target
                USING (SELECT @id AS id) AS src ON target.id = src.id
                WHEN MATCHED THEN UPDATE SET family_id = @family_id, etablissement_id = @etablissement_id,
                  graphic_charter_id = @graphic_charter_id, nom = @nom, updated_at = @updated_at,
                  has_header = @has_header, has_footer = @has_footer, orientation = @orientation,
                  filter_profile_json = @filter_profile_json, section_directions_json = @section_directions_json,
                  page_margins_json = @page_margins_json, header_html = @header_html,
                  body_html = @body_html, footer_html = @footer_html
                WHEN NOT MATCHED THEN INSERT (id, family_id, etablissement_id, graphic_charter_id, nom, updated_at,
                  has_header, has_footer, orientation, filter_profile_json, section_directions_json,
                  page_margins_json, header_html, body_html, footer_html)
                  VALUES (@id, @family_id, @etablissement_id, @graphic_charter_id, @nom, @updated_at,
                  @has_header, @has_footer, @orientation, @filter_profile_json, @section_directions_json,
                  @page_margins_json, @header_html, @body_html, @footer_html);
                """, TemplateParams(template, JString(template, "organizationId")));
            return (await GetTemplateByIdAsync(JString(template, "id")!))!;
        }

        public async Task DeleteTemplateAsync(string id)
        {
            using var connection = _connectionFactory.CreateConnection();
            await connection.ExecuteAsync("DELETE FROM template WHERE id = @id", new { id });
        }

        public async Task<IEnumerable<object>> LoadTableViewsAsync()
        {
            if (!await TableExistsAsync("table_view_config")) return [];
            var hasFieldSettings = await TableHasColumnAsync("table_view_config", "field_settings_json");
            var sql = $"""
                SELECT id, table_name, label, visible_fields_json, editable_fields_json,
                       preview_fields_json,
                       {(hasFieldSettings ? "field_settings_json" : "'{}'")} AS field_settings_json,
                       created_at, updated_at
                FROM table_view_config
                ORDER BY label ASC, table_name ASC
                """;
            using var connection = _connectionFactory.CreateConnection();
            var rows = await connection.QueryAsync(sql);
            return rows.Select(row =>
            {
                var item = Row(row);
                return new
                {
                    id = Str(item, "id"),
                    tableName = Str(item, "table_name"),
                    label = Str(item, "label"),
                    visibleFields = JsonValue(item, "visible_fields_json", new JsonArray()),
                    editableFields = JsonValue(item, "editable_fields_json", new JsonArray()),
                    previewFields = JsonValue(item, "preview_fields_json", new JsonArray()),
                    fieldSettings = JsonValue(item, "field_settings_json", new JsonObject()),
                    createdAt = Obj(item, "created_at"),
                    updatedAt = Obj(item, "updated_at")
                };
            });
        }

        public async Task<object?> GetTableViewConfigByIdAsync(string id)
        {
            return (await LoadTableViewsAsync()).FirstOrDefault(item => GetAnonymousProperty(item, "id") == id);
        }

        public async Task<IDictionary<string, object?>> LoadSettingsAsync()
        {
            if (!await TableExistsAsync("app_setting")) return new Dictionary<string, object?>();
            using var connection = _connectionFactory.CreateConnection();
            var rows = await connection.QueryAsync("SELECT [key], value_json FROM app_setting");
            var settings = new Dictionary<string, object?>();
            foreach (var row in rows)
            {
                var item = Row(row);
                settings[Str(item, "key") ?? ""] = ParseJsonNode(Str(item, "value_json"), null);
            }

            return settings;
        }

        public async Task<object> LoadSchemaAsync()
        {
            using var connection = _connectionFactory.CreateConnection();
            var tables = (await connection.QueryAsync("""
                SELECT t.TABLE_NAME AS name, ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS comment
                FROM INFORMATION_SCHEMA.TABLES t
                LEFT JOIN sys.extended_properties ep ON ep.major_id = OBJECT_ID(t.TABLE_NAME) AND ep.minor_id = 0 AND ep.name = 'MS_Description'
                WHERE t.TABLE_TYPE = 'BASE TABLE'
                ORDER BY t.TABLE_NAME
                """)).Select(CleanRow);
            var columns = (await connection.QueryAsync("""
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
                """)).Select(CleanRow);
            var relations = (await connection.QueryAsync("""
                SELECT fk_tab.name AS [table], fk_col.name AS [column], pk_tab.name AS referencedTable, pk_col.name AS referencedColumn
                FROM sys.foreign_key_columns fkc
                JOIN sys.tables fk_tab ON fkc.parent_object_id = fk_tab.object_id
                JOIN sys.columns fk_col ON fkc.parent_object_id = fk_col.object_id AND fkc.parent_column_id = fk_col.column_id
                JOIN sys.tables pk_tab ON fkc.referenced_object_id = pk_tab.object_id
                JOIN sys.columns pk_col ON fkc.referenced_object_id = pk_col.object_id AND fkc.referenced_column_id = pk_col.column_id
                ORDER BY fk_tab.name
                """)).Select(CleanRow);
            return new { tables, columns, relations };
        }

        public async Task ReplaceStateAsync(JsonObject state, string? scopedOrganizationId, bool isSuperAdmin)
        {
            using var connection = _connectionFactory.CreateConnection();
            connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                if (isSuperAdmin)
                {
                    await connection.ExecuteAsync("DELETE FROM graphic_charter; DELETE FROM template; DELETE FROM family; DELETE FROM table_view_config; DELETE FROM app_setting;", transaction: transaction);
                    await SaveSettingsAsync(connection, transaction, state["settings"] as JsonObject);
                    foreach (var family in ArrayOf(state, "families")) await InsertFamilyAsync(connection, transaction, family);
                    foreach (var tableView in ArrayOf(state, "tableViews")) await InsertTableViewAsync(connection, transaction, tableView);
                }
                else
                {
                    if (string.IsNullOrWhiteSpace(scopedOrganizationId)) throw new InvalidOperationException("Organisation admin introuvable pour la sauvegarde.");
                    await connection.ExecuteAsync("DELETE FROM graphic_charter WHERE etablissement_id = @OrgId; DELETE FROM template WHERE etablissement_id = @OrgId;", new { OrgId = scopedOrganizationId }, transaction);
                }

                var organizations = ArrayOf(state, "organizations");
                foreach (var organization in organizations)
                {
                    var organizationId = JString(organization, "id");
                    if (!isSuperAdmin && organizationId != scopedOrganizationId) continue;
                    foreach (var charter in ArrayOf(organization, "graphicCharters")) await InsertGraphicCharterAsync(connection, transaction, charter, organizationId);
                }

                foreach (var template in ArrayOf(state, "templates"))
                {
                    var organizationId = JString(template, "organizationId") ?? scopedOrganizationId;
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

        public async Task<IEnumerable<object>> RunSelectQueryAsync(string sql, Dictionary<string, object?> parameters)
        {
            var cleaned = NormalizeSelectQueryForSqlServer((sql ?? string.Empty).Trim().TrimEnd(';'));
            if (!cleaned.StartsWith("select", StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Seules les requetes SELECT sont autorisees.");
            var dynamicParameters = new DynamicParameters();
            if (!parameters.ContainsKey("organizationId")) parameters["organizationId"] = null;
            cleaned = CompileNamedParameters(cleaned, parameters, dynamicParameters);
            using var connection = _connectionFactory.CreateConnection();
            return (await connection.QueryAsync(cleaned, dynamicParameters)).Select(CleanRow);
        }

        public async Task<IEnumerable<object>> GetTableViewRowsAsync(string? configId, int? limit, string? search, JsonObject? config)
        {
            var tableView = await ResolveTableViewAsync(configId, config) ?? throw new InvalidOperationException("Configuration introuvable.");
            var tableName = JString(tableView, "tableName")!;
            if (string.IsNullOrWhiteSpace(tableName) || !await TableExistsAsync(tableName)) return [];
            var columns = await GetColumnsAsync(tableName);
            var pk = await GetRowKeyAsync(tableName, columns);
            var allowed = columns.Select(c => c.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var previewFields = JsonArrayStrings(tableView, "previewFields").Where(allowed.Contains).ToArray();
            var selectFields = new[] { pk }.Concat(JsonArrayStrings(tableView, "visibleFields")).Concat(JsonArrayStrings(tableView, "editableFields")).Concat(previewFields).Where(allowed.Contains).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            if (selectFields.Length == 0) return [];
            var parameters = new DynamicParameters();
            parameters.Add("limit", Math.Max(1, Math.Min(limit ?? 200, 500)));
            var where = "";
            if (!string.IsNullOrWhiteSpace(search) && previewFields.Length > 0)
            {
                parameters.Add("search", $"%{search}%");
                where = "WHERE " + string.Join(" OR ", previewFields.Select(field => $"CONVERT(NVARCHAR(MAX), {Quote(field)}) LIKE @search"));
            }
            using var connection = _connectionFactory.CreateConnection();
            var rows = await connection.QueryAsync($"SELECT TOP (@limit) {string.Join(", ", selectFields.Select(Quote))} FROM {Quote(tableName)} {where} ORDER BY {Quote(pk)} DESC", parameters);
            return rows.Select(CleanRow);
        }

        public async Task<object?> GetTableViewRecordAsync(string? configId, object? rowId)
        {
            var tableView = await ResolveTableViewAsync(configId, null) ?? throw new InvalidOperationException("Configuration introuvable.");
            var tableName = JString(tableView, "tableName")!;
            if (string.IsNullOrWhiteSpace(tableName) || !await TableExistsAsync(tableName)) return null;
            var columns = await GetColumnsAsync(tableName);
            var pk = await GetRowKeyAsync(tableName, columns);
            var allowed = columns.Select(c => c.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var selectFields = new[] { pk }.Concat(JsonArrayStrings(tableView, "visibleFields")).Concat(JsonArrayStrings(tableView, "editableFields")).Where(allowed.Contains).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            if (selectFields.Length == 0) return null;
            using var connection = _connectionFactory.CreateConnection();
            var row = await connection.QueryFirstOrDefaultAsync($"SELECT TOP (1) {string.Join(", ", selectFields.Select(Quote))} FROM {Quote(tableName)} WHERE {Quote(pk)} = @rowId", new { rowId });
            return row is null ? null : CleanRow(row);
        }

        public async Task<object?> UpdateTableViewRecordAsync(string? configId, object? rowId, Dictionary<string, object?> values)
        {
            var tableView = await ResolveTableViewAsync(configId, null) ?? throw new InvalidOperationException("Configuration introuvable.");
            var tableName = JString(tableView, "tableName")!;
            if (string.IsNullOrWhiteSpace(tableName) || !await TableExistsAsync(tableName)) return null;
            var editable = JsonArrayStrings(tableView, "editableFields").ToHashSet(StringComparer.OrdinalIgnoreCase);
            var tableColumns = await GetColumnsAsync(tableName);
            var columns = tableColumns.Where(column => editable.Contains(column.Name) && values.ContainsKey(column.Name)).ToArray();
            if (columns.Length > 0)
            {
                var parameters = new DynamicParameters();
                parameters.Add("rowId", rowId);
                foreach (var column in columns) parameters.Add(column.Name, values[column.Name]);
                using var connection = _connectionFactory.CreateConnection();
                var pk = await GetRowKeyAsync(tableName, tableColumns);
                await connection.ExecuteAsync($"UPDATE {Quote(tableName)} SET {string.Join(", ", columns.Select(c => $"{Quote(c.Name)} = @{c.Name}"))} WHERE {Quote(pk)} = @rowId", parameters);
            }
            return await GetTableViewRecordAsync(configId, rowId);
        }

        public async Task<object?> CreateTableViewRecordAsync(string? configId, Dictionary<string, object?> values, JsonObject? config)
        {
            var tableView = await ResolveTableViewAsync(configId, config) ?? throw new InvalidOperationException("Configuration introuvable.");
            var tableName = JString(tableView, "tableName")!;
            if (string.IsNullOrWhiteSpace(tableName) || !await TableExistsAsync(tableName)) return null;
            var editable = JsonArrayStrings(tableView, "editableFields").ToHashSet(StringComparer.OrdinalIgnoreCase);
            var tableColumns = await GetColumnsAsync(tableName);
            var columns = tableColumns.Where(column => editable.Contains(column.Name) && !column.IsIdentity && values.ContainsKey(column.Name)).ToArray();
            var pk = await GetRowKeyAsync(tableName, tableColumns);
            var parameters = new DynamicParameters();
            foreach (var column in columns) parameters.Add(column.Name, values[column.Name]);
            var insertSql = columns.Length == 0
                ? $"INSERT INTO {Quote(tableName)} OUTPUT INSERTED.{Quote(pk)} AS inserted_id DEFAULT VALUES"
                : $"INSERT INTO {Quote(tableName)} ({string.Join(", ", columns.Select(c => Quote(c.Name)))}) OUTPUT INSERTED.{Quote(pk)} AS inserted_id VALUES ({string.Join(", ", columns.Select(c => "@" + c.Name))})";
            using var connection = _connectionFactory.CreateConnection();
            var insertedId = await connection.ExecuteScalarAsync<object>(insertSql, parameters);
            return await GetTableViewRecordAsync(JString(tableView, "id"), insertedId);
        }

        public async Task DeleteTableViewRecordAsync(string? configId, object? rowId)
        {
            var tableView = await ResolveTableViewAsync(configId, null) ?? throw new InvalidOperationException("Configuration introuvable.");
            var tableName = JString(tableView, "tableName")!;
            if (string.IsNullOrWhiteSpace(tableName) || !await TableExistsAsync(tableName)) return;
            var pk = await GetRowKeyAsync(tableName, await GetColumnsAsync(tableName));
            using var connection = _connectionFactory.CreateConnection();
            await connection.ExecuteAsync($"DELETE FROM {Quote(tableName)} WHERE {Quote(pk)} = @rowId", new { rowId });
        }

        public async Task<IEnumerable<object>> GetLookupOptionsAsync(string? configId, string? fieldName, JsonObject? config)
        {
            var tableView = await ResolveTableViewAsync(configId, config) ?? throw new InvalidOperationException("Configuration introuvable.");
            var settings = tableView["fieldSettings"] as JsonObject;
            var field = string.IsNullOrWhiteSpace(fieldName) ? null : settings?[fieldName] as JsonObject;
            if (field is null || JString(field, "displayMode") != "lookup") return [];
            var table = JString(field, "lookupTable");
            var valueColumn = JString(field, "lookupValueColumn");
            var labelColumn = JString(field, "lookupLabelColumn");
            if (string.IsNullOrWhiteSpace(table) || string.IsNullOrWhiteSpace(valueColumn) || string.IsNullOrWhiteSpace(labelColumn)) return [];
            if (!await TableExistsAsync(table)) return [];
            var lookupColumns = (await GetColumnsAsync(table)).Select(column => column.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (!lookupColumns.Contains(valueColumn) || !lookupColumns.Contains(labelColumn)) return [];
            using var connection = _connectionFactory.CreateConnection();
            var rows = await connection.QueryAsync($"SELECT CONVERT(NVARCHAR(4000), {Quote(valueColumn)}) AS value, CONVERT(NVARCHAR(4000), {Quote(labelColumn)}) AS label FROM {Quote(table)} WHERE {Quote(valueColumn)} IS NOT NULL ORDER BY CONVERT(NVARCHAR(4000), {Quote(labelColumn)}) ASC");
            return rows.Select(CleanRow);
        }

        public async Task<object> UpsertTableViewConfigAsync(JsonObject tableView)
        {
            var normalized = NormalizeTableView(tableView);
            using var connection = _connectionFactory.CreateConnection();
            await connection.ExecuteAsync("""
                MERGE table_view_config AS target
                USING (SELECT @id AS id) AS src ON target.id = src.id
                WHEN MATCHED THEN UPDATE SET table_name = @table_name, label = @label,
                  visible_fields_json = @visible_fields_json, editable_fields_json = @editable_fields_json,
                  preview_fields_json = @preview_fields_json, field_settings_json = @field_settings_json, updated_at = @updated_at
                WHEN NOT MATCHED THEN INSERT (id, table_name, label, visible_fields_json, editable_fields_json, preview_fields_json, field_settings_json, created_at, updated_at)
                  VALUES (@id, @table_name, @label, @visible_fields_json, @editable_fields_json, @preview_fields_json, @field_settings_json, @created_at, @updated_at);
                """, TableViewParams(normalized));
            return normalized;
        }

        public async Task DeleteTableViewConfigAsync(string? id)
        {
            using var connection = _connectionFactory.CreateConnection();
            await connection.ExecuteAsync("DELETE FROM table_view_config WHERE id = @id", new { id });
        }

        private async Task<JsonObject?> ResolveTableViewAsync(string? configId, JsonObject? provided)
        {
            if (provided is not null && !string.IsNullOrWhiteSpace(JString(provided, "tableName")))
            {
                if (string.IsNullOrWhiteSpace(JString(provided, "id")) && !string.IsNullOrWhiteSpace(configId)) provided["id"] = configId;
                return NormalizeTableView(provided);
            }
            using var connection = _connectionFactory.CreateConnection();
            var row = await connection.QueryFirstOrDefaultAsync("SELECT TOP (1) * FROM table_view_config WHERE id = @configId", new { configId });
            if (row is null) return null;
            var item = Row(row);
            return NormalizeTableView(new JsonObject
            {
                ["id"] = Str(item, "id"),
                ["tableName"] = Str(item, "table_name"),
                ["label"] = Str(item, "label"),
                ["visibleFields"] = JsonValue(item, "visible_fields_json", new JsonArray()),
                ["editableFields"] = JsonValue(item, "editable_fields_json", new JsonArray()),
                ["previewFields"] = JsonValue(item, "preview_fields_json", new JsonArray()),
                ["fieldSettings"] = JsonValue(item, "field_settings_json", new JsonObject()),
                ["createdAt"] = Str(item, "created_at"),
                ["updatedAt"] = Str(item, "updated_at")
            });
        }

        private async Task<bool> TableExistsAsync(string tableName)
        {
            using var connection = _connectionFactory.CreateConnection();
            var count = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName AND TABLE_TYPE = 'BASE TABLE'", new { tableName });
            return count > 0;
        }

        private async Task<bool> TableHasColumnAsync(string tableName, string columnName)
        {
            using var connection = _connectionFactory.CreateConnection();
            var count = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName AND COLUMN_NAME = @columnName",
                new { tableName, columnName });
            return count > 0;
        }

        private async Task<ColumnInfo[]> GetColumnsAsync(string tableName)
        {
            using var connection = _connectionFactory.CreateConnection();
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

        private async Task<string> GetPrimaryKeyAsync(string tableName)
        {
            using var connection = _connectionFactory.CreateConnection();
            return await connection.ExecuteScalarAsync<string?>("""
                SELECT TOP (1) kcu.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_NAME = kcu.TABLE_NAME
                WHERE tc.TABLE_NAME = @tableName AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                ORDER BY kcu.ORDINAL_POSITION
                """, new { tableName }) ?? "id";
        }

        private async Task<string> GetRowKeyAsync(string tableName, IReadOnlyCollection<ColumnInfo> columns)
        {
            var primaryKey = await GetPrimaryKeyAsync(tableName);
            if (!string.IsNullOrWhiteSpace(primaryKey) && columns.Any(column => string.Equals(column.Name, primaryKey, StringComparison.OrdinalIgnoreCase)))
            {
                return primaryKey;
            }
            return columns.FirstOrDefault(column => string.Equals(column.Name, "id", StringComparison.OrdinalIgnoreCase))?.Name
                ?? columns.FirstOrDefault(column => column.IsIdentity)?.Name
                ?? columns.FirstOrDefault()?.Name
                ?? throw new InvalidOperationException("Cle primaire introuvable.");
        }

        private static string CompileNamedParameters(string querySql, Dictionary<string, object?> values, DynamicParameters output)
        {
            return Regex.Replace(querySql, @":([a-zA-Z_]\w*)", match =>
            {
                var key = match.Groups[1].Value;
                output.Add(key, values.TryGetValue(key, out var value) ? NormalizeParameterValue(value) : null);
                return "@" + key;
            });
        }

        private static object? NormalizeParameterValue(object? value)
        {
            if (value is JsonElement element)
            {
                return element.ValueKind switch
                {
                    JsonValueKind.String => element.GetString(),
                    JsonValueKind.Number when element.TryGetInt64(out var longValue) => longValue,
                    JsonValueKind.Number when element.TryGetDouble(out var doubleValue) => doubleValue,
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Null => null,
                    _ => element.ToString()
                };
            }
            return value;
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
        {
            return Regex.Replace(sql, @"`([^`]+)`", match => Quote(match.Groups[1].Value));
        }

        private static string ConvertLegacyFunctions(string sql)
        {
            return Regex.Replace(sql, @"\bIFNULL\s*\(", "ISNULL(", RegexOptions.IgnoreCase);
        }

        private static string ApplyTopLevelLimit(string sql)
        {
            var match = Regex.Match(sql, @"\s+LIMIT\s+(\d+)\s*$", RegexOptions.IgnoreCase);
            if (!match.Success) return sql;
            var limit = match.Groups[1].Value;
            var withoutLimit = sql[..match.Index].TrimEnd();
            if (Regex.IsMatch(withoutLimit, @"^\s*SELECT\s+TOP\s*\(", RegexOptions.IgnoreCase)) return withoutLimit;
            return Regex.Replace(withoutLimit, @"^\s*SELECT\s+", $"SELECT TOP ({limit}) ", RegexOptions.IgnoreCase);
        }

        private static string StripDanglingSelectCommas(string sql)
        {
            return Regex.Replace(sql, @",\s+FROM\s+", " FROM ", RegexOptions.IgnoreCase);
        }

        private static async Task SaveSettingsAsync(IDbConnection connection, IDbTransaction transaction, JsonObject? settings)
        {
            if (settings is null) return;
            foreach (var (key, value) in settings)
            {
                await connection.ExecuteAsync("INSERT INTO app_setting ([key], value_json) VALUES (@key, @value)", new { key, value = value?.ToJsonString(JsonOptions) ?? "null" }, transaction);
            }
        }

        private static Task InsertFamilyAsync(IDbConnection connection, IDbTransaction transaction, JsonObject family)
        {
            return connection.ExecuteAsync("""
                INSERT INTO family (id, nom, icon, description, beneficiary_mode, beneficiary_table, beneficiary_link_column,
                  beneficiary_display_column_1, beneficiary_display_column_2, beneficiary_sql_text, filter_catalog_json,
                  sql_text, created_at, classes_json)
                VALUES (@id, @nom, @icon, @description, @beneficiary_mode, @beneficiary_table, @beneficiary_link_column,
                  @beneficiary_display_column_1, @beneficiary_display_column_2, @beneficiary_sql_text, @filter_catalog_json,
                  @sql_text, @created_at, @classes_json)
                """, new
            {
                id = JString(family, "id"),
                nom = JString(family, "nom") ?? "",
                icon = JString(family, "icon") ?? "",
                description = JString(family, "description") ?? "",
                beneficiary_mode = JString(family, "beneficiaryMode") == "organization" ? "organization" : "table",
                beneficiary_table = JString(family, "beneficiaryMode") == "organization" ? null : JString(family, "beneficiaryTable"),
                beneficiary_link_column = JString(family, "beneficiaryLinkColumn"),
                beneficiary_display_column_1 = JString(family, "beneficiaryDisplayColumn1"),
                beneficiary_display_column_2 = JString(family, "beneficiaryDisplayColumn2"),
                beneficiary_sql_text = JString(family, "beneficiarySql") ?? "",
                filter_catalog_json = JsonString(family, "filterCatalog", "[]"),
                sql_text = JString(family, "sql") ?? "",
                created_at = JString(family, "createdAt"),
                classes_json = JsonString(family, "classes", "[]")
            }, transaction);
        }

        private static Task InsertTableViewAsync(IDbConnection connection, IDbTransaction transaction, JsonObject tableView)
        {
            return connection.ExecuteAsync("""
                INSERT INTO table_view_config (id, table_name, label, visible_fields_json, editable_fields_json,
                  preview_fields_json, field_settings_json, created_at, updated_at)
                VALUES (@id, @table_name, @label, @visible_fields_json, @editable_fields_json,
                  @preview_fields_json, @field_settings_json, @created_at, @updated_at)
                """, TableViewParams(NormalizeTableView(tableView)), transaction);
        }

        private static Task InsertGraphicCharterAsync(IDbConnection connection, IDbTransaction transaction, JsonObject charter, string? organizationId)
        {
            return connection.ExecuteAsync("""
                INSERT INTO graphic_charter (id, etablissement_id, nom, description, is_default, config_json, created_at, updated_at)
                VALUES (@id, @etablissement_id, @nom, @description, @is_default, @config_json, @created_at, @updated_at)
                """, new
            {
                id = JString(charter, "id"),
                etablissement_id = organizationId,
                nom = JString(charter, "name") ?? "",
                description = JString(charter, "description") ?? "",
                is_default = JBool(charter, "isDefault"),
                config_json = JsonString(charter, "config", "{}"),
                created_at = JString(charter, "createdAt"),
                updated_at = JString(charter, "updatedAt") ?? JString(charter, "createdAt")
            }, transaction);
        }

        private static object GraphicCharterParams(JsonObject charter) => new
        {
            id = JString(charter, "id"),
            etablissement_id = JString(charter, "organizationId"),
            nom = JString(charter, "name") ?? JString(charter, "nom") ?? "",
            description = JString(charter, "description") ?? "",
            is_default = JBool(charter, "isDefault"),
            config_json = JsonString(charter, "config", "{}"),
            created_at = JString(charter, "createdAt") ?? DateTimeOffset.UtcNow.ToString("O"),
            updated_at = DateTimeOffset.UtcNow.ToString("O")
        };

        private static Task InsertTemplateAsync(IDbConnection connection, IDbTransaction transaction, JsonObject template, string? organizationId)
        {
            return connection.ExecuteAsync("""
                INSERT INTO template (id, family_id, etablissement_id, graphic_charter_id, nom, updated_at, has_header,
                  has_footer, orientation, filter_profile_json, section_directions_json, page_margins_json,
                  header_html, body_html, footer_html)
                VALUES (@id, @family_id, @etablissement_id, @graphic_charter_id, @nom, @updated_at, @has_header,
                  @has_footer, @orientation, @filter_profile_json, @section_directions_json, @page_margins_json,
                  @header_html, @body_html, @footer_html)
                """, new
            {
                id = JString(template, "id"),
                family_id = JString(template, "familyId"),
                etablissement_id = organizationId,
                graphic_charter_id = JString(template, "graphicCharterId"),
                nom = JString(template, "nom") ?? "",
                updated_at = JString(template, "updatedAt"),
                has_header = JBool(template, "hasHeader"),
                has_footer = JBool(template, "hasFooter"),
                orientation = JString(template, "orientation") ?? "portrait",
                filter_profile_json = JsonString(template, "filterProfile", "[]"),
                section_directions_json = JsonString(template, "sectionDirections", "{}"),
                page_margins_json = JsonString(template, "pageMargins", "{}"),
                header_html = JString(template, "header") ?? "",
                body_html = JString(template, "body") ?? "",
                footer_html = JString(template, "footer") ?? ""
            }, transaction);
        }

        private static object TableViewParams(JsonObject tableView) => new
        {
            id = JString(tableView, "id"),
            table_name = JString(tableView, "tableName"),
            label = JString(tableView, "label") ?? JString(tableView, "tableName"),
            visible_fields_json = JsonString(tableView, "visibleFields", "[]"),
            editable_fields_json = JsonString(tableView, "editableFields", "[]"),
            preview_fields_json = JsonString(tableView, "previewFields", "[]"),
            field_settings_json = JsonString(tableView, "fieldSettings", "{}"),
            created_at = JString(tableView, "createdAt") ?? DateTimeOffset.UtcNow.ToString("O"),
            updated_at = DateTimeOffset.UtcNow.ToString("O")
        };

        private static object FamilyParams(JsonObject family) => new
        {
            id = JString(family, "id"),
            nom = JString(family, "nom") ?? "",
            icon = JString(family, "icon") ?? "",
            description = JString(family, "description") ?? "",
            beneficiary_mode = JString(family, "beneficiaryMode") == "organization" ? "organization" : "table",
            beneficiary_table = JString(family, "beneficiaryMode") == "organization" ? null : JString(family, "beneficiaryTable"),
            beneficiary_link_column = JString(family, "beneficiaryLinkColumn"),
            beneficiary_display_column_1 = JString(family, "beneficiaryDisplayColumn1"),
            beneficiary_display_column_2 = JString(family, "beneficiaryDisplayColumn2"),
            beneficiary_sql_text = JString(family, "beneficiarySql") ?? "",
            filter_catalog_json = JsonString(family, "filterCatalog", "[]"),
            sql_text = JString(family, "sql") ?? "",
            created_at = JString(family, "createdAt") ?? DateTimeOffset.UtcNow.ToString("O"),
            classes_json = JsonString(family, "classes", "[]")
        };

        private static object TemplateParams(JsonObject template, string? organizationId) => new
        {
            id = JString(template, "id"),
            family_id = JString(template, "familyId"),
            etablissement_id = organizationId,
            graphic_charter_id = JString(template, "graphicCharterId"),
            nom = JString(template, "nom") ?? "",
            updated_at = DateTimeOffset.UtcNow.ToString("O"),
            has_header = JBool(template, "hasHeader"),
            has_footer = JBool(template, "hasFooter"),
            orientation = JString(template, "orientation") ?? "portrait",
            filter_profile_json = JsonString(template, "filterProfile", "[]"),
            section_directions_json = JsonString(template, "sectionDirections", "{}"),
            page_margins_json = JsonString(template, "pageMargins", "{}"),
            header_html = JString(template, "header") ?? "",
            body_html = JString(template, "body") ?? "",
            footer_html = JString(template, "footer") ?? ""
        };

        private static JsonObject NormalizeTableView(JsonObject source)
        {
            return new JsonObject
            {
                ["id"] = JString(source, "id") ?? $"tvw_{Guid.NewGuid():N}",
                ["tableName"] = JString(source, "tableName") ?? "",
                ["label"] = JString(source, "label") ?? "",
                ["visibleFields"] = source["visibleFields"]?.DeepClone() ?? new JsonArray(),
                ["editableFields"] = source["editableFields"]?.DeepClone() ?? new JsonArray(),
                ["previewFields"] = source["previewFields"]?.DeepClone() ?? new JsonArray(),
                ["fieldSettings"] = source["fieldSettings"]?.DeepClone() ?? new JsonObject(),
                ["createdAt"] = JString(source, "createdAt"),
                ["updatedAt"] = JString(source, "updatedAt")
            };
        }

        private static IEnumerable<JsonObject> ArrayOf(JsonObject source, string name) => source[name] is JsonArray array ? array.OfType<JsonObject>() : [];
        private static IEnumerable<string> JsonArrayStrings(JsonObject source, string name) => source[name] is JsonArray array ? array.Select(value => value?.GetValue<string>() ?? "").Where(value => !string.IsNullOrWhiteSpace(value)) : [];
        private static string? JString(JsonObject source, string name) => source[name]?.GetValue<object>()?.ToString();
        private static bool JBool(JsonObject source, string name) => source[name]?.GetValue<bool>() ?? false;
        private static string JsonString(JsonObject source, string name, string fallback) => source[name]?.ToJsonString(JsonOptions) ?? fallback;
        private static string Quote(string name) => $"[{name.Replace("]", "]]")}]";
        private static IDictionary<string, object?> Row(object row)
        {
            if (row is IDictionary<string, object?> nullableDictionary) return nullableDictionary;
            return ((IDictionary<string, object>)row).ToDictionary(pair => pair.Key, pair => (object?)pair.Value);
        }
        private static object CleanRow(object row) => Row(row).ToDictionary(pair => pair.Key, pair => pair.Value is DateTime dt ? dt.ToString("O") : pair.Value);
        private static string? Str(IDictionary<string, object?> row, string key) => row.TryGetValue(key, out var value) && value is not null && value is not DBNull ? value.ToString() : null;
        private static string? StrOrNull(IDictionary<string, object?> row, string key) => string.IsNullOrWhiteSpace(Str(row, key)) ? null : Str(row, key);
        private static object? Obj(IDictionary<string, object?> row, string key) => row.TryGetValue(key, out var value) && value is not DBNull ? value : null;
        private static bool Bool(IDictionary<string, object?> row, string key) => row.TryGetValue(key, out var value) && Convert.ToBoolean(value);
        private static JsonNode? JsonValue(IDictionary<string, object?> row, string key, JsonNode fallback)
        {
            try
            {
                var raw = Str(row, key);
                return string.IsNullOrWhiteSpace(raw) ? fallback.DeepClone() : JsonNode.Parse(raw) ?? fallback.DeepClone();
            }
            catch
            {
                return fallback.DeepClone();
            }
        }

        private static JsonNode? ParseJsonNode(string? raw, JsonNode? fallback)
        {
            try
            {
                return string.IsNullOrWhiteSpace(raw) ? fallback : JsonNode.Parse(raw);
            }
            catch
            {
                return fallback;
            }
        }
        private static string? FirstString(IDictionary<string, object?> row, params string[] keys) => keys.Select(key => Str(row, key)).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
        private static object? FirstObject(IDictionary<string, object?> row, params string[] keys) => keys.Select(key => Obj(row, key)).FirstOrDefault(value => value is not null);
        private static string? GetAnonymousProperty(object item, string propertyName) => item.GetType().GetProperty(propertyName)?.GetValue(item)?.ToString();

        private static IEnumerable<Dictionary<string, object?>> SeedUsers() =>
        [
            new() { ["id"] = "1", ["name"] = "Super Admin", ["email"] = "super.admin@gmail.com", ["password"] = "azerty", ["role"] = "supAdmin", ["organizationId"] = "2", ["profile"] = "" },
            new() { ["id"] = "2", ["name"] = "Admin", ["email"] = "admin@gmail.com", ["password"] = "azerty", ["role"] = "admin", ["organizationId"] = "2", ["profile"] = "" },
            new() { ["id"] = "3", ["name"] = "User", ["email"] = "user@gmail.com", ["password"] = "azerty", ["role"] = "user", ["organizationId"] = "2", ["profile"] = "" }
        ];

        private sealed class ColumnInfo
        {
            public string Name { get; set; } = "";
            public string Type { get; set; } = "";
            public bool Nullable { get; set; }
            public bool IsIdentity { get; set; }
        }
    }
}
