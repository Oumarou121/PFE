import { CommonModule } from "@angular/common";
import { Component, OnInit, ViewEncapsulation } from "@angular/core";
import { Router } from "@angular/router";

import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { OrganizationService } from "../../services/organization.service";
import { EditorStateService } from "../../services/editor-state.service";
import { ModuleRecord } from "../../models/module.model";

type AdminQuickCard = {
  title: string;
  subtitle: string;
  icon: string;
  action: () => void;
};

@Component({
  selector: "app-admin-home",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./admin-home.component.html",
  styleUrls: ["./admin-home.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class AdminHomeComponent implements OnInit {
  loading = true;
  organizationName = "";

  constructor(
    public router: Router,
    private auth: AuthService,
    private state: EditorStateService,
    private organizationsService: OrganizationService,
    private notifications: NotificationService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.state.ensureResources(["organizations", "modules"]);
      const user = this.auth.getCurrentUser();
      const organizationId = user?.organizationId || null;
      const organization = organizationId
        ? this.organizationsService.getOrganization(organizationId)
        : this.organizationsService.getOrganizations()[0] || null;
      this.organizationName = organization?.nom || organization?.name || "";
    } catch {
      this.notifications.showError(
        "Impossible de charger l'espace administrateur.",
      );
    } finally {
      this.loading = false;
    }
  }

  get modules(): ModuleRecord[] {
    const modules = (this.state.getState().modules || []) as ModuleRecord[];
    return modules
      .filter((module) => module.isActive)
      .slice()
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  get quickCards(): AdminQuickCard[] {
    return [
      {
        title: "Gestion des templates",
        subtitle: "Ouvrir l'éditeur de documents",
        icon: "✏️",
        action: () => this.router.navigate(["/admin/editor"]),
      },
      {
        title: "Historique des documents",
        subtitle: "Consulter les documents générés",
        icon: "📚",
        action: () => this.router.navigate(["/documents"]),
      },
      {
        title: "Gestion des modules",
        subtitle: "Configurer les espaces métiers",
        icon: "🧩",
        action: () => this.router.navigate(["/admin/modules"]),
      },
    ];
  }

  openModule(module: ModuleRecord): void {
    this.router.navigate(["/admin/modules", module.id]);
  }

  logout(): void {
    this.auth.logout();
  }
}
