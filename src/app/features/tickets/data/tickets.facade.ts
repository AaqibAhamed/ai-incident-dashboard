import { inject, Injectable, signal } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import {
  AddCommentDocument,
  AssignTicketDocument,
  type AssignTicketMutationVariables,
  CreateTicketDocument,
  type CreateTicketMutationVariables,
  TicketDocument,
  type TicketQuery,
  type TicketQueryVariables,
  TicketsDocument,
  type TicketsQuery,
  type TicketsQueryVariables,
  UpdateTicketDocument,
  type UpdateTicketMutationVariables,
} from '../../../../graphql/generated/graphql';
import { TicketFiltersStore } from './ticket-filters.store';

export type TicketListNode = TicketsQuery['tickets']['edges'][number]['node'];

const PAGE_SIZE = 15;

@Injectable({ providedIn: 'root' })
export class TicketsFacade {
  private readonly apollo = inject(Apollo);
  private readonly filters = inject(TicketFiltersStore);

  readonly items = signal<TicketListNode[]>([]);
  readonly pageInfo = signal<{ endCursor: string | null; hasNextPage: boolean } | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadFirst(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const vars: TicketsQueryVariables = {
        filter: this.filters.graphqlFilter(),
        after: null,
        first: PAGE_SIZE,
      };
      const result = await firstValueFrom(
        this.apollo.query({ query: TicketsDocument, variables: vars, fetchPolicy: 'network-only' }),
      );
      const conn = result.data?.tickets;
      if (!conn) {
        this.items.set([]);
        this.pageInfo.set(null);
        return;
      }
      this.items.set(conn.edges.map((e) => e.node));
      this.pageInfo.set(conn.pageInfo);
    } catch {
      this.error.set('Failed to load tickets');
      this.items.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    const pi = this.pageInfo();
    if (!pi?.hasNextPage || !pi.endCursor) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const vars: TicketsQueryVariables = {
        filter: this.filters.graphqlFilter(),
        after: pi.endCursor,
        first: PAGE_SIZE,
      };
      const result = await firstValueFrom(
        this.apollo.query({ query: TicketsDocument, variables: vars, fetchPolicy: 'network-only' }),
      );
      const conn = result.data?.tickets;
      if (!conn) return;
      const next = conn.edges.map((e) => e.node);
      this.items.update((cur) => {
        const ids = new Set(cur.map((t) => t.id));
        const merged = [...cur];
        for (const t of next) {
          if (!ids.has(t.id)) merged.push(t);
        }
        return merged;
      });
      this.pageInfo.set(conn.pageInfo);
    } catch {
      this.error.set('Failed to load more');
    } finally {
      this.loading.set(false);
    }
  }

  async assignTicket(id: string, assigneeId: string): Promise<void> {
    const vars: AssignTicketMutationVariables = { id, assigneeId };
    await firstValueFrom(this.apollo.mutate({ mutation: AssignTicketDocument, variables: vars }));
    await this.loadFirst();
  }

  async updateTicket(id: string, input: UpdateTicketMutationVariables['input']): Promise<void> {
    const vars: UpdateTicketMutationVariables = { id, input };
    await firstValueFrom(
      this.apollo.mutate({
        mutation: UpdateTicketDocument,
        variables: vars,
      }),
    );
    await this.loadFirst();
  }

  async addComment(ticketId: string, body: string): Promise<void> {
    await firstValueFrom(
      this.apollo.mutate({
        mutation: AddCommentDocument,
        variables: { ticketId, body },
      }),
    );
  }

  async getTicket(id: string): Promise<TicketQuery['ticket'] | null> {
    const vars: TicketQueryVariables = { id };
    const res = await firstValueFrom(
      this.apollo.query({
        query: TicketDocument,
        variables: vars,
        fetchPolicy: 'network-only',
      }),
    );
    return res.data?.ticket ?? null;
  }

  async createTicket(input: CreateTicketMutationVariables['input']): Promise<string> {
    const vars: CreateTicketMutationVariables = { input };
    try {
      const res = await firstValueFrom(
        this.apollo.mutate({
          mutation: CreateTicketDocument,
          variables: vars,
        }),
      );
      return res.data?.createTicket.id ?? '';
    } catch (error: unknown) {
      const message = String((error as { message?: string })?.message ?? '');
      const hasTags = Array.isArray(input.tags) && input.tags.length > 0;
      // Backward-compatible path when an older backend schema lacks CreateTicketInput.tags.
      if (hasTags && message.includes('field `tags` does not exist on the type `CreateTicketInput`')) {
        const retryInput = { ...input };
        delete (retryInput as { tags?: string[] }).tags;
        const retry = await firstValueFrom(
          this.apollo.mutate({
            mutation: CreateTicketDocument,
            variables: { input: retryInput },
          }),
        );
        return retry.data?.createTicket.id ?? '';
      }
      throw error;
    }
  }
}
