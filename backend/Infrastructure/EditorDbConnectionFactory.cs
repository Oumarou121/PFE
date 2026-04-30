using System.Data;
using Microsoft.Data.SqlClient;

namespace DocApi.Infrastructure
{
    public class EditorDbConnectionFactory : IEditorDbConnectionFactory
    {
        private readonly string _connectionString;

        public EditorDbConnectionFactory(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("EditorSqlServer")
                ?? throw new ArgumentNullException("EditorSqlServer connection string is not configured.");
        }

        public IDbConnection CreateConnection()
        {
            return new SqlConnection(_connectionString);
        }
    }
}
