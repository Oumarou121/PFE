using DocApi.DTOs;
using DocApi.Common;
using DocApi.Services;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api")]
    public class EditorController : ControllerBase
    {
        private const string SessionCookie = "sirhdoc_session";
        private readonly IEditorService _service;
        private readonly JwtSettings _jwtSettings;

        public EditorController(IEditorService service, IOptions<JwtSettings> jwtSettings)
        {
            _service = service;
            _jwtSettings = jwtSettings.Value;
        }

        [HttpPost("login")]
        [HttpPost("auth/login")]
        public async Task<ActionResult> Login([FromBody] EditorLoginRequest request)
        {
            var user = await _service.LoginAsync(request);
            if (user is null) return Unauthorized(new EditorApiResponse(false, Error: "Identifiants invalides"));

            Response.Cookies.Append(SessionCookie, EditorService.CreateCookieValue(user), new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Secure = Request.IsHttps,
                Expires = DateTimeOffset.UtcNow.AddHours(8)
            });
            return Ok(new EditorApiResponse(true, User: user, Token: CreateJwt(user), RedirectTo: GetRoleHome(GetUserRole(user))));
        }

        [HttpPost("logout")]
        public ActionResult Logout()
        {
            Response.Cookies.Delete(SessionCookie);
            return Ok(new EditorApiResponse(true));
        }

        [HttpGet("me")]
        public ActionResult Me()
        {
            var user = CurrentUser();
            return user is null
                ? Unauthorized(new EditorApiResponse(false, Error: "Not authenticated"))
                : Ok(new EditorApiResponse(true, User: user, RedirectTo: GetRoleHome(GetUserRole(user))));
        }

        [HttpPost("bootstrap")]
        [HttpGet("state")]
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
            return Request.Cookies.TryGetValue(SessionCookie, out var cookie)
                ? _service.GetUserFromCookie(cookie)
                : null;
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

        private string CreateJwt(object user)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, GetUserValue(user, "id") ?? ""),
                new Claim(ClaimTypes.Name, GetUserValue(user, "name") ?? ""),
                new Claim(ClaimTypes.Email, GetUserValue(user, "email") ?? ""),
                new Claim(ClaimTypes.Role, GetUserRole(user) ?? "user"),
                new Claim("organizationId", GetUserValue(user, "organizationId") ?? "")
            };
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(
                issuer: _jwtSettings.Issuer,
                audience: _jwtSettings.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
                signingCredentials: credentials);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private static string? GetUserValue(object user, string key)
        {
            if (user is IDictionary<string, object?> dictionary && dictionary.TryGetValue(key, out var value)) return value?.ToString();
            return user.GetType().GetProperty(key)?.GetValue(user)?.ToString();
        }
    }
}
