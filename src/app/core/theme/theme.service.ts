import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  /** Dark mode toggle */
  readonly dark = signal(false);

  readonly themeClass = computed(() => (this.dark() ? 'app-dark-theme' : ''));

  toggle(): void {
    this.dark.update((d) => !d);
    this.doc.body.classList.toggle('app-dark-theme', this.dark());
  }

  setDark(value: boolean): void {
    this.dark.set(value);
    this.doc.body.classList.toggle('app-dark-theme', value);
  }
}
