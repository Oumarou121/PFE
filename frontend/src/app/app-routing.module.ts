import { Routes } from '@angular/router';

const legacyPage = () =>
  import('./features/legacy-editor/legacy-editor-page.component').then(m => m.LegacyEditorPageComponent);

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: legacyPage,
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
    path: 'user',
    loadComponent: legacyPage,
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
