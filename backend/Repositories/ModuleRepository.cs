using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Dapper;
using DocApi.DTOs;
using DocApi.Infrastructure;
using DocApi.Repositories.Interfaces;

namespace DocApi.Repositories
{
    public class ModuleRepository : IModuleRepository
    {
        private readonly IConfigDbConnectionFactory _configFactory;
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        public ModuleRepository(IConfigDbConnectionFactory configFactory)
        {
            _configFactory = configFactory;
        }

        private IDbConnection ConfigConnection() => _configFactory.CreateConnection();

        public async Task<IEnumerable<ModuleResponse>> LoadModulesAsync()
        {
            using var connection = ConfigConnection();
            
            var modulesSql = "SELECT * FROM [module] ORDER BY display_order ASC, name ASC";
            var moduleRows = await connection.QueryAsync(modulesSql);
            
            var tableViewsSql = "SELECT * FROM [module_table_view] ORDER BY order_index ASC";
            var tableViewRows = await connection.QueryAsync(tableViewsSql);
            
            var tableViewsByModule = tableViewRows
                .Select(r => Row(r))
                .GroupBy(r => Str(r, "module_id"))
                .ToDictionary(g => g.Key!, g => g.Select(r => new ModuleTableViewDto
                {
                    Id = Str(r, "id") ?? string.Empty,
                    ModuleId = Str(r, "module_id") ?? string.Empty,
                    TableViewConfigId = Str(r, "table_view_config_id") ?? string.Empty,
                    IsPrimary = Bool(r, "is_primary"),
                    IsManagementTable = Bool(r, "is_management_table"),
                    OrderIndex = Int(r, "order_index")
                }).ToList());

            return moduleRows.Select(r =>
            {
                var row = Row(r);
                var id = Str(row, "id") ?? string.Empty;
                return new ModuleResponse
                {
                    Id = id,
                    Name = Str(row, "name") ?? string.Empty,
                    Description = Str(row, "description"),
                    Icon = Str(row, "icon"),
                    MainTableViewId = Str(row, "main_table_view_id") ?? string.Empty,
                    IsActive = Bool(row, "is_active"),
                    DisplayOrder = Int(row, "display_order"),
                    OrganizationIds = JsonValue(row, "organization_ids_json", new List<int>()),
                    CreatedAt = Str(row, "created_at"),
                    UpdatedAt = Str(row, "updated_at"),
                    TableViews = tableViewsByModule.TryGetValue(id, out List<ModuleTableViewDto> tvs)
                        ? tvs
                        : new List<ModuleTableViewDto>()
                };
            });
        }

        public async Task<ModuleResponse?> GetModuleByIdAsync(string id)
            => (await LoadModulesAsync()).FirstOrDefault(m => m.Id == id);

        public async Task<ModuleResponse> UpsertModuleAsync(ModuleRequest request)
        {
            if (string.IsNullOrEmpty(request.Id)) request.Id = Guid.NewGuid().ToString("N");
            
            using var connection = ConfigConnection();
            if (connection.State != ConnectionState.Open) connection.Open();
            using var transaction = connection.BeginTransaction();
            
            try
            {
                var now = DateTime.UtcNow.ToString("O");
                
                await connection.ExecuteAsync(@"
                    IF EXISTS (SELECT 1 FROM [module] WHERE id = @Id)
                    BEGIN
                        UPDATE [module] SET 
                            name = @Name, 
                            description = @Description, 
                            icon = @Icon,
                            main_table_view_id = @MainTableViewId, 
                            is_active = @IsActive, 
                            display_order = @DisplayOrder,
                            organization_ids_json = @OrganizationIdsJson,
                            updated_at = @UpdatedAt
                        WHERE id = @Id
                    END
                    ELSE
                    BEGIN
                        INSERT INTO [module] (id, name, description, icon, main_table_view_id, is_active, display_order, organization_ids_json, created_at, updated_at)
                        VALUES (@Id, @Name, @Description, @Icon, @MainTableViewId, @IsActive, @DisplayOrder, @OrganizationIdsJson, @CreatedAt, @UpdatedAt)
                    END", 
                    new {
                        request.Id,
                        request.Name,
                        request.Description,
                        request.Icon,
                        request.MainTableViewId,
                        request.IsActive,
                        request.DisplayOrder,
                        OrganizationIdsJson = JsonSerializer.Serialize(request.OrganizationIds, JsonOptions),
                        CreatedAt = request.CreatedAt ?? now,
                        UpdatedAt = now
                    }, transaction);

                await connection.ExecuteAsync("DELETE FROM [module_table_view] WHERE module_id = @ModuleId", new { ModuleId = request.Id }, transaction);
                
                foreach (var tv in request.TableViews)
                {
                    var tvId = string.IsNullOrEmpty(tv.Id) ? Guid.NewGuid().ToString("N") : tv.Id;
                    await connection.ExecuteAsync(@"
                        INSERT INTO [module_table_view] (id, module_id, table_view_config_id, is_primary, is_management_table, order_index)
                        VALUES (@Id, @ModuleId, @TableViewConfigId, @IsPrimary, @IsManagementTable, @OrderIndex)",
                        new {
                            Id = tvId,
                            ModuleId = request.Id,
                            tv.TableViewConfigId,
                            tv.IsPrimary,
                            tv.IsManagementTable,
                            tv.OrderIndex
                        }, transaction);
                }

                transaction.Commit();
                return (await GetModuleByIdAsync(request.Id))!;
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        public async Task DeleteModuleAsync(string id)
        {
            using var connection = ConfigConnection();
            if (connection.State != ConnectionState.Open) connection.Open();
            using var transaction = connection.BeginTransaction();
            try
            {
                await connection.ExecuteAsync("DELETE FROM [module_table_view] WHERE module_id = @id", new { id }, transaction);
                await connection.ExecuteAsync("DELETE FROM [module] WHERE id = @id", new { id }, transaction);
                transaction.Commit();
            }
            catch
            {
                transaction.Rollback();
                throw;
            }
        }

        private static IDictionary<string, object?> Row(object row)
        {
            if (row is IDictionary<string, object?> d) return d;
            return ((IDictionary<string, object>)row).ToDictionary(p => p.Key, p => (object?)p.Value);
        }
        private static string? Str(IDictionary<string, object?> row, string key) => row.TryGetValue(key, out var v) && v != null && v != DBNull.Value ? v.ToString() : null;
        private static bool Bool(IDictionary<string, object?> row, string key) => row.TryGetValue(key, out var v) && v != null && v != DBNull.Value && Convert.ToBoolean(v);
        private static int Int(IDictionary<string, object?> row, string key) => row.TryGetValue(key, out var v) && v != null && v != DBNull.Value ? Convert.ToInt32(v) : 0;
        private static T JsonValue<T>(IDictionary<string, object?> row, string key, T fallback)
        {
            var raw = Str(row, key);
            return string.IsNullOrWhiteSpace(raw) ? fallback : JsonSerializer.Deserialize<T>(raw, JsonOptions) ?? fallback;
        }
    }
}
