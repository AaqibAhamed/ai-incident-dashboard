import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { UserRole } from '../../../graphql/generated/graphql';
import { AuthStore, type LoginCredentials } from '../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <div class="wrap">
      <mat-card appearance="outlined" class="card">
        <mat-card-title>Sign in (demo)</mat-card-title>
        <mat-card-subtitle>Choose a role — credentials are mocked via MSW</mat-card-subtitle>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="username" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="current-password" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full">
              <mat-label>Role</mat-label>
              <mat-select formControlName="role">
                <mat-option value="AGENT">Agent</mat-option>
                <mat-option value="MANAGER">Manager</mat-option>
                <mat-option value="REQUESTER">Requester</mat-option>
              </mat-select>
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || busy()">
              Continue
            </button>
          </form>
        </mat-card-content>
        <mat-card-footer class="foot">
          <span>PII and prompts stay on the server in production — see README.</span>
        </mat-card-footer>
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
        width: min(420px, 100%);
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
    `,
  ],
})
export default class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly busy = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['agent@demo.local', [Validators.required, Validators.email]],
    password: ['demo', Validators.required],
    role: this.fb.nonNullable.control<UserRole>('AGENT', Validators.required),
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
