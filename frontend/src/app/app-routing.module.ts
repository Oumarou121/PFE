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
    loadComponent: () =>
      import("./features/editor/pages/super-admin/super-admin.component").then(
        (m) => m.SuperAdminComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "superAdmin", roles: ["supAdmin"] },
  },
  {
    path: "admin",
    loadComponent: () =>
      import("./features/editor/pages/admin-home/admin-home.component").then(
        (m) => m.AdminHomeComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "adminHome", roles: ["admin"] },
  },
  {
    path: "admin/editor",
    loadComponent: () =>
      import("./features/editor/pages/admin/admin.component").then(
        (m) => m.AdminComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "adminEditor", roles: ["admin"] },
  },
  {
    path: "admin/modules",
    loadComponent: () =>
      import("./features/editor/pages/admin-modules/admin-modules.component").then(
        (m) => m.AdminModulesComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "adminModules", roles: ["admin"] },
  },
  {
    path: "admin/modules/:moduleId",
    loadComponent: () =>
      import("./features/editor/pages/admin-modules/admin-modules.component").then(
        (m) => m.AdminModulesComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "adminModules", roles: ["admin"] },
  },
  {
    path: "admin/personnel",
    loadComponent: () =>
      import("./features/editor/pages/admin-personnel/admin-personnel.component").then(
        (m) => m.AdminPersonnelComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "adminPersonnel", roles: ["admin"] },
  },

  {
    path: "user",
    loadComponent: () =>
      import("./features/editor/pages/user-home/user-home.component").then(
        (m) => m.UserHomeComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "userHome", roles: ["user"] },
  },
  {
    path: "user/generation",
    loadComponent: () =>
      import("./features/editor/pages/user/user-page.component").then(
        (m) => m.UserPageComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "userGeneration", roles: ["user"], mode: "documents" },
  },
  {
    path: "user/modules/:moduleId",
    loadComponent: () =>
      import("./features/editor/pages/user/user-page.component").then(
        (m) => m.UserPageComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "userModule", roles: ["user"], mode: "data" },
  },
  {
    path: "documents/group/:groupKey",
    loadComponent: () =>
      import("./features/editor/pages/document-history/document-history-detail-page.component").then(
        (m) => m.DocumentHistoryDetailPageComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "documentDetails", roles: ["user", "admin", "supAdmin"] },
  },
  {
    path: "documents",
    loadComponent: () =>
      import("./features/editor/pages/document-history/document-history-page.component").then(
        (m) => m.DocumentHistoryPageComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "documents", roles: ["user", "admin", "supAdmin"] },
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
