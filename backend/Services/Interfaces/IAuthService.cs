using DocApi.DTOs;

namespace DocApi.Services.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponse> LoginAsync(LoginRequest request);
        Task<AuthResponse> RegisterAsync(RegisterRequest request);
        Task<UserResponse> GetUserProfileAsync(int userId);
        string GenerateJwtToken(int userId, string username, string role, string? organizationId = null);
    }
}
