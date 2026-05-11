using DocApi.DTOs;
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
        public async Task<ActionResult<IEnumerable<TableViewConfigResponse>>> GetAll()
        {
            return Ok(await _service.GetTableViewConfigsAsync());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TableViewConfigResponse>> GetById(string id)
        {
            var tableView = await _service.GetTableViewConfigByIdAsync(id);
            return tableView is null ? NotFound() : Ok(tableView);
        }

        [HttpPost]
        public async Task<ActionResult<TableViewConfigResponse>> Create([FromBody] TableViewConfigRequest tableView)
        {
            return Ok(await _service.UpsertTableViewConfigAsync(tableView));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<TableViewConfigResponse>> Update(string id, [FromBody] TableViewConfigRequest tableView)
        {
            tableView.Id = id;
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
