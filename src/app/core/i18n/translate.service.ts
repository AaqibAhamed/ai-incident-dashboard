import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { en, type TranslationTree } from './translations/en';
import { sv } from './translations/sv';

export type AppLocale = 'en' | 'sv';

const STORAGE_KEY = 'app.locale';

const DICTS: Record<AppLocale, TranslationTree> = {
  en,
  sv,
};

function lookupString(tree: TranslationTree, key: string): string | undefined {
  const segments = key.split('.');
  let cur: unknown = tree;
  for (const segment of segments) {
    if (cur === null || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[segment];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Simple nested-key lookups with runtime EN/SV switching (SSR-safe bundled dictionaries). */
@Injectable({ providedIn: 'root' })
export class TranslateService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _locale = signal<AppLocale>('en');

  readonly locale = this._locale.asReadonly();

  /** Call from APP_INITIALIZER on the browser to apply saved preference. */
  restoreLocaleFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'en' || raw === 'sv') {
      this._locale.set(raw);
    }
  }

  setLocale(next: AppLocale): void {
    this._locale.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }

  instant(key: string, params?: Record<string, string | number>): string {
    let text = lookupString(DICTS[this._locale()], key) ?? lookupString(en, key) ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{{${name}}}`, String(value));
      }
    }
    return text;
  }
}
