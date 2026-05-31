import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApolloTestingModule, ApolloTestingController } from 'apollo-angular/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_CONFIG } from '../../../core/tokens/api-config.token';
import { DOCUMENT } from '@angular/common';
import { TicketFiltersStore } from './ticket-filters.store';
import { TicketsFacade } from './tickets.facade';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

describe('TicketsFacade (ApolloTesting)', () => {
  beforeEach(() => {
    // Initialize the Angular testing environment if needed. No-op if already initialized.
    try {
      TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    } catch {
      // already initialized — ignore
    }

    TestBed.configureTestingModule({
      providers: [
        importProvidersFrom(ApolloTestingModule),
        TicketsFacade,
        TicketFiltersStore,
        { provide: API_CONFIG, useValue: { graphqlUrl: '/g', restUrl: '/api', wsUrl: '/g' } },
        { provide: DOCUMENT, useValue: { location: { href: 'http://localhost' } } }
      ]
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
                team: null
              }
            }
          ],
          pageInfo: { endCursor: 'c:0', hasNextPage: false }
        }
      }
    });
    await done;
    expect(facade.items().length).toBe(1);
    expect(facade.items()[0]!.title).toBe('Test');
    backend.verify();
  });
});

// Recreate the normalization/merge logic from the facade in a pure-TS test
type Assignee = { id: string | null; name: string | null } | null;
type TicketListNode = { id: string; status: string; updatedAt: string; assignee?: Assignee };
type TicketAssignedEvent = {
  BroadcastId?: string;
  TenantId: string;
  TicketId: string;
  AssigneeId?: string | null;
  AssigneeName?: string | null;
  // Backend may include updatedAt or Ticket with updatedAt
  updatedAt?: string | null;
  UpdatedAt?: string | null;
  Ticket?: { updatedAt?: string | null } | null;
};

const STATUS_MAP = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

function normalizeStatus(v: unknown, fallback: string): string {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Number(v);
    return (STATUS_MAP[n] ?? fallback) as string;
  }
  if (typeof v === 'string' && v) return v;
  return fallback;
}

function mergeTicketUpdated(
  node: TicketListNode,
  incoming: Partial<TicketListNode> & { assigneeId?: string | null; assigneeName?: string | null }
): TicketListNode {
  const inc = incoming ?? {};
  const patched: TicketListNode = {
    ...node,
    status: normalizeStatus(inc.status ?? node.status, node.status),
    updatedAt: inc.updatedAt ?? node.updatedAt,
    assignee:
      inc.assignee ??
      ((inc.assigneeId ?? inc.assigneeName)
        ? { id: inc.assigneeId ?? node.assignee?.id ?? null, name: inc.assigneeName ?? node.assignee?.name ?? null }
        : node.assignee)
  };
  return patched;
}

function mergeTicketAssigned(node: TicketListNode, ev: TicketAssignedEvent): TicketListNode {
  const serverUpdatedAt = ev.updatedAt ?? ev.UpdatedAt ?? ev.Ticket?.updatedAt;
  const updatedAt = serverUpdatedAt ?? new Date().toISOString();
  const assigneeId = ev.AssigneeId ?? ev.AssigneeId ?? null;
  const assigneeName = ev.AssigneeName ?? ev.AssigneeName ?? null;
  const hasAssigneeInfo = assigneeId != null || assigneeName != null;
  const nextAssignee = hasAssigneeInfo
    ? { id: assigneeId ?? node.assignee?.id ?? null, name: assigneeName ?? node.assignee?.name ?? null }
    : (node.assignee ?? null);
  return { ...node, assignee: nextAssignee, updatedAt };
}

describe('tickets facade merge helpers', () => {
  let base: TicketListNode;
  beforeEach(() => {
    base = { id: 't-1', status: 'OPEN', updatedAt: new Date().toISOString(), assignee: { id: 'u-1', name: 'Alice' } };
  });

  it('normalize numeric status and preserve assignee on TicketUpdated', () => {
    const incoming = { id: 't-1', status: 2 } as unknown as Partial<TicketListNode> & {
      assigneeId?: string | null;
      assigneeName?: string | null;
    };
    const patched = mergeTicketUpdated(base, incoming);
    expect(patched.status).toBe('RESOLVED');
    expect(patched.assignee?.name).toBe('Alice');
  });

  it('TicketAssigned updates updatedAt and preserves existing assignee when payload lacks assignee info', () => {
    const oldUpdatedAt = base.updatedAt;
    const ev = {
      BroadcastId: 'b-2',
      TenantId: 'tenant-1',
      TicketId: 't-1',
      UpdatedAt: new Date(Date.now() + 1000).toISOString()
    };
    const patched = mergeTicketAssigned(base, ev);
    expect(patched.assignee?.name).toBe('Alice');
    expect(patched.updatedAt).not.toBe(oldUpdatedAt);
  });
});
