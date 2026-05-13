using System.Collections.Generic;
using System.Threading.Tasks;
using DocApi.DTOs;
using DocApi.Repositories.Interfaces;
using DocApi.Services.Interfaces;

namespace DocApi.Services
{
    public class ModuleService : IModuleService
    {
        private readonly IModuleRepository _repository;

        public ModuleService(IModuleRepository repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<ModuleResponse>> GetModulesAsync()
        {
            return await _repository.LoadModulesAsync();
        }

        public async Task<ModuleResponse?> GetModuleByIdAsync(string id)
        {
            return await _repository.GetModuleByIdAsync(id);
        }

        public async Task<ModuleResponse> SaveModuleAsync(ModuleRequest request)
        {
            return await _repository.UpsertModuleAsync(request);
        }

        public async Task DeleteModuleAsync(string id)
        {
            await _repository.DeleteModuleAsync(id);
        }
    }
}
