using System.Collections.Generic;
using System.Threading.Tasks;
using DocApi.DTOs;

namespace DocApi.Repositories.Interfaces
{
    public interface IModuleRepository
    {
        Task<IEnumerable<ModuleResponse>> LoadModulesAsync();
        Task<ModuleResponse?> GetModuleByIdAsync(string id);
        Task<ModuleResponse> UpsertModuleAsync(ModuleRequest request);
        Task DeleteModuleAsync(string id);
    }
}
