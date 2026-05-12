using System.Data;

namespace DocApi.Infrastructure
{
    public interface IAuthDbConnectionFactory
    {
        IDbConnection CreateConnection();
    }

    public interface IConfigDbConnectionFactory
    {
        IDbConnection CreateConnection();
    }

    public interface ITenantConnectionFactory
    {
        IDbConnection CreateConnection();
        IDbConnection CreateConnection(string databaseName);
    }
}