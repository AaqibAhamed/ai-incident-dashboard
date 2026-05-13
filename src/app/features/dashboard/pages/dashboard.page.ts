import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { FEATURE_FLAGS } from '../../../core/tokens/feature-flags.token';
import type { TicketPriority, TicketStatus } from '../../../../graphql/generated/graphql';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { AiService } from '../../ai/ai.service';
import { DashboardFacade } from '../data/dashboard.facade';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    TimeAgoPipe,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <header class="page-head">
      <div class="page-head-text">
        <h1 class="title">Manager dashboard</h1>
        <p class="lede">Queue health and team load — soft signals, no noise.</p>
      </div>
      <div class="page-head-actions">
        <mat-form-field appearance="outline" class="range-field" subscriptSizing="dynamic">
          <mat-label>Range</mat-label>
          <mat-select [value]="range()" (selectionChange)="onRange($event)" panelWidth="auto">
            <mat-option value="week">Last week</mat-option>
            <mat-option value="month">Last month</mat-option>
          </mat-select>
        </mat-form-field>
        <button mat-stroked-button type="button" (click)="reload()">Refresh</button>
      </div>
    </header>

    @if (facade.loading()) {
      <div class="state">
        <mat-spinner diameter="40" />
      </div>
    } @else if (facade.error()) {
      <p class="soft-error">{{ facade.error() }}</p>
    } @else if (facade.metrics(); as m) {
      <section class="kpi" aria-label="Key metrics">
        <mat-card class="stat surface-card" appearance="outlined">
          <mat-card-content>
            <div class="stat-label">Open</div>
            <div class="stat-value">{{ m.openCount }}</div>
            <div class="stat-hint">Active in queue</div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat surface-card" appearance="outlined">
          <mat-card-content>
            <div class="stat-label">Resolved</div>
            <div class="stat-value">{{ m.resolvedCount }}</div>
            <div class="stat-hint">Closed in period</div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat surface-card" appearance="outlined">
          <mat-card-content>
            <div class="stat-label">SLA attention</div>
            <div class="stat-value">{{ m.slaBreaches }}</div>
            <div class="stat-hint">Needs follow-up</div>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat surface-card" appearance="outlined">
          <mat-card-content>
            <div class="stat-label">Aging over 7d</div>
            <div class="stat-value">{{ m.agingOver7d }}</div>
            <div class="stat-hint">Still not closed</div>
          </mat-card-content>
        </mat-card>
      </section>

      @defer (on viewport) {
        <mat-card class="section surface-card chart" appearance="outlined">
          <mat-card-header>
            <mat-card-title>Team workload</mat-card-title>
            <mat-card-subtitle>Open tickets by team</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @for (t of m.byTeam; track t.teamId) {
              <div class="chart-row">
                <span class="chart-name">{{ t.teamName }}</span>
                <div class="bar-track">
                  <div class="bar-fill" [style.width.%]="barWidth(t.openTickets)"></div>
                </div>
                <span class="chart-num">{{ t.openTickets }}</span>
              </div>
            }
          </mat-card-content>
        </mat-card>
      } @placeholder {
        <p class="muted">Scroll for workload chart…</p>
      }

      @if (flags.aiHealth) {
        @defer (on viewport) {
          <mat-card class="section surface-card ai" appearance="outlined">
            <mat-card-header>
              <mat-card-title>AI health summary</mat-card-title>
              <mat-card-subtitle>Optional narrative from your backend</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (aiErr()) {
                <p class="soft-error">{{ aiErr() }}</p>
              }
              @if (aiText()) {
                <p class="ai-body">{{ aiText() }}</p>
              }
              <div class="row-actions">
                <button mat-stroked-button type="button" (click)="runAi()" [disabled]="aiLoading()">
                  Generate report
                </button>
                @if (aiLoading()) {
                  <button mat-button type="button" (click)="cancelAi()">Cancel</button>
                }
              </div>
            </mat-card-content>
          </mat-card>
        } @placeholder {
          <p class="muted">AI summary loads on scroll…</p>
        }
      }

      <mat-card class="section surface-card manager" appearance="outlined">
        <mat-card-header>
          <mat-card-title>Tickets manager</mat-card-title>
          <mat-card-subtitle
            >View, update, comment, tag, and delete tickets from dashboard</mat-card-subtitle
          >
        </mat-card-header>
        <mat-card-content>
          @if (facade.ticketError()) {
            <p class="soft-error">{{ facade.ticketError() }}</p>
          }
          <div class="manager-grid">
            <div class="tickets-list">
              @for (t of facade.tickets(); track t.id) {
                <div class="ticket-item" [class.active]="selectedId() === t.id">
                  <button class="ticket-open" type="button" (click)="openTicket(t.id)">
                    <span class="ticket-title">{{ t.title }}</span>
                    <span class="ticket-meta">{{ t.status }} · {{ t.priority }}</span>
                  </button>
                  <button
                    mat-button
                    type="button"
                    class="ticket-delete"
                    (click)="deleteTicket(t.id)"
                  >
                    Delete
                  </button>
                </div>
              }
            </div>

            <div class="ticket-editor">
              @if (facade.ticketLoading()) {
                <div class="state"><mat-spinner diameter="30" /></div>
              } @else if (!selectedId()) {
                <p class="muted">Select a ticket to edit details, comments, tags, and status.</p>
              } @else {
                <div class="editor-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Title</mat-label>
                    <input
                      matInput
                      [(ngModel)]="editTitle"
                      [ngModelOptions]="{ standalone: true }"
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Category</mat-label>
                    <input
                      matInput
                      [(ngModel)]="editCategory"
                      [ngModelOptions]="{ standalone: true }"
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full">
                    <mat-label>Description</mat-label>
                    <textarea
                      matInput
                      rows="4"
                      [(ngModel)]="editDescription"
                      [ngModelOptions]="{ standalone: true }"
                    ></textarea>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Status</mat-label>
                    <mat-select [(ngModel)]="editStatus" [ngModelOptions]="{ standalone: true }">
                      @for (s of statuses; track s) {
                        <mat-option [value]="s">{{ s }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Priority</mat-label>
                    <mat-select [(ngModel)]="editPriority" [ngModelOptions]="{ standalone: true }">
                      @for (p of priorities; track p) {
                        <mat-option [value]="p">{{ p }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full">
                    <mat-label>Tags (comma-separated)</mat-label>
                    <input
                      matInput
                      [(ngModel)]="editTags"
                      [ngModelOptions]="{ standalone: true }"
                    />
                  </mat-form-field>
                </div>
                <div class="row-actions">
                  <button mat-stroked-button type="button" (click)="saveTicket()">
                    Save ticket
                  </button>
                  <button mat-button type="button" (click)="deleteTicket(selectedId()!)">
                    Delete ticket
                  </button>
                </div>

                <div class="comments">
                  <h3>Comments</h3>
                  @if (facade.selectedTicket()?.comments?.length) {
                    @for (c of facade.selectedTicket()?.comments ?? []; track c.id) {
                      <p class="comment-item">
                        <strong>{{ c.author?.name ?? 'User' }}</strong> · {{ c.createdAt | timeAgo
                        }}<br />
                        {{ c.body }}
                      </p>
                    }
                  } @else {
                    <p class="muted">No comments yet.</p>
                  }
                  <mat-form-field appearance="outline" class="full">
                    <mat-label>Add comment</mat-label>
                    <textarea
                      matInput
                      rows="3"
                      [(ngModel)]="commentDraft"
                      [ngModelOptions]="{ standalone: true }"
                    ></textarea>
                  </mat-form-field>
                  <button mat-stroked-button type="button" (click)="addComment()">
                    Add comment
                  </button>
                </div>
              }
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page-head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-6);
        margin-bottom: var(--space-8);
        padding-bottom: var(--space-6);
        border-bottom: 1px solid rgba(11, 31, 58, 0.06);
      }
      .title {
        margin-bottom: var(--space-2);
        color: #071329; /* deep navy */
        font-weight: 700;
      }
      .lede {
        margin: 0;
        font-size: 0.95rem;
        color: #4a6b86;
        max-width: 36rem;
        line-height: 1.5;
      }
      .page-head-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3);
      }
      .range-field {
        width: 11rem;
        margin: 0;
      }
      .state {
        padding: var(--space-8) 0;
        display: flex;
        justify-content: center;
      }
      .kpi {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-5);
        margin-bottom: var(--space-8);
      }
      .stat mat-card-content {
        padding: calc(var(--space-6) + 4px) !important;
      }
      .stat-label {
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #5b7b93;
        margin-bottom: var(--space-2);
      }
      .stat-value {
        font-size: 2rem;
        font-weight: 600;
        letter-spacing: -0.03em;
        line-height: 1.15;
        margin-bottom: var(--space-2);
      }
      .stat.surface-card {
        background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
        border: 1px solid rgba(11, 31, 58, 0.04);
        box-shadow: 0 6px 18px rgba(14, 30, 50, 0.04);
        border-radius: 10px;
      }
      .stat-hint {
        font-size: 0.8rem;
        color: #6b8899;
      }
      .section {
        margin-top: var(--space-6);
      }
      .chart mat-card-header {
        padding: var(--space-6) var(--space-6) 0;
      }
      .chart mat-card-content {
        padding: var(--space-5) var(--space-6) var(--space-6) !important;
      }
      .chart-row {
        display: grid;
        grid-template-columns: minmax(100px, 140px) 1fr 2.5rem;
        align-items: center;
        gap: var(--space-4);
        margin: var(--space-4) 0;
      }
      .chart-name {
        font-size: 0.875rem;
        color: #213a52;
      }
      .bar-track {
        height: 10px;
        background: rgba(11, 31, 58, 0.06);
        border-radius: 999px;
        overflow: hidden;
      }
      :host-context(.app-dark-theme) .bar-track {
        background: rgba(255, 255, 255, 0.08);
      }
      .bar-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #4f8ef7 0%, #6cc1ff 100%);
        min-width: 6px;
        transition: width 0.35s cubic-bezier(0.2, 0.9, 0.3, 1);
      }
      :host-context(.app-dark-theme) .bar-fill {
        background: rgba(148, 163, 184, 0.35);
      }
      .chart-num {
        font-size: 0.875rem;
        font-weight: 500;
        text-align: right;
        color: #2b485e;
      }
      .ai mat-card-header {
        padding: var(--space-6) var(--space-6) 0;
      }
      .ai mat-card-content {
        padding: var(--space-4) var(--space-6) var(--space-6) !important;
      }
      .ai-body {
        font-size: 0.95rem;
        line-height: 1.6;
        color: #324a5f;
        margin-bottom: var(--space-4);
      }
      .row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
        margin-top: var(--space-2);
      }
      .soft-error {
        margin: 0 0 var(--space-4);
        padding: var(--space-4);
        font-size: 0.9rem;
        color: #3b5569;
        background: #fff7f3;
        border: 1px solid rgba(219, 87, 76, 0.12);
        border-radius: 8px;
      }
      .muted {
        color: var(--color-text-subtle);
        font-size: 0.9rem;
        margin: var(--space-4) 0;
      }
      .manager mat-card-content {
        padding: var(--space-4) var(--space-6) var(--space-6) !important;
      }
      .manager-grid {
        display: grid;
        grid-template-columns: minmax(260px, 360px) 1fr;
        gap: var(--space-6);
        align-items: start;
      }
      @media (max-width: 980px) {
        .manager-grid {
          grid-template-columns: 1fr;
        }
      }
      .tickets-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        max-height: 520px;
        overflow: auto;
        padding-right: var(--space-3);
      }
      .ticket-item {
        border: 1px solid rgba(11, 31, 58, 0.06);
        border-radius: 10px;
        padding: calc(var(--space-2) + 2px);
        display: flex;
        gap: var(--space-2);
        align-items: center;
        justify-content: space-between;
        background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      }
      .ticket-item.active {
        border-color: rgba(79, 142, 247, 0.4);
        box-shadow: 0 6px 18px rgba(79, 142, 247, 0.06);
      }
      .ticket-open {
        flex: 1;
        background: transparent;
        border: 0;
        text-align: left;
        cursor: pointer;
        padding: var(--space-1);
      }
      .ticket-title {
        display: block;
        font-weight: 600;
      }
      .ticket-meta {
        display: block;
        color: #6b7f8f;
        font-size: 0.8rem;
      }
      .editor-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-3);
      }
      .editor-grid .full {
        grid-column: 1 / -1;
      }
      .comments {
        margin-top: var(--space-5);
        padding-top: var(--space-4);
        border-top: 1px solid var(--color-border-hairline);
      }
      .comment-item {
        margin: 0 0 var(--space-3);
        color: var(--color-text-muted);
      }
    `,
  ],
})
export default class DashboardPage implements OnInit {
  readonly facade = inject(DashboardFacade);
  private readonly ai = inject(AiService);
  private readonly router = inject(Router);
  readonly flags = inject(FEATURE_FLAGS);

  readonly range = signal<'week' | 'month'>('week');
  readonly aiLoading = signal(false);
  readonly aiText = signal<string | null>(null);
  readonly aiErr = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly statuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  readonly priorities: TicketPriority[] = ['P1', 'P2', 'P3', 'P4'];

  editTitle = '';
  editDescription = '';
  editCategory = '';
  editTags = '';
  editStatus: TicketStatus = 'OPEN';
  editPriority: TicketPriority = 'P3';
  commentDraft = '';
  private aiAbort?: AbortController;

  ngOnInit(): void {
    void this.facade.load(this.range());
  }

  maxOpen(): number {
    const m = this.facade.metrics();
    if (!m?.byTeam.length) return 1;
    return Math.max(1, ...m.byTeam.map((t) => t.openTickets));
  }

  barWidth(n: number): number {
    return Math.round((n / this.maxOpen()) * 100);
  }

  onRange(ev: MatSelectChange): void {
    this.range.set(ev.value as 'week' | 'month');
    void this.facade.load(this.range());
  }

  reload(): void {
    void this.facade.load(this.range());
  }

  async openTicket(id: string): Promise<void> {
    await this.router.navigate(['/tickets', id]);
  }

  async saveTicket(): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    await this.facade.updateTicket(id, {
      title: this.editTitle.trim(),
      description: this.editDescription.trim(),
      category: this.editCategory.trim(),
      tags: this.editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      status: this.editStatus,
      priority: this.editPriority,
    });
    await this.facade.load(this.range());
    await this.facade.loadTicket(id);
    this.syncEditFields();
  }

  async addComment(): Promise<void> {
    const id = this.selectedId();
    const body = this.commentDraft.trim();
    if (!id || !body) return;
    await this.facade.addComment(id, body);
    this.commentDraft = '';
  }

  async deleteTicket(id: string): Promise<void> {
    if (!confirm('Delete this ticket? This cannot be undone.')) return;
    const deleted = await this.facade.deleteTicket(id);
    if (!deleted) return;
    if (this.selectedId() === id) {
      this.selectedId.set(null);
      this.resetEditFields();
    }
    await this.facade.load(this.range());
  }

  private syncEditFields(): void {
    const ticket = this.facade.selectedTicket();
    if (!ticket) return;
    this.editTitle = ticket.title;
    this.editDescription = ticket.description;
    this.editCategory = ticket.category ?? '';
    this.editTags = ticket.tags.join(', ');
    this.editStatus = ticket.status;
    this.editPriority = ticket.priority;
  }

  private resetEditFields(): void {
    this.editTitle = '';
    this.editDescription = '';
    this.editCategory = '';
    this.editTags = '';
    this.editStatus = 'OPEN';
    this.editPriority = 'P3';
    this.commentDraft = '';
  }

  async runAi(): Promise<void> {
    this.aiAbort?.abort();
    this.aiAbort = new AbortController();
    this.aiLoading.set(true);
    this.aiErr.set(null);
    this.aiText.set(null);
    try {
      const r = await this.ai.healthReport(this.range(), this.aiAbort.signal);
      this.aiText.set(r.summary);
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'AbortError') return;
      this.aiErr.set('AI service unavailable, please try again.');
    } finally {
      this.aiLoading.set(false);
    }
  }

  cancelAi(): void {
    this.aiAbort?.abort();
  }
}
