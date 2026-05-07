import { Injectable } from '@angular/core';
import { GraphicCharterConfig, GraphicCharterRecord } from '../models/graphic-charter.model';
import { getScopedOrganizationId, normalizeGraphicCharterConfig, normalizeGraphicCharterEntry } from './editor-normalizers';
import { OrganizationService } from './organization.service';
import { TemplateService } from './template.service';

@Injectable({ providedIn: 'root' })
export class GraphicCharterService {
  constructor(private organizations: OrganizationService, private templates: TemplateService) {}

  normalizeGraphicCharterConfig(config: unknown = {}): GraphicCharterConfig {
    return normalizeGraphicCharterConfig(config);
  }

  getOrganizationGraphicCharters(organizationId: string | null | undefined): GraphicCharterRecord[] {
    const organization = organizationId ? this.organizations.getOrganization(organizationId) : null;
    return organization?.graphicCharters || [];
  }

  getOrganizationGraphicCharter(organizationId: string | null | undefined, charterId: string | null = null): GraphicCharterRecord | null {
    const charters = this.getOrganizationGraphicCharters(organizationId);
    if (!charters.length) return null;
    if (charterId) {
      const match = charters.find(item => item.id === charterId);
      if (match) return match;
    }
    return charters.find(item => item.isDefault) || charters[0] || null;
  }

  getTemplateGraphicCharter(templateId: string): GraphicCharterConfig {
    const template = this.templates.getTemplate(templateId);
    const organizationId = getScopedOrganizationId(template);
    const record = organizationId ? this.getOrganizationGraphicCharter(organizationId, template?.graphicCharterId || null) : null;
    return record?.config ? normalizeGraphicCharterConfig(record.config) : normalizeGraphicCharterConfig({});
  }

  async saveOrganizationGraphicCharter(organizationId: string, charter: Partial<GraphicCharterRecord>): Promise<GraphicCharterRecord | null> {
    const organization = this.organizations.getOrganization(organizationId);
    if (!organization) return null;
    const current = organization.graphicCharters || [];
    const normalized = normalizeGraphicCharterEntry({
      ...charter,
      id: charter.id,
      updatedAt: new Date().toISOString(),
      createdAt: charter.createdAt || new Date().toISOString()
    }, current.length);
    let next = current.filter(item => item.id !== normalized.id);
    next.push(normalized);
    if (normalized.isDefault || !next.some(item => item.isDefault)) {
      next = next.map(item => ({ ...item, isDefault: item.id === normalized.id }));
    }
    await this.organizations.saveOrganization({ ...organization, graphicCharters: next, updatedAt: new Date().toISOString() });
    return normalized;
  }
}
