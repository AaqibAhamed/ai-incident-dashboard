import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status >= 400) {
        const msg =
          typeof err.error === 'object' && err.error && 'message' in err.error
            ? String((err.error as { message: string }).message)
            : err.message || 'Request failed';
        snack.open(msg, 'Dismiss', { duration: 5000 });
      }
      return throwError(() => err);
    }),
  );
};
