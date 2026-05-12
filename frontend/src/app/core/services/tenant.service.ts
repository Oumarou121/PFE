import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

export interface TenantInfo {
  organizationId: number | null;
  role: string | null;
}

/**
 * Service Angular multi-tenant.
 * Expose le contexte tenant courant décodé depuis le JWT.
 * Utilisé par les composants pour filtrer les données par organisation.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  constructor(private authService: AuthService) {}

  /**
   * Retourne l'ID de l'organisation du tenant courant depuis le JWT.
   */
  getOrganizationId(): number | null {
    const token = this.authService.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const orgId = payload['organizationId'] ?? payload['org_id'] ?? null;
      return orgId !== null && orgId !== undefined ? parseInt(String(orgId), 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Retourne le rôle du user courant.
   */
  getRole(): string | null {
    const user = this.authService.getCurrentUser();
    return user?.role ?? null;
  }

  /**
   * Retourne true si le user est super admin (accès cross-tenant).
   */
  isSuperAdmin(): boolean {
    return this.getRole() === 'supAdmin';
  }

  /**
   * Retourne true si le user est admin d'organisation (accès tenant isolé).
   */
  isOrgAdmin(): boolean {
    return this.getRole() === 'admin';
  }

  /**
   * Retourne le contexte tenant courant.
   */
  getTenantInfo(): TenantInfo {
    return {
      organizationId: this.getOrganizationId(),
      role: this.getRole()
    };
  }
}
