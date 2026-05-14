import {
  buildDocumentFilterParams,
  getEnabledTemplateFilters,
  normalizeFamilyRecord,
  normalizeOrganizationRecord,
  normalizeTableViewRecord,
  normalizeTemplateRecord,
} from "./editor-normalizers";

describe("editor normalizers", () => {
  it("normalizes family legacy fields", () => {
    const family = normalizeFamilyRecord({
      id: "fam_1",
      beneficiaireTable: "Employee",
      beneficiaryLabelColumn: "nom",
      beneficiarySubtitleColumn: "grade",
      filterCatalogJson: [
        {
          label: "Departement",
          type: "select",
          staticOptionsText: "it|IT\nrh|RH",
        },
      ],
    });

    expect(family.beneficiaryMode).toBe("table");
    expect(family.beneficiaryTable).toBe("Employee");
    expect(family.beneficiaryDisplayColumn1).toBe("nom");
    expect(family.beneficiaryDisplayColumn2).toBe("grade");
    expect(family.filterCatalog.length).toBe(1);
    expect(family.filterCatalog[0].staticOptions[0]).toEqual({
      value: "it",
      label: "IT",
    });
  });

  it("normalizes template profile and directions", () => {
    const template = normalizeTemplateRecord({
      id: "tpl_1",
      organizationId: 42,
      filterProfileJson: [{ filterId: "flt_1", enabled: false }],
      sectionDir: { body: "rtl" },
      headerVisibility: "first",
    });

    expect(template.organizationId).toBe("42");
    expect(template.filterProfile[0].filterId).toBe("flt_1");
    expect(template.sectionDirections.body).toBe("rtl");
    expect(template.headerDisplay).toBe("first");
  });

  it("normalizes organization charters and table views", () => {
    const organization = normalizeOrganizationRecord({
      id: "org_1",
      graphicCharter: {
        identity: { officialName: "Org" },
        layout: { orientation: "landscape" },
      },
    });
    const tableView = normalizeTableViewRecord({
      id: "tv_1",
      tableName: "Employee",
      visibleFields: ["nom", "nom", "", "grade"],
      previewFields: ["a", "b", "c", "d"],
      fieldSettings: { orgId: { displayMode: "lookup", lookupTable: "Org" } },
      filters: [
        {
          id: "flt_1",
          name: "Statut",
          linkColumn: "status",
          sourceType: "static",
          staticOptions: [{ value: "actif", label: "Actif" }],
          enabled: true,
        },
        {
          id: "flt_2",
          name: "Département",
          linkColumn: "dept_id",
          sourceType: "table",
          sqlBuilder: {
            tableName: "department",
            valueColumn: "id",
            labelColumn: "name",
            distinct: true,
          },
          enabled: true,
        },
      ],
    });

    expect(organization.graphicCharters.length).toBe(1);
    expect(organization.graphicCharters[0].config.layout.orientation).toBe(
      "landscape",
    );
    expect(tableView.visibleFields).toEqual(["nom", "grade"]);
    expect(tableView.previewFields).toEqual(["a", "b", "c"]);
    expect(tableView.fieldSettings["orgId"].displayMode).toBe("lookup");
    const filters = tableView.filters ?? [];
    expect(filters[0].sourceType).toBe("Static");
    expect(filters[0].staticOptions?.[0]).toEqual({
      value: "actif",
      label: "Actif",
    });
    expect(filters[1].sourceType).toBe("Table");
    expect(filters[1].sqlBuilder?.tableName).toBe("department");
  });

  it("builds document filter params and enabled runtime filters", () => {
    const family = normalizeFamilyRecord({
      id: "fam_1",
      filterCatalog: [
        {
          id: "flt_1",
          label: "Age",
          type: "number",
          roles: { admin: true, user: true },
        },
        { id: "flt_2", label: "Hidden", roles: { admin: true, user: false } },
      ],
    });
    const template = normalizeTemplateRecord({
      id: "tpl_1",
      filterProfile: [
        { filterId: "flt_1", defaultValue: "18", order: 2 },
        { filterId: "flt_2", enabled: true, order: 1 },
      ],
    });
    const filters = getEnabledTemplateFilters(family, template, "user");

    expect(filters.map((filter) => filter.id)).toEqual(["flt_1"]);
    expect(
      buildDocumentFilterParams({ flt_1: "21" }, family.filterCatalog),
    ).toEqual({
      age: 21,
      filter_age: 21,
      hidden: null,
      filter_hidden: null,
    });
  });
});
