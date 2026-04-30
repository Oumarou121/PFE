using System.Text.Json.Nodes;

namespace DocApi.DTOs
{
    public record EditorApiResponse(bool Ok, object? State = null, object? User = null, object? Schema = null, object? Rows = null, object? Record = null, object? Options = null, object? TableView = null, string? Token = null, string? Error = null, string? RedirectTo = null);

    public class EditorLoginRequest
    {
        public string? Identifier { get; set; }
        public string? Password { get; set; }
    }

    public class EditorStateRequest
    {
        public JsonObject? State { get; set; }
    }

    public class EditorQueryRequest
    {
        public string? Sql { get; set; }
        public Dictionary<string, object?>? Params { get; set; }
    }

    public class TableViewRowsRequest
    {
        public string? ConfigId { get; set; }
        public int? Limit { get; set; }
        public string? Search { get; set; }
        public JsonObject? Config { get; set; }
    }

    public class TableViewRecordRequest
    {
        public string? ConfigId { get; set; }
        public object? RowId { get; set; }
        public Dictionary<string, object?>? Values { get; set; }
        public JsonObject? Config { get; set; }
    }

    public class TableViewLookupRequest
    {
        public string? ConfigId { get; set; }
        public string? FieldName { get; set; }
        public JsonObject? Config { get; set; }
    }

    public class TableViewConfigRequest
    {
        public JsonObject? TableView { get; set; }
        public string? Id { get; set; }
    }
}
