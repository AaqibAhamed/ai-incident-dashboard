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
    <h1>Platform — tenants</h1>
    <p class="sub">
      Create organizations and map a sign-in domain. The first tenant administrator is created
      automatically using the primary domain and admin display name.
    </p>

    <mat-card appearance="outlined" class="card">
      <mat-card-title>Create tenant</mat-card-title>
      <mat-card-content>
        <form [formGroup]="createForm" (ngSubmit)="createTenant()" class="form-column">
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Organization name</mat-label>
              <input matInput formControlName="name" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Slug</mat-label>
              <input matInput formControlName="slug" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="grow">
              <mat-label>Primary email domain</mat-label>
              <input matInput formControlName="primaryEmailDomain" placeholder="acme.com" />
            </mat-form-field>
          </div>
          <p class="section-label">Tenant administrator</p>
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Admin display name</mat-label>
              <input matInput formControlName="tenantAdminName" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Initial password</mat-label>
              <input matInput type="password" formControlName="tenantAdminPassword" />
            </mat-form-field>
          </div>
          <p class="preview" [class.preview-muted]="!adminEmailPreview()">
            <span class="preview-label">Admin sign-in email will be:</span>
            {{ adminEmailPreview() }}
          </p>
          <p class="hint">
            If that address is already in use, a numeric suffix is added automatically (e.g.
            jane.doe-1).
          </p>
          <button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="createForm.invalid || busy()"
          >
            Create
          </button>
        </form>
      </mat-card-content>
    </mat-card>

    <mat-card appearance="outlined" class="card">
      <mat-card-title>Active &amp; suspended tenants</mat-card-title>
      <mat-card-content>
        @if (loading()) {
          <p>Loading…</p>
        } @else if (!liveTenants().length) {
          <p>No active or suspended tenants.</p>
        } @else {
          <ul class="list">
            @for (t of liveTenants(); track t.id) {
              <li class="tenant-block">
                <div class="tenant-row">
                  <div class="row-main">
                    <div>
                      <strong>{{ t.name }}</strong>
                      <span class="meta">
                        {{ t.slug }} · {{ t.status }}
                        @if (t.primaryDomain) {
                          · {{ t.primaryDomain }}
                        }
                      </span>
                    </div>
                    @if (t.tenantAdmin) {
                      <div class="admin-line">
                        Admin: {{ t.tenantAdmin.name }} · {{ t.tenantAdmin.email }}
                        @if (!t.tenantAdmin.isActive) {
                          <span class="inactive">(inactive)</span>
                        }
                      </div>
                    } @else {
                      <div class="admin-line muted">No tenant admin on record</div>
                    }
                  </div>
                  <span class="actions">
                    <button mat-button type="button" (click)="toggleExpand(t.id)">
                      {{ expandedTenantId() === t.id ? 'Close' : 'View / edit' }}
                    </button>
                    @if (t.status === 'Active') {
                      <button mat-button type="button" (click)="suspendTenant(t.id)">
                        Suspend
                      </button>
                    }
                    @if (t.status === 'Suspended') {
                      <button mat-button type="button" (click)="resumeTenant(t.id)">Resume</button>
                    }
                    <button mat-button type="button" (click)="softDelete(t.id)">Delete</button>
                  </span>
                </div>
                @if (expandedTenantId() === t.id) {
                  <div class="expand-panel">
                    @if (editLoading()) {
                      <p class="panel-loading">Loading…</p>
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
      <mat-card-title>Deleted tenants</mat-card-title>
      <mat-card-content>
        @if (loading()) {
          <p>Loading…</p>
        } @else if (!deletedTenants().length) {
          <p>No deleted tenants.</p>
        } @else {
          <ul class="list">
            @for (t of deletedTenants(); track t.id) {
              <li class="tenant-block">
                <div class="tenant-row">
                  <div class="row-main">
                    <div>
                      <strong>{{ t.name }}</strong>
                      <span class="meta">
                        {{ t.slug }} · {{ t.status }}
                        @if (t.primaryDomain) {
                          · {{ t.primaryDomain }}
                        }
                      </span>
                    </div>
                    @if (t.tenantAdmin) {
                      <div class="admin-line">
                        Admin: {{ t.tenantAdmin.name }} · {{ t.tenantAdmin.email }}
                      </div>
                    } @else {
                      <div class="admin-line muted">No tenant admin on record</div>
                    }
                  </div>
                  <span class="actions">
                    <button mat-button type="button" (click)="toggleExpand(t.id)">
                      {{ expandedTenantId() === t.id ? 'Close' : 'View / edit' }}
                    </button>
                    <button
                      mat-flat-button
                      color="primary"
                      type="button"
                      (click)="restoreTenant(t.id)"
                    >
                      Restore to active
                    </button>
                  </span>
                </div>
                @if (expandedTenantId() === t.id) {
                  <div class="expand-panel">
                    @if (editLoading()) {
                      <p class="panel-loading">Loading…</p>
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

    <ng-template #tenantEditPanel>
      @if (editDetail(); as detail) {
        <p class="status-pill">Status: {{ detail.status }}</p>
        <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="form-column">
          <p class="section-label">Organization</p>
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput formControlName="tenantName" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Slug</mat-label>
              <input matInput formControlName="tenantSlug" />
            </mat-form-field>
          </div>
          @if (detail.domains.length) {
            <p class="domains">
              Domains:
              @for (d of detail.domains; track d.domain) {
                <span class="domain-pill">{{ d.domain }}{{ d.isPrimary ? ' (primary)' : '' }}</span>
              }
            </p>
          }
          @if (detail.tenantAdmin; as admin) {
            <p class="section-label">Default tenant admin</p>
            <div class="email-local-row">
              <mat-form-field appearance="outline" class="email-local-field">
                <mat-label>Sign-in email (local part)</mat-label>
                <input matInput formControlName="adminEmailLocalPart" autocomplete="off" />
                @if (
                  editForm.get('adminEmailLocalPart')?.invalid &&
                  editForm.get('adminEmailLocalPart')?.touched
                ) {
                  <mat-error
                    >Use letters, digits, dots, hyphens, underscores; no leading/trailing
                    dots.</mat-error
                  >
                }
              </mat-form-field>
              <span class="email-at-suffix" title="Domain is fixed for this tenant">{{
                adminDomainSuffix()
              }}</span>
            </div>
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Display name</mat-label>
                <input matInput formControlName="adminName" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="grow">
                <mat-label>New password</mat-label>
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
              Save changes
            </button>
          </div>
        </form>
      }
    </ng-template>
  `,
  styles: [
    `
      .sub {
        opacity: 0.75;
        margin-bottom: 1rem;
      }
      .card {
        margin-bottom: 1rem;
        max-width: 840px;
      }
      .deleted-card {
        opacity: 0.95;
      }
      .form-column {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-start;
      }
      .form-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: flex-start;
        width: 100%;
      }
      .grow {
        flex: 1;
        min-width: 180px;
      }
      .section-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin: 0.5rem 0 0;
        opacity: 0.7;
      }
      .preview {
        font-size: 0.9rem;
        margin: 0.25rem 0 0;
        line-height: 1.4;
      }
      .preview-muted {
        opacity: 0.55;
      }
      .preview-label {
        display: block;
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        opacity: 0.65;
        margin-bottom: 0.15rem;
      }
      .hint {
        font-size: 0.8rem;
        opacity: 0.65;
        margin: 0 0 0.25rem;
      }
      .status-pill {
        font-size: 0.875rem;
        margin: 0 0 0.75rem;
        opacity: 0.85;
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .tenant-block {
        border-bottom: 1px solid var(--color-border-hairline, rgba(15, 23, 42, 0.08));
        padding: 0.75rem 0;
      }
      .tenant-row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .row-main {
        flex: 1;
        min-width: 200px;
      }
      .meta {
        display: block;
        font-size: 0.875rem;
        opacity: 0.75;
        margin-top: 0.15rem;
      }
      .admin-line {
        font-size: 0.875rem;
        margin-top: 0.35rem;
      }
      .admin-line.muted {
        opacity: 0.65;
      }
      .inactive {
        color: var(--mat-sys-error, #b3261e);
        margin-left: 0.25rem;
      }
      .actions {
        margin-left: auto;
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        align-items: center;
      }
      .expand-panel {
        margin-top: 0.75rem;
        padding: 1rem 0.75rem 0.25rem;
        border-radius: 8px;
        background: var(--mat-sys-surface-container-low, rgba(15, 23, 42, 0.04));
        border: 1px solid var(--color-border-hairline, rgba(15, 23, 42, 0.1));
      }
      .panel-loading {
        margin: 0;
        opacity: 0.8;
      }
      .domains {
        font-size: 0.875rem;
        margin: 0 0 0.5rem;
        opacity: 0.85;
      }
      .domain-pill {
        display: inline-block;
        margin: 0.15rem 0.35rem 0 0;
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        background: var(--mat-sys-surface-container, rgba(15, 23, 42, 0.06));
        font-size: 0.8rem;
      }
      .edit-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
      .muted {
        opacity: 0.7;
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
        max-width: 280px;
      }
      .email-at-suffix {
        font-size: 0.95rem;
        font-weight: 500;
        opacity: 0.85;
        padding-top: 0.25rem;
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
