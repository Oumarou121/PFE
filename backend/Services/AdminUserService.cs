using System.Text.Json;
using DocApi.Common;
using DocApi.Domain.Entities;
using DocApi.DTOs;
using DocApi.Repositories.Interfaces;
using DocApi.Services.Interfaces;

namespace DocApi.Services
{
    public class AdminUserService : IAdminUserService
    {
        private readonly IUserRepository _userRepository;

        public AdminUserService(IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task<IEnumerable<AdminUserResponse>> GetOrganizationUsersAsync(int currentUserId, string currentUserRole, int? currentOrganizationId)
        {
            var organizationId = RequireAdminOrganization(currentUserRole, currentOrganizationId);
            return (await _userRepository.GetByOrganizationAsync(organizationId))
                .Where(IsManagedPersonnel)
                .Select(ToResponse);
        }

        public async Task<AdminUserResponse> GetOrganizationUserAsync(int id, int currentUserId, string currentUserRole, int? currentOrganizationId)
        {
            var user = await LoadAllowedUserAsync(id, currentUserRole, currentOrganizationId);
            return ToResponse(user);
        }

        public async Task<AdminUserResponse> CreateOrganizationUserAsync(AdminUserCreateRequest request, int currentUserId, string currentUserRole, int? currentOrganizationId)
        {
            var organizationId = ResolveTargetOrganization(request.OrganizationId, currentUserRole, currentOrganizationId);
            ValidateManagedRole(request.Role, currentUserRole);

            if (await _userRepository.ExistsAsync(request.Name, request.Email))
            {
                throw new ServiceException("Un utilisateur avec ce nom ou cet email existe deja");
            }

            var user = new User
            {
                Username = request.Name,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = "user",
                OrganizationId = organizationId,
                Profile = request.Profile,
                ProfileDetail = request.ProfileDetail,
                AccessAllYears = request.AccessAllYears,
                AccessYearList = NormalizeJsonArray(request.AccessYearList),
                ModuleIds = SerializeModuleIds(request.ModuleIds),
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            user.Id = await _userRepository.CreateAsync(user);
            return ToResponse(user);
        }

        public async Task<AdminUserResponse> UpdateOrganizationUserAsync(int id, AdminUserUpdateRequest request, int currentUserId, string currentUserRole, int? currentOrganizationId)
        {
            var existing = await LoadAllowedUserAsync(id, currentUserRole, currentOrganizationId);
            var organizationId = ResolveTargetOrganization(request.OrganizationId ?? existing.OrganizationId, currentUserRole, currentOrganizationId);
            ValidateManagedRole(request.Role, currentUserRole);

            if (await _userRepository.ExistsAsync(request.Name, request.Email, id))
            {
                throw new ServiceException("Un utilisateur avec ce nom ou cet email existe deja");
            }

            existing.Username = request.Name;
            existing.Email = request.Email;
            existing.Role = "user";
            existing.OrganizationId = organizationId;
            existing.Profile = request.Profile;
            existing.ProfileDetail = request.ProfileDetail;
            existing.AccessAllYears = request.AccessAllYears;
            existing.AccessYearList = NormalizeJsonArray(request.AccessYearList);
            existing.ModuleIds = SerializeModuleIds(request.ModuleIds);
            existing.IsActive = request.IsActive;

            var updated = string.IsNullOrWhiteSpace(request.Password)
                ? await _userRepository.UpdateWithoutPasswordAsync(existing)
                : await UpdateWithPasswordAsync(existing, request.Password);

            if (!updated) throw new NotFoundException("Utilisateur introuvable");
            return ToResponse(existing);
        }

        public async Task DeleteOrganizationUserAsync(int id, int currentUserId, string currentUserRole, int? currentOrganizationId)
        {
            if (id == currentUserId)
            {
                throw new ServiceException("Vous ne pouvez pas supprimer votre propre compte");
            }

            _ = await LoadAllowedUserAsync(id, currentUserRole, currentOrganizationId);
            if (!await _userRepository.DeleteAsync(id))
            {
                throw new NotFoundException("Utilisateur introuvable");
            }
        }

        private async Task<bool> UpdateWithPasswordAsync(User user, string password)
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            return await _userRepository.UpdateAsync(user);
        }

        private async Task<User> LoadAllowedUserAsync(int id, string currentUserRole, int? currentOrganizationId)
        {
            User? user;
            var organizationId = RequireAdminOrganization(currentUserRole, currentOrganizationId);
            user = await _userRepository.GetByIdInOrganizationAsync(id, organizationId);

            if (user == null || !IsManagedPersonnel(user))
            {
                throw new NotFoundException("Utilisateur introuvable");
            }

            return user;
        }

        private static int ResolveTargetOrganization(int? requestedOrganizationId, string currentUserRole, int? currentOrganizationId)
        {
            var organizationId = RequireAdminOrganization(currentUserRole, currentOrganizationId);
            if (requestedOrganizationId.HasValue && requestedOrganizationId.Value != organizationId)
            {
                throw new ServiceException("Vous ne pouvez gerer que les utilisateurs de votre organisation");
            }

            return organizationId;
        }

        private static int RequireAdminOrganization(string currentUserRole, int? currentOrganizationId)
        {
            if (!string.Equals(currentUserRole, "admin", StringComparison.OrdinalIgnoreCase))
            {
                throw new ServiceException("Acces reserve aux administrateurs");
            }

            return currentOrganizationId ?? throw new ServiceException("Votre compte admin n'est associe a aucune organisation");
        }

        private static void ValidateManagedRole(string role, string currentUserRole)
        {
            if (string.IsNullOrWhiteSpace(role)) throw new ServiceException("Le role est obligatoire");
            if (!string.Equals(role, "user", StringComparison.OrdinalIgnoreCase))
            {
                throw new ServiceException("Ce module gere uniquement les comptes utilisateur");
            }
        }

        private static bool IsManagedPersonnel(User user)
            => string.Equals(user.Role, "user", StringComparison.OrdinalIgnoreCase);

        private static AdminUserResponse ToResponse(User user) => new()
        {
            Id = user.Id,
            Name = user.Username,
            Email = user.Email,
            Role = user.Role,
            OrganizationId = user.OrganizationId,
            Profile = user.Profile,
            ProfileDetail = user.ProfileDetail,
            AccessAllYears = user.AccessAllYears,
            AccessYearList = user.AccessYearList,
            ModuleIds = ParseModuleIds(user.ModuleIds),
            CreatedAt = user.CreatedAt,
            IsActive = user.IsActive
        };

        private static string SerializeModuleIds(IEnumerable<string>? moduleIds)
            => JsonSerializer.Serialize((moduleIds ?? Array.Empty<string>())
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList());

        private static List<string> ParseModuleIds(string? moduleIds)
        {
            if (string.IsNullOrWhiteSpace(moduleIds)) return new List<string>();
            try
            {
                return JsonSerializer.Deserialize<List<string>>(moduleIds) ?? new List<string>();
            }
            catch (JsonException)
            {
                return moduleIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            }
        }

        private static string NormalizeJsonArray(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "[]";
            try
            {
                _ = JsonSerializer.Deserialize<List<object>>(value);
                return value;
            }
            catch (JsonException)
            {
                return "[]";
            }
        }
    }
}
