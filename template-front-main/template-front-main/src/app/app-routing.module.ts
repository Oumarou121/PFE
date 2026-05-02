import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'processus',
        loadComponent: () => import('./features/processus/processus-list/processus-list.component').then(m => m.ProcessusListComponent)
      },
      {
        path: 'documents',
        loadComponent: () => import('./features/documents/documents-list/documents-list.component').then(m => m.DocumentsListComponent)
      },
      {
        path: 'users',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/users/users-list/users-list.component').then(m => m.UsersListComponent)
          },
          {
            path: 'new',
            loadComponent: () => import('./features/users/users-form/users-form.component').then(m => m.UsersFormComponent)
          },
          {
            path: 'edit/:id',
            loadComponent: () => import('./features/users/users-form/users-form.component').then(m => m.UsersFormComponent)
          }
        ]
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];