namespace DocApi.Common
{
    public class ServiceException : Exception
    {
        public ServiceException(string message) : base(message) { }
    }

    public class NotFoundException : ServiceException
    {
        public NotFoundException(string message) : base(message) { }
    }
}
