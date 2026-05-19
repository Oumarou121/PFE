using Dapper;
using DocApi.Domain.Entities;
using DocApi.Infrastructure;
using DocApi.Repositories.Interfaces;
using Microsoft.Extensions.Options;

namespace DocApi.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly IAuthDbConnectionFactory _connectionFactory;

        public UserRepository(IAuthDbConnectionFactory connectionFactory)
        {
            _connectionFactory = connectionFactory;
        }

        public async Task<User?> GetByIdAsync(int id)
        {
            using var connection = _connectionFactory.CreateConnection();
            await EnsureAccessColumnsAsync(connection);
            var sql = $"""
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
                       ModuleIds,
                       DataAccessRules,
                       CAST(1 AS bit) AS IsActive
                FROM {UserTable}
                WHERE Id = @Id
                """;
            return await connection.QueryFirstOrDefaultAsync<User>(sql, new { Id = id });
        }

        public async Task<User?> GetByEmailAsync(string email)
        {
            using var connection = _connectionFactory.CreateConnection();
            await EnsureAccessColumnsAsync(connection);
            var sql = $"""
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
                       ModuleIds,
                       DataAccessRules,
                       CAST(1 AS bit) AS IsActive
                FROM {UserTable}
                WHERE Email = @Email
                """;
            return await connection.QueryFirstOrDefaultAsync<User>(sql, new { Email = email });
        }

        public async Task<IEnumerable<User>> GetAllAsync()
        {
            using var connection = _connectionFactory.CreateConnection();
            await EnsureAccessColumnsAsync(connection);
            var sql = $"""
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
                       ModuleIds,
                       DataAccessRules,
                       CAST(1 AS bit) AS IsActive
                FROM {UserTable}
                ORDER BY AccountCreationDate DESC
                """;
            return await connection.QueryAsync<User>(sql);
        }

        public async Task<IEnumerable<User>> GetByOrganizationAsync(int organizationId)
        {
            using var connection = _connectionFactory.CreateConnection();
            await EnsureAccessColumnsAsync(connection);
            var sql = $"""
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
                       ModuleIds,
                       DataAccessRules,
                       CAST(1 AS bit) AS IsActive
                FROM {UserTable}
                WHERE IdOrganization = @OrganizationId
                ORDER BY AccountCreationDate DESC, Name ASC
                """;
            return await connection.QueryAsync<User>(sql, new { OrganizationId = organizationId });
        }

        public async Task<User?> GetByIdInOrganizationAsync(int id, int organizationId)
        {
            using var connection = _connectionFactory.CreateConnection();
            await EnsureAccessColumnsAsync(connection);
            var sql = $"""
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
                       ModuleIds,
                       DataAccessRules,
                       CAST(1 AS bit) AS IsActive
                FROM {UserTable}
                WHERE Id = @Id AND IdOrganization = @OrganizationId
                """;
            return await connection.QueryFirstOrDefaultAsync<User>(sql, new { Id = id, OrganizationId = organizationId });
        }

        public async Task<int> CreateAsync(User user)
        {
            using var connection = _connectionFactory.CreateConnection();
            await EnsureAccessColumnsAsync(connection);
            var sql = $"""
                INSERT INTO {UserTable} (Name, Email, PassWord, IdOrganization, Role, AccountCreationDate, Profil, ProfilDetail, AccessAllYears, AccessYearList, ModuleIds, DataAccessRules)
                OUTPUT INSERTED.Id
                VALUES (@Username, @Email, @PasswordHash, @OrganizationId, @Role, @CreatedAt, @Profile, @ProfileDetail, @AccessAllYears, @AccessYearList, @ModuleIds, @DataAccessRules);
                """;

            return await connection.QuerySingleAsync<int>(sql, user);
        }

        public async Task<bool> UpdateAsync(User user)
        {
            using var connection = _connectionFactory.CreateConnection();
            await EnsureAccessColumnsAsync(connection);
            var sql = $"""
                UPDATE {UserTable}
                SET Name = @Username,
                    Email = @Email,
                    PassWord = @PasswordHash,
                    Role = @Role,
                    IdOrganization = @OrganizationId,
                    Profil = @Profile,
                    ProfilDetail = @ProfileDetail,
                    AccessAllYears = @AccessAllYears,
                    AccessYearList = @AccessYearList,
                    ModuleIds = @ModuleIds,
                    DataAccessRules = @DataAccessRules
                WHERE Id = @Id
                """;

            var rowsAffected = await connection.ExecuteAsync(sql, user);
            return rowsAffected > 0;
        }

        public async Task<bool> UpdateWithoutPasswordAsync(User user)
        {
            using var connection = _connectionFactory.CreateConnection();
            await EnsureAccessColumnsAsync(connection);
            var sql = $"""
                UPDATE {UserTable}
                SET Name = @Username,
                    Email = @Email,
                    Role = @Role,
                    IdOrganization = @OrganizationId,
                    Profil = @Profile,
                    ProfilDetail = @ProfileDetail,
                    AccessAllYears = @AccessAllYears,
                    AccessYearList = @AccessYearList,
                    ModuleIds = @ModuleIds,
                    DataAccessRules = @DataAccessRules
                WHERE Id = @Id
                """;

            var rowsAffected = await connection.ExecuteAsync(sql, user);
            return rowsAffected > 0;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            using var connection = _connectionFactory.CreateConnection();
            var sql = $"DELETE FROM {UserTable} WHERE Id = @Id";
            var rowsAffected = await connection.ExecuteAsync(sql, new { Id = id });
            return rowsAffected > 0;
        }

        public async Task<bool> ExistsAsync(string username, string email)
            => await ExistsAsync(username, email, null);

        public async Task<bool> ExistsAsync(string username, string email, int? excludedUserId)
        {
            using var connection = _connectionFactory.CreateConnection();
            var sql = $"""
                SELECT COUNT(1)
                FROM {UserTable}
                WHERE (Name = @Username OR Email = @Email)
                  AND (@ExcludedUserId IS NULL OR Id <> @ExcludedUserId)
                """;
            var count = await connection.QuerySingleAsync<int>(sql, new { Username = username, Email = email, ExcludedUserId = excludedUserId });
            return count > 0;
        }

        private string UserTable => "[dbo].[User]";

        private static async Task EnsureAccessColumnsAsync(System.Data.IDbConnection connection)
        {
            await connection.ExecuteAsync("""
                IF COL_LENGTH('dbo.User', 'DataAccessRules') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[User] ADD DataAccessRules NVARCHAR(MAX) NULL;
                END
                """);
        }
    }
}
