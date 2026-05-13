import { Routes } from '@angular/router';
import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { homeRedirectGuard } from './core/auth/guards/home-redirect.guard';
import { roleGuard } from './core/auth/guards/role.guard';
import { ticketResolver } from './features/tickets/data/ticket.resolver';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/nav-bar/nav-bar.component').then((m) => m.NavBarComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [homeRedirectGuard],
        loadComponent: () => import('./features/home/blank.page'),
      },
      {
        path: 'platform/tenants',
        canMatch: [roleGuard(['SUPER_ADMIN'])],
        loadComponent: () => import('./features/platform/pages/platform-tenants.page'),
      },
      {
        path: 'tenant/users',
        canMatch: [roleGuard(['TENANT_ADMIN'])],
        loadComponent: () => import('./features/tenant-admin/pages/tenant-users.page'),
      },
      {
        path: 'dashboard',
        canMatch: [roleGuard(['MANAGER', 'TENANT_ADMIN'])],
        loadComponent: () => import('./features/dashboard/pages/dashboard.page'),
      },
      {
        path: 'tickets',
        canMatch: [roleGuard(['MANAGER', 'AGENT', 'TENANT_ADMIN'])],
        loadComponent: () => import('./features/tickets/pages/tickets-list.page'),
      },
      {
        path: 'tickets/:id',
        loadComponent: () => import('./features/tickets/pages/ticket-detail.page'),
        resolve: { ticket: ticketResolver },
      },
      {
        path: 'request',
        loadComponent: () => import('./features/request/pages/request-form.page'),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
