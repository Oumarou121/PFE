import { Routes } from "@angular/router";
import { academicYearGuard, loginGuard } from "./core/guards/auth.guard";
import { roleGuard } from "./core/guards/role.guard";

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
    path: "super-admin/academic-years",
    loadComponent: () =>
      import("./features/editor/pages/super-admin-academic-years/super-admin-academic-years.component").then(
        (m) => m.SuperAdminAcademicYearsComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "academicYearConfig", roles: ["supAdmin"] },
  },
  {
    path: "academic-year",
    loadComponent: () =>
      import("./features/editor/pages/academic-year-select/academic-year-select.component").then(
        (m) => m.AcademicYearSelectComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "academicYear", roles: ["admin", "user"] },
  },
  {
    path: "profile",
    loadComponent: () =>
      import("./features/profile/profile.component").then(
        (m) => m.ProfileComponent,
      ),
    canActivate: [roleGuard, academicYearGuard],
    data: { page: "profile", roles: ["user", "admin", "supAdmin"] },
  },
  {
    path: "admin",
    loadComponent: () =>
      import("./features/editor/pages/admin-home/admin-home.component").then(
        (m) => m.AdminHomeComponent,
      ),
    canActivate: [roleGuard, academicYearGuard],
    data: { page: "adminHome", roles: ["admin"] },
  },
  {
    path: "admin/editor",
    loadComponent: () =>
      import("./features/editor/pages/admin/admin.component").then(
        (m) => m.AdminComponent,
      ),
    canActivate: [roleGuard, academicYearGuard],
    data: { page: "adminEditor", roles: ["admin"] },
  },
  {
    path: "admin/modules",
    loadComponent: () =>
      import("./features/editor/pages/admin-modules/admin-modules.component").then(
        (m) => m.AdminModulesComponent,
      ),
    canActivate: [roleGuard, academicYearGuard],
    data: { page: "adminModules", roles: ["admin"] },
  },
  {
    path: "admin/modules/:moduleId",
    loadComponent: () =>
      import("./features/editor/pages/admin-modules/admin-modules.component").then(
        (m) => m.AdminModulesComponent,
      ),
    canActivate: [roleGuard, academicYearGuard],
    data: { page: "adminModules", roles: ["admin"] },
  },
  {
    path: "admin/personnel",
    loadComponent: () =>
      import("./features/editor/pages/admin-personnel/admin-personnel.component").then(
        (m) => m.AdminPersonnelComponent,
      ),
    canActivate: [roleGuard, academicYearGuard],
    data: { page: "adminPersonnel", roles: ["admin"] },
  },

  {
    path: "user",
    loadComponent: () =>
      import("./features/editor/pages/user-home/user-home.component").then(
        (m) => m.UserHomeComponent,
      ),
    canActivate: [roleGuard, academicYearGuard],
    data: { page: "userHome", roles: ["user"] },
  },
  {
    path: "user/generation",
    loadComponent: () =>
      import("./features/editor/pages/user/user-page.component").then(
        (m) => m.UserPageComponent,
      ),
    canActivate: [roleGuard, academicYearGuard],
    data: { page: "userGeneration", roles: ["user"], mode: "documents" },
  },
  {
    path: "user/modules/:moduleId",
    loadComponent: () =>
      import("./features/editor/pages/user/user-page.component").then(
        (m) => m.UserPageComponent,
      ),
    canActivate: [roleGuard, academicYearGuard],
    data: { page: "userModule", roles: ["user"], mode: "data" },
  },
  {
    path: "archives/group/:groupKey",
    loadComponent: () =>
      import("./features/editor/pages/document-archive/document-archive-detail-page.component").then(
        (m) => m.DocumentArchiveDetailPageComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "archiveDetails", roles: ["user", "admin", "supAdmin"] },
  },
  {
    path: "archives",
    loadComponent: () =>
      import("./features/editor/pages/document-archive/document-archive-page.component").then(
        (m) => m.DocumentArchivePageComponent,
      ),
    canActivate: [roleGuard],
    data: { page: "archives", roles: ["user", "admin", "supAdmin"] },
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
