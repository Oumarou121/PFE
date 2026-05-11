using DocApi.DTOs;
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
        public async Task<ActionResult<IEnumerable<GraphicCharterResponse>>> GetAll()
        {
            return Ok(await _service.GetGraphicChartersAsync());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<GraphicCharterResponse>> GetById(string id)
        {
            var charter = await _service.GetGraphicCharterByIdAsync(id);
            return charter is null ? NotFound() : Ok(charter);
        }

        [HttpPost]
        public async Task<ActionResult<GraphicCharterResponse>> Create([FromBody] GraphicCharterRequest charter)
        {
            return Ok(await _service.UpsertGraphicCharterAsync(charter));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<GraphicCharterResponse>> Update(string id, [FromBody] GraphicCharterRequest charter)
        {
            charter.Id = id;
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
