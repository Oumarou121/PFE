using System.Data;
using DocApi.Common.Tenant;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace DocApi.Infrastructure.ConnectionFactories
{
    public class TenantConnectionFactory : ITenantConnectionFactory
    {
        private readonly ITenantProvider _tenantProvider;
        private readonly string _baseConnectionString;

        public TenantConnectionFactory(IConfiguration configuration, ITenantProvider tenantProvider)
        {
            _tenantProvider = tenantProvider;
            _baseConnectionString = configuration.GetConnectionString("EditorSqlServer") ?? throw new InvalidOperationException("Connection string 'EditorSqlServer' not found.");
        }

        public IDbConnection CreateConnection()
        {
            var databaseName = _tenantProvider.GetDatabaseName();

            if (string.IsNullOrEmpty(databaseName))
            {
                throw new InvalidOperationException("Tenant DatabaseName was not determined. Cannot establish a tenant-specific connection.");
            }

            var connectionStringBuilder = new SqlConnectionStringBuilder(_baseConnectionString)
            {
                InitialCatalog = databaseName
            };

            var connection = new SqlConnection(connectionStringBuilder.ConnectionString);
            connection.Open();
            return connection;
        }
    }
}