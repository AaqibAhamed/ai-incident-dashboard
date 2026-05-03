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
    <p class="sub">Create managers, agents, and requesters for your organization.</p>

    <mat-card appearance="outlined" class="card">
      <mat-card-title>Add user</mat-card-title>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="create()" class="form">
          <mat-form-field appearance="outline">
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>
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
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || busy()">
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
                  <button mat-button type="button" (click)="deactivate(u.id)">Deactivate</button>
                } @else {
                  <span class="inactive">Inactive</span>
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
  readonly loading = signal(true);
  readonly busy = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: this.fb.nonNullable.control<UserRole>('AGENT', Validators.required),
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await firstValueFrom(this.http.get<UserRow[]>(`${this.api.restUrl}/tenant/users`));
      this.users.set(rows ?? []);
    } catch {
      this.snack.open('Failed to load users', 'OK', { duration: 4000 });
    } finally {
      this.loading.set(false);
    }
  }

  async create(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.http.post(`${this.api.restUrl}/tenant/users`, this.form.getRawValue()));
      this.snack.open('User created', 'OK', { duration: 3000 });
      this.form.patchValue({ name: '', email: '', password: '' });
      await this.reload();
    } catch {
      this.snack.open('Create failed', 'OK', { duration: 5000 });
    } finally {
      this.busy.set(false);
    }
  }

  async deactivate(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${this.api.restUrl}/tenant/users/${id}`, { isActive: false }));
      await this.reload();
    } catch {
      this.snack.open('Update failed', 'OK', { duration: 4000 });
    }
  }
}
