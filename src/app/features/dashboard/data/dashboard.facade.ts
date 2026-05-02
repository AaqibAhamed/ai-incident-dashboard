import { inject, Injectable, signal } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import {
  AddCommentDocument,
  type AddCommentMutationVariables,
  DashboardMetricsDocument,
  type DashboardMetricsQuery,
  type DashboardMetricsQueryVariables,
  DeleteTicketDocument,
  TicketDocument,
  TicketsDocument,
  type TicketQuery,
  type TicketQueryVariables,
  type TicketsQuery,
  type TicketsQueryVariables,
  UpdateTicketDocument,
  type UpdateTicketMutationVariables,
} from '../../../../graphql/generated/graphql';

@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  private readonly apollo = inject(Apollo);

  readonly metrics = signal<DashboardMetricsQuery['dashboardMetrics'] | null>(null);
  readonly tickets = signal<TicketsQuery['tickets']['edges'][number]['node'][]>([]);
  readonly selectedTicket = signal<TicketQuery['ticket'] | null>(null);
  readonly loading = signal(false);
  readonly ticketLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly ticketError = signal<string | null>(null);

  async load(range: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const vars: DashboardMetricsQueryVariables = { range };
      const [metricsRes, ticketsRes] = await Promise.all([
        firstValueFrom(
          this.apollo.query({
            query: DashboardMetricsDocument,
            variables: vars,
            fetchPolicy: 'network-only',
          }),
        ),
        firstValueFrom(
          this.apollo.query({
            query: TicketsDocument,
            variables: { first: 30 } satisfies TicketsQueryVariables,
            fetchPolicy: 'network-only',
          }),
        ),
      ]);
      this.metrics.set(metricsRes.data?.dashboardMetrics ?? null);
      this.tickets.set(ticketsRes.data?.tickets.edges.map((edge) => edge.node) ?? []);
      if (this.selectedTicket()) {
        const currentId = this.selectedTicket()!.id;
        if (!this.tickets().some((t) => t.id === currentId)) {
          this.selectedTicket.set(null);
        }
      }
    } catch {
      this.error.set('Failed to load dashboard data');
    } finally {
      this.loading.set(false);
    }
  }

  async loadTicket(id: string): Promise<void> {
    this.ticketLoading.set(true);
    this.ticketError.set(null);
    try {
      const vars: TicketQueryVariables = { id };
      const res = await firstValueFrom(
        this.apollo.query({
          query: TicketDocument,
          variables: vars,
          fetchPolicy: 'network-only',
        }),
      );
      this.selectedTicket.set(res.data?.ticket ?? null);
    } catch {
      this.ticketError.set('Failed to load ticket details');
    } finally {
      this.ticketLoading.set(false);
    }
  }

  async updateTicket(id: string, input: UpdateTicketMutationVariables['input']): Promise<void> {
    this.ticketLoading.set(true);
    this.ticketError.set(null);
    try {
      const vars: UpdateTicketMutationVariables = { id, input };
      await firstValueFrom(
        this.apollo.mutate({
          mutation: UpdateTicketDocument,
          variables: vars,
        }),
      );
      await this.loadTicket(id);
    } catch {
      this.ticketError.set('Failed to update ticket');
    } finally {
      this.ticketLoading.set(false);
    }
  }

  async addComment(ticketId: string, body: string): Promise<void> {
    this.ticketLoading.set(true);
    this.ticketError.set(null);
    try {
      const vars: AddCommentMutationVariables = { ticketId, body };
      await firstValueFrom(
        this.apollo.mutate({
          mutation: AddCommentDocument,
          variables: vars,
        }),
      );
      await this.loadTicket(ticketId);
    } catch {
      this.ticketError.set('Failed to add comment');
    } finally {
      this.ticketLoading.set(false);
    }
  }

  async deleteTicket(id: string): Promise<boolean> {
    this.ticketLoading.set(true);
    this.ticketError.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate({
          mutation: DeleteTicketDocument,
          variables: { id },
        }),
      );
      const deleted = !!res.data?.deleteTicket;
      if (deleted && this.selectedTicket()?.id === id) {
        this.selectedTicket.set(null);
      }
      this.tickets.update((items) => items.filter((ticket) => ticket.id !== id));
      return deleted;
    } catch {
      this.ticketError.set('Failed to delete ticket');
      return false;
    } finally {
      this.ticketLoading.set(false);
    }
  }
}
