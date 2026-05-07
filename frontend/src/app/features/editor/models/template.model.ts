import type { TemplateFilterProfileEntry } from './filter.model';
import type { UnknownRecord } from './editor-common.model';

export interface TemplateSectionDirections {
  header: 'ltr' | 'rtl';
  body: 'ltr' | 'rtl';
  footer: 'ltr' | 'rtl';
}

export interface HeaderFooterDistances {
  headerTop: number;
  footerBottom: number;
}

export interface TemplateRecord extends UnknownRecord {
  id: string;
  familyId?: string;
  organizationId?: string | null;
  graphicCharterId?: string | null;
  header?: string;
  body?: string;
  footer?: string;
  hasHeader?: boolean;
  hasFooter?: boolean;
  headerFooterDistances: HeaderFooterDistances;
  filterProfile: TemplateFilterProfileEntry[];
  headerDisplay: 'all' | 'first' | 'even' | 'odd';
  footerDisplay: 'all' | 'first' | 'even' | 'odd';
  sectionDirections: TemplateSectionDirections;
}
