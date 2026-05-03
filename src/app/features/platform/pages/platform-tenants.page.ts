import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../../../core/tokens/api-config.token';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
}

@Component({
  selector: 'app-platform-tenants',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  template: `
    <h1>Platform — tenants</h1>
    <p class="sub">Create organizations and map an email domain for sign-in.</p>

    <mat-card appearance="outlined" class="card">
      <mat-card-title>Create tenant</mat-card-title>
      <mat-card-content>
        <form [formGroup]="createForm" (ngSubmit)="createTenant()" class="form">
          <mat-form-field appearance="outline">
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Slug</mat-label>
            <input matInput formControlName="slug" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="wide">
            <mat-label>Primary email domain</mat-label>
            <input matInput formControlName="primaryEmailDomain" placeholder="acme.com" />
          </mat-form-field>
          <button mat-flat-button color="primary" type="submit" [disabled]="createForm.invalid || busy()">
            Create
          </button>
        </form>
      </mat-card-content>
    </mat-card>

    <mat-card appearance="outlined" class="card">
      <mat-card-title>Tenants</mat-card-title>
      <mat-card-content>
        @if (loading()) {
          <p>Loading…</p>
        } @else if (!tenants().length) {
          <p>No tenants yet.</p>
        } @else {
          <ul class="list">
            @for (t of tenants(); track t.id) {
              <li>
                <strong>{{ t.name }}</strong> · {{ t.slug }} · {{ t.status }}
                <span class="actions">
                  @if (t.status === 'Active') {
                    <button mat-button type="button" (click)="suspend(t.id)">Suspend</button>
                  } @else {
                    <button mat-button type="button" (click)="activate(t.id)">Activate</button>
                  }
                </span>
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
      .wide {
        min-width: 200px;
        flex: 1;
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .list li {
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--color-border-hairline, rgba(15, 23, 42, 0.08));
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
      }
      .actions {
        margin-left: auto;
      }
    `,
  ],
})
export default class PlatformTenantsPage {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);
  private readonly snack = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly tenants = signal<TenantRow[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);

  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    primaryEmailDomain: ['', Validators.required],
  });

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await firstValueFrom(
        this.http.get<TenantRow[]>(`${this.api.restUrl}/platform/tenants`),
      );
      this.tenants.set(rows ?? []);
    } catch {
      this.snack.open('Failed to load tenants', 'OK', { duration: 4000 });
    } finally {
      this.loading.set(false);
    }
  }

  async createTenant(): Promise<void> {
    if (this.createForm.invalid) return;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.http.post(`${this.api.restUrl}/platform/tenants`, this.createForm.getRawValue()),
      );
      this.snack.open('Tenant created', 'OK', { duration: 3000 });
      this.createForm.reset({ name: '', slug: '', primaryEmailDomain: '' });
      await this.reload();
    } catch {
      this.snack.open('Create failed (slug or domain conflict?)', 'OK', { duration: 5000 });
    } finally {
      this.busy.set(false);
    }
  }

  async suspend(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${this.api.restUrl}/platform/tenants/${id}/suspend`, {}));
      await this.reload();
    } catch {
      this.snack.open('Suspend failed', 'OK', { duration: 4000 });
    }
  }

  async activate(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${this.api.restUrl}/platform/tenants/${id}/activate`, {}));
      await this.reload();
    } catch {
      this.snack.open('Activate failed', 'OK', { duration: 4000 });
    }
  }
}
