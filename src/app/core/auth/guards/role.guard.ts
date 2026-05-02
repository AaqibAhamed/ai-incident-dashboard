import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import type { UserRole } from '../../../../graphql/generated/graphql';
import { AuthStore } from '../auth.store';

export function roleGuard(allowed: UserRole[]): CanMatchFn {
  return () => {
    const auth = inject(AuthStore);
    const router = inject(Router);
    const role = auth.user()?.role;
    if (!role || !allowed.includes(role)) {
      return router.parseUrl('/');
    }
    return true;
  };
}
