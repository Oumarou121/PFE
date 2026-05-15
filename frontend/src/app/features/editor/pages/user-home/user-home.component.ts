import { CommonModule } from "@angular/common";
import { Component, OnInit, ViewEncapsulation } from "@angular/core";
import { Router } from "@angular/router";

import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { ModuleRecord } from "../../models/module.model";
import { EditorStateService } from "../../services/editor-state.service";
import { OrganizationService } from "../../services/organization.service";

type UserHomeCard = {
  title: string;
  icon: string;
  action: () => void;
};

@Component({
  selector: "app-user-home",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./user-home.component.html",
  styleUrls: ["./user-home.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class UserHomeComponent implements OnInit {
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
      const organization = user?.organizationId
        ? this.organizationsService.getOrganization(user.organizationId)
        : this.organizationsService.getOrganizations()[0] || null;
      this.organizationName = organization?.nom || organization?.name || "";
      this.auth.setActiveOrganizationId(user?.organizationId || null);
    } catch {
      this.notifications.showError("Impossible de charger votre espace.");
    } finally {
      this.loading = false;
    }
  }

  get baseCards(): UserHomeCard[] {
    return [
      {
        title: "Generation de document",
        icon: "fa fa-file-text",
        action: () => this.router.navigate(["/user/generation"]),
      },
    ];
  }

  get modules(): ModuleRecord[] {
    const user = this.auth.getCurrentUser();
    const allowedIds = new Set(user?.moduleIds || []);
    const modules = (this.state.getState().modules || []) as ModuleRecord[];
    return modules
      .filter((module) => module.isActive && allowedIds.has(module.id))
      .slice()
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  openModule(module: ModuleRecord): void {
    this.router.navigate(["/user/modules", module.id]);
  }

  logout(): void {
    this.auth.logout();
  }
}
