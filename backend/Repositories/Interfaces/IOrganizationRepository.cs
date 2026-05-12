using DocApi.Domain.Entities;

namespace DocApi.Repositories.Interfaces
{
    public interface IOrganizationRepository
    {
        Task<Organization?> GetByIdAsync(int id);
    }
}