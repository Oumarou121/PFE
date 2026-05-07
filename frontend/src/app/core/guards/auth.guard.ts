import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(["/login"]);
  return false;
};

export const loginGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  const role = authService.getCurrentUser()?.role;
  if (role === "supAdmin") router.navigate(["/super-admin"]);
  else if (role === "admin") router.navigate(["/admin"]);
  else router.navigate(["/user"]);
  return false;
};
