using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace DocApi.Domain.ValueObjects
{
    public enum BeneficiaryMode
    {
        Table,
        Organization
    }

    public enum FilterType
    {
        Text,
        Number,
        Date,
        Select
    }

    public enum FilterSourceType
    {
        Static,
        Sql
    }

    public enum SectionDirection
    {
        Ltr,
        Rtl
    }

    public enum SectionDisplayMode
    {
        All,
        First,
        Even,
        Odd
    }

    public enum PageOrientation
    {
        Portrait,
        Landscape
    }

    public enum TableViewDisplayMode
    {
        Raw,
        Lookup
    }

    public enum AllowedValueMode
    {
        All,
        Subset
    }

    public class FilterOption
    {
        [Required]
        [MaxLength(255)]
        public string Value { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string Label { get; set; } = string.Empty;
    }

    public class FilterRoleAccess
    {
        public bool Admin { get; set; } = true;
        public bool User { get; set; } = true;
    }

    public class FilterSqlBuilder
    {
        [MaxLength(128)]
        public string TableName { get; set; } = string.Empty;

        [MaxLength(128)]
        public string ValueColumn { get; set; } = string.Empty;

        [MaxLength(128)]
        public string LabelColumn { get; set; } = string.Empty;

        public bool Distinct { get; set; } = true;
    }

    public class FilterColumnBinding
    {
        [MaxLength(128)]
        public string TableName { get; set; } = string.Empty;

        [MaxLength(128)]
        public string ColumnName { get; set; } = string.Empty;

        [MaxLength(32)]
        public string Mode { get; set; } = "manual";
    }

    public class FilterDefinition
    {
        [Required]
        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;

        [Required]
        [MaxLength(128)]
        public string Key { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string Label { get; set; } = string.Empty;

        public FilterType Type { get; set; } = FilterType.Text;
        public FilterSourceType SourceType { get; set; } = FilterSourceType.Static;

        [MaxLength(255)]
        public string Placeholder { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string HelpText { get; set; } = string.Empty;

        public FilterRoleAccess Roles { get; set; } = new();
        public FilterColumnBinding ColumnBinding { get; set; } = new();
        public List<FilterColumnBinding> ColumnBindings { get; set; } = [];
        public List<FilterOption> StaticOptions { get; set; } = [];
        public FilterSqlBuilder SqlBuilder { get; set; } = new();
        public string SqlQuery { get; set; } = string.Empty;
    }

    public class TemplateFilterProfileEntry
    {
        [Required]
        [MaxLength(64)]
        public string FilterId { get; set; } = string.Empty;

        public bool Enabled { get; set; } = true;
        public bool AdminEnabled { get; set; } = true;
        public bool UserEnabled { get; set; } = true;
        public bool Required { get; set; }
        public bool Locked { get; set; }

        [Range(0, 10_000)]
        public int Order { get; set; }

        public object? DefaultValue { get; set; }
        public AllowedValueMode AllowedValueMode { get; set; } = AllowedValueMode.All;
        public List<FilterOption> AllowedValues { get; set; } = [];
    }

    public class VariableColumn
    {
        [MaxLength(128)]
        public string? Key { get; set; }

        [MaxLength(255)]
        public string? Label { get; set; }

        [MaxLength(128)]
        public string? Tech { get; set; }

        [JsonExtensionData]
        public Dictionary<string, object> ExtraConfig { get; set; } = [];
    }

    public class VariableDefinition
    {
        [MaxLength(64)]
        public string? Id { get; set; }

        [MaxLength(255)]
        public string? Label { get; set; }

        [MaxLength(128)]
        public string? Tech { get; set; }

        [MaxLength(64)]
        public string? Type { get; set; }

        public string? SqlQuery { get; set; }
        public List<VariableColumn> Columns { get; set; } = [];

        [JsonExtensionData]
        public Dictionary<string, object> ExtraConfig { get; set; } = [];
    }

    public class FamilyClass
    {
        [MaxLength(64)]
        public string? Id { get; set; }

        [MaxLength(255)]
        public string? Nom { get; set; }

        [MaxLength(255)]
        public string? Name { get; set; }

        public List<VariableDefinition> Vars { get; set; } = [];

        [JsonExtensionData]
        public Dictionary<string, object> ExtraConfig { get; set; } = [];
    }

    public class PageMargins
    {
        [Range(0, 100)]
        public decimal Mt { get; set; } = 20;

        [Range(0, 100)]
        public decimal Mb { get; set; } = 20;

        [Range(0, 100)]
        public decimal Ml { get; set; } = 25;

        [Range(0, 100)]
        public decimal Mr { get; set; } = 25;
    }

    public class HeaderFooterDistances
    {
        [Range(0, 100)]
        public decimal HeaderTop { get; set; } = 5;

        [Range(0, 100)]
        public decimal FooterBottom { get; set; } = 5;
    }

    public class SectionDirections
    {
        public SectionDirection Header { get; set; } = SectionDirection.Ltr;
        public SectionDirection Body { get; set; } = SectionDirection.Ltr;
        public SectionDirection Footer { get; set; } = SectionDirection.Ltr;
    }

    public class PageBackground
    {
        public bool Enabled { get; set; }
        public string Image { get; set; } = string.Empty;

        [MaxLength(32)]
        public string Size { get; set; } = "cover";

        [MaxLength(64)]
        public string Position { get; set; } = "center center";

        [MaxLength(32)]
        public string Repeat { get; set; } = "no-repeat";
    }

    public class GraphicCharterIdentity
    {
        [MaxLength(255)]
        public string OfficialName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string DirectorName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string Slogan { get; set; } = string.Empty;

        public string LogoText { get; set; } = string.Empty;
    }

    public class ColorPalette
    {
        [MaxLength(32)]
        public string Primary { get; set; } = "#1d4ed8";

        [MaxLength(32)]
        public string Secondary { get; set; } = "#475569";

        [MaxLength(32)]
        public string Text { get; set; } = "#111111";

        [MaxLength(32)]
        public string Heading { get; set; } = "#0f172a";

        [MaxLength(32)]
        public string Border { get; set; } = "#c8cdd8";

        [MaxLength(32)]
        public string TableHeaderBg { get; set; } = "transparent";

        [MaxLength(32)]
        public string TableAltRowBg { get; set; } = "#f8fafc";

        [JsonExtensionData]
        public Dictionary<string, object> ExtraColors { get; set; } = [];
    }

    public class FontConfig
    {
        [MaxLength(255)]
        public string BodyFont { get; set; } = "\"Times New Roman\", Times, serif";

        [MaxLength(255)]
        public string HeadingFont { get; set; } = "\"Times New Roman\", Times, serif";
    }

    public class GraphicCharterLayout
    {
        public PageOrientation Orientation { get; set; } = PageOrientation.Portrait;
        public PageMargins PageMargins { get; set; } = new();
        public HeaderFooterDistances HeaderFooterDistances { get; set; } = new();
        public PageBackground PageBackground { get; set; } = new();
    }

    public class HeaderConfig
    {
        public bool EnabledByDefault { get; set; } = true;
        public SectionDisplayMode DisplayMode { get; set; } = SectionDisplayMode.All;
        public string Html { get; set; } = "<p style=\"text-align:center\"><strong>{{nom_etab}}</strong></p><p style=\"text-align:center;font-size:10pt;color:var(--doc-color-secondary)\">{{adresse_etab}} - Tel : {{tel_etab}}</p>";
    }

    public class FooterConfig
    {
        public bool EnabledByDefault { get; set; } = true;
        public SectionDisplayMode DisplayMode { get; set; } = SectionDisplayMode.All;
        public string Html { get; set; } = "<p style=\"text-align:center;font-size:9pt;color:var(--doc-color-secondary)\">Document officiel - {{nom_etab}} - Annee {{annee_univ}}</p>";
    }

    public class WatermarkConfig
    {
        public bool Enabled { get; set; }
        public string Text { get; set; } = string.Empty;

        [MaxLength(32)]
        public string Color { get; set; } = "#94a3b8";

        [Range(0, 1)]
        public decimal Opacity { get; set; } = 0.08m;
    }

    public class GraphicCharterConfig
    {
        public GraphicCharterIdentity Identity { get; set; } = new();
        public ColorPalette Colors { get; set; } = new();
        public FontConfig Typography { get; set; } = new();
        public GraphicCharterLayout Layout { get; set; } = new();
        public HeaderConfig Header { get; set; } = new();
        public FooterConfig Footer { get; set; } = new();
        public WatermarkConfig Watermark { get; set; } = new();

        [JsonExtensionData]
        public Dictionary<string, object> ExtraConfig { get; set; } = [];
    }

    public class TableViewFieldSetting
    {
        public TableViewDisplayMode DisplayMode { get; set; } = TableViewDisplayMode.Raw;

        [MaxLength(128)]
        public string LookupTable { get; set; } = string.Empty;

        [MaxLength(128)]
        public string LookupValueColumn { get; set; } = string.Empty;

        [MaxLength(128)]
        public string LookupLabelColumn { get; set; } = string.Empty;

        [MaxLength(128)]
        public string LookupLabelColumn2 { get; set; } = string.Empty;
    }

    public enum TableFilterSourceType
    {
        Static,     // Liste d'options statiques (value, label)
        Table       // Données provenant d'une table (requête SQL)
    }

    public class TableFilterOption
    {
        [Required]
        [MaxLength(255)]
        public string Value { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string Label { get; set; } = string.Empty;
    }

    public class TableFilterSqlBuilder
    {
        [Required]
        [MaxLength(128)]
        public string TableName { get; set; } = string.Empty;

        [Required]
        [MaxLength(128)]
        public string ValueColumn { get; set; } = string.Empty;

        [Required]
        [MaxLength(128)]
        public string LabelColumn { get; set; } = string.Empty;

        public bool Distinct { get; set; } = true;
    }

    public class TableViewFilter
    {
        [Required]
        [MaxLength(64)]
        public string Id { get; set; } = string.Empty;

        [Required]
        [MaxLength(128)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(128)]
        public string LinkColumn { get; set; } = string.Empty;

        public TableFilterSourceType SourceType { get; set; } = TableFilterSourceType.Static;

        // Pour sourceType = "Static"
        public List<TableFilterOption>? StaticOptions { get; set; }

        // Pour sourceType = "Table"
        public TableFilterSqlBuilder? SqlBuilder { get; set; }

        [MaxLength(1000)]
        public string HelpText { get; set; } = string.Empty;

        public bool Enabled { get; set; } = true;
    }
}
