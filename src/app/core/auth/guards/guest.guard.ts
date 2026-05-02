import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthStore } from '../auth.store';

export const guestGuard: CanMatchFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return router.parseUrl('/');
  }
  return true;
};
