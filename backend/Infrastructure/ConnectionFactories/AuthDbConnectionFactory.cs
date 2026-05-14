using System.Data;
using DocApi.Common;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace DocApi.Infrastructure.ConnectionFactories
{
    public class AuthDbConnectionFactory : IAuthDbConnectionFactory
    {
        private readonly string _connectionString;

        public AuthDbConnectionFactory(IConfiguration configuration, IOptions<EditorDatabaseOptions> options)
        {
            var baseConnString = configuration.GetConnectionString("EditorSqlServer");
            var databaseName = options.Value.AuthDatabaseName;
            
            var connectionStringBuilder = new SqlConnectionStringBuilder(baseConnString)
            {
                InitialCatalog = databaseName
            };
            
            _connectionString = connectionStringBuilder.ConnectionString;
        }

        public IDbConnection CreateConnection()
        {
            var connection = new SqlConnection(_connectionString);
            connection.Open();
            return connection;
        }
    }
}