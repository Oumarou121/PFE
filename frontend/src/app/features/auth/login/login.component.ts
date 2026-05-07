import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
})
export class LoginComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  errorMessage = "";

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      this.redirectByRole();
      return;
    }

    this.form = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", Validators.required],
    });
  }

  submit(): void {
    if (this.form.invalid || this.loading) return;
    this.loading = true;
    this.errorMessage = "";

    this.authService.login(this.form.value).subscribe({
      next: (response) => {
        this.loading = false;
        this.redirectByRole(response.redirectTo);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.error ||
          err?.error?.message ||
          "Connexion impossible. Vérifiez vos identifiants.";
      },
    });
  }

  private redirectByRole(redirectTo?: string): void {
    if (redirectTo) {
      const route = this.legacyUrlToRoute(redirectTo);
      this.router.navigate([route]);
      return;
    }
    const user = this.authService.getCurrentUser();
    switch (user?.role) {
      case "supAdmin":
        this.router.navigate(["/super-admin"]);
        break;
      case "admin":
        this.router.navigate(["/admin"]);
        break;
      default:
        this.router.navigate(["/user"]);
        break;
    }
  }

  private legacyUrlToRoute(url: string): string {
    const file = url.split("?")[0].replace(/^\/+/, "");
    if (file === "superAdmin.html") return "/super-admin";
    if (file === "admin.html") return "/admin";
    if (file === "user.html") return "/user";
    return "/user";
  }
}
