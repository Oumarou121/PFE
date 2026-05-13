using DocApi.DTOs;
using DocApi.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DocApi.Controllers
{
    [ApiController]
    [Route("api/modules")]
    [Authorize]
    public class ModulesController : ControllerBase
    {
        private readonly IModuleService _service;

        public ModulesController(IModuleService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ModuleResponse>>> GetModules()
        {
            var modules = await _service.GetModulesAsync();
            return Ok(modules);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ModuleResponse>> GetModule(string id)
        {
            var module = await _service.GetModuleByIdAsync(id);
            if (module == null) return NotFound(new EditorApiResponse(false, Error: "Module non trouvé"));
            return Ok(module);
        }

        [HttpPost]
        public async Task<ActionResult<ModuleResponse>> SaveModule([FromBody] ModuleRequest request)
        {
            try
            {
                var result = await _service.SaveModuleAsync(request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new EditorApiResponse(false, Error: ex.Message));
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteModule(string id)
        {
            try
            {
                await _service.DeleteModuleAsync(id);
                return Ok(new EditorApiResponse(true));
            }
            catch (Exception ex)
            {
                return BadRequest(new EditorApiResponse(false, Error: ex.Message));
            }
        }
    }
}
