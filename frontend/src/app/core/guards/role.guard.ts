import { inject } from "@angular/core";
import { Router, ActivatedRouteSnapshot } from "@angular/router";
import { AuthService } from "../services/auth.service";

export const roleGuard = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(["/login"]);
    return false;
  }

  const allowedRoles: string[] = route.data["roles"] ?? [];
  if (!allowedRoles.length) return true;

  const user = authService.getCurrentUser();
  if (user && allowedRoles.includes(user.role)) {
    return true;
  }

  // Redirect to the user's own space
  const role = user?.role;
  if (role === "supAdmin") router.navigate(["/super-admin"]);
  else if (role === "admin") router.navigate(["/admin"]);
  else router.navigate(["/user"]);

  return false;
};
