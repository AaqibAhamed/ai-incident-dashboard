import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApolloTestingModule, ApolloTestingController } from 'apollo-angular/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TicketFiltersStore } from './ticket-filters.store';
import { TicketsFacade } from './tickets.facade';

describe('TicketsFacade (ApolloTesting)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [importProvidersFrom(ApolloTestingModule), TicketsFacade, TicketFiltersStore],
    });
  });

  it('loadFirst maps tickets connection', async () => {
    const backend = TestBed.inject(ApolloTestingController);
    const facade = TestBed.inject(TicketsFacade);
    const done = facade.loadFirst();
    const op = backend.expectOne('Tickets');
    op.flush({
      data: {
        tickets: {
          edges: [
            {
              cursor: 'c:0',
              node: {
                id: 't-1',
                title: 'Test',
                status: 'OPEN',
                priority: 'P2',
                slaBreached: false,
                slaDueAt: null,
                tags: [],
                updatedAt: new Date().toISOString(),
                assignee: null,
                team: null,
              },
            },
          ],
          pageInfo: { endCursor: 'c:0', hasNextPage: false },
        },
      },
    });
    await done;
    expect(facade.items().length).toBe(1);
    expect(facade.items()[0]!.title).toBe('Test');
    backend.verify();
  });
});
