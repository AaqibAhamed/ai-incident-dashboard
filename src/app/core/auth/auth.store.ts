import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { computed, effect, inject } from '@angular/core';

import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';

import { firstValueFrom } from 'rxjs';

import type { UserRole } from '../../../graphql/generated/graphql';

import { API_CONFIG } from '../tokens/api-config.token';

const SESSION_KEY = 'aid_session';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const ACTIVITY_THROTTLE_MS = 30 * 1000;

const REFRESH_RETRY_LIMIT = 3;

const REFRESH_RETRY_BASE_DELAY_MS = 3000;

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

  // Unix ms timestamp when access token expires (provided by server)
  accessTokenExpiresAt: number | null;

  isIdle: boolean;

  initialized: boolean;
};

export interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken?: string;

  refreshToken?: string;

  // Unix ms timestamp when access token expires
  accessTokenExpiresAt?: number;

  user: SessionUser;

  tenant?: SessionTenant | null;
}

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

export const AuthStore = signalStore(
  { providedIn: 'root' },

  withState<AuthState>({
    user: null,

    tenant: null,
    accessTokenExpiresAt: null,

    isIdle: false,

    initialized: false
  }),

  withComputed(store => ({
    // Authentication is better derived from presence of user data when tokens are HttpOnly cookies
    isAuthenticated: computed(() => !!store.user()),

    roles: computed(() => (store.user() ? [store.user()!.role] : ([] as UserRole[]))),

    isSuperAdmin: computed(() => store.user()?.role === 'SUPER_ADMIN'),

    isTenantUser: computed(() => !!store.tenant()?.id)
  })),

  withMethods((store, http = inject(HttpClient), api = inject(API_CONFIG)) => {
    // SignalRService must not be injected here to avoid circular dependency.
    // SignalRService will observe AuthStore and start/stop itself as needed.
    // =====================================================
    // Crypto
    // =====================================================

    let cryptoModule: typeof import('./auth.crypto') | null = null;

    const getCrypto = async () => {
      if (cryptoModule) {
        return cryptoModule;
      }

      try {
        cryptoModule = await import('./auth.crypto');

        return cryptoModule;
      } catch {
        return null;
      }
    };

    // =====================================================
    // Runtime Resources
    // =====================================================

    let refreshTimer: number | null = null;

    let idleTimer: number | null = null;

    let refreshPromise: Promise<void> | null = null;

    let listenersInitialized = false;

    let lastActivityAt = 0;

    const cleanupFns: Array<() => void> = [];

    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('aid-auth') : null;

    // =====================================================
    // Cleanup
    // =====================================================

    const clearRefreshTimer = (): void => {
      if (refreshTimer != null) {
        clearTimeout(refreshTimer);

        refreshTimer = null;
      }
    };

    const clearIdleTimer = (): void => {
      if (idleTimer != null) {
        clearTimeout(idleTimer);

        idleTimer = null;
      }
    };

    const clearSessionStorage = (): void => {
      if (!storageAvailable()) return;

      sessionStorage.removeItem(SESSION_KEY);
    };

    const clearState = (): void => {
      patchState(store, {
        user: null,

        tenant: null,
        isIdle: false
      });
    };

    const fullCleanup = (): void => {
      clearRefreshTimer();

      clearIdleTimer();

      clearSessionStorage();

      clearState();
    };

    // =====================================================
    // Broadcast Channel
    // =====================================================

    const broadcast = (type: 'logout' | 'refresh'): void => {
      channel?.postMessage({ type });
    };

    channel?.addEventListener('message', async event => {
      switch (event.data?.type) {
        case 'logout':
          fullCleanup();

          break;

        case 'refresh':
          await restoreFromStorage();

          break;
      }
    });

    // =====================================================
    // Persistence
    // =====================================================

    const persist = async (): Promise<void> => {
      if (!storageAvailable()) {
        return;
      }

      try {
        const payload: Partial<AuthState> = {
          user: store.user(),

          tenant: store.tenant(),

          // We persist only user/tenant and the server-provided expiry. Tokens live in HttpOnly cookies.
          accessTokenExpiresAt: store.accessTokenExpiresAt()
        };

        const crypto = await getCrypto();

        if (crypto) {
          const encrypted = await crypto.encryptState(payload);

          sessionStorage.setItem(SESSION_KEY, encrypted);

          return;
        }

        sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
      } catch {
        // best effort
      }
    };

    const readPersisted = async (): Promise<Partial<AuthState> | null> => {
      if (!storageAvailable()) {
        return null;
      }

      try {
        const raw = sessionStorage.getItem(SESSION_KEY);

        if (!raw) {
          return null;
        }

        const crypto = await getCrypto();

        const parsed = crypto ? await crypto.decryptState(raw) : JSON.parse(raw);

        return parsed as Partial<AuthState> | null;
      } catch {
        clearSessionStorage();

        return null;
      }
    };

    // =====================================================
    // Logout
    // =====================================================

    const performLogout = (): void => {
      fullCleanup();

      broadcast('logout');
    };

    // =====================================================
    // Idle Tracking
    // =====================================================

    const startIdleTimer = (): void => {
      clearIdleTimer();

      idleTimer = window.setTimeout(() => {
        patchState(store, {
          isIdle: true
        });

        performLogout();
      }, IDLE_TIMEOUT_MS);
    };

    const updateActivity = (): void => {
      const now = Date.now();

      if (now - lastActivityAt < ACTIVITY_THROTTLE_MS) {
        return;
      }

      lastActivityAt = now;

      if (store.isIdle()) {
        patchState(store, {
          isIdle: false
        });
      }

      startIdleTimer();
    };

    const initializeActivityTracking = (): void => {
      if (listenersInitialized || typeof window === 'undefined') {
        return;
      }

      listenersInitialized = true;

      const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

      events.forEach(eventName => {
        window.addEventListener(eventName, updateActivity, { passive: true });

        cleanupFns.push(() => {
          window.removeEventListener(eventName, updateActivity);
        });
      });

      const visibilityHandler = async (): Promise<void> => {
        if (!document.hidden) {
          updateActivity();

          await validateAndRefresh();
        }
      };

      document.addEventListener('visibilitychange', visibilityHandler);

      cleanupFns.push(() => {
        document.removeEventListener('visibilitychange', visibilityHandler);
      });

      const onlineHandler = async (): Promise<void> => {
        await validateAndRefresh();
      };

      window.addEventListener('online', onlineHandler);

      cleanupFns.push(() => {
        window.removeEventListener('online', onlineHandler);
      });

      updateActivity();
    };

    // =====================================================
    // Refresh Scheduling
    // =====================================================

    const scheduleRefresh = async (): Promise<void> => {
      clearRefreshTimer();

      if (store.isIdle() || !store.user()) {
        return;
      }

      // Prefer server-provided expiry timestamp when available
      const expiresAt = store.accessTokenExpiresAt();

      let delay: number | null = null;

      if (expiresAt) {
        const now = Date.now();
        const msLeft = expiresAt - now;
        // schedule refresh 60s before expiry (or immediately if passed)
        delay = Math.max(0, msLeft - 60_000);
      } else {
        // No client-side token available for fallback when using cookie-only auth
        delay = null;
      }

      if (delay == null) {
        return;
      }

      if (delay === 0) {
        await performRefresh();

        return;
      }

      refreshTimer = window.setTimeout(() => {
        void performRefresh();
      }, delay);
    };

    const validateAndRefresh = async (): Promise<void> => {
      const expiresAt = store.accessTokenExpiresAt();

      let shouldRefresh = false;

      if (expiresAt) {
        const now = Date.now();
        // refresh if token is expired or about to expire within 60s
        shouldRefresh = expiresAt - now <= 60_000;
      } else {
        // Without a client-side token we can't compute a fallback; only refresh based on server expiry
        shouldRefresh = false;
      }

      if (shouldRefresh) {
        await performRefresh();
      }
    };

    // =====================================================
    // Refresh
    // =====================================================

    async function performRefresh(retryCount = 0): Promise<void> {
      if (refreshPromise) {
        return refreshPromise;
      }

      refreshPromise = (async () => {
        try {
          // For cookie-only auth we don't send tokens in the body. Server validates cookies.
          const body = await firstValueFrom(
            http.post<LoginResponse>(`${api.restUrl}/auth/refresh`, {}, { withCredentials: true })
          );

          const expiresAt = body.accessTokenExpiresAt ?? null;

          patchState(store, {
            accessTokenExpiresAt: expiresAt,

            user: body.user,

            tenant: body.tenant ?? null
          });

          await persist();

          await scheduleRefresh();

          broadcast('refresh');
        } catch (err) {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            performLogout();

            return;
          }

          if (retryCount < REFRESH_RETRY_LIMIT) {
            const retryDelay = REFRESH_RETRY_BASE_DELAY_MS * (retryCount + 1);

            await new Promise(resolve => {
              setTimeout(resolve, retryDelay);
            });

            return performRefresh(retryCount + 1);
          }

          throw err;
        } finally {
          refreshPromise = null;
        }
      })();

      return refreshPromise;
    }

    // =====================================================
    // Restore
    // =====================================================

    async function restoreFromStorage(): Promise<void> {
      const parsed = await readPersisted();

      if (!parsed) {
        patchState(store, {
          initialized: true
        });

        return;
      }

      patchState(store, {
        user: parsed.user ?? null,

        tenant: parsed.tenant ?? null
      });

      try {
        await validateAndRefresh();

        await scheduleRefresh();

        initializeActivityTracking();

        // SignalRService will react to AuthStore state changes and start itself.
      } catch {
        performLogout();
      }

      patchState(store, {
        initialized: true
      });
    }

    // =====================================================
    // Public API
    // =====================================================

    return {
      async login(loginCredentials: LoginCredentials): Promise<void> {
        const body = await firstValueFrom(
          http.post<LoginResponse>(`${api.restUrl}/auth/login`, loginCredentials, { withCredentials: true })
        );

        // Backend sets tokens via HttpOnly cookies. Backend includes an expiry timestamp
        // so the frontend can schedule refreshes without reading HttpOnly cookies.
        const expiresAt = body.accessTokenExpiresAt ?? null;

        patchState(store, {
          user: body.user,

          tenant: body.tenant ?? null,

          accessTokenExpiresAt: expiresAt,

          isIdle: false
        });

        initializeActivityTracking();

        startIdleTimer();

        await persist();

        await scheduleRefresh();

        broadcast('refresh');
      },

      logout(): void {
        performLogout();
      },

      async refresh(): Promise<void> {
        return performRefresh();
      },

      async restoreFromStorage(): Promise<void> {
        return restoreFromStorage();
      },

      // Expose persist so hooks can access it to run a persistence effect
      async saveToStorage(): Promise<void> {
        return persist();
      }
    };
  }),

  withHooks(store => ({
    onInit(): void {
      // restoreFromStorage should run once during init
      void store.restoreFromStorage();

      // persistence effect: watch tokens and persist whenever they change
      effect(() => {
        // watch user and expiry; persist after restoration
        store.user();

        store.accessTokenExpiresAt();

        if (store.initialized()) {
          void store.saveToStorage();
        }
      });
    },

    onDestroy(): void {
      // cleanup handled by closures
      // runtime resources released automatically
    }
  }))
);
