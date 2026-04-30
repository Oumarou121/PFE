using System.Text.Json.Nodes;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api/table-view-configs")]
    public class TableViewConfigsController : ControllerBase
    {
        private readonly IEditorService _service;

        public TableViewConfigsController(IEditorService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetAll()
        {
            return Ok(await _service.GetTableViewConfigsAsync());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetById(string id)
        {
            var tableView = await _service.GetTableViewConfigByIdAsync(id);
            return tableView is null ? NotFound() : Ok(tableView);
        }

        [HttpPost]
        public async Task<ActionResult<object>> Create([FromBody] JsonObject tableView)
        {
            return Ok(await _service.UpsertTableViewConfigAsync(tableView));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<object>> Update(string id, [FromBody] JsonObject tableView)
        {
            tableView["id"] = id;
            return Ok(await _service.UpsertTableViewConfigAsync(tableView));
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            await _service.DeleteTableViewConfigAsync(id);
            return NoContent();
        }
    }
}
