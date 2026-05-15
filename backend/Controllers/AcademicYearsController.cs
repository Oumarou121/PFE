using System.Security.Claims;
using DocApi.DTOs;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api/academic-years")]
    [Authorize]
    public class AcademicYearsController : ControllerBase
    {
        private readonly IEditorService _editorService;
        private readonly IAuthService _authService;

        public AcademicYearsController(IEditorService editorService, IAuthService authService)
        {
            _editorService = editorService;
            _authService = authService;
        }

        [HttpGet("config")]
        public async Task<ActionResult<AcademicYearConfigResponse?>> GetConfig([FromQuery] int? organizationId = null)
        {
            var currentUser = await CurrentUserAsync();
            var targetOrganizationId = organizationId ?? currentUser.OrganizationId;
            if (!targetOrganizationId.HasValue) return BadRequest(new { message = "organizationId is required" });
            if (!CanAccessOrganization(currentUser, targetOrganizationId.Value)) return Forbid();

            return Ok(await _editorService.GetAcademicYearConfigAsync(targetOrganizationId.Value));
        }

        [HttpPut("config")]
        public async Task<ActionResult<AcademicYearConfigResponse>> SaveConfig([FromBody] AcademicYearConfigRequest request)
        {
            var currentUser = await CurrentUserAsync();
            var saved = await _editorService.UpsertAcademicYearConfigAsync(request, currentUser);
            return Ok(saved);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AcademicYearResponse>>> List()
        {
            var currentUser = await CurrentUserAsync();
            return Ok(await _editorService.GetAcademicYearsAsync(currentUser));
        }

        [HttpPost]
        public async Task<ActionResult<AcademicYearResponse>> Create([FromBody] AcademicYearCreateRequest request)
        {
            var currentUser = await CurrentUserAsync();
            return Ok(await _editorService.CreateAcademicYearAsync(request, currentUser));
        }

        [HttpPost("{code}/close")]
        public async Task<ActionResult> Close([FromRoute] string code)
        {
            var currentUser = await CurrentUserAsync();
            await _editorService.CloseAcademicYearAsync(code, currentUser);
            return Ok(new { ok = true });
        }

        private async Task<AuthUserResponse> CurrentUserAsync()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrWhiteSpace(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                throw new UnauthorizedAccessException("Utilisateur invalide.");

            var profile = await _authService.GetUserProfileAsync(userId);
            return new AuthUserResponse
            {
                Id = profile.Id.ToString(),
                Email = profile.Email,
                Name = profile.Name,
                Role = profile.Role,
                OrganizationId = profile.OrganizationId,
                Profile = profile.Profile,
                ProfileDetail = profile.ProfileDetail,
                AccessAllYears = profile.AccessAllYears,
                AccessYearList = profile.AccessYearList,
                ModuleIds = profile.ModuleIds
            };
        }

        private static bool CanAccessOrganization(AuthUserResponse currentUser, int organizationId)
            => string.Equals(currentUser.Role, "supAdmin", StringComparison.OrdinalIgnoreCase)
               || currentUser.OrganizationId == organizationId;
    }
}
