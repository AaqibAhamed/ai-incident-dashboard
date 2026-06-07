/** @vitest-environment jsdom */
import { TestBed } from '@angular/core/testing';
import type { ProviderToken } from '@angular/core';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import type { SessionTenant, SessionUser } from './auth.store';

type AuthStoreInstance = {
  user(): SessionUser | null;
  tenant(): SessionTenant | null;
  accessTokenExpiresAt(): number | null;
  lastActivityAt(): number | null;
  isIdle(): boolean;
  isAuthenticated(): boolean;
  roles(): string[];
  isSuperAdmin(): boolean;
  isTenantUser(): boolean;
  login(credentials: { email: string; password: string }): Promise<void>;
  restoreFromStorage(): Promise<void>;
  refresh(): Promise<void>;
  logout(): void;
};
import { API_CONFIG } from '../tokens/api-config.token';

const SESSION_KEY = 'aid_session';

const mockEncryptState = vi.fn(async (state: unknown) => JSON.stringify(state));
const mockDecryptState = vi.fn(async (raw: string) => JSON.parse(raw));
const mockCalculateRefreshDelay = vi.fn(() => 60_000);

vi.mock('./auth.crypto', async () => ({
  encryptState: mockEncryptState,
  decryptState: mockDecryptState,
  calculateRefreshDelay: mockCalculateRefreshDelay
}));

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // The test environment may already be initialized by a shared setup.
}

describe('AuthStore', () => {
  const apiConfig = {
    restUrl: 'http://api.test',
    graphqlUrl: 'http://graphql.test',
    wsUrl: 'ws://api.test'
  };
  let httpClient: { post: (...args: unknown[]) => unknown };
  let authStoreToken: ProviderToken<AuthStoreInstance>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    httpClient = {
      post: vi.fn()
    };

    sessionStorage.clear();
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: httpClient },
        { provide: API_CONFIG, useValue: apiConfig }
      ]
    });

    const module = await TestBed.runInInjectionContext(async () => await import('./auth.store'));
    authStoreToken = module.AuthStore;

    TestBed.runInInjectionContext(() => {
      const store = TestBed.inject(authStoreToken);
      store.logout();
    });
  });

  afterEach(() => {
    TestBed.runInInjectionContext(() => {
      const store = TestBed.inject(authStoreToken);
      store.logout();
    });
    TestBed.resetTestingModule();
  });

  it('starts with no authenticated session', () => {
    TestBed.runInInjectionContext(() => {
      const store = TestBed.inject(authStoreToken) as AuthStoreInstance;

      expect(store.isAuthenticated()).toBe(false);
      expect(store.roles()).toEqual([]);
      expect(store.isSuperAdmin()).toBe(false);
      expect(store.isTenantUser()).toBe(false);
      // tokens are cookie-only and not exposed to JS
    });
  });

  it('logs in and persists session state', async () => {
    const response = {
      accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@domain.com',
        role: 'SUPER_ADMIN'
      } as SessionUser,
      tenant: {
        id: 'tenant-1',
        name: 'Test Tenant',
        slug: 'test-tenant'
      } as SessionTenant
    };

    (httpClient.post as ReturnType<typeof vi.fn>).mockReturnValue(of(response));

    await TestBed.runInInjectionContext(async () => {
      const store = TestBed.inject(authStoreToken) as AuthStoreInstance;
      await store.login({ email: 'test@domain.com', password: 'password' });
      await Promise.resolve();

      expect(httpClient.post).toHaveBeenCalledWith(
        `${apiConfig.restUrl}/auth/login`,
        {
          email: 'test@domain.com',
          password: 'password'
        },
        { withCredentials: true }
      );
      expect(store.isAuthenticated()).toBe(true);
      expect(store.user()).toEqual(response.user);
      expect(store.tenant()).toEqual(response.tenant);
      expect(store.isSuperAdmin()).toBe(true);
      expect(store.isTenantUser()).toBe(true);
      expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
      expect(mockEncryptState).toHaveBeenCalled();
      // Server provided expiry should be used for scheduling; crypto.calculateRefreshDelay should not be required
      expect((TestBed.inject(authStoreToken) as AuthStoreInstance).accessTokenExpiresAt()).toBe(
        response.accessTokenExpiresAt
      );
      expect(mockCalculateRefreshDelay).not.toHaveBeenCalled();
    });
  });

  it('restores state from session storage', async () => {
    const persisted = {
      user: {
        id: 'user-2',
        name: 'Restore User',
        email: 'restore@domain.com',
        role: 'TENANT_ADMIN'
      } as SessionUser,
      tenant: {
        id: 'tenant-2',
        name: 'Restore Tenant',
        slug: 'restore-tenant'
      } as SessionTenant,
      accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
      lastActivityAt: Date.now(),
      isIdle: false
    };

    (mockDecryptState as ReturnType<typeof vi.fn>).mockResolvedValueOnce(persisted);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(persisted));

    await TestBed.runInInjectionContext(async () => {
      const store = TestBed.inject(authStoreToken) as AuthStoreInstance;
      await store.restoreFromStorage();
      await Promise.resolve();

      expect(store.user()).toEqual(persisted.user);
      expect(store.tenant()).toEqual(persisted.tenant);
      expect(store.isAuthenticated()).toBe(true);
      expect(mockDecryptState).toHaveBeenCalledWith(JSON.stringify(persisted));
      // no client-side token present; fallback not used
      expect(mockCalculateRefreshDelay).not.toHaveBeenCalled();
    });
  });

  it('refreshes the access token using refresh token', async () => {
    const refreshed = {
      accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
      user: {
        id: 'user-3',
        name: 'Refresh User',
        email: 'refresh@domain.com',
        role: 'TENANT_ADMIN'
      } as SessionUser,
      tenant: {
        id: 'tenant-3',
        name: 'Refresh Tenant',
        slug: 'refresh-tenant'
      } as SessionTenant
    };

    const loginResp = {
      accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
      user: refreshed.user,
      tenant: refreshed.tenant
    };

    (httpClient.post as ReturnType<typeof vi.fn>).mockReturnValueOnce(of(loginResp)).mockReturnValueOnce(of(refreshed));

    await TestBed.runInInjectionContext(async () => {
      const store = TestBed.inject(authStoreToken) as AuthStoreInstance;
      await store.login({ email: 'refresh@domain.com', password: 'password' });

      await store.refresh();

      expect(httpClient.post).toHaveBeenCalledWith(`${apiConfig.restUrl}/auth/refresh`, {}, { withCredentials: true });
      expect(store.user()).toEqual(refreshed.user);
      expect(store.tenant()).toEqual(refreshed.tenant);
      expect(mockEncryptState).toHaveBeenCalled();
    });
  });

  it('logs out and clears persisted session', () => {
    sessionStorage.setItem(SESSION_KEY, 'cached-session');

    TestBed.runInInjectionContext(() => {
      const store = TestBed.inject(authStoreToken) as AuthStoreInstance;
      (httpClient.post as ReturnType<typeof vi.fn>).mockReturnValue(
        of({
          accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
          user: {
            id: 'user-4',
            name: 'Logout User',
            email: 'logout@domain.com',
            role: 'SUPER_ADMIN'
          },
          tenant: {
            id: 'tenant-4',
            name: 'Logout Tenant',
            slug: 'logout-tenant'
          }
        })
      );

      return store.login({ email: 'logout@domain.com', password: 'password' }).then(() => {
        store.logout();

        expect(store.user()).toBeNull();
        expect(store.tenant()).toBeNull();
        expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
        expect(store.isAuthenticated()).toBe(false);
      });
    });
  });
});
