import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthStore } from '../../core/auth/auth.store';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav mode="side" opened class="nav">
        <div class="brand">Incident Hub</div>
        <mat-nav-list>
          @if (canPlatform()) {
            <a mat-list-item routerLink="/platform/tenants" routerLinkActive="active">Platform tenants</a>
          }
          @if (canTenantAdmin()) {
            <a mat-list-item routerLink="/tenant/users" routerLinkActive="active">Tenant users</a>
          }
          @if (canDash()) {
            <a mat-list-item routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          }
          @if (canTickets()) {
            <a mat-list-item routerLink="/tickets" routerLinkActive="active">Tickets</a>
          }
          @if (showRequest()) {
            <a mat-list-item routerLink="/request" routerLinkActive="active">New request</a>
          }
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content class="content">
        <mat-toolbar class="topbar">
          <span class="topbar-title">
            AI‑assisted Incident &amp; Service Request
            @if (auth.tenant(); as t) {
              <span class="tenant-chip">{{ t.name }}</span>
            }
          </span>
          <span class="spacer"></span>
          <button mat-icon-button type="button" (click)="theme.toggle()" [attr.aria-label]="'Toggle theme'">
            <mat-icon>{{ theme.dark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          <button mat-button type="button" (click)="logout()">Logout</button>
        </mat-toolbar>
        <main class="main">
          <div class="page">
            <router-outlet />
          </div>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .shell {
        height: 100vh;
        background: var(--color-page-bg);
      }
      .nav {
        width: 232px;
        border-right: 1px solid var(--color-border-hairline);
        background: var(--color-surface-elevated);
      }
      .brand {
        padding: var(--space-6) var(--space-5) var(--space-3);
        font-weight: 600;
        font-size: 1rem;
        letter-spacing: -0.02em;
        color: var(--color-text-muted);
      }
      a.active {
        font-weight: 600;
        background: var(--color-border-soft);
        border-radius: var(--radius-sm);
      }
      .content {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--color-page-bg);
      }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--color-surface-elevated);
        color: inherit;
        border-bottom: 1px solid var(--color-border-hairline);
        box-shadow: var(--color-shadow-soft);
        padding: 0 var(--space-4);
      }
      .topbar-title {
        font-size: 0.95rem;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: rgba(15, 23, 42, 0.75);
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .tenant-chip {
        font-size: 0.8rem;
        font-weight: 500;
        padding: 0.15rem 0.5rem;
        border-radius: var(--radius-sm, 8px);
        background: var(--color-border-soft, rgba(15, 23, 42, 0.06));
        color: rgba(15, 23, 42, 0.65);
      }
      :host-context(.app-dark-theme) .topbar-title {
        color: rgba(255, 255, 255, 0.72);
      }
      .spacer {
        flex: 1;
      }
      .main {
        flex: 1;
        padding: var(--space-6) 0 var(--space-10);
        min-height: 0;
      }
      .page {
        max-width: var(--content-max);
        margin: 0 auto;
        padding-left: var(--space-6);
        padding-right: var(--space-6);
      }
    `,
  ],
})
export default class AppShellComponent {
  readonly auth = inject(AuthStore);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly canPlatform = computed(() => this.auth.user()?.role === 'SUPER_ADMIN');
  readonly canTenantAdmin = computed(() => this.auth.user()?.role === 'TENANT_ADMIN');
  readonly canDash = computed(() => {
    const r = this.auth.user()?.role;
    return r === 'MANAGER' || r === 'TENANT_ADMIN';
  });
  readonly canTickets = computed(() => {
    const r = this.auth.user()?.role;
    return r === 'MANAGER' || r === 'AGENT' || r === 'TENANT_ADMIN';
  });
  readonly showRequest = computed(() => this.auth.user()?.role !== 'SUPER_ADMIN');

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
