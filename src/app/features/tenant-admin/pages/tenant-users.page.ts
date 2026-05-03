import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import type { UserRole } from '../../../../graphql/generated/graphql';
import { API_CONFIG } from '../../../core/tokens/api-config.token';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface TenantUsersListResponse {
  primaryEmailDomain: string | null;
  users: UserRow[];
}

const emailLocalPartPattern = /^(?:[a-z0-9]|[a-z0-9][a-z0-9._-]*[a-z0-9])$/i;

@Component({
  selector: 'app-tenant-users',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  template: `
    <h1>Tenant users</h1>
    <p class="sub">
      New users sign in with your organization’s primary email domain. Enter only the part before
      <span class="nowrap">&#64;</span>
      — the domain is fixed.
    </p>

    <mat-card appearance="outlined" class="card">
      <mat-card-title>Add user</mat-card-title>
      <mat-card-content>
        @if (!primaryEmailDomain()) {
          <p class="warn">
            Primary email domain is not available. You cannot add users until it is configured.
          </p>
        }
        <form [formGroup]="form" (ngSubmit)="create()" class="form">
          <mat-form-field appearance="outline">
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <div class="email-local-row">
            <mat-form-field appearance="outline" class="email-local-field">
              <mat-label>Email (local part)</mat-label>
              <input matInput formControlName="emailLocalPart" autocomplete="off" />
              @if (form.get('emailLocalPart')?.invalid && form.get('emailLocalPart')?.touched) {
                <mat-error
                  >Letters, digits, dots, hyphens, underscores; no leading/trailing dots.</mat-error
                >
              }
            </mat-form-field>
            <span class="email-suffix" [class.muted]="!primaryEmailDomain()">{{
              primaryDomainSuffix()
            }}</span>
          </div>
          <mat-form-field appearance="outline">
            <mat-label>Role</mat-label>
            <mat-select formControlName="role">
              <mat-option value="MANAGER">Manager</mat-option>
              <mat-option value="AGENT">Agent</mat-option>
              <mat-option value="REQUESTER">Requester</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input matInput type="password" formControlName="password" />
          </mat-form-field>
          <button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="form.invalid || busy() || !primaryEmailDomain()"
          >
            Create
          </button>
        </form>
      </mat-card-content>
    </mat-card>

    <mat-card appearance="outlined" class="card">
      <mat-card-title>Users</mat-card-title>
      <mat-card-content>
        @if (loading()) {
          <p>Loading…</p>
        } @else {
          <ul class="list">
            @for (u of users(); track u.id) {
              <li>
                {{ u.name }} · {{ u.email }} · {{ u.role }}
                @if (u.isActive) {
                  <button
                    [disabled]="u.role == 'TENANT_ADMIN'"
                    mat-button
                    type="button"
                    (click)="deactivate(u.id)"
                  >
                    Deactivate
                  </button>
                } @else {
                  <!-- <span class="inactive">Inactive</span> -->
                  <button
                    class="inactive"
                    [disabled]="u.role == 'TENANT_ADMIN'"
                    mat-button
                    type="button"
                    (click)="activate(u.id)"
                  >
                    Inactive
                  </button>
                }
              </li>
            }
          </ul>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .sub {
        opacity: 0.75;
        margin-bottom: 1rem;
        max-width: 42rem;
        line-height: 1.45;
      }
      .nowrap {
        white-space: nowrap;
      }
      .warn {
        color: var(--mat-sys-error, #b3261e);
        font-size: 0.9rem;
        margin: 0 0 0.75rem;
      }
      .card {
        margin-bottom: 1rem;
        max-width: 720px;
      }
      .form {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: flex-start;
      }
      .email-local-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem 0.75rem;
        width: 100%;
      }
      .email-local-field {
        flex: 1;
        min-width: 160px;
        max-width: 260px;
      }
      .email-suffix {
        font-size: 0.95rem;
        font-weight: 500;
        opacity: 0.85;
        padding-top: 0.25rem;
      }
      .email-suffix.muted {
        opacity: 0.45;
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .list li {
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--color-border-hairline, rgba(15, 23, 42, 0.08));
      }
      .inactive {
        opacity: 0.6;
        font-size: 0.85rem;
      }
    `,
  ],
})
export default class TenantUsersPage {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);
  private readonly snack = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly users = signal<UserRow[]>([]);
  readonly primaryEmailDomain = signal<string | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    emailLocalPart: ['', [Validators.required, Validators.pattern(emailLocalPartPattern)]],
    role: this.fb.nonNullable.control<UserRole>('AGENT', Validators.required),
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  constructor() {
    void this.reload();
  }

  primaryDomainSuffix(): string {
    const d = this.primaryEmailDomain();
    return d ? `@${d}` : '(loading…)';
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<TenantUsersListResponse>(`${this.api.restUrl}/tenant/users`),
      );
      this.primaryEmailDomain.set(res?.primaryEmailDomain ?? null);
      this.users.set(res?.users ?? []);
    } catch {
      this.snack.open('Failed to load users', 'OK', { duration: 4000 });
    } finally {
      this.loading.set(false);
    }
  }

  async create(): Promise<void> {
    if (this.form.invalid || !this.primaryEmailDomain()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${this.api.restUrl}/tenant/users`, this.form.getRawValue()),
      );
      this.snack.open('User created', 'OK', { duration: 3000 });
      this.form.patchValue({ name: '', emailLocalPart: '', password: '' });
      await this.reload();
    } catch {
      this.snack.open('Create failed (duplicate email or invalid local part)', 'OK', {
        duration: 5000,
      });
    } finally {
      this.busy.set(false);
    }
  }

  async deactivate(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.api.restUrl}/tenant/users/${id}`, { isActive: false }),
      );
      await this.reload();
    } catch {
      this.snack.open('Update failed', 'OK', { duration: 4000 });
    }
  }

  async activate(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.api.restUrl}/tenant/users/${id}`, { isActive: true }),
      );
      await this.reload();
    } catch {
      this.snack.open('Update failed', 'OK', { duration: 4000 });
    }
  }
}
