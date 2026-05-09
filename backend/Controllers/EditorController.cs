using DocApi.DTOs;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api")]
    public class EditorController : ControllerBase
    {
        private readonly IEditorService _service;
        private readonly IAuthService _authService;
        private readonly ILogger<EditorController> _logger;

        public EditorController(IEditorService service, IAuthService authService, ILogger<EditorController> logger)
        {
            _service = service;
            _authService = authService;
            _logger = logger;
        }

        [HttpPost("login")]
        public async Task<ActionResult> Login([FromBody] EditorLoginRequest request)
        {
            try
            {
                var auth = await _authService.LoginAsync(new LoginRequest
                {
                    Email = request.Identifier ?? "",
                    Password = request.Password ?? ""
                });
                return Ok(new EditorApiResponse(true, User: auth.User, Token: auth.Token, RedirectTo: auth.RedirectTo));
            }
            catch
            {
                return Unauthorized(new EditorApiResponse(false, Error: "Identifiants invalides"));
            }
        }

        [HttpPost("logout")]
        public ActionResult Logout()
        {
            return Ok(new EditorApiResponse(true));
        }

        [HttpGet("me")]
        [Authorize]
        public ActionResult Me()
        {
            var user = CurrentUser();
            return user is null
                ? Unauthorized(new EditorApiResponse(false, Error: "Not authenticated"))
                : Ok(new EditorApiResponse(true, User: user, RedirectTo: GetRoleHome(GetUserRole(user))));
        }

        [HttpPost("bootstrap")]
        [HttpGet("state")]
        [Authorize]
        public async Task<ActionResult> State()
        {
            var user = CurrentUser();
            var state = await _service.LoadStateAsync(user);
            return Ok(new EditorApiResponse(true, State: state, User: user));
        }

        [HttpGet("schema")]
        public async Task<ActionResult> Schema()
        {
            return Ok(new EditorApiResponse(true, Schema: await _service.LoadSchemaAsync()));
        }

        [HttpGet("organizations")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<object>>> Organizations()
        {
            return Ok(await _service.GetOrganizationsAsync());
        }

        [HttpGet("admins")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<object>>> Admins()
        {
            return Ok(await _service.GetAdminsAsync());
        }

        [HttpPut("state")]
        [Authorize]
        public async Task<ActionResult> ReplaceState([FromBody] EditorStateRequest request)
        {
            if (request.State is null) return BadRequest(new EditorApiResponse(false, Error: "state is required"));
            await _service.ReplaceStateAsync(request.State, CurrentUser());
            return Ok(new EditorApiResponse(true));
        }

        [HttpPost("query")]
        public async Task<ActionResult> Query([FromBody] EditorQueryRequest request)
        {
            try
            {
                _logger.LogInformation("Query endpoint called. Sql: {Sql} Params: {Params}", request.Sql, request.Params is null ? "null" : JsonSerializer.Serialize(request.Params));
            }
            catch
            {
                // ignore logging errors
            }
            if (string.IsNullOrWhiteSpace(request?.Sql))
            {
                return BadRequest(new EditorApiResponse(false, Error: "sql is required"));
            }

            var rows = await _service.RunSelectQueryAsync(request.Sql, request.Params);
            return Ok(new EditorApiResponse(true, Rows: rows));
        }

        [HttpPost("search-beneficiaries")]
        public async Task<ActionResult> SearchBeneficiaries([FromBody] JsonElement request)
        {
            try
            {
                if (!request.TryGetProperty("familyId", out var famIdElem) || famIdElem.ValueKind != JsonValueKind.String)
                {
                    return BadRequest(new EditorApiResponse(false, Error: "familyId is required"));
                }
                var familyId = famIdElem.GetString();

                string? organizationId = null;
                if (request.TryGetProperty("organizationId", out var orgElem) && orgElem.ValueKind == JsonValueKind.String)
                {
                    organizationId = orgElem.GetString();
                }

                JsonElement filtersElem = default;
                var hasFilters = request.TryGetProperty("filters", out filtersElem) && filtersElem.ValueKind == JsonValueKind.Object;

                string? search = null;
                if (request.TryGetProperty("search", out var searchElem) && searchElem.ValueKind == JsonValueKind.String)
                {
                    search = searchElem.GetString();
                }

                var limit = 200;
                if (request.TryGetProperty("limit", out var limitElem) && limitElem.ValueKind == JsonValueKind.Number && limitElem.TryGetInt32(out var l))
                {
                    limit = l;
                }

                var family = await _service.GetFamilyByIdAsync(familyId!);
                if (family == null) return Ok(new EditorApiResponse(true, Rows: Array.Empty<object>()));

                var familyJson = JsonSerializer.Serialize(family, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                var familyNode = JsonNode.Parse(familyJson) as JsonObject ?? new JsonObject();
                var filterCatalog = familyNode["filterCatalog"] as JsonArray ?? new JsonArray();

                var parameters = new Dictionary<string, object?>();
                parameters["organizationId"] = organizationId;
                if (hasFilters)
                {
                    foreach (var prop in filtersElem.EnumerateObject())
                    {
                        var filterId = prop.Name;
                        var valueElem = prop.Value;
                        // find matching filter definition in family.filterCatalog by id -> take its key
                        string key = filterCatalog
                            .Select(n => n as JsonObject)
                            .Where(o => o != null && o["id"] != null && string.Equals(o["id"]?.ToString(), filterId, StringComparison.OrdinalIgnoreCase))
                            .Select(o => o?["key"]?.ToString())
                            .FirstOrDefault() ?? filterId;
                        parameters[key] = valueElem;
                        parameters[$"filter_{key}"] = valueElem;
                    }
                }
                if (!string.IsNullOrWhiteSpace(search)) parameters["search"] = search;
                parameters["limit"] = limit;

                var beneficiaryMode = familyNode["beneficiaryMode"]?.ToString() ?? "table";
                IEnumerable<object> rows;
                if (string.Equals(beneficiaryMode, "organization", StringComparison.OrdinalIgnoreCase))
                {
                    var orgs = await _service.GetOrganizationsAsync();
                    rows = orgs.Select(o =>
                    {
                        var s = JsonSerializer.Serialize(o, new JsonSerializerOptions(JsonSerializerDefaults.Web));
                        var jo = JsonNode.Parse(s) as JsonObject;
                        return new
                        {
                            id = jo?["id"]?.ToString(),
                            libelle = jo?["nom"]?.ToString() ?? jo?["name"]?.ToString()
                        } as object;
                    }).ToArray();
                }
                else
                {
                    var beneficiarySql = familyNode["beneficiarySql"]?.ToString();
                    if (string.IsNullOrWhiteSpace(beneficiarySql))
                    {
                        var tableName = familyNode["beneficiaryTable"]?.ToString();
                        var linkColumn = familyNode["beneficiaryLinkColumn"]?.ToString() ?? "id";
                        var display1 = familyNode["beneficiaryDisplayColumn1"]?.ToString() ?? "Nom";
                        var display2 = familyNode["beneficiaryDisplayColumn2"]?.ToString();
                        var labelExpr = string.IsNullOrWhiteSpace(display2) ?
                            $"CONVERT(NVARCHAR(255), {display1})" :
                            $"LTRIM(RTRIM(COALESCE(CONVERT(NVARCHAR(255), {display1}), '') + ' ' + COALESCE(CONVERT(NVARCHAR(255), {display2}), '')))";
                        beneficiarySql = $"SELECT TOP ({limit}) {linkColumn} AS id, {labelExpr} AS libelle FROM {tableName}";
                    }
                    rows = (await _service.RunSelectQueryAsync(beneficiarySql ?? string.Empty, parameters)).ToArray();
                }

                return Ok(new EditorApiResponse(true, Rows: rows));
            }
            catch (Exception ex)
            {
                try { _logger?.LogError(ex, "SearchBeneficiaries failed"); } catch { }
                return StatusCode(500, new EditorApiResponse(false, Error: ex.Message));
            }
        }

        [HttpPost("preview")]
        public async Task<ActionResult> Preview([FromBody] DTOs.PreviewRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request?.TemplateId)) return Ok(new { html = "" });

                var template = await _service.GetTemplateByIdAsync(request.TemplateId);
                if (template == null) return Ok(new { html = "" });

                string header = template.GetType().GetProperty("header")?.GetValue(template)?.ToString() ?? "";
                string body = template.GetType().GetProperty("body")?.GetValue(template)?.ToString() ?? "";
                string footer = template.GetType().GetProperty("footer")?.GetValue(template)?.ToString() ?? "";

                // Try to fetch beneficiary row if table + id provided (basic safety: allow simple table names)
                IDictionary<string, string?> rowValues = new Dictionary<string, string?>();
                if (!string.IsNullOrWhiteSpace(request.BeneficiaryTable) && !string.IsNullOrWhiteSpace(request.BeneficiaryId))
                {
                    // allow only safe table names
                    if (Regex.IsMatch(request.BeneficiaryTable!, "^[A-Za-z0-9_]+$"))
                    {
                        var sql = $"SELECT TOP (1) * FROM {request.BeneficiaryTable} WHERE id = @id";
                        var rows = (await _service.RunSelectQueryAsync(sql, new Dictionary<string, object?> { ["id"] = request.BeneficiaryId })).ToArray();
                        if (rows.Length > 0)
                        {
                            var r = rows[0];
                            foreach (var p in r.GetType().GetProperties())
                            {
                                var v = p.GetValue(r)?.ToString();
                                rowValues[p.Name] = v;
                            }
                        }
                    }
                }

                var html = header + body + footer;

                if (rowValues.Count > 0)
                {
                    // replace {{field}} and {field} placeholders
                    html = Regex.Replace(html, "\\{\\{\\s*(\\w+)\\s*\\}\\}|\\{\\s*(\\w+)\\s*\\}", match =>
                    {
                        var key = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;
                        return rowValues.TryGetValue(key, out var val) && val != null ? System.Net.WebUtility.HtmlEncode(val) : match.Value;
                    });
                }

                return Ok(new { html });
            }
            catch (Exception ex)
            {
                try { _logger?.LogError(ex, "Preview generation failed"); } catch { }
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("table-view/rows")]
        public async Task<ActionResult> TableViewRows([FromBody] TableViewRowsRequest request)
        {
            return Ok(new EditorApiResponse(true, Rows: await _service.GetTableViewRowsAsync(request)));
        }

        [HttpPost("table-view/record")]
        public async Task<ActionResult> TableViewRecord([FromBody] TableViewRecordRequest request)
        {
            return Ok(new EditorApiResponse(true, Record: await _service.GetTableViewRecordAsync(request)));
        }

        [HttpPut("table-view/record")]
        public async Task<ActionResult> UpdateTableViewRecord([FromBody] TableViewRecordRequest request)
        {
            return Ok(new EditorApiResponse(true, Record: await _service.UpdateTableViewRecordAsync(request)));
        }

        [HttpPost("table-view/record/create")]
        public async Task<ActionResult> CreateTableViewRecord([FromBody] TableViewRecordRequest request)
        {
            return Ok(new EditorApiResponse(true, Record: await _service.CreateTableViewRecordAsync(request)));
        }

        [HttpDelete("table-view/record")]
        public async Task<ActionResult> DeleteTableViewRecord([FromBody] TableViewRecordRequest request)
        {
            await _service.DeleteTableViewRecordAsync(request);
            return Ok(new EditorApiResponse(true));
        }

        [HttpPost("table-view/lookup-options")]
        public async Task<ActionResult> LookupOptions([FromBody] TableViewLookupRequest request)
        {
            return Ok(new EditorApiResponse(true, Options: await _service.GetLookupOptionsAsync(request)));
        }

        [HttpPost("table-view-config")]
        public async Task<ActionResult> UpsertTableViewConfig([FromBody] TableViewConfigRequest request)
        {
            if (request.TableView is null) return BadRequest(new EditorApiResponse(false, Error: "tableView is required"));
            return Ok(new EditorApiResponse(true, TableView: await _service.UpsertTableViewConfigAsync(request.TableView)));
        }

        [HttpDelete("table-view-config")]
        public async Task<ActionResult> DeleteTableViewConfig([FromBody] TableViewConfigRequest request)
        {
            await _service.DeleteTableViewConfigAsync(request.Id);
            return Ok(new EditorApiResponse(true));
        }

        private object? CurrentUser()
        {
            if (User.Identity?.IsAuthenticated != true) return null;
            return new Dictionary<string, object?>
            {
                ["id"] = User.FindFirstValue(ClaimTypes.NameIdentifier),
                ["name"] = User.FindFirstValue(ClaimTypes.Name),
                ["email"] = User.FindFirstValue(ClaimTypes.Email),
                ["role"] = User.FindFirstValue(ClaimTypes.Role),
                ["organizationId"] = User.FindFirstValue("organizationId"),
                ["profile"] = ""
            };
        }

        private static string GetRoleHome(string? role) => role switch
        {
            "supAdmin" => "/superAdmin.html",
            "admin" => "/admin.html",
            _ => "/user.html"
        };

        private static string? GetUserRole(object user)
        {
            if (user is IDictionary<string, object?> dictionary && dictionary.TryGetValue("role", out var role)) return role?.ToString();
            return user.GetType().GetProperty("role")?.GetValue(user)?.ToString();
        }

    }
}
