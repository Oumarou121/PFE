import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { UserMenuComponent } from "../../../../shared/components/user-menu/user-menu.component";
import { AcademicYearConfig } from "../../models/academic-year.model";
import { OrganizationRecord } from "../../models/organization.model";
import { DatabaseSchema, SchemaColumn, SchemaTable } from "../../models/schema.model";
import { AcademicYearService } from "../../services/academic-year.service";
import { EditorStateService } from "../../services/editor-state.service";
import { OrganizationService } from "../../services/organization.service";
import { SchemaService } from "../../services/schema.service";

@Component({
  selector: "app-super-admin-academic-years",
  standalone: true,
  imports: [CommonModule, FormsModule, UserMenuComponent],
  templateUrl: "./super-admin-academic-years.component.html",
  styleUrls: ["./super-admin-academic-years.component.scss"],
})
export class SuperAdminAcademicYearsComponent implements OnInit {
  organizations: OrganizationRecord[] = [];
  selectedOrganizationId = "";
  schema: DatabaseSchema = {};
  config: AcademicYearConfig | null = null;
  loading = true;
  saving = false;
  selectedTableToAdd = "";

  constructor(
    private state: EditorStateService,
    private organizationsService: OrganizationService,
    private schemaService: SchemaService,
    private academicYears: AcademicYearService,
    private auth: AuthService,
    private notifications: NotificationService,
    public router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.state.ensureResources(["organizations"]);
      this.organizations = this.organizationsService.getOrganizations();
      this.selectedOrganizationId = this.organizations[0]?.id || "";
      if (this.selectedOrganizationId) await this.loadOrganizationContext();
    } catch {
      this.notifications.showError("Chargement de la configuration impossible.");
    } finally {
      this.loading = false;
    }
  }

  get tables(): SchemaTable[] {
    return this.schema.tables || [];
  }

  get availableTables(): SchemaTable[] {
    const selected = new Set(this.config?.affectedTables.map((item) => item.tableName) || []);
    return this.tables.filter((table) => !selected.has(table.name));
  }

  async onOrganizationChange(): Promise<void> {
    await this.loadOrganizationContext();
  }

  async loadOrganizationContext(): Promise<void> {
    if (!this.selectedOrganizationId) return;
    this.loading = true;
    this.auth.setActiveOrganizationId(this.selectedOrganizationId);
    try {
      const [schema, config] = await Promise.all([
        this.schemaService.getSchema(true),
        this.academicYears.getConfig(this.selectedOrganizationId),
      ]);
      this.schema = schema;
      this.config =
        config ||
        {
          organizationId: Number(this.selectedOrganizationId),
          affectedTables: [],
        };
    } catch {
      this.notifications.showError("Impossible de charger le schema de l'organisation.");
    } finally {
      this.loading = false;
    }
  }

  columnsFor(tableName: string | null | undefined): SchemaColumn[] {
    if (!tableName) return [];
    return (this.schema.columns || []).filter(
      (column) => column.table.toLowerCase() === tableName.toLowerCase(),
    );
  }

  addAffectedTable(): void {
    if (!this.config || !this.selectedTableToAdd) return;
    const firstCandidate =
      this.columnsFor(this.selectedTableToAdd).find((column) =>
        this.looksLikeAcademicYearColumn(column.name),
      ) || this.columnsFor(this.selectedTableToAdd)[0];
    this.config.affectedTables.push({
      tableName: this.selectedTableToAdd,
      yearColumn: firstCandidate?.name || "",
    });
    this.selectedTableToAdd = "";
  }

  removeAffectedTable(index: number): void {
    this.config?.affectedTables.splice(index, 1);
  }

  async save(): Promise<void> {
    if (!this.config) return;
    this.saving = true;
    try {
      this.config.organizationId = Number(this.selectedOrganizationId);
      this.config.affectedTables = this.config.affectedTables.filter(
        (item) => item.tableName && item.yearColumn,
      );
      this.config = await this.academicYears.saveConfig(this.config);
      this.notifications.showSuccess("Configuration des annees universitaires sauvegardee.");
    } catch {
      this.notifications.showError("Sauvegarde impossible.");
    } finally {
      this.saving = false;
    }
  }

  private looksLikeAcademicYearColumn(name: string): boolean {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized.includes("anneeuniv") || normalized.includes("academic");
  }
}
