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
    <h1>Manager dashboard</h1>
    <mat-form-field appearance="outline">
      <mat-label>Range</mat-label>
      <mat-select [value]="range()" (selectionChange)="onRange($event)">
        <mat-option value="week">Last week</mat-option>
        <mat-option value="month">Last month</mat-option>
      </mat-select>
    </mat-form-field>
    <button mat-stroked-button type="button" (click)="reload()">Refresh</button>

    @if (facade.loading()) {
      <mat-spinner diameter="40" />
    } @else if (facade.error()) {
      <p>{{ facade.error() }}</p>
    } @else if (facade.metrics(); as m) {
      <div class="kpi">
        <mat-card><mat-card-title>Open</mat-card-title><mat-card-content>{{ m.openCount }}</mat-card-content></mat-card>
        <mat-card><mat-card-title>Resolved</mat-card-title><mat-card-content>{{ m.resolvedCount }}</mat-card-content></mat-card>
        <mat-card><mat-card-title>SLA breaches</mat-card-title><mat-card-content>{{ m.slaBreaches }}</mat-card-content></mat-card>
        <mat-card><mat-card-title>Aging &gt; 7d</mat-card-title><mat-card-content>{{ m.agingOver7d }}</mat-card-content></mat-card>
      </div>
      @defer (on viewport) {
        <mat-card class="chart">
          <mat-card-title>Team workload</mat-card-title>
          <mat-card-content>
            @for (t of m.byTeam; track t.teamId) {
              <div class="row">
                <span class="name">{{ t.teamName }}</span>
                <div class="bar-wrap">
                  <div class="bar" [style.width.%]="barWidth(t.openTickets)"></div>
                </div>
                <span class="num">{{ t.openTickets }}</span>
              </div>
            }
          </mat-card-content>
        </mat-card>
      } @placeholder {
        <p class="muted">Scroll for charts…</p>
      }
      @if (flags.aiHealth) {
        @defer (on viewport) {
          <mat-card class="ai">
            <mat-card-title>AI health summary</mat-card-title>
            <mat-card-content>
              @if (aiErr()) {
                <p class="warn">{{ aiErr() }}</p>
              }
              @if (aiText()) {
                <p>{{ aiText() }}</p>
              }
              <div class="row-actions">
                <button mat-stroked-button type="button" (click)="runAi()" [disabled]="aiLoading()">Generate report</button>
                @if (aiLoading()) {
                  <button mat-button type="button" (click)="cancelAi()">Cancel</button>
                }
              </div>
            </mat-card-content>
          </mat-card>
        } @placeholder {
          <p class="muted">AI block loads on viewport…</p>
        }
      }
    }
  `,
  styles: [
    `
      .kpi {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 1rem;
        margin: 1rem 0;
      }
      .chart {
        margin-top: 1rem;
      }
      .row {
        display: grid;
        grid-template-columns: 120px 1fr 40px;
        align-items: center;
        gap: 0.5rem;
        margin: 0.35rem 0;
      }
      .bar-wrap {
        height: 10px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
      }
      .bar {
        height: 100%;
        background: #3f51b5;
      }
      .ai {
        margin-top: 1rem;
      }
      .row-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.75rem;
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
