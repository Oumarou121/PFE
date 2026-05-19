using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using BCrypt.Net;
using DocApi.Common;
using DocApi.Domain.Entities;
using DocApi.DTOs;
using DocApi.Repositories.Interfaces;
using DocApi.Services.Interfaces;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace DocApi.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUserRepository _userRepository;
        private readonly JwtSettings _jwtSettings;

        public AuthService(IUserRepository userRepository, IOptions<JwtSettings> jwtSettings)
        {
            _userRepository = userRepository;
            _jwtSettings = jwtSettings.Value;
        }

        public async Task<AuthResponse> LoginAsync(LoginRequest request)
        {
            var user = await _userRepository.GetByEmailAsync(request.Email);

            if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
            {
                throw new ServiceException("Invalid email or password");
            }

            if (!user.IsActive)
            {
                throw new ServiceException("Account is deactivated");
            }

            var token = GenerateJwtToken(user.Id, user.Username, user.Role, user.OrganizationId, user.Email);
            var expiresAt = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes);

            return new AuthResponse
            {
                Token = token,
                Email = user.Email,
                Name = user.Username,
                Role = user.Role,
                ExpiresAt = expiresAt,
                User = ToAuthUser(user),
                RedirectTo = GetRoleHome(user.Role)
            };
        }

        public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
        {
            if (await _userRepository.ExistsAsync(request.Username, request.Email))
            {
                throw new ServiceException("Username or email already exists");
            }

            var user = new User
            {
                Username = request.Username,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = request.Role,
                OrganizationId = request.OrganizationId,
                Profile = request.Profile,
                ProfileDetail = request.ProfileDetail,
                AccessAllYears = true,
                AccessYearList = "[]",
                ModuleIds = "[]",
                DataAccessRules = "[]",
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            var userId = await _userRepository.CreateAsync(user);
            user.Id = userId;

            var token = GenerateJwtToken(user.Id, user.Username, user.Role, user.OrganizationId, user.Email);
            var expiresAt = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes);

            return new AuthResponse
            {
                Token = token,
                Email = user.Email,
                Name = user.Username,
                Role = user.Role,
                ExpiresAt = expiresAt,
                User = ToAuthUser(user),
                RedirectTo = GetRoleHome(user.Role)
            };
        }

        public async Task<UserResponse> GetUserProfileAsync(int userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);

            if (user == null)
            {
                throw new NotFoundException("User not found");
            }

            return new UserResponse
            {
                Id = user.Id,
                Email = user.Email,
                Name = user.Username,
                Role = user.Role,
                OrganizationId = user.OrganizationId,
                Profile = user.Profile,
                ProfileDetail = user.ProfileDetail,
                AccessAllYears = user.AccessAllYears,
                AccessYearList = user.AccessYearList,
                ModuleIds = ParseModuleIds(user.ModuleIds),
                DataAccessRules = ParseDataAccessRules(user.DataAccessRules),
                CreatedAt = user.CreatedAt,
                IsActive = user.IsActive
            };
        }

        public string GenerateJwtToken(int userId, string username, string role, int? organizationId = null)
        {
            return GenerateJwtToken(userId, username, role, organizationId, null);
        }

        private string GenerateJwtToken(int userId, string username, string role, int? organizationId, string? email)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, userId.ToString()),
                new(ClaimTypes.Name, username),
                new(ClaimTypes.Role, role),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
            };

            if (!string.IsNullOrWhiteSpace(email))
            {
                claims.Add(new Claim(ClaimTypes.Email, email));
            }

            if (organizationId.HasValue)
            {
                claims.Add(new Claim("organizationId", organizationId.Value.ToString()));
            }

            var token = new JwtSecurityToken(
                issuer: _jwtSettings.Issuer,
                audience: _jwtSettings.Audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private static AuthUserResponse ToAuthUser(User user) => new()
        {
            Id = user.Id.ToString(),
            Email = user.Email,
            Name = user.Username,
            Role = user.Role,
            OrganizationId = user.OrganizationId,
            Profile = user.Profile,
            ProfileDetail = user.ProfileDetail,
            AccessAllYears = user.AccessAllYears,
            AccessYearList = user.AccessYearList,
            ModuleIds = ParseModuleIds(user.ModuleIds),
            DataAccessRules = ParseDataAccessRules(user.DataAccessRules)
        };

        private static List<string> ParseModuleIds(string? moduleIds)
        {
            if (string.IsNullOrWhiteSpace(moduleIds)) return new List<string>();

            try
            {
                return JsonSerializer.Deserialize<List<string>>(moduleIds) ?? new List<string>();
            }
            catch (JsonException)
            {
                return moduleIds
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToList();
            }
        }

        private static List<UserDataAccessRuleDto> ParseDataAccessRules(string? rules)
        {
            if (string.IsNullOrWhiteSpace(rules)) return new List<UserDataAccessRuleDto>();

            try
            {
                return JsonSerializer.Deserialize<List<UserDataAccessRuleDto>>(rules) ?? new List<UserDataAccessRuleDto>();
            }
            catch (JsonException)
            {
                return new List<UserDataAccessRuleDto>();
            }
        }

        private static bool VerifyPassword(string password, string passwordHash)
        {
            if (string.IsNullOrWhiteSpace(passwordHash)) return false;

            if (passwordHash.StartsWith("$2", StringComparison.Ordinal))
            {
                return BCrypt.Net.BCrypt.Verify(password, passwordHash);
            }

            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
            var sha256Base64 = Convert.ToBase64String(bytes);
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(sha256Base64),
                Encoding.UTF8.GetBytes(passwordHash));
        }

        private static string GetRoleHome(string? role) => role switch
        {
            "supAdmin" => "/superAdmin.html",
            "admin" => "/admin.html",
            _ => "/user.html"
        };
    }
}
