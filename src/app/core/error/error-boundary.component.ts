import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

/**
 * Lightweight UI shell for recoverable errors (pair with GlobalErrorHandler for fatal).
 */
@Component({
  selector: 'app-error-boundary',
  standalone: true,
  imports: [MatCardModule, MatButtonModule],
  template: `
    @if (message()) {
      <mat-card appearance="outlined" class="err">
        <mat-card-title>Something went wrong</mat-card-title>
        <mat-card-content>{{ message() }}</mat-card-content>
        <mat-card-actions align="end">
          <button mat-button type="button" (click)="retry.emit()">Try again</button>
        </mat-card-actions>
      </mat-card>
    } @else {
      <ng-content />
    }
  `,
  styles: [
    `
      .err {
        margin: 1rem;
      }
    `,
  ],
})
export class ErrorBoundaryComponent {
  readonly message = input<string | null>(null);
  readonly retry = output<void>();
}
