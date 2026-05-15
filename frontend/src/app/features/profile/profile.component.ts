import { CommonModule } from "@angular/common";
import { Component, OnInit, ViewEncapsulation } from "@angular/core";
import { Router } from "@angular/router";
import { lastValueFrom } from "rxjs";

import { ApiService } from "../../core/services/api.service";
import { AuthService } from "../../core/services/auth.service";
import { NotificationService } from "../../core/services/notification.service";
import { UserMenuComponent } from "../../shared/components/user-menu/user-menu.component";

type ProfileResponse = {
  id: number;
  email: string;
  name: string;
  role: string;
  organizationId?: number | null;
  profile?: string | null;
  profileDetail?: string | null;
  accessAllYears: boolean;
  accessYearList?: string | null;
  moduleIds: string[];
  createdAt: string;
  isActive: boolean;
};

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [CommonModule, UserMenuComponent],
  templateUrl: "./profile.component.html",
  styleUrls: ["./profile.component.scss"],
  encapsulation: ViewEncapsulation.None,
})
export class ProfileComponent implements OnInit {
  loading = true;
  profile: ProfileResponse | null = null;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
    private notifications: NotificationService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.profile = await lastValueFrom(this.api.get<ProfileResponse>("auth/profile"));
    } catch {
      this.notifications.showError("Impossible de charger le profil.");
    } finally {
      this.loading = false;
    }
  }

  get homeRoute(): string {
    const role = this.auth.getCurrentUser()?.role;
    if (role === "supAdmin") return "/super-admin";
    if (role === "admin") return "/admin";
    return "/user";
  }

  get accessYearsLabel(): string {
    if (!this.profile) return "-";
    if (this.profile.accessAllYears) return "Toutes les annees";
    try {
      const years = JSON.parse(this.profile.accessYearList || "[]");
      return Array.isArray(years) && years.length ? years.join(", ") : "Aucune";
    } catch {
      return this.profile.accessYearList || "Aucune";
    }
  }

  goHome(): void {
    this.router.navigate([this.homeRoute]);
  }
}
