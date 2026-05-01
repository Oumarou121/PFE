using DocApi.DTOs;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api")]
    public class EditorController : ControllerBase
    {
        private readonly IEditorService _service;
        private readonly IAuthService _authService;

        public EditorController(IEditorService service, IAuthService authService)
        {
            _service = service;
            _authService = authService;
        }

        [HttpPost("login")]
        public async Task<ActionResult> Login([FromBody] EditorLoginRequest request)
        {
            try
            {
                var auth = await _authService.LoginAsync(new LoginRequest
                {
                    Username = request.Identifier ?? "",
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

        [HttpPut("state")]
        public async Task<ActionResult> ReplaceState([FromBody] EditorStateRequest request)
        {
            if (request.State is null) return BadRequest(new EditorApiResponse(false, Error: "state is required"));
            await _service.ReplaceStateAsync(request.State, CurrentUser());
            return Ok(new EditorApiResponse(true));
        }

        [HttpPost("query")]
        public async Task<ActionResult> Query([FromBody] EditorQueryRequest request)
        {
            return Ok(new EditorApiResponse(true, Rows: await _service.RunSelectQueryAsync(request.Sql, request.Params)));
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
