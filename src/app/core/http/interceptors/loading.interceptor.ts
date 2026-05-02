import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../../loading/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;
  const tracked = url.includes('/graphql') || url.includes('/api/');
  if (!tracked || req.headers.get('X-Skip-Loading') === '1') {
    return next(req);
  }
  const loading = inject(LoadingService);
  loading.begin();
  return next(req).pipe(finalize(() => loading.end()));
};
