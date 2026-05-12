import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { GraphicCharterConfig, GraphicCharterRecord } from '../models/graphic-charter.model';
import {
  getScopedOrganizationId,
  normalizeGraphicCharterConfig,
  normalizeGraphicCharterEntry
} from './editor-normalizers';
import { OrganizationService } from './organization.service';
import { TemplateService } from './template.service';
import { EditorStateService } from './editor-state.service';

@Injectable({ providedIn: 'root' })
export class GraphicCharterService {

  constructor(
    private api: ApiService,
    private organizations: OrganizationService,
    private templates: TemplateService,
    private state: EditorStateService
  ) {}

  normalizeGraphicCharterConfig(config: unknown = {}): GraphicCharterConfig {
    return normalizeGraphicCharterConfig(config);
  }

  getOrganizationGraphicCharters(organizationId: string | null | undefined): GraphicCharterRecord[] {
    const organization = organizationId ? this.organizations.getOrganization(organizationId) : null;
    return organization?.graphicCharters || [];
  }

  getOrganizationGraphicCharter(
    organizationId: string | null | undefined,
    charterId: string | null = null
  ): GraphicCharterRecord | null {
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
    const record = organizationId
      ? this.getOrganizationGraphicCharter(organizationId, template?.graphicCharterId || null)
      : null;
    return record?.config
      ? normalizeGraphicCharterConfig(record.config)
      : normalizeGraphicCharterConfig({});
  }

  /**
   * Sauvegarde une charte graphique via l'API (ConfigDB → UnivadConfiDB),
   * puis met à jour le state local.
   * La charte est toujours liée à une organisation via OrganizationId.
   */
  async saveOrganizationGraphicCharter(
    organizationId: string,
    charter: Partial<GraphicCharterRecord>
  ): Promise<GraphicCharterRecord | null> {
    const organization = this.organizations.getOrganization(organizationId);
    if (!organization) return null;

    const current = organization.graphicCharters || [];
    const normalized = normalizeGraphicCharterEntry(
      {
        ...charter,
        id: charter.id,
        organizationId: parseInt(organizationId, 10),
        updatedAt: new Date().toISOString(),
        createdAt: charter.createdAt || new Date().toISOString()
      },
      current.length
    );

    // ── Persistance via API (UnivadConfiDB) ──
    try {
      const saved = await firstValueFrom(
        this.api.put<GraphicCharterRecord>(
          `graphic-charters/${encodeURIComponent(normalized.id)}`,
          normalized
        )
      );
      if (saved) {
        Object.assign(normalized, saved);
      }
    } catch (err) {
      console.error('[GraphicCharterService] API save failed:', err);
      throw err;
    }

    // ── Mise à jour du state local ──
    let next = current.filter(item => item.id !== normalized.id);
    next.push(normalized);

    if (normalized.isDefault || !next.some(item => item.isDefault)) {
      next = next.map(item => ({ ...item, isDefault: item.id === normalized.id }));
    }

    // Sync état local (sans persistState complet, l'API gère la persistance)
    const appState = this.state.getState();
    const orgIndex = appState.organizations.findIndex(o => o.id === organizationId);
    if (orgIndex >= 0) {
      appState.organizations[orgIndex] = {
        ...appState.organizations[orgIndex],
        graphicCharters: next,
        updatedAt: new Date().toISOString()
      };
      this.state.replaceState(appState);
    }

    return normalized;
  }

  /**
   * Supprime une charte graphique via l'API.
   */
  async deleteOrganizationGraphicCharter(
    organizationId: string,
    charterId: string
  ): Promise<void> {
    const organization = this.organizations.getOrganization(organizationId);
    if (!organization) return;

    // ── Suppression via API ──
    try {
      await firstValueFrom(
        this.api.delete(`graphic-charters/${encodeURIComponent(charterId)}`)
      );
    } catch (err) {
      console.error('[GraphicCharterService] API delete failed:', err);
      throw err;
    }

    // ── Mise à jour du state local ──
    const appState = this.state.getState();
    const orgIndex = appState.organizations.findIndex(o => o.id === organizationId);
    if (orgIndex >= 0) {
      appState.organizations[orgIndex] = {
        ...appState.organizations[orgIndex],
        graphicCharters: (organization.graphicCharters || []).filter(c => c.id !== charterId)
      };
      this.state.replaceState(appState);
    }
  }
}
