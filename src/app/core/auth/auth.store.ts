import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, runInInjectionContext, Injector } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import type { UserRole } from '../../../graphql/generated/graphql';
import { API_CONFIG } from '../tokens/api-config.token';

const SESSION_KEY = 'aid_session';

function storageAvailable(): boolean {
  return typeof sessionStorage !== 'undefined' && sessionStorage != null;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface SessionTenant {
  id: string;
  name: string;
  slug: string;
}

type AuthState = {
  user: SessionUser | null;
  tenant: SessionTenant | null;
  accessToken: string | null;
  refreshToken: string | null;
  lastActivityAt: number | null;
  isIdle: boolean;
};

export interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  tenant?: SessionTenant | null;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({
    user: null,
    tenant: null,
    accessToken: null,
    refreshToken: null,
    lastActivityAt: null,
    isIdle: false,
  }),
  withComputed((store) => ({
    isAuthenticated: computed(() => !!store.accessToken()),
    roles: computed(() => (store.user() ? [store.user()!.role] : ([] as UserRole[]))),
    isSuperAdmin: computed(() => store.user()?.role === 'SUPER_ADMIN'),
    isTenantUser: computed(() => !!store.tenant()?.id),
    // tenantId: computed(() => store.tenant()?.id ?? null),
  })),
  withMethods((store, http = inject(HttpClient), api = inject(API_CONFIG)) => {
    import('./auth.crypto').then((m) => m).catch(() => null);

    const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

    let idleTimer: number | null = null;
    let activityListenersInitialized = false;

    const clearIdleTimer = (): void => {
      if (idleTimer != null) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const performLogout = (): void => {
      patchState(store, {
        user: null,
        tenant: null,
        accessToken: null,
        refreshToken: null,
        lastActivityAt: null,
        isIdle: false,
      });

      clearRefreshTimer();
      clearIdleTimer();

      if (storageAvailable()) {
        sessionStorage.removeItem(SESSION_KEY);
      }
    };

    const startIdleTimer = (): void => {
      clearIdleTimer();

      idleTimer = window.setTimeout(() => {
        patchState(store, {
          isIdle: true,
        });

        // stop refresh cycle
        clearRefreshTimer();

        // logout user after timeout
        performLogout();
      }, IDLE_TIMEOUT_MS) as unknown as number;
    };

    const updateActivity = (): void => {
      const now = Date.now();

      patchState(store, {
        lastActivityAt: now,
        isIdle: false,
      });

      startIdleTimer();

      // if user became active again and token exists
      // ensure refresh scheduling resumes
      if (store.accessToken()) {
        scheduleRefresh();
      }
    };

    // We'll import crypto helpers lazily to avoid SSR issues
    let crypto: typeof import('./auth.crypto') | null = null;
    const getCrypto = async (): Promise<typeof import('./auth.crypto') | null> => {
      if (crypto) return crypto;
      try {
        crypto = await import('./auth.crypto');
        return crypto;
      } catch {
        crypto = null;
        return null;
      }
    };

    const initializeActivityTracking = (): void => {
      if (activityListenersInitialized) return;

      activityListenersInitialized = true;

      const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

      events.forEach((event) => {
        window.addEventListener(event, updateActivity, {
          passive: true,
        });
      });

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          updateActivity();
        }
      });

      updateActivity();
    };

    const persist = async (): Promise<void> => {
      if (!storageAvailable()) return;
      try {
        const state: AuthState = {
          user: store.user(),
          tenant: store.tenant(),
          accessToken: store.accessToken(),
          refreshToken: store.refreshToken(),
          lastActivityAt: store.lastActivityAt(),
          isIdle: store.isIdle(),
        };
        const c = await getCrypto();
        if (c) {
          const encrypted = await c.encryptState(state);
          sessionStorage.setItem(SESSION_KEY, encrypted);
        } else {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
        }
      } catch {
        // best-effort
      }
    };

    const readPersisted = async (): Promise<Partial<AuthState> | null> => {
      if (!storageAvailable()) return null;
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const c = await getCrypto();
        if (c) {
          const obj = await c.decryptState(raw);
          return obj as Partial<AuthState> | null;
        }
        return JSON.parse(raw) as Partial<AuthState>;
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
    };

    let refreshTimer: number | null = null;
    let refreshPromise: Promise<void> | null = null;

    const clearRefreshTimer = (): void => {
      if (refreshTimer != null) {
        clearTimeout(refreshTimer as unknown as number);
        refreshTimer = null;
      }
    };

    const scheduleRefresh = (): void => {
      if (store.isIdle()) {
        return;
      }
      clearRefreshTimer();
      const token = store.accessToken();
      // use helper to calculate delay; fall back if helper unavailable
      const c = (async () => await getCrypto())();
      (async () => {
        const mod = await c;
        const delay = mod ? mod.calculateRefreshDelay(token) : null;
        if (delay == null) return; // can't schedule
        // if token already expired or within buffer, refresh immediately
        if (delay === 0) {
          void performRefresh();
          return;
        }
        refreshTimer = window.setTimeout(() => {
          void performRefresh();
        }, delay) as unknown as number;
      })();
    };

    // performRefresh is defined before we return to ensure it and the effect
    // are reachable and created during store factory execution.
    async function performRefresh(): Promise<void> {
      const rt = store.refreshToken();
      if (!rt) return;
      // dedupe concurrent refresh calls
      if (refreshPromise) return refreshPromise;

      refreshPromise = (async () => {
        try {
          const body = await firstValueFrom(
            http.post<LoginResponse>(`${api.restUrl}/auth/refresh`, { refreshToken: rt }),
          );
          patchState(store, {
            user: body.user,
            tenant: body.tenant ?? null,
            accessToken: body.accessToken,
            refreshToken: body.refreshToken ?? rt,
          });
          await persist();
          scheduleRefresh();
        } catch (err) {
          // if refresh failed with 401, tokens are invalid -> force logout
          if (err instanceof HttpErrorResponse && err.status === 401) {
            // clear everything and remove persisted session
            patchState(store, { user: null, tenant: null, accessToken: null, refreshToken: null });
            if (storageAvailable()) sessionStorage.removeItem(SESSION_KEY);
            clearRefreshTimer();
          }
          throw err;
        } finally {
          refreshPromise = null;
        }
      })();

      return refreshPromise;
    }

    // effect: persist whenever relevant signals change and keep refresh timer in sync
    // Defer effect creation to next microtask to ensure injection context is available
    Promise.resolve().then(() => {
      try {
        runInInjectionContext(inject(Injector), () => {
          effect(() => {
            // read signals so effect re-runs on changes
            store.accessToken();
            store.refreshToken();
            store.user();
            store.tenant();
            // persist and schedule/clear refresh
            void persist();
            scheduleRefresh();
          });
        });
      } catch {
        // If effect fails, it's okay - persist still happens in methods
      }
    });

    return {
      async restoreFromStorage(): Promise<void> {
        const parsed = await readPersisted();
        if (!parsed) return;

        patchState(store, {
          user: parsed.user ?? null,
          tenant: parsed.tenant ?? null,
          accessToken: parsed.accessToken ?? null,
          refreshToken: parsed.refreshToken ?? null,
        });

        if (parsed.accessToken) {
          initializeActivityTracking();
          updateActivity();
          scheduleRefresh();
        }
      },

      async login(credentials: LoginCredentials): Promise<void> {
        try {
          const body = await firstValueFrom(
            http.post<LoginResponse>(`${api.restUrl}/auth/login`, credentials),
          );
          patchState(store, {
            user: body.user,
            tenant: body.tenant ?? null,
            accessToken: body.accessToken,
            refreshToken: body.refreshToken,
          });
          // persist and schedule a refresh when login succeeds
          await persist();
          scheduleRefresh();
          initializeActivityTracking();
          updateActivity();
        } catch (err) {
          // rethrow after optional handling so callers can show messages
          throw err;
        }
      },

      logout(): void {
        performLogout();
      },

      async refresh(): Promise<void> {
        return performRefresh();
      },
      // internal implementation used by scheduler and public refresh()
      async performRefreshInternal(): Promise<void> {
        return performRefresh();
      },
    };
  }),
);
