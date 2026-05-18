import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../../../core/services/auth.service";
import { NotificationService } from "../../../../core/services/notification.service";
import { UserMenuComponent } from "../../../../shared/components/user-menu/user-menu.component";
import { ActiveAcademicYearPillComponent } from "../../../../shared/components/active-academic-year-pill/active-academic-year-pill.component";
import { AcademicYear } from "../../models/academic-year.model";
import { AcademicYearService } from "../../services/academic-year.service";

@Component({
  selector: "app-academic-year-select",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UserMenuComponent,
    ActiveAcademicYearPillComponent,
  ],
  templateUrl: "./academic-year-select.component.html",
  styleUrls: ["./academic-year-select.component.scss"],
})
export class AcademicYearSelectComponent implements OnInit {
  years: AcademicYear[] = [];
  selectedCode = "";
  loading = true;
  creating = false;
  showCreateForm = false;
  createForm = { code: "", startDate: "", endDate: "" };

  constructor(
    private academicYears: AcademicYearService,
    private auth: AuthService,
    private router: Router,
    private notifications: NotificationService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadYears();
  }

  get isAdmin(): boolean {
    return this.auth.getCurrentUser()?.role === "admin";
  }

  async loadYears(): Promise<void> {
    this.loading = true;
    try {
      this.years = await this.academicYears.listYears();
      this.selectedCode = this.auth.getActiveAcademicYear() || this.years[0]?.code || "";
    } catch {
      this.notifications.showError("Impossible de charger les annees universitaires.");
    } finally {
      this.loading = false;
    }
  }

  selectYear(year: AcademicYear): void {
    this.selectedCode = year.code;
  }

  confirmSelection(): void {
    if (!this.selectedCode) return;
    this.auth.setActiveAcademicYear(this.selectedCode);
    const role = this.auth.getCurrentUser()?.role;
    this.router.navigate([role === "admin" ? "/admin" : "/user"]);
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
  }

  async createYear(): Promise<void> {
    if (!this.createForm.code.trim()) return;
    this.creating = true;
    try {
      const created = await this.academicYears.createYear({
        code: this.createForm.code.trim(),
        startDate: this.createForm.startDate || null,
        endDate: this.createForm.endDate || null,
        status: "En cours",
      });
      this.createForm = { code: "", startDate: "", endDate: "" };
      await this.loadYears();
      this.selectedCode = created.code;
      this.showCreateForm = false;
      this.notifications.showSuccess("Annee universitaire creee.");
    } catch {
      this.notifications.showError("Creation de l'annee universitaire impossible.");
    } finally {
      this.creating = false;
    }
  }

  async closeYear(year: AcademicYear, event: Event): Promise<void> {
    event.stopPropagation();
    if (year.isClosed) return;
    try {
      await this.academicYears.closeYear(year.code);
      await this.loadYears();
      this.notifications.showSuccess("Annee universitaire cloturee.");
    } catch {
      this.notifications.showError("Cloture de l'annee universitaire impossible.");
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
