import { ErrorHandler, inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly snack = inject(MatSnackBar);

  handleError(error: unknown): void {
    console.error(error);
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    this.snack.open(msg, 'Dismiss', { duration: 6000 });
  }
}
