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

type AuthState = {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
};

export interface LoginCredentials {
  email: string;
  password: string;
  role: UserRole;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
  }),
  withComputed((store) => ({
    isAuthenticated: computed(() => !!store.accessToken()),
    roles: computed(() => (store.user() ? [store.user()!.role] : ([] as UserRole[]))),
  })),
  withMethods((store, http = inject(HttpClient), api = inject(API_CONFIG)) => {
    const persist = (): void => {
      if (!storageAvailable()) return;
      const state: AuthState = {
        user: store.user(),
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
          const parsed = JSON.parse(raw) as AuthState;
          patchState(store, parsed);
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
          accessToken: body.accessToken,
          refreshToken: body.refreshToken,
        });
        persist();
      },

      logout(): void {
        patchState(store, { user: null, accessToken: null, refreshToken: null });
        if (storageAvailable()) {
          sessionStorage.removeItem(SESSION_KEY);
        }
      },

      /** Demo refresh — real .NET refresh flow plugs in here */
      async refresh(): Promise<void> {
        const rt = store.refreshToken();
        if (!rt) return;
        const body = await firstValueFrom(
          http.post<LoginResponse>(`${api.restUrl}/auth/refresh`, { refreshToken: rt }),
        );
        patchState(store, {
          accessToken: body.accessToken,
          refreshToken: body.refreshToken ?? rt,
        });
        persist();
      },
    };
  }),
);
