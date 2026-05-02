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
          @if (canDash()) {
            <a mat-list-item routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          }
          @if (canTickets()) {
            <a mat-list-item routerLink="/tickets" routerLinkActive="active">Tickets</a>
          }
          <a mat-list-item routerLink="/request" routerLinkActive="active">New request</a>
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar color="primary">
          <span>AI‑assisted Incident &amp; Service Request</span>
          <span class="spacer"></span>
          <button mat-icon-button type="button" (click)="theme.toggle()" [attr.aria-label]="'Toggle theme'">
            <mat-icon>{{ theme.dark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          <button mat-button type="button" (click)="logout()">Logout</button>
        </mat-toolbar>
        <main class="main"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .shell {
        height: 100vh;
      }
      .nav {
        width: 220px;
      }
      .brand {
        padding: 1rem 1rem 0.5rem;
        font-weight: 600;
      }
      a.active {
        font-weight: 600;
      }
      .spacer {
        flex: 1;
      }
      .main {
        padding: 1rem;
      }
    `,
  ],
})
export default class AppShellComponent {
  readonly auth = inject(AuthStore);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly canDash = computed(() => this.auth.user()?.role === 'MANAGER');
  readonly canTickets = computed(() => {
    const r = this.auth.user()?.role;
    return r === 'MANAGER' || r === 'AGENT';
  });

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
