using System.Collections.Generic;
using System.Threading.Tasks;
using DocApi.DTOs;

namespace DocApi.Services.Interfaces
{
    public interface IModuleService
    {
        Task<IEnumerable<ModuleResponse>> GetModulesAsync();
        Task<ModuleResponse?> GetModuleByIdAsync(string id);
        Task<ModuleResponse> SaveModuleAsync(ModuleRequest request);
        Task DeleteModuleAsync(string id);
    }
}
