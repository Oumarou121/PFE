using DocApi.DTOs;

namespace DocApi.Services.Interfaces
{
    public interface IAdminUserService
    {
        Task<IEnumerable<AdminUserResponse>> GetOrganizationUsersAsync(int currentUserId, string currentUserRole, int? currentOrganizationId);
        Task<AdminUserResponse> GetOrganizationUserAsync(int id, int currentUserId, string currentUserRole, int? currentOrganizationId);
        Task<AdminUserResponse> CreateOrganizationUserAsync(AdminUserCreateRequest request, int currentUserId, string currentUserRole, int? currentOrganizationId);
        Task<AdminUserResponse> UpdateOrganizationUserAsync(int id, AdminUserUpdateRequest request, int currentUserId, string currentUserRole, int? currentOrganizationId);
        Task DeleteOrganizationUserAsync(int id, int currentUserId, string currentUserRole, int? currentOrganizationId);
    }
}
