import { CommonModule } from '@angular/common';
import { Component, inject, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TranslateService } from '../../../core/i18n/translate.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-nav-bar',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    TranslatePipe,
  ],
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.scss'],
})
export class NavBarComponent {
  readonly auth = inject(AuthStore);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(TranslateService);
  readonly locale = this.i18n.locale;
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
