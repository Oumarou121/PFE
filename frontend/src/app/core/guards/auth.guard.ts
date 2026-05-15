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
  else if (role === "admin" || role === "user") router.navigate(["/academic-year"]);
  else router.navigate(["/login"]);
  return false;
};

export const academicYearGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.getCurrentUser()?.role;

  if (role === "supAdmin" || authService.getActiveAcademicYear()) {
    return true;
  }

  router.navigate(["/academic-year"]);
  return false;
};
