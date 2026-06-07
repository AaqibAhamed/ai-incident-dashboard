import { HttpInterceptorFn } from '@angular/common/http';
// No imports required — cookie-based auth uses withCredentials on requests

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApi = req.url.includes('/api/') || req.url.endsWith('/graphql');
  if (isApi) {
    // Rely on HttpOnly cookies for authentication; ensure credentials are sent
    return next(req.clone({ withCredentials: true }));
  }

  return next(req);
};
