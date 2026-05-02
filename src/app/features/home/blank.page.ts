import { Component } from '@angular/core';

/** Placeholder for `/` while `homeRedirectGuard` issues a `UrlTree` redirect */
@Component({
  selector: 'app-home-blank',
  standalone: true,
  template: `<p class="muted">Redirecting…</p>`,
  styles: [
    `
      .muted {
        padding: 1rem;
        opacity: 0.7;
      }
    `,
  ],
})
export default class BlankPage {}
