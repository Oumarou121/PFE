import { Routes } from '@angular/router';

const legacyPage = () =>
  import('./features/legacy-editor/legacy-editor-page.component').then(m => m.LegacyEditorPageComponent);

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    data: { page: 'login' }
  },
  {
    path: 'super-admin',
    loadComponent: legacyPage,
    data: { page: 'superAdmin' }
  },
  {
    path: 'admin',
    loadComponent: legacyPage,
    data: { page: 'admin' }
  },
  {
    path: 'super-admin-angular',
    loadComponent: () => import('./superadmin/superadmin.component').then(m => m.SuperadminComponent),
    data: { page: 'superAdmin' }
  },
  {
    path: 'admin-angular',
    loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent),
    data: { page: 'admin' }
  },
  {
    path: 'user',
    loadComponent: () => import('./features/user/user-page/user-page.component').then(m => m.UserPageComponent),
    data: { page: 'user' }
  },
  {
    path: 'user-angular',
    loadComponent: () => import('./features/user/user-angular-page/user-angular-page.component').then(m => m.UserAngularPageComponent),
    data: { page: 'user' }
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
