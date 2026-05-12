using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace DocApi.Infrastructure.ConnectionFactories
{
    public class ConfigDbConnectionFactory : IConfigDbConnectionFactory
    {
        private readonly string _connectionString;

        public ConfigDbConnectionFactory(IConfiguration configuration)
        {
            var internalDbName = configuration["EditorDatabase:ConfigDatabaseName"] ?? "UnivadConfiDB";
            var baseConnString = configuration.GetConnectionString("EditorSqlServer");
            
            var connectionStringBuilder = new SqlConnectionStringBuilder(baseConnString)
            {
                InitialCatalog = internalDbName
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