using System.Text.Json.Nodes;
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
        public async Task<ActionResult<IEnumerable<object>>> GetAll()
        {
            return Ok(await _service.GetTemplatesAsync(CurrentUser()));
        }

        [HttpGet("{id}")]
        [Authorize]
        public async Task<ActionResult<object>> GetById(string id)
        {
            var template = await _service.GetTemplateByIdAsync(id);
            return template is null ? NotFound() : Ok(template);
        }

        [HttpPost]
        [Authorize]
        public async Task<ActionResult<object>> Create([FromBody] JsonObject template)
        {
            return Ok(await _service.UpsertTemplateAsync(template));
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<ActionResult<object>> Update(string id, [FromBody] JsonObject template)
        {
            template["id"] = id;
            return Ok(await _service.UpsertTemplateAsync(template));
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(string id)
        {
            await _service.DeleteTemplateAsync(id);
            return NoContent();
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
    }
}
