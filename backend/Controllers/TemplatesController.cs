using System.Text.Json.Nodes;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

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
        public async Task<ActionResult<IEnumerable<object>>> GetAll()
        {
            return Ok(await _service.GetTemplatesAsync());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetById(string id)
        {
            var template = await _service.GetTemplateByIdAsync(id);
            return template is null ? NotFound() : Ok(template);
        }

        [HttpPost]
        public async Task<ActionResult<object>> Create([FromBody] JsonObject template)
        {
            return Ok(await _service.UpsertTemplateAsync(template));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<object>> Update(string id, [FromBody] JsonObject template)
        {
            template["id"] = id;
            return Ok(await _service.UpsertTemplateAsync(template));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            await _service.DeleteTemplateAsync(id);
            return NoContent();
        }
    }
}
