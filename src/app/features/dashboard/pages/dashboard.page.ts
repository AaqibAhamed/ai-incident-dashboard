import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { FEATURE_FLAGS } from '../../../core/tokens/feature-flags.token';
import { AiService } from '../../ai/ai.service';
import { DashboardFacade } from '../data/dashboard.facade';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
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
        border-bottom: 1px solid var(--color-border-soft);
      }
      .title {
        margin-bottom: var(--space-2);
      }
      .lede {
        margin: 0;
        font-size: 0.95rem;
        color: var(--color-text-muted);
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
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--space-5);
        margin-bottom: var(--space-8);
      }
      .stat mat-card-content {
        padding: var(--space-6) !important;
      }
      .stat-label {
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-subtle);
        margin-bottom: var(--space-2);
      }
      .stat-value {
        font-size: 2rem;
        font-weight: 600;
        letter-spacing: -0.03em;
        line-height: 1.15;
        margin-bottom: var(--space-2);
      }
      .stat-hint {
        font-size: 0.8rem;
        color: var(--color-text-muted);
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
        color: var(--color-text-muted);
      }
      .bar-track {
        height: 8px;
        background: rgba(15, 23, 42, 0.06);
        border-radius: 999px;
        overflow: hidden;
      }
      :host-context(.app-dark-theme) .bar-track {
        background: rgba(255, 255, 255, 0.08);
      }
      .bar-fill {
        height: 100%;
        border-radius: 999px;
        background: rgba(71, 85, 105, 0.38);
        min-width: 4px;
        transition: width 0.25s ease;
      }
      :host-context(.app-dark-theme) .bar-fill {
        background: rgba(148, 163, 184, 0.35);
      }
      .chart-num {
        font-size: 0.875rem;
        font-weight: 500;
        text-align: right;
        color: var(--color-text-muted);
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
        color: var(--color-text-muted);
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
        color: var(--color-text-muted);
        background: var(--color-surface);
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-sm);
      }
      .muted {
        color: var(--color-text-subtle);
        font-size: 0.9rem;
        margin: var(--space-4) 0;
      }
    `,
  ],
})
export default class DashboardPage implements OnInit {
  readonly facade = inject(DashboardFacade);
  private readonly ai = inject(AiService);
  readonly flags = inject(FEATURE_FLAGS);

  readonly range = signal<'week' | 'month'>('week');
  readonly aiLoading = signal(false);
  readonly aiText = signal<string | null>(null);
  readonly aiErr = signal<string | null>(null);
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
