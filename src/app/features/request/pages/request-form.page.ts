import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { catchError, firstValueFrom, map, Observable, of, switchMap, timer } from 'rxjs';
import type { TicketPriority } from '../../../../graphql/generated/graphql';
import { API_CONFIG } from '../../../core/tokens/api-config.token';
import { FEATURE_FLAGS } from '../../../core/tokens/feature-flags.token';
import { AiService } from '../../ai/ai.service';
import { TicketsFacade } from '../../tickets/data/tickets.facade';

@Component({
  selector: 'app-request-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatStepperModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  template: `
    <h1>New service request</h1>
    <mat-stepper linear>
      <mat-step [stepControl]="step1" label="Describe">
        <form [formGroup]="step1">
          <mat-form-field appearance="outline" class="full">
            <mat-label>Natural language</mat-label>
            <textarea matInput rows="4" formControlName="naturalLanguage"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Description</mat-label>
            <textarea matInput rows="3" formControlName="description"></textarea>
          </mat-form-field>
          @if (flags.aiFormAssist) {
            <button mat-stroked-button type="button" (click)="assist()" [disabled]="assistBusy()">
              AI: infer fields
            </button>
          }
          <div class="actions">
            <button mat-button matStepperNext type="button">Next</button>
          </div>
        </form>
      </mat-step>
      <mat-step [stepControl]="step2" label="Details">
        <form [formGroup]="step2">
          <mat-form-field appearance="outline" class="full">
            <mat-label>Category</mat-label>
            <input matInput formControlName="category" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Priority</mat-label>
            <mat-select formControlName="priority">
              <mat-option value="P1">P1</mat-option>
              <mat-option value="P2">P2</mat-option>
              <mat-option value="P3">P3</mat-option>
              <mat-option value="P4">P4</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Asset tag</mat-label>
            <input matInput formControlName="assetTag" />
            @if (step2.controls.assetTag.pending) {
              <mat-hint>Validating…</mat-hint>
            }
            @if (step2.controls.assetTag.errors?.['asset']) {
              <mat-error>{{ step2.controls.assetTag.errors?.['asset']?.['message'] }}</mat-error>
            }
          </mat-form-field>
          <div class="uploads">
            <h3>Attachments</h3>
            <p class="hint">
              Upload images, videos, or documents (PNG/JPG/SVG/MP4/PDF/DOC and similar file types).
            </p>
            <input type="file" multiple (change)="onPickFiles($event)" />
            @if (pickedFiles().length) {
              <div class="picked">
                @for (f of pickedFiles(); track f.name + f.size) {
                  <p>{{ f.name }} · {{ f.type || 'unknown type' }} · {{ (f.size / 1024).toFixed(1) }} KB</p>
                }
              </div>
            }
          </div>
          <div class="actions">
            <button mat-button matStepperPrevious type="button">Back</button>
            <button mat-button matStepperNext type="button">Next</button>
          </div>
        </form>
      </mat-step>
      <mat-step label="Submit">
        <mat-card appearance="outlined">
          <mat-card-title>Review</mat-card-title>
          <mat-card-content>
            <p>
              <strong>Title:</strong>
              {{ step1.controls.title.value.trim() || aiTitleHint() || '(untitled)' }}
            </p>
            <p><strong>Priority:</strong> {{ step2.controls.priority.value }}</p>
            <p><strong>Category:</strong> {{ step2.controls.category.value }}</p>
          </mat-card-content>
        </mat-card>
        <div class="actions">
          <button mat-button matStepperPrevious type="button">Back</button>
          <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="busy()">
            Submit
          </button>
        </div>
      </mat-step>
    </mat-stepper>
  `,
  styles: [
    `
      .full {
        width: 100%;
        display: block;
        margin-bottom: 0.5rem;
      }
      .actions {
        margin-top: 1rem;
        display: flex;
        gap: 0.5rem;
      }
      .uploads {
        margin-top: 0.75rem;
      }
      .hint {
        margin: 0 0 0.5rem;
        opacity: 0.75;
        font-size: 0.85rem;
      }
      .picked {
        margin-top: 0.75rem;
        padding: 0.75rem;
        border: 1px solid var(--color-border-hairline, rgba(15, 23, 42, 0.08));
        border-radius: var(--radius-sm, 8px);
      }
      .picked p {
        margin: 0.25rem 0;
        font-size: 0.85rem;
      }
    `,
  ],
})
export default class RequestFormPage {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);
  private readonly facade = inject(TicketsFacade);
  private readonly router = inject(Router);
  private readonly ai = inject(AiService);
  private readonly snack = inject(MatSnackBar);
  readonly flags = inject(FEATURE_FLAGS);

  readonly assistBusy = signal(false);
  readonly busy = signal(false);
  readonly aiTitleHint = signal('');
  readonly pickedFiles = signal<File[]>([]);
  readonly uploadedFiles = signal<
    Array<{
      id: string;
      fileName: string;
      contentType: string;
      sizeBytes: number;
      uploadedByUserId: string;
      uploadedAt: string;
      url: string;
    }>
  >([]);

  readonly step1 = this.fb.nonNullable.group({
    naturalLanguage: [''],
    title: ['', Validators.required],
    description: ['', Validators.required],
  });

  readonly step2 = this.fb.nonNullable.group({
    category: ['General', Validators.required],
    priority: this.fb.nonNullable.control<TicketPriority>('P3', Validators.required),
    assetTag: new FormControl('', {
      asyncValidators: [(c) => this.validateAsset$(c)],
    }),
  });

  onPickFiles(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const list = input?.files;
    if (!list?.length) {
      this.pickedFiles.set([]);
      return;
    }
    this.pickedFiles.set(Array.from(list));
  }

  async assist(): Promise<void> {
    if (!this.flags.aiFormAssist) return;
    const text = this.step1.controls.naturalLanguage.value.trim();
    if (!text) return;
    this.assistBusy.set(true);
    try {
      const r = await this.ai.parseRequest(text);
      this.step1.patchValue({ title: r.title, description: text });
      this.step2.patchValue({
        category: r.category,
        priority: r.priority as TicketPriority,
      });
      this.aiTitleHint.set(r.title);
    } catch {
      this.snack.open('AI service unavailable, please try again.', 'OK', { duration: 5000 });
    } finally {
      this.assistBusy.set(false);
    }
  }

  private validateAsset$(ctrl: AbstractControl): Observable<ValidationErrors | null> {
    return timer(250).pipe(
      switchMap(() => {
        const v = (ctrl.value as string)?.trim();
        if (!v) return of(null);
        return this.http
          .get<{ valid: boolean; message?: string }>(`${this.api.restUrl}/validate-asset`, {
            params: { assetTag: v },
          })
          .pipe(
            map((res) =>
              res.valid ? null : { asset: { message: res.message ?? 'Invalid asset' } },
            ),
            catchError(() => of({ asset: { message: 'Validation failed' } })),
          );
      }),
    );
  }

  async submit(): Promise<void> {
    if (this.step1.invalid || this.step2.invalid) return;
    this.busy.set(true);
    try {
      const uploadedIds = await this.uploadAttachments();
      const id = await this.facade.createTicket({
        title: this.step1.controls.title.value,
        description: this.step1.controls.description.value,
        priority: this.step2.controls.priority.value,
        category: this.step2.controls.category.value,
        attachmentIds: uploadedIds,
      });
      await this.router.navigate(['/tickets', id]);
      this.pickedFiles.set([]);
      this.uploadedFiles.set([]);
    } finally {
      this.busy.set(false);
    }
  }

  private async uploadAttachments(): Promise<string[]> {
    const files = this.pickedFiles();
    if (!files.length) return [];

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file, file.name);
    }

    const response = await firstValueFrom(
      this.http.post<{
        files: Array<{
          id: string;
          fileName: string;
          contentType: string;
          sizeBytes: number;
          uploadedByUserId: string;
          uploadedAt: string;
          url: string;
        }>;
      }>(`${this.api.restUrl}/upload`, formData),
    );

    const uploaded = response?.files ?? [];
    this.uploadedFiles.set(uploaded);
    return uploaded.map((file) => file.id);
  }
}
