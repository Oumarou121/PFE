using System.Text.Json.Nodes;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api/graphic-charters")]
    public class GraphicChartersController : ControllerBase
    {
        private readonly IEditorService _service;

        public GraphicChartersController(IEditorService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetAll()
        {
            return Ok(await _service.GetGraphicChartersAsync());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetById(string id)
        {
            var charter = await _service.GetGraphicCharterByIdAsync(id);
            return charter is null ? NotFound() : Ok(charter);
        }

        [HttpPost]
        public async Task<ActionResult<object>> Create([FromBody] JsonObject charter)
        {
            return Ok(await _service.UpsertGraphicCharterAsync(charter));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<object>> Update(string id, [FromBody] JsonObject charter)
        {
            charter["id"] = id;
            return Ok(await _service.UpsertGraphicCharterAsync(charter));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            await _service.DeleteGraphicCharterAsync(id);
            return NoContent();
        }
    }
}
