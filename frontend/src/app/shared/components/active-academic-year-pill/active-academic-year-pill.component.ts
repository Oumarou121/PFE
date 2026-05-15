import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "app-active-academic-year-pill",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./active-academic-year-pill.component.html",
  styleUrls: ["./active-academic-year-pill.component.scss"],
})
export class ActiveAcademicYearPillComponent {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  get code(): string {
    return this.auth.getActiveAcademicYear() || "";
  }

  get visible(): boolean {
    return this.auth.getCurrentUser()?.role !== "supAdmin" && !!this.code;
  }

  changeYear(): void {
    this.router.navigate(["/academic-year"]);
  }
}
