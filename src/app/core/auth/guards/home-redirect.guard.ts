import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth.store';

/** Route '' — send user to the right home by role */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const role = auth.user()?.role;
  if (role === 'MANAGER') {
    return router.parseUrl('/dashboard');
  }
  if (role === 'AGENT') {
    return router.parseUrl('/tickets');
  }
  return router.parseUrl('/request');
};
