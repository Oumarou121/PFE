using Dapper;
using DocApi.Domain.Entities;
using DocApi.Infrastructure;
using DocApi.Repositories.Interfaces;

namespace DocApi.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly IEditorDbConnectionFactory _connectionFactory;

        public UserRepository(IEditorDbConnectionFactory connectionFactory)
        {
            _connectionFactory = connectionFactory;
        }

        public async Task<User?> GetByIdAsync(int id)
        {
            using var connection = _connectionFactory.CreateConnection();
            const string sql = """
                SELECT Id,
                       Name AS Username,
                       Email,
                       PassWord AS PasswordHash,
                       IdOrganization AS OrganizationId,
                       Role,
                       AccountCreationDate AS CreatedAt,
                       Profil AS Profile,
                       ProfilDetail AS ProfileDetail,
                       AccessAllYears,
                       AccessYearList,
                       CAST(1 AS bit) AS IsActive
                FROM [User]
                WHERE Id = @Id
                """;
            return await connection.QueryFirstOrDefaultAsync<User>(sql, new { Id = id });
        }

        public async Task<User?> GetByUsernameAsync(string username)
        {
            using var connection = _connectionFactory.CreateConnection();
            const string sql = """
                SELECT Id,
                       Name AS Username,
                       Email,
                       PassWord AS PasswordHash,
                       IdOrganization AS OrganizationId,
                       Role,
                       AccountCreationDate AS CreatedAt,
                       Profil AS Profile,
                       ProfilDetail AS ProfileDetail,
                       AccessAllYears,
                       AccessYearList,
                       CAST(1 AS bit) AS IsActive
                FROM [User]
                WHERE Name = @Username OR Email = @Username
                """;
            return await connection.QueryFirstOrDefaultAsync<User>(sql, new { Username = username });
        }

        public async Task<User?> GetByEmailAsync(string email)
        {
            using var connection = _connectionFactory.CreateConnection();
            const string sql = """
                SELECT Id,
                       Name AS Username,
                       Email,
                       PassWord AS PasswordHash,
                       IdOrganization AS OrganizationId,
                       Role,
                       AccountCreationDate AS CreatedAt,
                       Profil AS Profile,
                       ProfilDetail AS ProfileDetail,
                       AccessAllYears,
                       AccessYearList,
                       CAST(1 AS bit) AS IsActive
                FROM [User]
                WHERE Email = @Email
                """;
            return await connection.QueryFirstOrDefaultAsync<User>(sql, new { Email = email });
        }

        public async Task<IEnumerable<User>> GetAllAsync()
        {
            using var connection = _connectionFactory.CreateConnection();
            const string sql = """
                SELECT Id,
                       Name AS Username,
                       Email,
                       PassWord AS PasswordHash,
                       IdOrganization AS OrganizationId,
                       Role,
                       AccountCreationDate AS CreatedAt,
                       Profil AS Profile,
                       ProfilDetail AS ProfileDetail,
                       AccessAllYears,
                       AccessYearList,
                       CAST(1 AS bit) AS IsActive
                FROM [User]
                ORDER BY AccountCreationDate DESC
                """;
            return await connection.QueryAsync<User>(sql);
        }

        public async Task<int> CreateAsync(User user)
        {
            using var connection = _connectionFactory.CreateConnection();
            const string sql = """
                INSERT INTO [User] (Name, Email, PassWord, IdOrganization, Role, AccountCreationDate, Profil, ProfilDetail, AccessAllYears, AccessYearList)
                OUTPUT INSERTED.Id
                VALUES (@Username, @Email, @PasswordHash, @OrganizationId, @Role, @CreatedAt, @Profile, @ProfileDetail, @AccessAllYears, @AccessYearList);
                """;

            return await connection.QuerySingleAsync<int>(sql, user);
        }

        public async Task<bool> UpdateAsync(User user)
        {
            using var connection = _connectionFactory.CreateConnection();
            const string sql = """
                UPDATE [User]
                SET Name = @Username,
                    Email = @Email,
                    PassWord = @PasswordHash,
                    Role = @Role,
                    IdOrganization = @OrganizationId,
                    Profil = @Profile,
                    ProfilDetail = @ProfileDetail,
                    AccessAllYears = @AccessAllYears,
                    AccessYearList = @AccessYearList
                WHERE Id = @Id
                """;

            var rowsAffected = await connection.ExecuteAsync(sql, user);
            return rowsAffected > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = _connectionFactory.CreateConnection();
            const string sql = "DELETE FROM [User] WHERE Id = @Id";
            var rowsAffected = await connection.ExecuteAsync(sql, new { Id = id });
            return rowsAffected > 0;
        }

        public async Task<bool> ExistsAsync(string username, string email)
        {
            using var connection = _connectionFactory.CreateConnection();
            const string sql = """
                SELECT COUNT(1)
                FROM [User]
                WHERE Name = @Username OR Email = @Email
                """;
            var count = await connection.QuerySingleAsync<int>(sql, new { Username = username, Email = email });
            return count > 0;
        }
    }
}
