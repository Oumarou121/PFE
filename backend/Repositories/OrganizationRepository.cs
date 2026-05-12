using Dapper;
using DocApi.Domain.Entities;
using DocApi.Infrastructure;
using DocApi.Repositories.Interfaces;

namespace DocApi.Repositories
{
    public class OrganizationRepository : IOrganizationRepository
    {
        private readonly IAuthDbConnectionFactory _connectionFactory;

        public OrganizationRepository(IAuthDbConnectionFactory connectionFactory)
        {
            _connectionFactory = connectionFactory;
        }

        public async Task<Organization?> GetByIdAsync(int id)
        {
            using var connection = _connectionFactory.CreateConnection();
            const string sql = @"
                SELECT 
                    Id,
                    NameFr,
                    Acronym,
                    DatabaseName,
                    OrganizationSystemPrefix,
                    Email
                FROM [dbo].[Organization]
                WHERE Id = @Id
            ";
            return await connection.QueryFirstOrDefaultAsync<Organization>(sql, new { Id = id });
        }
    }
}
