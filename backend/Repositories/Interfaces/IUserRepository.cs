using DocApi.Domain.Entities;

namespace DocApi.Repositories.Interfaces
{
    public interface IUserRepository
    {
        Task<User?> GetByIdAsync(int id);
        Task<User?> GetByEmailAsync(string email);
        Task<IEnumerable<User>> GetAllAsync();
        Task<IEnumerable<User>> GetByOrganizationAsync(int organizationId);
        Task<User?> GetByIdInOrganizationAsync(int id, int organizationId);
        Task<int> CreateAsync(User user);
        Task<bool> UpdateAsync(User user);
        Task<bool> UpdateWithoutPasswordAsync(User user);
        Task<bool> DeleteAsync(int id);
        Task<bool> ExistsAsync(string username, string email);
        Task<bool> ExistsAsync(string username, string email, int? excludedUserId);
    }
}
