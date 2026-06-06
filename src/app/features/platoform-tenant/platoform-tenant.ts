import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../../core/tokens/api-config.token';

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
    .map(p =>
      p
        .toLowerCase()
        .split('')
        .filter(c => /[a-z0-9]/.test(c))
        .join('')
    )
    .filter(s => s.length > 0);
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
  selector: 'app-platoform-tenant',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule
  ],
  templateUrl: './platoform-tenant.html',
  styleUrl: './platoform-tenant.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlatoformTenant {
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
    tenantAdminPassword: ['', [Validators.required, Validators.minLength(4)]]
  });

  readonly editForm = this.fb.nonNullable.group({
    tenantName: ['', Validators.required],
    tenantSlug: ['', Validators.required],
    adminName: [''],
    adminEmailLocalPart: ['', [Validators.required, Validators.pattern(emailLocalPartPattern)]],
    adminPassword: ['']
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
      const res = await firstValueFrom(this.http.get<PlatformTenantsResponse>(`${this.api.restUrl}/platform/tenants`));
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
        this.http.post<CreateTenantResponse>(`${this.api.restUrl}/platform/tenants`, this.createForm.getRawValue())
      );
      const email = res?.tenantAdmin?.email;
      this.snack.open(email ? `Tenant created. Admin email: ${email}` : 'Tenant and tenant admin created', 'OK', {
        duration: 5000
      });
      this.createForm.reset({
        name: '',
        slug: '',
        primaryEmailDomain: '',
        tenantAdminName: '',
        tenantAdminPassword: ''
      });
      await this.reload();
    } catch {
      this.snack.open(
        'Create failed (slug in use, primary domain already registered, or could not assign admin email)',
        'OK',
        { duration: 6000 }
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
        this.http.get<TenantDetail>(`${this.api.restUrl}/platform/tenants/${tenantId}`)
      );
      if (this.expandedTenantId() !== tenantId) {
        return;
      }
      this.editDetail.set(detail);
      const { local } = detail.tenantAdmin ? splitEmailLocalAndDomain(detail.tenantAdmin.email) : { local: '' };
      this.editForm.patchValue({
        tenantName: detail.name,
        tenantSlug: detail.slug,
        adminName: detail.tenantAdmin?.name ?? '',
        adminEmailLocalPart: local,
        adminPassword: ''
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
          slug: v.tenantSlug
        })
      );

      if (detail.tenantAdmin) {
        const body: { name?: string; emailLocalPart?: string; password?: string } = {
          name: v.adminName,
          emailLocalPart: v.adminEmailLocalPart
        };
        if (v.adminPassword?.length) {
          body.password = v.adminPassword;
        }
        await firstValueFrom(
          this.http.patch(
            `${this.api.restUrl}/platform/tenants/${detail.id}/tenant-admins/${detail.tenantAdmin.id}`,
            body
          )
        );
      }

      this.snack.open('Saved', 'OK', { duration: 2500 });
      this.collapseEdit();
      await this.reload();
    } catch {
      this.snack.open('Save failed (slug conflict, invalid email local part, or address already in use)', 'OK', {
        duration: 5000
      });
    } finally {
      this.editBusy.set(false);
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${this.api.restUrl}/platform/tenants/${id}/delete`, {}));
      if (this.expandedTenantId() === id) {
        this.collapseEdit();
      }
      await this.reload();
      this.snack.open('Tenant deleted (soft). It appears under Deleted tenants.', 'OK', {
        duration: 4000
      });
    } catch {
      this.snack.open('Delete failed', 'OK', { duration: 4000 });
    }
  }

  async restoreTenant(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${this.api.restUrl}/platform/tenants/${id}/restore`, {}));
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
      await firstValueFrom(this.http.patch(`${this.api.restUrl}/platform/tenants/${id}/suspend`, {}));
      await this.reload();
    } catch {
      this.snack.open('Suspend failed', 'OK', { duration: 4000 });
    }
  }

  async resumeTenant(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.patch(`${this.api.restUrl}/platform/tenants/${id}/resume`, {}));
      await this.reload();
    } catch {
      this.snack.open('Resume failed', 'OK', { duration: 4000 });
    }
  }
}
