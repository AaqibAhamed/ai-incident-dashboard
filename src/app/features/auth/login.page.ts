import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthStore, type LoginCredentials } from '../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <div class="wrap">
      <mat-card appearance="outlined" class="card">
        <mat-card-title>Sign in</mat-card-title>
        <mat-card-subtitle> Tenant is resolved from your work email domain. </mat-card-subtitle>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="username" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full">
              <mat-label>Password</mat-label>
              <input
                matInput
                type="password"
                formControlName="password"
                autocomplete="current-password"
              />
            </mat-form-field>
            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="form.invalid || busy()"
            >
              Continue
            </button>
          </form>
        </mat-card-content>
        <mat-card-footer class="foot"> </mat-card-footer>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1rem;
      }
      .card {
        width: min(460px, 100%);
      }
      .full {
        width: 100%;
        display: block;
        margin-bottom: 0.5rem;
      }
      .foot {
        padding: 0.75rem 1rem 1rem;
        font-size: 0.75rem;
        opacity: 0.75;
      }
      code {
        font-size: 0.85em;
      }
    `,
  ],
})
export default class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly busy = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['name@example.com', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async onSubmit(): Promise<void> {
    this.busy.set(true);
    try {
      const raw = this.form.getRawValue() as LoginCredentials;
      await this.auth.login(raw);
      await this.router.navigateByUrl('/');
    } catch {
      /* snack via interceptor */
    } finally {
      this.busy.set(false);
    }
  }
}
