import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { EditorStateService } from './editor-state.service';
import { DocumentRenderService } from './document-render.service';
import { FamilyService } from './family.service';
import { FilterRuntimeService } from './filter-runtime.service';
import { QueryService } from './query.service';
import { TableViewService } from './table-view.service';

describe('editor services', () => {
  let http: HttpTestingController;
  let state: EditorStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    state = TestBed.inject(EditorStateService);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads bootstrap into typed editor state', async () => {
    const promise = state.loadBootstrap();

    const req = http.expectOne(`${environment.apiUrl}/bootstrap`);
    expect(req.request.method).toBe('POST');
    req.flush({
      state: {
        families: [{ id: 'fam_1', beneficiaireTable: 'Employee' }],
        templates: [{ id: 'tpl_1', familyId: 'fam_1' }],
        organizations: [{ id: 'org_1' }],
        admins: [{ id: 'adm_1', organizationId: 'org_1' }],
        tableViews: [{ id: 'tv_1', tableName: 'Employee' }],
        settings: { organizationVisibleVarKeys: ['nom'] }
      }
    });

    const loaded = await promise;
    expect(loaded.families[0].beneficiaryTable).toBe('Employee');
    expect(loaded._loaded?.families).toBeTrue();
  });

  it('maps table view endpoints through ApiService', async () => {
    const service = TestBed.inject(TableViewService);

    const rowsPromise = service.getTableViewRows('tv_1', { search: 'ali' });
    const rowsReq = http.expectOne(`${environment.apiUrl}/table-view/rows`);
    expect(rowsReq.request.method).toBe('POST');
    expect(rowsReq.request.body).toEqual({ configId: 'tv_1', config: null, search: 'ali', databaseName: undefined, selectedFilters: null });
    rowsReq.flush({ rows: [{ id: 1, nom: 'Ali' }] });
    expect(await rowsPromise).toEqual([{ id: 1, nom: 'Ali' }]);

    const savePromise = service.saveTableViewRecord('tv_1', '1', { nom: 'Ali' });
    const saveReq = http.expectOne(`${environment.apiUrl}/table-view/record`);
    expect(saveReq.request.method).toBe('PUT');
    saveReq.flush({ record: { id: 1, nom: 'Ali' } });
    expect(await savePromise).toEqual({ id: 1, nom: 'Ali' });
  });

  it('resolves sql filter options and validates subset values', async () => {
    const query = TestBed.inject(QueryService);
    spyOn(query, 'runSelect').and.resolveTo([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' }
    ]);
    state.replaceState({
      families: [{
        id: 'fam_1',
        beneficiaryMode: 'table',
        beneficiaryTable: 'Employee',
        beneficiaryTableLabel: '',
        beneficiaryDisplayColumn1: '',
        beneficiaryDisplayColumn2: '',
        beneficiaryLinkColumn: '',
        beneficiarySql: '',
        filterCatalog: [{
          id: 'flt_1',
          key: 'department',
          label: 'Department',
          type: 'select',
          sourceType: 'sql',
          placeholder: '',
          helpText: '',
          roles: { admin: true, user: true },
          columnBinding: { tableName: '', columnName: '', mode: 'manual' },
          columnBindings: [],
          staticOptions: [],
          sqlBuilder: { tableName: '', valueColumn: '', labelColumn: '', distinct: true },
          sqlQuery: 'select value, label from departments'
        }]
      }],
      templates: [{
        id: 'tpl_1',
        familyId: 'fam_1',
        organizationId: null,
        graphicCharterId: null,
        headerFooterDistances: { headerTop: 5, footerBottom: 5 },
        filterProfile: [{
          filterId: 'flt_1',
          enabled: true,
          adminEnabled: true,
          userEnabled: true,
          required: false,
          locked: false,
          order: 0,
          defaultValue: 'a',
          allowedValueMode: 'subset',
          allowedValues: [{ value: 'b', label: 'B' }]
        }],
        headerDisplay: 'all',
        footerDisplay: 'all',
        sectionDirections: { header: 'ltr', body: 'ltr', footer: 'ltr' }
      }]
    });
    const runtime = TestBed.inject(FilterRuntimeService);

    const filters = await runtime.resolveTemplateFiltersForRole('fam_1', 'tpl_1', 'user');
    expect(filters[0].options).toEqual([{ value: 'b', label: 'B' }]);
    expect(runtime.validateRuntimeFilterValues(filters, { flt_1: 'a' })).toEqual({ flt_1: 'a' });
    expect(runtime.validateRuntimeFilterValues(filters, { flt_1: 'x' })).toEqual({ flt_1: 'a' });
  });

  it('maps family save endpoint', async () => {
    const families = TestBed.inject(FamilyService);

    const promise = families.saveFamily({
      id: 'fam_1',
      beneficiaryMode: 'table',
      beneficiaryTable: 'Employee',
      beneficiaryTableLabel: '',
      beneficiaryDisplayColumn1: '',
      beneficiaryDisplayColumn2: '',
      beneficiaryLinkColumn: '',
      beneficiarySql: '',
      filterCatalog: []
    });

    const req = http.expectOne(`${environment.apiUrl}/families/fam_1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
    expect((await promise).id).toBe('fam_1');
  });

  it('renders document preview with legacy context, charter and table syntaxes', () => {
    state.replaceState({
      organizations: [{
        id: 'org_1',
        nom: 'Org 1',
        adresse: 'Rue 1',
        tel: '123',
        ville: 'Tunis',
        raw: { code_etab: 'ORG-CODE', region: 'Nord' },
        graphicCharters: [{
          id: 'charter_1',
          name: 'Charter',
          description: '',
          isDefault: true,
          createdAt: null,
          updatedAt: '2026-01-01',
          config: {
            identity: { officialName: 'Nom officiel', directorName: 'Directeur X', slogan: 'Slogan X', logoText: 'LOGO' },
            colors: { primary: '#111111', secondary: '#222222', text: '#333333', heading: '#444444', border: '#555555', tableHeaderBg: '#eeeeee', tableAltRowBg: '#dddddd' },
            typography: { bodyFont: 'Arial', headingFont: 'Georgia' },
            layout: { orientation: 'landscape', pageMargins: { mt: 10, mb: 11, ml: 12, mr: 13 }, headerFooterDistances: { headerTop: 4, footerBottom: 6 }, pageBackground: { enabled: false, image: '', size: 'cover', position: 'center center', repeat: 'no-repeat' } },
            header: { enabledByDefault: true, displayMode: 'all', html: '' },
            footer: { enabledByDefault: true, displayMode: 'all', html: '' },
            watermark: { enabled: false, text: '', color: '#999999', opacity: 0.1 }
          }
        }]
      }],
      families: [{
        id: 'fam_1',
        beneficiaryMode: 'table',
        beneficiaryTable: 'Employee',
        beneficiaryTableLabel: '',
        beneficiaryDisplayColumn1: '',
        beneficiaryDisplayColumn2: '',
        beneficiaryLinkColumn: '',
        beneficiarySql: '',
        filterCatalog: [],
        classes: [{ vars: [{ tech: 'rows', type: 'list-object', columns: [{ key: 'libelle', label: 'Libelle' }, { key: 'valeur', label: 'Valeur' }] }] }]
      }],
      templates: [{
        id: 'tpl_render',
        familyId: 'fam_1',
        organizationId: 'org_1',
        graphicCharterId: 'charter_1',
        hasHeader: true,
        hasFooter: true,
        header: '<p>{{nom_etab}} {{org_code_etab}} {{directeur}}</p>',
        body: '<p>{{nom}}</p><p>{{date_du_jour_iso}}</p>{{#items:ul}}{{#rows:table:libelle,valeur}}',
        footer: '<p>{{annee_univ}} {{slogan_etab}}</p>',
        headerFooterDistances: { headerTop: 5, footerBottom: 5 },
        filterProfile: [],
        headerDisplay: 'first',
        footerDisplay: 'odd',
        sectionDirections: { header: 'ltr', body: 'ltr', footer: 'ltr' }
      }],
      admins: [],
      tableViews: [],
      settings: {},
      _loaded: {}
    });
    const service = TestBed.inject(DocumentRenderService);
    const pages = service.renderDocumentPages(state.getState().templates[0], {
      nom: 'Ali',
      items: ['A', 'B'],
      rows: [{ libelle: 'Salaire', valeur: 100 }]
    }, { mode: 'preview' });

    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0].header).toContain('Nom officiel');
    expect(pages[0].header).toContain('ORG-CODE');
    expect(pages[0].header).toContain('Directeur X');
    expect(pages[0].content).not.toContain('{{date_du_jour_iso}}');
    expect(pages[0].content).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(pages[0].content).toContain('<ul');
    expect(pages[0].content).toContain('<table');
    expect(pages[0].content).toContain('Libelle');
    const html = service.buildDocumentPagesHtml(state.getState().templates[0], pages);
    expect(html).toContain('document-render--preview');
    expect(html).toContain('--page-orientation:landscape');
    expect(html).toContain('--doc-font-body:Arial');
  });
});
