import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import type { TicketQuery } from '../../../../graphql/generated/graphql';
import { FEATURE_FLAGS } from '../../../core/tokens/feature-flags.token';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { AiService } from '../../ai/ai.service';
import { TicketsFacade } from '../data/tickets.facade';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    MatDividerModule,
    MatSnackBarModule,
    TimeAgoPipe,
  ],
  template: `
    @if (!ticket()) {
      <mat-card><mat-card-content>Ticket not found.</mat-card-content></mat-card>
    } @else {
      @let t = ticket()!;
      <div class="grid">
        <div class="main">
          <mat-card appearance="outlined" class="surface-card detail-main">
            <mat-card-header class="detail-header">
              <mat-card-title class="detail-title">{{ t.title }}</mat-card-title>
              <mat-card-subtitle class="detail-subtitle">
                {{ t.priority }} · {{ t.status }} · {{ t.team?.name }}
              </mat-card-subtitle>
            </mat-card-header>
            <div class="detail-times" aria-label="Ticket timestamps">
              <span>Created {{ t.createdAt | timeAgo }}</span>
              <span class="dot" aria-hidden="true">·</span>
              <span>Updated {{ t.updatedAt | timeAgo }}</span>
            </div>
            <mat-card-content class="detail-content">
              <p class="description">{{ t.description }}</p>
              <mat-divider />
              <h3>Assign</h3>
              <mat-form-field appearance="outline">
                <mat-label>Assignee</mat-label>
                <mat-select
                  [value]="t.assigneeId ?? 'u-agent'"
                  (selectionChange)="onAssign($event)"
                >
                  <mat-option value="u-agent">Alex Agent</mat-option>
                  <mat-option value="u-manager">Morgan Manager</mat-option>
                </mat-select>
              </mat-form-field>
              <h3>Comments</h3>
              <mat-list>
                @for (c of t.comments; track c.id) {
                  <mat-list-item>
                    <span matListItemTitle>{{ c.author?.name ?? 'User' }}</span>
                    <span matListItemLine>{{ c.body }}</span>
                    <span matListItemMeta>{{ c.createdAt | timeAgo }}</span>
                  </mat-list-item>
                }
              </mat-list>
              <mat-form-field appearance="outline" class="full">
                <mat-label>New comment</mat-label>
                <textarea matInput rows="3" [(ngModel)]="commentDraft"></textarea>
              </mat-form-field>
              <div class="row">
                <button mat-flat-button color="primary" type="button" (click)="post()">Post</button>
                @if (flags.aiReply) {
                  <button
                    mat-stroked-button
                    type="button"
                    (click)="useAiDraft()"
                    [disabled]="aiBusy()"
                  >
                    Use AI draft
                  </button>
                }
              </div>
            </mat-card-content>
          </mat-card>
          <mat-card class="mt surface-card" appearance="outlined">
            <mat-card-header>
              <mat-card-title>History</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <mat-list>
                @for (h of t.history; track h.id) {
                  <mat-list-item>
                    <span matListItemTitle>{{ h.action }}</span>
                    <span matListItemLine>{{ h.details }}</span>
                    <span matListItemMeta>{{ h.createdAt | timeAgo }}</span>
                  </mat-list-item>
                }
              </mat-list>
            </mat-card-content>
          </mat-card>
          @if (t.relatedTicketIds.length) {
            <mat-card class="mt surface-card" appearance="outlined">
              <mat-card-header>
                <mat-card-title>Related</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <ul>
                  @for (rid of t.relatedTicketIds; track rid) {
                    <li>
                      <a [routerLink]="['/tickets', rid]">{{ rid }}</a>
                    </li>
                  }
                </ul>
              </mat-card-content>
            </mat-card>
          }
        </div>
        @if (flags.aiSummary) {
          @defer (on viewport) {
            <mat-card class="side surface-card" appearance="outlined">
              <mat-card-header>
                <mat-card-title>AI summary</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                @if (aiSumErr()) {
                  <p class="warn">{{ aiSumErr() }}</p>
                }
                @if (aiSummary(); as s) {
                  <p><strong>Problem:</strong> {{ s.problem }}</p>
                  <p><strong>Impact:</strong> {{ s.impact }}</p>
                  <p><strong>Next:</strong> {{ s.nextSteps }}</p>
                }
                <div class="row">
                  <button
                    mat-stroked-button
                    type="button"
                    (click)="summarize()"
                    [disabled]="sumBusy()"
                  >
                    Summarize ticket
                  </button>
                  @if (sumBusy()) {
                    <button mat-button type="button" (click)="cancelSum()">Cancel</button>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          } @placeholder {
            <p class="muted">AI panel loads on scroll…</p>
          }
        }
      </div>
    }
  `,
  styles: [
    `
      .detail-header {
        padding: var(--space-6, 1.5rem) var(--space-6, 1.5rem) var(--space-3, 0.75rem);
      }
      .detail-title {
        margin: 0 0 var(--space-2, 0.5rem);
        font-size: 1.35rem;
        line-height: 1.3;
        font-weight: 600;
      }
      .detail-subtitle {
        margin: 0;
        line-height: 1.45;
      }
      .detail-times {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2, 0.5rem);
        margin: 0 var(--space-6, 1.5rem) var(--space-4, 1rem);
        padding-bottom: var(--space-4, 1rem);
        border-bottom: 1px solid var(--color-border-hairline, rgba(15, 23, 42, 0.06));
        font-size: 0.8125rem;
        color: var(--color-text-muted, rgba(15, 23, 42, 0.55));
      }
      .detail-times .dot {
        opacity: 0.45;
        user-select: none;
      }
      .detail-content {
        padding-top: var(--space-5, 1.25rem) !important;
      }
      .description {
        margin: 0 0 var(--space-5, 1.25rem);
        line-height: 1.6;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 1rem;
        align-items: start;
      }
      @media (max-width: 960px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
      .full {
        width: 100%;
        margin-top: 0.5rem;
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .mt {
        margin-top: 1rem;
      }
      .side {
        position: sticky;
        top: 1rem;
      }
      .warn {
        color: #b00020;
      }
      .muted {
        opacity: 0.7;
      }
    `,
  ],
})
export default class TicketDetailPage {
  readonly ticket = input<TicketQuery['ticket'] | null>(null);

  private readonly facade = inject(TicketsFacade);
  private readonly router = inject(Router);
  private readonly ai = inject(AiService);
  private readonly snack = inject(MatSnackBar);
  readonly flags = inject(FEATURE_FLAGS);

  commentDraft = '';

  readonly sumBusy = signal(false);
  readonly aiSummary = signal<{ problem: string; impact: string; nextSteps: string } | null>(null);
  readonly aiSumErr = signal<string | null>(null);
  private sumAbort?: AbortController;

  readonly aiBusy = signal(false);

  async onAssign(ev: MatSelectChange): Promise<void> {
    const t = this.ticket();
    const id = ev.value as string | null;
    if (!t) return;
    if (id) {
      await this.facade.assignTicket(t.id, id);
    }
    await this.reload();
  }

  async post(): Promise<void> {
    const t = this.ticket();
    const body = this.commentDraft.trim();
    if (!t || !body) return;
    await this.facade.addComment(t.id, body);
    this.commentDraft = '';
    await this.reload();
  }

  async useAiDraft(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    this.aiBusy.set(true);
    try {
      const r = await this.ai.suggestedReply(t.id);
      this.commentDraft = r.draft;
    } catch {
      this.snack.open('AI service unavailable, please try again.', 'OK', { duration: 5000 });
    } finally {
      this.aiBusy.set(false);
    }
  }

  async summarize(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    this.sumAbort?.abort();
    this.sumAbort = new AbortController();
    this.sumBusy.set(true);
    this.aiSumErr.set(null);
    this.aiSummary.set(null);
    try {
      const r = await this.ai.summarizeTicket(t.id, this.sumAbort.signal);
      this.aiSummary.set(r);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      this.aiSumErr.set('AI service unavailable, please try again.');
    } finally {
      this.sumBusy.set(false);
    }
  }

  cancelSum(): void {
    this.sumAbort?.abort();
  }

  private async reload(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    await this.router.navigateByUrl(`/tickets/${t.id}`, { replaceUrl: true });
  }
}
