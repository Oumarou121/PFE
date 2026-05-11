using DocApi.DTOs;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api/templates")]
    public class TemplatesController : ControllerBase
    {
        private readonly IEditorService _service;

        public TemplatesController(IEditorService service)
        {
            _service = service;
        }

        [HttpGet]
        [Authorize]
        public async Task<ActionResult<IEnumerable<TemplateResponse>>> GetAll()
        {
            return Ok(await _service.GetTemplatesAsync(CurrentUser()));
        }

        [HttpGet("{id}")]
        [Authorize]
        public async Task<ActionResult<TemplateResponse>> GetById(string id)
        {
            var template = await _service.GetTemplateByIdAsync(id);
            return template is null ? NotFound() : Ok(template);
        }

        [HttpPost]
        [Authorize]
        public async Task<ActionResult<TemplateResponse>> Create([FromBody] TemplateRequest template)
        {
            return Ok(await _service.UpsertTemplateAsync(template));
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<ActionResult<TemplateResponse>> Update(string id, [FromBody] TemplateRequest template)
        {
            template.Id = id;
            return Ok(await _service.UpsertTemplateAsync(template));
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(string id)
        {
            await _service.DeleteTemplateAsync(id);
            return NoContent();
        }

        private AuthUserResponse? CurrentUser()
        {
            if (User.Identity?.IsAuthenticated != true) return null;
            return new AuthUserResponse
            {
                Id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty,
                Name = User.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
                Email = User.FindFirstValue(ClaimTypes.Email) ?? string.Empty,
                Role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty,
                OrganizationId = User.FindFirstValue("organizationId"),
                Profile = string.Empty,
                ProfileDetail = null,
                AccessAllYears = false,
                AccessYearList = null
            };
        }
    }
}
