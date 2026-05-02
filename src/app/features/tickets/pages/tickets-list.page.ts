import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { TicketStatus } from '../../../../graphql/generated/graphql';
import { InfiniteScrollDirective } from '../../../shared/directives/infinite-scroll.directive';
import { SlaStatusPipe } from '../../../shared/pipes/sla-status.pipe';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { TicketFiltersStore } from '../data/ticket-filters.store';
import type { TicketListNode } from '../data/tickets.facade';
import { TicketsFacade } from '../data/tickets.facade';

@Component({
  selector: 'app-tickets-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DragDropModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    InfiniteScrollDirective,
    TimeAgoPipe,
    SlaStatusPipe,
  ],
  template: `
    <h1>Agent queue</h1>
    <div class="filters">
      <mat-form-field appearance="outline">
        <mat-label>Search</mat-label>
        <input matInput [(ngModel)]="searchDraft" />
      </mat-form-field>
      <mat-slide-toggle [ngModel]="filters.slaBreaching()" (ngModelChange)="onSla($event)">
        SLA breaching only
      </mat-slide-toggle>
      <button mat-stroked-button type="button" (click)="apply()">Apply filters</button>
      <button mat-button type="button" (click)="reset()">Reset</button>
      <span class="badge" [class.on]="filters.activeFilterCount() > 0">
        {{ filters.activeFilterCount() }} active
      </span>
    </div>
    @if (facade.loading() && !facade.items().length) {
      <mat-spinner diameter="40" />
    } @else if (facade.error()) {
      <p>{{ facade.error() }}</p>
    } @else {
      <div cdkDropListGroup class="board">
        @for (col of columns(); track col.id) {
          <div class="col">
            <h3>{{ col.label }} ({{ col.items.length }})</h3>
            <div
              class="list"
              cdkDropList
              [id]="col.id"
              [cdkDropListData]="col.items"
              (cdkDropListDropped)="drop($event, col.targetStatus)"
            >
              @for (t of col.items; track t.id) {
                <mat-card cdkDrag [cdkDragData]="t" appearance="outlined" class="card">
                  <a class="title" [routerLink]="['/tickets', t.id]">{{ t.title }}</a>
                  <div class="meta">
                    <mat-chip-set>
                      <mat-chip>{{ t.priority }}</mat-chip>
                      <mat-chip>{{ t.status }}</mat-chip>
                    </mat-chip-set>
                    <span class="sla" [class.bad]="t.slaBreached">
                      {{ t.slaBreached | slaStatus: t.slaDueAt }}
                    </span>
                  </div>
                  <div class="sub">{{ t.updatedAt | timeAgo }}</div>
                </mat-card>
              }
            </div>
          </div>
        }
      </div>
      @if (facade.pageInfo()?.hasNextPage) {
        <div class="sentinel" appInfiniteScroll (loadMore)="onLoadMore()"></div>
      }
    }
  `,
  styles: [
    `
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1rem;
      }
      .badge {
        font-size: 0.85rem;
        opacity: 0.7;
      }
      .badge.on {
        opacity: 1;
        font-weight: 600;
      }
      .board {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }
      @media (max-width: 960px) {
        .board {
          grid-template-columns: 1fr;
        }
      }
      .list {
        min-height: 200px;
        background: rgba(0, 0, 0, 0.03);
        border-radius: 8px;
        padding: 0.5rem;
        max-height: 520px;
        overflow: auto;
      }
      .card {
        margin-bottom: 0.5rem;
        cursor: grab;
      }
      .title {
        font-weight: 600;
        text-decoration: none;
        color: inherit;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        margin-top: 0.35rem;
      }
      .sla.bad {
        color: #b00020;
        font-weight: 600;
      }
      .sub {
        font-size: 0.75rem;
        opacity: 0.7;
        margin-top: 0.25rem;
      }
      .sentinel {
        height: 24px;
      }
    `,
  ],
})
export default class TicketsListPage implements OnInit {
  readonly facade = inject(TicketsFacade);
  readonly filters = inject(TicketFiltersStore);

  searchDraft = '';

  readonly columns = computed(() => {
    const items = this.facade.items();
    const open = items.filter((t) => t.status === 'OPEN');
    const prog = items.filter((t) => t.status === 'IN_PROGRESS');
    const done = items.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');
    return [
      { id: 'open', label: 'Open', targetStatus: 'OPEN' as TicketStatus, items: open },
      {
        id: 'prog',
        label: 'In progress',
        targetStatus: 'IN_PROGRESS' as TicketStatus,
        items: prog,
      },
      {
        id: 'done',
        label: 'Resolved / closed',
        targetStatus: 'RESOLVED' as TicketStatus,
        items: done,
      },
    ];
  });

  ngOnInit(): void {
    this.searchDraft = this.filters.search();
    void this.facade.loadFirst();
  }

  onSla(v: boolean): void {
    this.filters.patch({ slaBreaching: v });
  }

  apply(): void {
    this.filters.patch({ search: this.searchDraft });
    void this.facade.loadFirst();
  }

  reset(): void {
    this.filters.reset();
    this.searchDraft = '';
    void this.facade.loadFirst();
  }

  onLoadMore(): void {
    void this.facade.loadMore();
  }

  async drop(ev: CdkDragDrop<TicketListNode[]>, target: TicketStatus): Promise<void> {
    const ticket = ev.item.data as TicketListNode | undefined;
    if (!ticket) return;
    if (ticket.status === target) return;
    if (target === 'RESOLVED' && ticket.status === 'CLOSED') return;
    await this.facade.updateTicket(ticket.id, { status: target });
  }
}
