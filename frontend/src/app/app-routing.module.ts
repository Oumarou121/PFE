import { Routes } from "@angular/router";
import { loginGuard } from "./core/guards/auth.guard";
import { roleGuard } from "./core/guards/role.guard";

const legacyPage = () =>
  import("./features/legacy-editor/legacy-editor-page.component").then(
    (m) => m.LegacyEditorPageComponent,
  );

export const routes: Routes = [
  {
    path: "login",
    loadComponent: () =>
      import("./features/auth/login/login.component").then(
        (m) => m.LoginComponent,
      ),
    canActivate: [loginGuard],
    data: { page: "login" },
  },
  {
    path: "super-admin",
    loadComponent: legacyPage,
    canActivate: [roleGuard],
    data: { page: "superAdmin", roles: ["supAdmin"] },
  },
  {
    path: "admin",
    loadComponent: legacyPage,
    canActivate: [roleGuard],
    data: { page: "admin", roles: ["admin"] },
  },
  {
    path: "user",
    loadComponent: legacyPage,
    canActivate: [roleGuard],
    data: { page: "user", roles: ["user"] },
  },
  {
    path: "",
    redirectTo: "login",
    pathMatch: "full",
  },
  {
    path: "**",
    redirectTo: "login",
  },
];
