import type {
  Comment,
  DashboardMetrics,
  Ticket,
  TicketStatus,
  User,
  UserRole,
} from '../../graphql/generated/graphql';

export const MOCK_USERS: User[] = [
  {
    __typename: 'User',
    id: 'u-agent',
    name: 'Alex Agent',
    email: 'alex@example.com',
    role: 'AGENT' as UserRole,
  },
  {
    __typename: 'User',
    id: 'u-manager',
    name: 'Morgan Manager',
    email: 'morgan@example.com',
    role: 'MANAGER' as UserRole,
  },
  {
    __typename: 'User',
    id: 'u-requester',
    name: 'Riley Requester',
    email: 'riley@example.com',
    role: 'REQUESTER' as UserRole,
  },
];

const teamNames = ['Network', 'Identity', 'Platform', 'Support'];

function ticket(
  id: string,
  title: string,
  status: TicketStatus,
  priority: 'P1' | 'P2' | 'P3' | 'P4',
  idx: number,
): Ticket {
  const assignee = idx % 3 === 0 ? null : MOCK_USERS[0];
  const slaBreached = priority === 'P1' && status === 'OPEN';
  const teamId = `t${(idx % teamNames.length) + 1}`;
  const created = new Date(Date.now() - idx * 86400000).toISOString();
  const comments: Comment[] = [
    {
      __typename: 'Comment',
      id: `${id}-c1`,
      ticketId: id,
      authorId: 'u-requester',
      author: MOCK_USERS[2],
      body: 'Initial report — seeing errors in VPN client.',
      createdAt: created,
    },
    {
      __typename: 'Comment',
      id: `${id}-c2`,
      ticketId: id,
      authorId: 'u-agent',
      author: MOCK_USERS[0],
      body: 'Thanks — checking gateway logs now.',
      createdAt: new Date(Date.now() - idx * 3600000).toISOString(),
    },
  ];
  return {
    __typename: 'Ticket',
    id,
    title,
    description: `Detailed description for ${title}. Environment: prod. Steps to reproduce documented internally.`,
    status,
    priority,
    assigneeId: assignee?.id ?? null,
    assignee,
    requesterId: 'u-requester',
    requester: MOCK_USERS[2],
    teamId,
    team: { __typename: 'Team', id: teamId, name: teamNames[idx % teamNames.length]! },
    category: idx % 2 === 0 ? 'Incident' : 'Service Request',
    tags: idx % 2 === 0 ? ['vpn', 'wifi'] : ['email', 'mfa'],
    slaDueAt: new Date(Date.now() + (slaBreached ? -3600000 : 48 * 3600000)).toISOString(),
    slaBreached,
    createdAt: created,
    updatedAt: new Date().toISOString(),
    comments,
    history: [
      {
        __typename: 'TicketHistoryEntry',
        id: `${id}-h1`,
        createdAt: created,
        action: 'CREATED',
        details: 'Ticket opened',
      },
      {
        __typename: 'TicketHistoryEntry',
        id: `${id}-h2`,
        createdAt: new Date().toISOString(),
        action: 'COMMENT_ADDED',
        details: null,
      },
    ],
    relatedTicketIds: idx > 1 ? [`t-${idx - 1}`] : [],
    attachments:
      idx % 4 === 0
        ? [
            {
              __typename: 'Attachment',
              id: `${id}-a1`,
              fileName: 'trace.log',
              url: '/api/files/trace.log',
              uploadedAt: created,
            },
          ]
        : [],
  };
}

const titles = [
  'VPN fails on office WiFi',
  'Email sync delays',
  'MFA reset for contractor',
  'Laptop disk warning',
  'API gateway 502 spikes',
  'Jira webhook retries',
  'Printer queue stuck',
  'SSL cert renewal',
  'AD group membership sync',
  'Backup job failure',
  'VPN split tunnel question',
  'Git runner offline',
  'PagerDuty routing wrong team',
  'Snowflake query timeout',
  'Office 365 license reclaim',
  'WiFi captive portal loop',
  'HR system SSO error',
  'Kubernetes node NotReady',
  'Database connection pool exhausted',
  'S3 bucket policy review',
];

export const ALL_TICKETS: Ticket[] = titles.map((title, i) =>
  ticket(
    `t-${i + 1}`,
    title,
    (['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as TicketStatus[])[i % 4]!,
    (['P1', 'P2', 'P3', 'P4'] as const)[i % 4]!,
    i + 1,
  ),
);

export function metricsFor(range: string): DashboardMetrics {
  const open = ALL_TICKETS.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
  const resolved = ALL_TICKETS.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
  const slaBreaches = ALL_TICKETS.filter((t) => t.slaBreached).length;
  const agingOver7d = ALL_TICKETS.filter((t) => {
    const c = new Date(t.createdAt as string).getTime();
    return Date.now() - c > 7 * 86400000 && t.status !== 'CLOSED';
  }).length;
  const byTeam = teamNames.map((name, i) => ({
    __typename: 'TeamWorkload' as const,
    teamId: `t${i + 1}`,
    teamName: name,
    openTickets: ALL_TICKETS.filter((t) => t.team?.name === name && t.status !== 'CLOSED').length,
  }));
  void range;
  return {
    __typename: 'DashboardMetrics',
    openCount: open,
    resolvedCount: resolved,
    slaBreaches,
    agingOver7d,
    byTeam,
  };
}
