using System.Text.Json.Nodes;

namespace DocApi.Domain.Entities
{
    public class AppSetting
    {
        public string Key { get; set; } = string.Empty;
        public JsonNode? Value { get; set; }
    }
}
