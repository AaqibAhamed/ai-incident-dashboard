import { http, HttpResponse } from 'msw';
import type { Ticket, UserRole } from '../graphql/generated/graphql';
import { ALL_TICKETS, metricsFor, MOCK_USERS } from './fixtures/seed';

let ticketDb: Ticket[] = JSON.parse(JSON.stringify(ALL_TICKETS)) as Ticket[];

const encodeCursor = (i: number): string => btoa(`c:${i}`);
const decodeCursor = (c: string | null | undefined): number => {
  if (!c) return -1;
  try {
    const s = atob(c);
    const m = /^c:(\d+)$/.exec(s);
    return m ? parseInt(m[1]!, 10) : -1;
  } catch {
    return -1;
  }
};

function filterList(filter: Record<string, unknown> | undefined | null): Ticket[] {
  let list = [...ticketDb];
  if (!filter) return list;
  const status = filter['status'] as string[] | undefined;
  const priority = filter['priority'] as string[] | undefined;
  const assigneeId = filter['assigneeId'] as string | undefined;
  const tags = filter['tags'] as string[] | undefined;
  const slaBreaching = filter['slaBreaching'] as boolean | undefined;
  const search = (filter['search'] as string | undefined)?.toLowerCase().trim();
  if (status?.length) list = list.filter((t) => status.includes(t.status));
  if (priority?.length) list = list.filter((t) => priority.includes(t.priority));
  if (assigneeId) list = list.filter((t) => t.assigneeId === assigneeId);
  if (tags?.length) list = list.filter((t) => tags.some((tag) => t.tags.includes(tag)));
  if (slaBreaching) list = list.filter((t) => t.slaBreached);
  if (search) {
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search),
    );
  }
  return list;
}

function listNode(t: Ticket) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    slaBreached: t.slaBreached,
    slaDueAt: t.slaDueAt,
    tags: t.tags,
    updatedAt: t.updatedAt,
    assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
    team: t.team ? { id: t.team.id, name: t.team.name } : null,
  };
}

export const handlers = [
  http.post('/graphql', async ({ request }) => {
    const body = (await request.json()) as {
      operationName?: string;
      variables?: Record<string, unknown>;
    };
    const op = body.operationName;
    const v = body.variables ?? {};

    switch (op) {
      case 'Tickets': {
        const filtered = filterList(v['filter'] as Record<string, unknown> | null);
        const after = v['after'] as string | null | undefined;
        const first = (v['first'] as number) ?? 15;
        const start = decodeCursor(after) + 1;
        const slice = filtered.slice(start, start + first);
        const edges = slice.map((node, i) => ({
          cursor: encodeCursor(start + i),
          node: listNode(node),
        }));
        const hasNext = start + first < filtered.length;
        const endCursor = edges.length ? edges[edges.length - 1]!.cursor : null;
        return HttpResponse.json({
          data: { tickets: { edges, pageInfo: { endCursor, hasNextPage: hasNext } } },
        });
      }
      case 'Ticket': {
        const id = v['id'] as string;
        const t = ticketDb.find((x) => x.id === id) ?? null;
        return HttpResponse.json({ data: { ticket: t } });
      }
      case 'DashboardMetrics': {
        const range = v['range'] as string;
        return HttpResponse.json({ data: { dashboardMetrics: metricsFor(range) } });
      }
      case 'UpdateTicket': {
        const id = v['id'] as string;
        const input = v['input'] as Record<string, unknown>;
        const t = ticketDb.find((x) => x.id === id);
        if (!t) {
          return HttpResponse.json({ errors: [{ message: 'Not found' }] }, { status: 200 });
        }
        if (input['status']) t.status = input['status'] as Ticket['status'];
        if (input['priority']) t.priority = input['priority'] as Ticket['priority'];
        if (typeof input['title'] === 'string') t.title = input['title'];
        if (typeof input['description'] === 'string') t.description = input['description'];
        if (typeof input['category'] === 'string') t.category = input['category'];
        if (Array.isArray(input['tags'])) t.tags = input['tags'] as string[];
        t.updatedAt = new Date().toISOString();
        return HttpResponse.json({
          data: {
            updateTicket: {
              id: t.id,
              title: t.title,
              description: t.description,
              category: t.category,
              tags: t.tags,
              status: t.status,
              priority: t.priority,
              updatedAt: t.updatedAt,
            },
          },
        });
      }
      case 'DeleteTicket': {
        const id = v['id'] as string;
        const before = ticketDb.length;
        ticketDb = ticketDb.filter((x) => x.id !== id);
        return HttpResponse.json({ data: { deleteTicket: before !== ticketDb.length } });
      }
      case 'AssignTicket': {
        const id = v['id'] as string;
        const assigneeId = v['assigneeId'] as string;
        const t = ticketDb.find((x) => x.id === id);
        const user = MOCK_USERS.find((u) => u.id === assigneeId) ?? MOCK_USERS[0];
        if (t) {
          t.assigneeId = assigneeId;
          t.assignee = user ?? null;
          t.updatedAt = new Date().toISOString();
        }
        return HttpResponse.json({
          data: {
            assignTicket: {
              id,
              assigneeId,
              assignee: user ? { id: user.id, name: user.name } : null,
            },
          },
        });
      }
      case 'AddComment': {
        const ticketId = v['ticketId'] as string;
        const bodyText = v['body'] as string;
        const t = ticketDb.find((x) => x.id === ticketId);
        const c = {
          __typename: 'Comment' as const,
          id: `c-${Date.now()}`,
          ticketId,
          authorId: 'u-agent',
          author: MOCK_USERS[0] ?? null,
          body: bodyText,
          createdAt: new Date().toISOString(),
        };
        if (t) {
          t.comments = [...t.comments, c];
          t.updatedAt = new Date().toISOString();
        }
        return HttpResponse.json({ data: { addComment: c } });
      }
      case 'CreateTicket': {
        const input = v['input'] as {
          title: string;
          description: string;
          priority: Ticket['priority'];
          category: string;
        };
        const id = `t-${ticketDb.length + 1}`;
        const nt = JSON.parse(JSON.stringify(ALL_TICKETS[0])) as Ticket;
        nt.id = id;
        nt.title = input.title;
        nt.description = input.description;
        nt.priority = input.priority;
        nt.category = input.category;
        nt.status = 'OPEN';
        nt.createdAt = new Date().toISOString();
        nt.updatedAt = nt.createdAt;
        ticketDb = [nt, ...ticketDb];
        return HttpResponse.json({
          data: { createTicket: { id, title: nt.title, status: nt.status, priority: nt.priority } },
        });
      }
      default:
        return HttpResponse.json(
          { errors: [{ message: `Unknown operation ${op ?? ''}` }] },
          { status: 200 },
        );
    }
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string; role: UserRole };
    const template = MOCK_USERS.find((u) => u.role === body.role) ?? MOCK_USERS[0]!;
    const user = {
      id: template.id,
      name: template.name,
      email: body.email || template.email,
      role: body.role,
    };
    return HttpResponse.json({
      accessToken: `mock.${body.role.toLowerCase()}.token`,
      refreshToken: 'mock-refresh',
      user,
    });
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    const body = (await request.json()) as { refreshToken: string };
    void body;
    return HttpResponse.json({
      accessToken: 'mock.refreshed',
      refreshToken: 'mock-refresh',
      user: MOCK_USERS[0],
    });
  }),

  http.post('/api/upload', async () =>
    HttpResponse.json({ id: `file-${Date.now()}`, url: '/api/files/upload.bin' }),
  ),

  http.post('/api/ai/summary', async () =>
    HttpResponse.json({
      problem: 'Connectivity / authentication issue affecting remote access.',
      impact: 'Users cannot reach internal apps via VPN.',
      nextSteps: 'Verify gateway logs, reset MFA device, and confirm WiFi captive portal bypass.',
    }),
  ),

  http.post('/api/ai/reply', async () =>
    HttpResponse.json({
      draft:
        'Thanks for the details. Could you confirm whether this happens only on office WiFi and whether other devices show the same behavior?',
    }),
  ),

  http.post('/api/ai/form-assist', async ({ request }) => {
    const body = (await request.json()) as { text: string };
    const t = body.text.toLowerCase();
    return HttpResponse.json({
      title: t.includes('vpn') ? 'VPN connectivity issue' : 'General IT request',
      category: t.includes('vpn') ? 'Network' : 'General',
      priority: t.includes('down') || t.includes('not working') ? 'P2' : 'P3',
    });
  }),

  http.post('/api/ai/health-report', async () =>
    HttpResponse.json({
      summary:
        'Overall queue health is stable: SLA risk concentrated in P1 VPN tickets. Recommend staffing Network on-call and publishing a WiFi/VPN FAQ.',
    }),
  ),

  http.get('/api/validate-asset', ({ request }) => {
    const url = new URL(request.url);
    const tag = url.searchParams.get('assetTag') ?? '';
    if (tag.length < 4) {
      return HttpResponse.json({ valid: false, message: 'Asset tag too short' }, { status: 400 });
    }
    return HttpResponse.json({ valid: true, assetId: `AST-${tag.toUpperCase()}` });
  }),
];
