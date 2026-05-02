import { DOCUMENT } from '@angular/common';
import { afterNextRender, computed, inject, Injectable, signal } from '@angular/core';

const THEME_DARK_KEY = 'aid_theme_dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  /** Dark mode — body class applied after hydration to avoid SSR mismatch */
  readonly dark = signal(false);

  readonly themeClass = computed(() => (this.dark() ? 'app-dark-theme' : ''));

  constructor() {
    afterNextRender(() => {
      try {
        const stored = localStorage.getItem(THEME_DARK_KEY);
        if (stored === '1') {
          this.dark.set(true);
          this.doc.body.classList.add('app-dark-theme');
        }
      } catch {
        /* ignore */
      }
    });
  }

  toggle(): void {
    this.dark.update((d) => !d);
    const next = this.dark();
    this.doc.body.classList.toggle('app-dark-theme', next);
    try {
      localStorage.setItem(THEME_DARK_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  setDark(value: boolean): void {
    this.dark.set(value);
    this.doc.body.classList.toggle('app-dark-theme', value);
    try {
      localStorage.setItem(THEME_DARK_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
}
