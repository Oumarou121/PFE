using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using DocApi.Domain.ValueObjects;
using DocApi.DTOs;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api")]
    [Authorize]  // Require authentication for all endpoints except login
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
        [AllowAnonymous]
        public async Task<ActionResult> Login([FromBody] EditorLoginRequest request)
        {
            try
            {
                var auth = await _authService.LoginAsync(new LoginRequest
                {
                    Email = request.Identifier,
                    Password = request.Password
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
                : Ok(new EditorApiResponse(true, User: user, RedirectTo: GetRoleHome(user.Role)));
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
        public async Task<ActionResult> Schema([FromQuery] string? databaseName = null)      
        {
            return Ok(new EditorApiResponse(true, Schema: await _service.LoadSchemaAsync(SanitizeDatabaseName(databaseName))));
        }

        [HttpGet("organizations")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<OrganizationResponse>>> Organizations()
        {
            return Ok(await _service.GetOrganizationsAsync());
        }

        [HttpGet("admins")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<AdminResponse>>> Admins()
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
                _logger.LogInformation("Query endpoint called. Sql: {Sql} Params: {Params}", request.Sql, JsonSerializer.Serialize(request.Params));
            }
            catch
            {
                // ignore logging errors
            }

            if (string.IsNullOrWhiteSpace(request.Sql))
            {
                return BadRequest(new EditorApiResponse(false, Error: "sql is required"));   
            }

            var rows = await _service.RunSelectQueryAsync(request.Sql, request.Params, SanitizeDatabaseName(request.DatabaseName));
            return Ok(new EditorApiResponse(true, Rows: rows));
        }

        [HttpPost("search-beneficiaries")]
        public async Task<ActionResult> SearchBeneficiaries([FromBody] SearchBeneficiariesRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.FamilyId))
                {
                    return BadRequest(new EditorApiResponse(false, Error: "familyId is required"));
                }

                var family = await _service.GetFamilyByIdAsync(request.FamilyId);
                if (family is null) return Ok(new EditorApiResponse(true, Rows: Array.Empty<IDictionary<string, object?>>()));

                var parameters = new Dictionary<string, object?>
                {
                    ["organizationId"] = request.OrganizationId
                };

                foreach (var (filterId, value) in request.Filters)
                {
                    var key = family.FilterCatalog
                        .FirstOrDefault(filter => string.Equals(filter.Id, filterId, StringComparison.OrdinalIgnoreCase))
                        ?.Key ?? filterId;
                    parameters[key] = value;
                    parameters[$"filter_{key}"] = value;
                }

                if (!string.IsNullOrWhiteSpace(request.Search)) parameters["search"] = request.Search;
                IEnumerable<IDictionary<string, object?>> rows;
                if (family.BeneficiaryMode == BeneficiaryMode.Organization)
                {
                    rows = (await _service.GetOrganizationsAsync())
                        .Select(organization => new Dictionary<string, object?>
                        {
                            ["id"] = organization.Id,
                            ["libelle"] = organization.Nom ?? organization.NameFr ?? organization.Acronym
                        })
                        .ToArray();
                }
                else
                {
                    var beneficiarySql = family.BeneficiarySql;
                    if (string.IsNullOrWhiteSpace(beneficiarySql))
                    {
                        var tableName = family.BeneficiaryTable;
                        var linkColumn = family.BeneficiaryLinkColumn ?? "id";
                        var display1 = family.BeneficiaryDisplayColumn1 ?? "Nom";
                        var display2 = family.BeneficiaryDisplayColumn2;
                        var labelExpr = string.IsNullOrWhiteSpace(display2)
                            ? $"CONVERT(NVARCHAR(255), {display1})"
                            : $"LTRIM(RTRIM(COALESCE(CONVERT(NVARCHAR(255), {display1}), '') + ' ' + COALESCE(CONVERT(NVARCHAR(255), {display2}), '')))";
                        beneficiarySql = $"SELECT {linkColumn} AS id, {labelExpr} AS libelle FROM {tableName}";
                    }

                    rows = (await _service.RunSelectQueryAsync(beneficiarySql ?? string.Empty, parameters, SanitizeDatabaseName(request.DatabaseName))).ToArray();
                }

                return Ok(new EditorApiResponse(true, Rows: rows));
            }
            catch (Exception ex)
            {
                try { _logger.LogError(ex, "SearchBeneficiaries failed"); } catch { }
                return StatusCode(500, new EditorApiResponse(false, Error: ex.Message));
            }
        }

        [HttpPost("preview")]
        public async Task<ActionResult> Preview([FromBody] PreviewRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.TemplateId)) return Ok(new { html = "" });

                var template = await _service.GetTemplateByIdAsync(request.TemplateId);
                if (template is null) return Ok(new { html = "" });

                IDictionary<string, string?> rowValues = new Dictionary<string, string?>();
                if (!string.IsNullOrWhiteSpace(request.BeneficiaryTable) && !string.IsNullOrWhiteSpace(request.BeneficiaryId))
                {
                    if (Regex.IsMatch(request.BeneficiaryTable, "^[A-Za-z0-9_]+$"))
                    {
                        var sql = $"SELECT TOP (1) * FROM {request.BeneficiaryTable} WHERE id = @id";
                        var rows = (await _service.RunSelectQueryAsync(sql, new Dictionary<string, object?> { ["id"] = request.BeneficiaryId }, SanitizeDatabaseName(request.DatabaseName))).ToArray();
                        if (rows.Length > 0)
                        {
                            foreach (var (key, value) in rows[0])
                            {
                                rowValues[key] = value?.ToString();
                            }
                        }
                    }
                }

                var html = template.Header + template.Body + template.Footer;

                if (rowValues.Count > 0)
                {
                    html = Regex.Replace(html, "\\{\\{\\s*(\\w+)\\s*\\}\\}|\\{\\s*(\\w+)\\s*\\}", match =>
                    {
                        var key = match.Groups[1].Success ? match.Groups[1].Value : match.Groups[2].Value;
                        return rowValues.TryGetValue(key, out var val) && val is not null
                            ? System.Net.WebUtility.HtmlEncode(val)
                            : match.Value;
                    });
                }

                return Ok(new { html });
            }
            catch (Exception ex)
            {
                try { _logger.LogError(ex, "Preview generation failed"); } catch { }
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("archives")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<DocumentResponse>>> Documents(
            [FromQuery] int? organizationId = null,
            [FromQuery] string? familyId = null,
            [FromQuery] string? beneficiaryTable = null,
            [FromQuery] string? beneficiaryId = null)
        {
            var rows = await _service.GetDocumentsAsync(new DocumentListRequest
            {
                OrganizationId = organizationId,
                FamilyId = familyId,
                BeneficiaryTable = beneficiaryTable,
                BeneficiaryId = beneficiaryId
            }, CurrentUser());
            return Ok(rows);
        }

        [HttpGet("archives/paged")]
        [Authorize]
        public async Task<ActionResult<DocumentListResponse>> DocumentsPaged(
            [FromQuery] int page = 1,
            [FromQuery] string? familyId = null,
            [FromQuery] string? beneficiaryTable = null,
            [FromQuery] string? beneficiaryId = null,
            [FromQuery] string sortBy = "generatedAt",
            [FromQuery] string sortOrder = "desc")
        {
            var result = await _service.GetDocumentsPagedAsync(new DocumentListRequest
            {
                Page = page,
                FamilyId = familyId,
                BeneficiaryTable = beneficiaryTable,
                BeneficiaryId = beneficiaryId,
                SortBy = sortBy,
                SortOrder = sortOrder
            }, CurrentUser());
            return Ok(result);
        }

        [HttpGet("archives/{id}")]
        [Authorize]
        public async Task<ActionResult<DocumentResponse>> DocumentById(string id)
        {
            var item = await _service.GetDocumentByIdAsync(id, CurrentUser());
            return item is null ? NotFound() : Ok(item);
        }

        [HttpPost("archives")]
        [Authorize]
        public async Task<ActionResult<DocumentResponse>> CreateDocument([FromBody] DocumentCreateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.FullHtml))
            {
                return BadRequest(new EditorApiResponse(false, Error: "fullHtml is required"));
            }

            var item = await _service.CreateDocumentAsync(request, CurrentUser());
            return Ok(item);
        }

        [HttpDelete("archives/{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteDocument(string id)
        {
            await _service.DeleteDocumentAsync(id, CurrentUser());
            return NoContent();
        }

        [HttpPost("table-view/rows")]
        public async Task<ActionResult> TableViewRows([FromBody] TableViewRowsRequest request)
        {
            request.DatabaseName = SanitizeDatabaseName(request.DatabaseName);
            return Ok(new EditorApiResponse(true, Rows: await _service.GetTableViewRowsAsync(request)));
        }

        [HttpPost("table-view/record")]
        public async Task<ActionResult> TableViewRecord([FromBody] TableViewRecordRequest request)
        {
            request.DatabaseName = SanitizeDatabaseName(request.DatabaseName);
            return Ok(new EditorApiResponse(true, Record: await _service.GetTableViewRecordAsync(request)));
        }

        [HttpPut("table-view/record")]
        public async Task<ActionResult> UpdateTableViewRecord([FromBody] TableViewRecordRequest request)
        {
            request.DatabaseName = SanitizeDatabaseName(request.DatabaseName);
            return Ok(new EditorApiResponse(true, Record: await _service.UpdateTableViewRecordAsync(request)));
        }

        [HttpPost("table-view/record/create")]
        public async Task<ActionResult> CreateTableViewRecord([FromBody] TableViewRecordRequest request)
        {
            request.DatabaseName = SanitizeDatabaseName(request.DatabaseName);
            return Ok(new EditorApiResponse(true, Record: await _service.CreateTableViewRecordAsync(request)));
        }

        [HttpDelete("table-view/record")]
        public async Task<ActionResult> DeleteTableViewRecord([FromBody] TableViewRecordRequest request)
        {
            request.DatabaseName = SanitizeDatabaseName(request.DatabaseName);
            await _service.DeleteTableViewRecordAsync(request);
            return Ok(new EditorApiResponse(true));
        }

        [HttpPost("table-view/lookup-options")]
        public async Task<ActionResult> LookupOptions([FromBody] TableViewLookupRequest request)
        {
            request.DatabaseName = SanitizeDatabaseName(request.DatabaseName);
            return Ok(new EditorApiResponse(true, Options: await _service.GetLookupOptionsAsync(request)));
        }

        [HttpPost("table-view-config")]
        public async Task<ActionResult> UpsertTableViewConfig([FromBody] TableViewConfigEnvelopeRequest request)
        {
            if (request.TableView is null) return BadRequest(new EditorApiResponse(false, Error: "tableView is required"));
            return Ok(new EditorApiResponse(true, TableView: await _service.UpsertTableViewConfigAsync(request.TableView)));
        }

        [HttpDelete("table-view-config")]
        public async Task<ActionResult> DeleteTableViewConfig([FromBody] TableViewConfigEnvelopeRequest request)
        {
            await _service.DeleteTableViewConfigAsync(request.Id);
            return Ok(new EditorApiResponse(true));
        }

        [HttpGet("table-view-config/{id}/filters")]
        public async Task<ActionResult> GetTableViewFilters(string id)
        {
            await _service.EnsureSchemaAsync();
            var config = await _service.GetTableViewConfigByIdAsync(id);
            if (config == null) return NotFound(new EditorApiResponse(false, Error: "TableView not found"));
            
            return Ok(new EditorApiResponse(true, Data: config.Filters ?? []));
        }

        [HttpPost("table-view-filters/options")]
        public async Task<ActionResult> GetTableFilterOptions([FromBody] GetFilterOptionsRequest request)
        {
            if (request?.Filter?.SourceType != TableFilterSourceType.Table)
                return BadRequest(new EditorApiResponse(false, Error: "Only table-based filters are supported"));

            if (string.IsNullOrWhiteSpace(request.Filter.SqlBuilder?.TableName))
                return BadRequest(new EditorApiResponse(false, Error: "SqlBuilder configuration is required"));

            try
            {
                var options = await _service.GetTableFilterOptionsAsync(request.Filter.SqlBuilder, request.DatabaseName);
                return Ok(new EditorApiResponse(true, Data: options));
            }
            catch (Exception ex)
            {
                return BadRequest(new EditorApiResponse(false, Error: $"Failed to fetch filter options: {ex.Message}"));
            }
        }

        private string? SanitizeDatabaseName(string? databaseName)
        {
            if (string.IsNullOrEmpty(databaseName)) return null;
            var user = CurrentUser();
            return user?.Role == "supAdmin" ? databaseName : null;
        }

        private AuthUserResponse? CurrentUser()        {
            if (User.Identity?.IsAuthenticated != true) return null;
            return new AuthUserResponse
            {
                Id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty,
                Name = User.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
                Email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty,
                Role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty,
                OrganizationId = int.TryParse(User.FindFirstValue("organizationId"), out var orgId) ? orgId : null,
                Profile = string.Empty,
                ProfileDetail = null,
                AccessAllYears = false,
                AccessYearList = null
            };
        }

        private static string GetRoleHome(string? role) => role switch
        {
            "supAdmin" => "/superAdmin.html",
            "admin" => "/admin.html",
            _ => "/user.html"
        };
    }
}
