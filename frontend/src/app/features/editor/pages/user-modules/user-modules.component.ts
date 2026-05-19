import { CommonModule } from "@angular/common";
import { Component, ViewEncapsulation } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";

import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { ActiveAcademicYearPillComponent } from "../../../../shared/components/active-academic-year-pill/active-academic-year-pill.component";
import { UserMenuComponent } from "../../../../shared/components/user-menu/user-menu.component";
import { TableFiltersComponent } from "../../components/table-filters/table-filters.component";
import { ModuleRecord } from "../../models/module.model";
import { TableViewConfig } from "../../models/table-view.model";
import { EditorStateService } from "../../services/editor-state.service";
import { OrganizationService } from "../../services/organization.service";
import { TableViewService } from "../../services/table-view.service";
import { AdminModulesComponent } from "../admin-modules/admin-modules.component";

@Component({
  selector: "app-user-modules",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    TableFiltersComponent,
    UserMenuComponent,
    ActiveAcademicYearPillComponent,
  ],
  templateUrl: "../admin-modules/admin-modules.component.html",
  styleUrls: ["../admin-modules/admin-modules.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class UserModulesComponent extends AdminModulesComponent {
  constructor(
    router: Router,
    auth: AuthService,
    route: ActivatedRoute,
    state: EditorStateService,
    tableViews: TableViewService,
    organizationsService: OrganizationService,
    notifications: NotificationService,
    dialog: MatDialog,
  ) {
    super(
      router,
      auth,
      route,
      state,
      tableViews,
      organizationsService,
      notifications,
      dialog,
    );
  }

  override get modulesList(): ModuleRecord[] {
    const search = this.dataViewSearch.trim().toLowerCase();
    const allowedIds = new Set(this.auth.getCurrentUser()?.moduleIds || []);
    const modules = (this.state.getState().modules || []) as ModuleRecord[];
    return modules.filter(
      (module) =>
        module.isActive &&
        allowedIds.has(module.id) &&
        (!search || module.name.toLowerCase().includes(search)),
    );
  }

  override get selectedModule(): ModuleRecord | null {
    return this.selectedModuleId
      ? this.modulesList.find((module) => module.id === this.selectedModuleId) ||
          null
      : null;
  }

  override goBack(): void {
    this.router.navigate(["/user"]);
  }

  protected override async ensureLookupOptions(
    view: TableViewConfig,
  ): Promise<void> {
    await super.ensureLookupOptions(view);
    this.applyLookupRestrictions(view);
  }

  private applyLookupRestrictions(view: TableViewConfig): void {
    const rules = this.auth.getCurrentUser()?.dataAccessRules || [];
    const applicableRules = rules.filter((rule) => {
      const sameTableView = rule.tableViewId === view.id;
      const sameTable =
        !!rule.tableName &&
        rule.tableName.toLowerCase() === view.tableName.toLowerCase();
      return (sameTableView || sameTable) && rule.values?.length;
    });

    applicableRules.forEach((rule) => {
      const key = `${view.id}::${rule.field}`;
      const options = this.lookupOptions[key];
      if (!options) return;
      const allowedValues = new Set(rule.values.map((value) => String(value)));
      this.lookupOptions[key] = options.filter((option) =>
        allowedValues.has(String(option.value)),
      );
    });
  }
}
