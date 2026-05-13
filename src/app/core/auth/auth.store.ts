import { HttpClient } from '@angular/common/http';
import { computed, inject } from '@angular/core';
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
  }),
  withComputed((store) => ({
    isAuthenticated: computed(() => !!store.accessToken()),
    roles: computed(() => (store.user() ? [store.user()!.role] : ([] as UserRole[]))),
    isSuperAdmin: computed(() => store.user()?.role === 'SUPER_ADMIN'),
    isTenantUser: computed(() => !!store.tenant()?.id),
  })),
  withMethods((store, http = inject(HttpClient), api = inject(API_CONFIG)) => {
    const persist = (): void => {
      if (!storageAvailable()) return;
      const state: AuthState = {
        user: store.user(),
        tenant: store.tenant(),
        accessToken: store.accessToken(),
        refreshToken: store.refreshToken(),
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    };

    return {
      restoreFromStorage(): void {
        if (!storageAvailable()) return;
        try {
          const raw = sessionStorage.getItem(SESSION_KEY);
          if (!raw) return;
          const parsed = JSON.parse(raw) as Partial<AuthState>;
          patchState(store, {
            user: parsed.user ?? null,
            tenant: parsed.tenant ?? null,
            accessToken: parsed.accessToken ?? null,
            refreshToken: parsed.refreshToken ?? null,
          });
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
        }
      },

      async login(credentials: LoginCredentials): Promise<void> {
        const body = await firstValueFrom(
          http.post<LoginResponse>(`${api.restUrl}/auth/login`, credentials),
        );
        patchState(store, {
          user: body.user,
          tenant: body.tenant ?? null,
          accessToken: body.accessToken,
          refreshToken: body.refreshToken,
        });
        persist();
      },

      logout(): void {
        patchState(store, { user: null, tenant: null, accessToken: null, refreshToken: null });
        if (storageAvailable()) {
          sessionStorage.removeItem(SESSION_KEY);
        }
      },

      async refresh(): Promise<void> {
        const rt = store.refreshToken();
        if (!rt) return;
        const body = await firstValueFrom(
          http.post<LoginResponse>(`${api.restUrl}/auth/refresh`, { refreshToken: rt }),
        );
        patchState(store, {
          user: body.user,
          tenant: body.tenant ?? null,
          accessToken: body.accessToken,
          refreshToken: body.refreshToken ?? rt,
        });
        persist();
      },
    };
  }),
);
