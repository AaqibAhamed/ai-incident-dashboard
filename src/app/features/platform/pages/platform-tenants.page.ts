import { NgTemplateOutlet } from '@angular/common';
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

interface TenantAdminSummary {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  primaryDomain: string | null;
  tenantAdmin: TenantAdminSummary | null;
}

interface PlatformTenantsResponse {
  live: TenantRow[];
  deleted: TenantRow[];
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  domains: { domain: string; isPrimary: boolean }[];
  tenantAdmin: TenantAdminSummary | null;
}

interface CreateTenantResponse {
  tenantAdmin?: { id: string; name: string; email: string };
}

/** Matches backend TenantAdminEmailFactory.BuildLocalPartFromDisplayName (ASCII letters/digits per word, dot-separated). */
function buildTenantAdminLocalPart(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return 'admin';
  }
  const segments = parts
    .map((p) =>
      p
        .toLowerCase()
        .split('')
        .filter((c) => /[a-z0-9]/.test(c))
        .join(''),
    )
    .filter((s) => s.length > 0);
  return segments.length ? segments.join('.') : 'admin';
}

function splitEmailLocalAndDomain(email: string): { local: string; domain: string } {
  const i = email.indexOf('@');
  if (i < 0) return { local: '', domain: '' };
  return { local: email.slice(0, i), domain: email.slice(i + 1) };
}

/** Aligns with backend TenantAdminEmailFactory.TryNormalizeEmailLocalPart (single char or middle segment rules). */
const emailLocalPartPattern = /^(?:[a-z0-9]|[a-z0-9][a-z0-9._-]*[a-z0-9])$/i;

@Component({
  selector: 'app-platform-tenants',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="page-header">
      <h1>Platform Tenants</h1>
      <p class="sub">
        Create organizations and map a sign-in domain. The first tenant administrator is created
        automatically using the primary domain and admin display name.
      </p>
    </div>

    <mat-card appearance="outlined" class="card">
      <mat-card-title>Register New Tenant</mat-card-title>
      <mat-card-content>
        <form [formGroup]="createForm" (ngSubmit)="createTenant()" class="form-column">
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Organization name</mat-label>
              <input matInput formControlName="name" placeholder="e.g. Acme Corp" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Slug</mat-label>
              <input matInput formControlName="slug" placeholder="acme-corp" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Primary email domain</mat-label>
              <input matInput formControlName="primaryEmailDomain" placeholder="acme.com" />
            </mat-form-field>
          </div>

          <p class="section-label">Default Administrator</p>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Admin display name</mat-label>
              <input matInput formControlName="tenantAdminName" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Initial password</mat-label>
              <input matInput type="password" formControlName="tenantAdminPassword" />
            </mat-form-field>
          </div>

          <div class="preview-box" [class.preview-muted]="!adminEmailPreview()">
            <span class="preview-label">Admin sign-in email will be</span>
            <span class="preview-value">{{ adminEmailPreview() }}</span>
            <p class="hint">
              If that address is already in use, a numeric suffix is added automatically (e.g.
              jane.doe-1).
            </p>
          </div>

          <div class="actions">
            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="createForm.invalid || busy()"
            >
              Create Tenant
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>

    <mat-card appearance="outlined" class="card">
      <mat-card-title>Active &amp; Suspended Tenants</mat-card-title>
      <mat-card-content>
        @if (loading()) {
          <p class="panel-loading">Loading tenants...</p>
        } @else if (!liveTenants().length) {
          <p class="muted">No active or suspended tenants found.</p>
        } @else {
          <ul class="list">
            @for (t of liveTenants(); track t.id) {
              <li class="tenant-block">
                <div class="tenant-row">
                  <div class="row-main">
                    <div>
                      <strong>{{ t.name }}</strong>
                      <span class="meta">
                        {{ t.slug }}
                        <span
                          class="status-badge"
                          [class.active]="t.status === 'Active'"
                          [class.suspended]="t.status === 'Suspended'"
                        >
                          {{ t.status }}
                        </span>
                        @if (t.primaryDomain) {
                          · {{ t.primaryDomain }}
                        }
                      </span>
                    </div>
                    @if (t.tenantAdmin) {
                      <div class="admin-info">
                        <span class="admin-label">Admin:</span> {{ t.tenantAdmin.name }} ·
                        {{ t.tenantAdmin.email }}
                        @if (!t.tenantAdmin.isActive) {
                          <span class="inactive">(inactive)</span>
                        }
                      </div>
                    } @else {
                      <div class="admin-info muted">No tenant admin on record</div>
                    }
                  </div>
                  <span class="actions">
                    <button mat-button type="button" (click)="toggleExpand(t.id)">
                      {{ expandedTenantId() === t.id ? 'Close' : 'View / Edit' }}
                    </button>
                    @if (t.status === 'Active') {
                      <button mat-button type="button" (click)="suspendTenant(t.id)">
                        Suspend
                      </button>
                    } @else if (t.status === 'Suspended') {
                      <button mat-button type="button" (click)="resumeTenant(t.id)">Resume</button>
                    }
                    <button mat-button color="warn" type="button" (click)="softDelete(t.id)">
                      Delete
                    </button>
                  </span>
                </div>

                @if (expandedTenantId() === t.id) {
                  <div class="expand-panel">
                    @if (editLoading()) {
                      <p class="panel-loading">Loading details...</p>
                    } @else if (editDetail(); as detail) {
                      @if (detail.id === t.id) {
                        <ng-container *ngTemplateOutlet="tenantEditPanel"></ng-container>
                      }
                    }
                  </div>
                }
              </li>
            }
          </ul>
        }
      </mat-card-content>
    </mat-card>

    <mat-card appearance="outlined" class="card deleted-card">
      <mat-card-title>Deleted Tenants</mat-card-title>
      <mat-card-content>
        @if (loading()) {
          <p class="panel-loading">Loading...</p>
        } @else if (!deletedTenants().length) {
          <p class="muted">No deleted tenants.</p>
        } @else {
          <ul class="list">
            @for (t of deletedTenants(); track t.id) {
              <li class="tenant-block">
                <div class="tenant-row">
                  <div class="row-main">
                    <div>
                      <strong>{{ t.name }}</strong>
                      <span class="meta">{{ t.slug }} · {{ t.status }}</span>
                    </div>
                  </div>
                  <span class="actions">
                    <button mat-button type="button" (click)="toggleExpand(t.id)">
                      {{ expandedTenantId() === t.id ? 'Close' : 'Details' }}
                    </button>
                    <button
                      mat-flat-button
                      color="primary"
                      type="button"
                      (click)="restoreTenant(t.id)"
                    >
                      Restore Tenant
                    </button>
                  </span>
                </div>
                @if (expandedTenantId() === t.id) {
                  <div class="expand-panel">
                    <ng-container *ngTemplateOutlet="tenantEditPanel"></ng-container>
                  </div>
                }
              </li>
            }
          </ul>
        }
      </mat-card-content>
    </mat-card>

    <ng-template #tenantEditPanel>
      @if (editDetail(); as detail) {
        <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="form-column">
          <p class="section-label">Organization Settings</p>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Organization Name</mat-label>
              <input matInput formControlName="tenantName" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Slug</mat-label>
              <input matInput formControlName="tenantSlug" />
            </mat-form-field>
          </div>

          @if (detail.domains.length) {
            <div class="domains-row">
              <span class="admin-label">Registered Domains:</span>
              @for (d of detail.domains; track d.domain) {
                <span class="domain-pill">{{ d.domain }}{{ d.isPrimary ? ' (primary)' : '' }}</span>
              }
            </div>
          }

          @if (detail.tenantAdmin; as admin) {
            <p class="section-label">Tenant Administrator</p>
            <div class="email-local-row">
              <mat-form-field appearance="outline" class="grow">
                <mat-label>Sign-in email (local part)</mat-label>
                <input matInput formControlName="adminEmailLocalPart" autocomplete="off" />
                @if (
                  editForm.get('adminEmailLocalPart')?.invalid &&
                  editForm.get('adminEmailLocalPart')?.touched
                ) {
                  <mat-error>Invalid format (e.g. use letters, digits, dots, hyphens).</mat-error>
                }
              </mat-form-field>
              <span class="email-at-suffix" title="Domain is fixed for this tenant">{{
                adminDomainSuffix()
              }}</span>
            </div>

            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Display Name</mat-label>
                <input matInput formControlName="adminName" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Update Password</mat-label>
                <input
                  matInput
                  type="password"
                  formControlName="adminPassword"
                  placeholder="Leave blank to keep"
                />
              </mat-form-field>
            </div>
          } @else {
            <p class="muted">This tenant has no tenant admin in the system.</p>
          }

          <div class="edit-actions">
            <button mat-button type="button" (click)="collapseEdit()">Cancel</button>
            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="editForm.invalid || editBusy()"
            >
              Save Changes
            </button>
          </div>
        </form>
      }
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
        padding-top: var(--space-6);
      }

      .page-header {
        margin-bottom: var(--space-8);

        h1 {
          margin-bottom: var(--space-1);
          letter-spacing: -0.03em;
        }

        .sub {
          color: var(--color-text-secondary);
          font-size: 1rem;
          max-width: 600px;
        }
      }

      .card {
        background: var(--color-surface);
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-md);
        box-shadow: var(--color-shadow-soft);
        margin-bottom: var(--space-6);
        max-width: 960px;
        overflow: hidden;

        mat-card-title {
          padding: var(--space-5) var(--space-6);
          font-size: 1.1rem;
          font-weight: 600;
          border-bottom: 1px solid var(--color-border-soft);
          margin-bottom: 0;
        }

        mat-card-content {
          padding: var(--space-6);
        }
      }

      .form-column {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: var(--space-4);
        width: 100%;
      }

      .section-label {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--color-primary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: var(--space-4) 0 0;
      }

      /* Tenant List Styling */
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .tenant-block {
        border-bottom: 1px solid var(--color-border-soft);
        padding: var(--space-4) 0;
        transition: background-color 0.2s ease;

        &:last-child {
          border-bottom: none;
        }
      }

      .tenant-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
      }

      .row-main {
        display: flex;
        flex-direction: column;
        gap: 2px;

        strong {
          font-size: 1rem;
          color: var(--color-text-primary);
        }

        .meta {
          font-size: 0.85rem;
          // color: var(--color-text-primary);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
      }

      .admin-info {
        margin-top: var(--space-2);
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-text-secondary);

        .admin-label {
          font-weight: 500;
          color: var(--color-text-muted);
        }
      }

      .status-badge {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);

        &.active {
          background: #dcfce7;
          color: #166534;
        }
        &.suspended {
          background: #fee2e2;
          color: #991b1b;
        }
      }

      /* Preview Area */
      .preview-box {
        background: var(--color-surface-muted);
        padding: var(--space-4);
        border-radius: var(--radius-sm);
        border-left: 4px solid var(--color-primary);

        .preview-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          margin-bottom: 4px;
          display: block;
        }

        .preview-value {
          font-family: monospace;
          font-size: 1rem;
          color: var(--color-primary);
        }
      }

      .hint {
        font-size: 0.8rem;
        color: var(--color-text-subtle);
        font-style: italic;
      }

      .actions {
        display: flex;
        gap: var(--space-1);
      }

      .expand-panel {
        margin-top: var(--space-4);
        padding: var(--space-5);
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-md);
      }

      .email-local-row {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);

        .email-at-suffix {
          font-weight: 600;
          color: var(--color-text-muted);
          font-size: 1.1rem;
        }
      }

      .domain-pill {
        display: inline-flex;
        align-items: center;
        background: var(--color-primary-soft);
        color: var(--color-primary);
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-right: var(--space-2);
      }

      button[mat-flat-button] {
        padding: 0 var(--space-6);
        height: 44px;
        font-weight: 600;
      }
    `,
  ],
})
export default class PlatformTenantsPage {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);
  private readonly snack = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly liveTenants = signal<TenantRow[]>([]);
  readonly deletedTenants = signal<TenantRow[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly expandedTenantId = signal<string | null>(null);
  readonly editDetail = signal<TenantDetail | null>(null);
  readonly editLoading = signal(false);
  readonly editBusy = signal(false);

  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    primaryEmailDomain: ['', Validators.required],
    tenantAdminName: ['', Validators.required],
    tenantAdminPassword: ['', [Validators.required, Validators.minLength(4)]],
  });

  readonly editForm = this.fb.nonNullable.group({
    tenantName: ['', Validators.required],
    tenantSlug: ['', Validators.required],
    adminName: [''],
    adminEmailLocalPart: ['', [Validators.required, Validators.pattern(emailLocalPartPattern)]],
    adminPassword: [''],
  });

  constructor() {
    void this.reload();
  }

  adminDomainSuffix(): string {
    const email = this.editDetail()?.tenantAdmin?.email ?? '';
    const { domain } = splitEmailLocalAndDomain(email);
    return domain ? `@${domain}` : '';
  }

  adminEmailPreview(): string {
    const v = this.createForm.getRawValue();
    const domain = v.primaryEmailDomain.trim().toLowerCase();
    const name = v.tenantAdminName.trim();
    if (!domain || !name) {
      return 'Enter domain and admin name to preview.';
    }
    const local = buildTenantAdminLocalPart(name);
    return `${local}@${domain}`;
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<PlatformTenantsResponse>(`${this.api.restUrl}/platform/tenants`),
      );
      this.liveTenants.set(res?.live ?? []);
      this.deletedTenants.set(res?.deleted ?? []);
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
      const res = await firstValueFrom(
        this.http.post<CreateTenantResponse>(
          `${this.api.restUrl}/platform/tenants`,
          this.createForm.getRawValue(),
        ),
      );
      const email = res?.tenantAdmin?.email;
      this.snack.open(
        email ? `Tenant created. Admin email: ${email}` : 'Tenant and tenant admin created',
        'OK',
        { duration: 5000 },
      );
      this.createForm.reset({
        name: '',
        slug: '',
        primaryEmailDomain: '',
        tenantAdminName: '',
        tenantAdminPassword: '',
      });
      await this.reload();
    } catch {
      this.snack.open(
        'Create failed (slug in use, primary domain already registered, or could not assign admin email)',
        'OK',
        { duration: 6000 },
      );
    } finally {
      this.busy.set(false);
    }
  }

  toggleExpand(tenantId: string): void {
    if (this.expandedTenantId() === tenantId) {
      this.collapseEdit();
      return;
    }
    this.expandedTenantId.set(tenantId);
    void this.loadEditDetail(tenantId);
  }

  collapseEdit(): void {
    this.expandedTenantId.set(null);
    this.editDetail.set(null);
  }

  async loadEditDetail(tenantId: string): Promise<void> {
    this.editLoading.set(true);
    this.editDetail.set(null);
    try {
      const detail = await firstValueFrom(
        this.http.get<TenantDetail>(`${this.api.restUrl}/platform/tenants/${tenantId}`),
      );
      if (this.expandedTenantId() !== tenantId) {
        return;
      }
      this.editDetail.set(detail);
      const { local } = detail.tenantAdmin
        ? splitEmailLocalAndDomain(detail.tenantAdmin.email)
        : { local: '' };
      this.editForm.patchValue({
        tenantName: detail.name,
        tenantSlug: detail.slug,
        adminName: detail.tenantAdmin?.name ?? '',
        adminEmailLocalPart: local,
        adminPassword: '',
      });
      const adminNameCtl = this.editForm.get('adminName');
      const localCtl = this.editForm.get('adminEmailLocalPart');
      if (detail.tenantAdmin) {
        adminNameCtl?.setValidators([Validators.required]);
        localCtl?.setValidators([Validators.required, Validators.pattern(emailLocalPartPattern)]);
      } else {
        adminNameCtl?.clearValidators();
        localCtl?.clearValidators();
      }
      adminNameCtl?.updateValueAndValidity();
      localCtl?.updateValueAndValidity();
    } catch {
      this.snack.open('Failed to load tenant', 'OK', { duration: 4000 });
      this.collapseEdit();
    } finally {
      this.editLoading.set(false);
    }
  }

  async saveEdit(): Promise<void> {
    const detail = this.editDetail();
    const expandedId = this.expandedTenantId();
    if (!detail || !expandedId || detail.id !== expandedId || this.editForm.invalid) return;
    const v = this.editForm.getRawValue();
    this.editBusy.set(true);
    try {
      await firstValueFrom(
        this.http.patch(`${this.api.restUrl}/platform/tenants/${detail.id}`, {
          name: v.tenantName,
          slug: v.tenantSlug,
        }),
      );

      if (detail.tenantAdmin) {
        const body: { name?: string; emailLocalPart?: string; password?: string } = {
          name: v.adminName,
          emailLocalPart: v.adminEmailLocalPart,
        };
        if (v.adminPassword?.length) {
          body.password = v.adminPassword;
        }
        await firstValueFrom(
          this.http.patch(
            `${this.api.restUrl}/platform/tenants/${detail.id}/tenant-admins/${detail.tenantAdmin.id}`,
            body,
          ),
        );
      }

      this.snack.open('Saved', 'OK', { duration: 2500 });
      this.collapseEdit();
      await this.reload();
    } catch {
      this.snack.open(
        'Save failed (slug conflict, invalid email local part, or address already in use)',
        'OK',
        {
          duration: 5000,
        },
      );
    } finally {
      this.editBusy.set(false);
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.api.restUrl}/platform/tenants/${id}/delete`, {}),
      );
      if (this.expandedTenantId() === id) {
        this.collapseEdit();
      }
      await this.reload();
      this.snack.open('Tenant deleted (soft). It appears under Deleted tenants.', 'OK', {
        duration: 4000,
      });
    } catch {
      this.snack.open('Delete failed', 'OK', { duration: 4000 });
    }
  }

  async restoreTenant(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.api.restUrl}/platform/tenants/${id}/restore`, {}),
      );
      if (this.expandedTenantId() === id) {
        this.collapseEdit();
      }
      await this.reload();
      this.snack.open('Tenant restored to active', 'OK', { duration: 3000 });
    } catch {
      this.snack.open('Restore failed', 'OK', { duration: 4000 });
    }
  }

  async suspendTenant(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.api.restUrl}/platform/tenants/${id}/suspend`, {}),
      );
      await this.reload();
    } catch {
      this.snack.open('Suspend failed', 'OK', { duration: 4000 });
    }
  }

  async resumeTenant(id: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.api.restUrl}/platform/tenants/${id}/resume`, {}),
      );
      await this.reload();
    } catch {
      this.snack.open('Resume failed', 'OK', { duration: 4000 });
    }
  }
}
