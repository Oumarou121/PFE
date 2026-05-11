namespace DocApi.Domain.Entities
{
    public class AppSetting
    {
        public string Key { get; set; } = string.Empty;
        public object? Value { get; set; }
    }
}
