import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'edit' },
  {
    path: 'edit',
    loadComponent: () => import('./features/editor/editor').then((c) => c.Editor),
  },
];
