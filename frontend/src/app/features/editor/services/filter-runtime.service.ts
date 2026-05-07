import { Injectable } from '@angular/core';
import { FilterDefinition, FilterOption, FilterValueMap, RuntimeFilterEntry } from '../models/filter.model';
import { buildDocumentFilterParams, getEnabledTemplateFilters, normalizeFilterInputValue, normalizeFilterOptions } from './editor-normalizers';
import { FamilyService } from './family.service';
import { QueryService } from './query.service';
import { TemplateService } from './template.service';

@Injectable({ providedIn: 'root' })
export class FilterRuntimeService {
  constructor(
    private families: FamilyService,
    private templates: TemplateService,
    private query: QueryService
  ) {}

  buildDocumentFilterParams(values: FilterValueMap = {}, filterDefs: FilterDefinition[] = []) {
    return buildDocumentFilterParams(values, Array.isArray(filterDefs) ? filterDefs : []);
  }

  getDefaultFilterValues(familyId: string, templateId: string, role: 'admin' | 'user' = 'user'): FilterValueMap {
    const family = this.families.getFamily(familyId);
    const template = this.templates.getTemplate(templateId);
    if (!family || !template) return {};
    return Object.fromEntries(
      getEnabledTemplateFilters(family, template, role).map(entry => [
        entry.id,
        normalizeFilterInputValue(entry, entry.profile.defaultValue)
      ])
    );
  }

  validateRuntimeFilterValues(entries: RuntimeFilterEntry[] = [], values: FilterValueMap = {}): FilterValueMap {
    const next = this.applyFilterValueDefaults(entries, values);
    entries.forEach(entry => {
      if (entry.type !== 'select') return;
      const allowed = this.getAllowedFilterOptions(entry, entry.options || []);
      const currentValue = next[entry.id];
      if (currentValue === null || currentValue === undefined || currentValue === '') return;
      if (allowed.length && !allowed.some(option => option.value === String(currentValue))) {
        next[entry.id] = normalizeFilterInputValue(entry, entry.profile.defaultValue);
      }
    });
    return next;
  }

  async resolveTemplateFiltersForRole(
    familyId: string,
    templateId: string,
    role: 'admin' | 'user' = 'user',
    organizationId: string | null = null,
    values: FilterValueMap = {},
    extraParams: Record<string, unknown> = {}
  ): Promise<RuntimeFilterEntry[]> {
    const family = this.families.getFamily(familyId);
    const template = this.templates.getTemplate(templateId);
    if (!family || !template) return [];
    const entries = getEnabledTemplateFilters(family, template, role);
    const filterDefs = family.filterCatalog || [];
    const resolved: RuntimeFilterEntry[] = [];
    for (const entry of entries) {
      resolved.push({
        ...entry,
        options: await this.resolveFilterOptionsForEntry(entry, organizationId, values, extraParams, filterDefs)
      });
    }
    return resolved;
  }

  async resolveFilterOptionsForEntry(
    filterEntry: RuntimeFilterEntry,
    organizationId: string | null = null,
    values: FilterValueMap = {},
    extraParams: Record<string, unknown> = {},
    filterDefs: FilterDefinition[] = []
  ): Promise<FilterOption[]> {
    if (!filterEntry || filterEntry.type !== 'select') return [];
    if (filterEntry.sourceType !== 'sql') {
      return this.getAllowedFilterOptions(filterEntry, filterEntry.staticOptions);
    }
    if (!String(filterEntry.sqlQuery || '').trim()) {
      return this.getAllowedFilterOptions(filterEntry, []);
    }
    const rows = await this.query.runSelect(filterEntry.sqlQuery, {
      organizationId,
      ...buildDocumentFilterParams(values, filterDefs.length ? filterDefs : [filterEntry]),
      ...extraParams
    });
    const options = normalizeFilterOptions(rows.map((row, index) => ({
      value: row['value'] ?? row['id'] ?? row['code'] ?? row['key'] ?? index + 1,
      label: row['label'] ?? row['libelle'] ?? row['nom'] ?? row['name'] ?? row['intitule'] ?? row['titre'] ?? row['value'] ?? row['id'] ?? index + 1
    })));
    return this.getAllowedFilterOptions(filterEntry, options);
  }

  private applyFilterValueDefaults(entries: RuntimeFilterEntry[] = [], values: FilterValueMap = {}): FilterValueMap {
    const next: FilterValueMap = {};
    entries.forEach(entry => {
      const rawValue = values[entry.id] !== undefined ? values[entry.id] : entry.profile.defaultValue ?? null;
      next[entry.id] = normalizeFilterInputValue(entry, rawValue);
    });
    return next;
  }

  private getAllowedFilterOptions(filterEntry: RuntimeFilterEntry, options: FilterOption[] = []): FilterOption[] {
    const normalizedOptions = normalizeFilterOptions(options);
    if (filterEntry.profile.allowedValueMode !== 'subset' || !filterEntry.profile.allowedValues?.length) {
      return normalizedOptions;
    }
    const allowedMap = new Map(normalizeFilterOptions(filterEntry.profile.allowedValues).map(option => [option.value, option]));
    const subset = normalizedOptions.filter(option => allowedMap.has(option.value));
    return subset.length ? subset : [...allowedMap.values()];
  }
}
