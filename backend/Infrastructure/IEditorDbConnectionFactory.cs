using System.Data;

namespace DocApi.Infrastructure
{
    public interface IEditorDbConnectionFactory
    {
        IDbConnection CreateConnection();
    }
}
