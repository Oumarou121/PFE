import { CommonModule } from "@angular/common";
import { Component, OnInit, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { Router } from "@angular/router";

import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { ConfirmDialogComponent } from "../../../../shared/components/confirm-dialog/confirm-dialog.component";
import { ModuleRecord } from "../../models/module.model";
import { PersonnelCreateRequest, PersonnelUpdateRequest, PersonnelUser } from "../../models/personnel.model";
import { EditorStateService } from "../../services/editor-state.service";
import { OrganizationService } from "../../services/organization.service";
import { PersonnelService } from "../../services/personnel.service";

type PersonnelForm = PersonnelUpdateRequest & {
  id?: number;
  accessYearsText: string;
};

@Component({
  selector: "app-admin-personnel",
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: "./admin-personnel.component.html",
  styleUrls: ["./admin-personnel.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class AdminPersonnelComponent implements OnInit {
  loading = true;
  saving = false;
  deleting = false;
  organizationName = "";
  search = "";
  personnel: PersonnelUser[] = [];
  selectedUserId: number | null = null;
  creating = false;
  form: PersonnelForm = this.createEmptyForm();

  constructor(
    public router: Router,
    private auth: AuthService,
    private state: EditorStateService,
    private organizationsService: OrganizationService,
    private personnelService: PersonnelService,
    private notifications: NotificationService,
    private dialog: MatDialog,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      await this.state.ensureResources(["organizations", "modules"]);
      const user = this.auth.getCurrentUser();
      const organization = user?.organizationId
        ? this.organizationsService.getOrganization(user.organizationId)
        : this.organizationsService.getOrganizations()[0] || null;
      this.organizationName = organization?.nom || organization?.name || "";
      await this.reload();
    } catch {
      this.notifications.showError("Impossible de charger le personnel.");
    } finally {
      this.loading = false;
    }
  }

  get filteredPersonnel(): PersonnelUser[] {
    const query = this.search.trim().toLowerCase();
    if (!query) return this.personnel;
    return this.personnel.filter((user) =>
      [user.name, user.email, user.role, user.profile, user.profileDetail]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  get modules(): ModuleRecord[] {
    const modules = (this.state.getState().modules || []) as ModuleRecord[];
    return modules
      .filter((module) => module.isActive)
      .slice()
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  goBack(): void {
    this.router.navigate(["/admin"]);
  }

  logout(): void {
    this.auth.logout();
  }

  async reload(): Promise<void> {
    this.personnel = await this.personnelService.getAll();
    if (this.selectedUserId && !this.personnel.some((user) => user.id === this.selectedUserId)) {
      this.resetSelection();
    }
  }

  createUser(): void {
    this.creating = true;
    this.selectedUserId = null;
    this.form = this.createEmptyForm();
  }

  selectUser(user: PersonnelUser): void {
    if (this.saving || this.deleting) return;
    this.creating = false;
    this.selectedUserId = user.id;
    this.form = {
      id: user.id,
      name: user.name,
      email: user.email,
      password: "",
      role: user.role || "user",
      organizationId: user.organizationId ?? null,
      profile: user.profile || "",
      profileDetail: user.profileDetail || "",
      accessAllYears: user.accessAllYears,
      accessYearList: user.accessYearList || "[]",
      accessYearsText: this.formatAccessYears(user.accessYearList),
      moduleIds: [...(user.moduleIds || [])],
      isActive: user.isActive,
    };
  }

  async saveUser(): Promise<void> {
    if (!this.form.name.trim() || !this.form.email.trim()) {
      this.notifications.showError("Nom et email sont obligatoires.");
      return;
    }
    if (this.creating && !this.form.password?.trim()) {
      this.notifications.showError("Le mot de passe est obligatoire.");
      return;
    }
    const accessYearList = this.buildAccessYearList();
    if (!this.form.accessAllYears && accessYearList === null) {
      this.notifications.showError("Saisissez au moins une annee autorisee.");
      return;
    }

    this.saving = true;
    try {
      if (this.creating) {
        const payload: PersonnelCreateRequest = {
          name: this.form.name.trim(),
          email: this.form.email.trim(),
          password: this.form.password || "",
          role: "user",
          organizationId: this.form.organizationId ?? null,
          profile: this.form.profile || null,
          profileDetail: this.form.profileDetail || null,
          accessAllYears: this.form.accessAllYears,
          accessYearList: accessYearList || "[]",
          moduleIds: this.form.moduleIds || [],
        };
        const created = await this.personnelService.create(payload);
        this.notifications.showSuccess("Personnel ajoute.");
        await this.reload();
        this.selectUser(created);
      } else if (this.form.id) {
        const payload: PersonnelUpdateRequest = {
          name: this.form.name.trim(),
          email: this.form.email.trim(),
          password: this.form.password?.trim() || undefined,
          role: "user",
          organizationId: this.form.organizationId ?? null,
          profile: this.form.profile || null,
          profileDetail: this.form.profileDetail || null,
          accessAllYears: this.form.accessAllYears,
          accessYearList: accessYearList || "[]",
          moduleIds: this.form.moduleIds || [],
          isActive: this.form.isActive,
        };
        const updated = await this.personnelService.update(this.form.id, payload);
        this.notifications.showSuccess("Personnel enregistre.");
        await this.reload();
        this.selectUser(updated);
      }
    } catch (error: any) {
      this.notifications.showError(error?.error?.message || "Impossible d'enregistrer le personnel.");
    } finally {
      this.saving = false;
    }
  }

  deleteUser(): void {
    if (this.creating) {
      this.resetSelection();
      return;
    }
    if (!this.form.id) {
      this.notifications.showError("Selectionnez un personnel a supprimer.");
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: "Supprimer le personnel ?",
        message: `Le compte "${this.form.name}" sera supprime.`,
        confirmText: "Supprimer",
        cancelText: "Annuler",
        actionType: "delete",
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed || !this.form.id) return;
      this.deleting = true;
      try {
        await this.personnelService.delete(this.form.id);
        this.notifications.showSuccess("Personnel supprime.");
        await this.reload();
        this.resetSelection();
      } catch (error: any) {
        this.notifications.showError(error?.error?.message || "Impossible de supprimer le personnel.");
      } finally {
        this.deleting = false;
      }
    });
  }

  isModuleSelected(moduleId: string): boolean {
    return this.form.moduleIds.includes(moduleId);
  }

  toggleModule(moduleId: string, checked: boolean): void {
    if (checked && !this.form.moduleIds.includes(moduleId)) {
      this.form.moduleIds = [...this.form.moduleIds, moduleId];
      return;
    }
    if (!checked) {
      this.form.moduleIds = this.form.moduleIds.filter((id) => id !== moduleId);
    }
  }

  getModuleNames(user: PersonnelUser): string {
    const names = (user.moduleIds || [])
      .map((id) => this.modules.find((module) => module.id === id)?.name || id)
      .filter(Boolean);
    return names.length ? names.join(", ") : "Aucun module";
  }

  getAccessYearsLabel(user: PersonnelUser): string {
    if (user.accessAllYears) return "Toutes";
    const years = this.parseAccessYears(user.accessYearList);
    return years.length ? years.join(", ") : "Aucune";
  }

  setAccessAllYears(value: boolean): void {
    this.form.accessAllYears = value;
    if (value) {
      this.form.accessYearsText = "";
      this.form.accessYearList = "[]";
    }
  }

  private resetSelection(): void {
    this.creating = false;
    this.selectedUserId = null;
    this.form = this.createEmptyForm();
  }

  private createEmptyForm(): PersonnelForm {
    const organizationId = this.auth.getCurrentUser()?.organizationId;
    return {
      name: "",
      email: "",
      password: "",
      role: "user",
      organizationId: organizationId ? Number(organizationId) : null,
      profile: "",
      profileDetail: "",
      accessAllYears: true,
      accessYearList: "[]",
      accessYearsText: "",
      moduleIds: [],
      isActive: true,
    };
  }

  private buildAccessYearList(): string | null {
    if (this.form.accessAllYears) return "[]";
    const years = this.form.accessYearsText
      .split(/[,;\s]+/)
      .map((year) => year.trim())
      .filter(Boolean);

    const uniqueYears = Array.from(new Set(years));
    if (!uniqueYears.length) return null;
    return JSON.stringify(uniqueYears);
  }

  private formatAccessYears(accessYearList?: string | null): string {
    return this.parseAccessYears(accessYearList).join(", ");
  }

  private parseAccessYears(accessYearList?: string | null): string[] {
    if (!accessYearList?.trim()) return [];
    try {
      const value = JSON.parse(accessYearList);
      return Array.isArray(value) ? value.map((item) => String(item)) : [];
    } catch {
      return accessYearList
        .split(/[,;\s]+/)
        .map((year) => year.trim())
        .filter(Boolean);
    }
  }
}
