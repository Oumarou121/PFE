using DocApi.DTOs;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api/families")]
    public class FamiliesController : ControllerBase
    {
        private readonly IEditorService _service;

        public FamiliesController(IEditorService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<FamilyResponse>>> GetAll()
        {
            return Ok(await _service.GetFamiliesAsync());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<FamilyResponse>> GetById(string id)
        {
            var family = await _service.GetFamilyByIdAsync(id);
            return family is null ? NotFound() : Ok(family);
        }

        [HttpPost]
        public async Task<ActionResult<FamilyResponse>> Create([FromBody] FamilyRequest family)
        {
            var saved = await _service.UpsertFamilyAsync(family);
            return Ok(saved);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<FamilyResponse>> Update(string id, [FromBody] FamilyRequest family)
        {
            family.Id = id;
            return Ok(await _service.UpsertFamilyAsync(family));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            await _service.DeleteFamilyAsync(id);
            return NoContent();
        }
    }
}
