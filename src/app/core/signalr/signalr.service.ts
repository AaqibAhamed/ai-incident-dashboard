import { inject, Injectable, Injector, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { LogLevel } from '@microsoft/signalr';

import { API_CONFIG } from '../tokens/api-config.token';
import { AuthStore } from '../auth/auth.store';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private readonly api = inject(API_CONFIG);
  private readonly injector = inject(Injector);

  private getAuth(): InstanceType<typeof AuthStore> {
    return this.injector.get(AuthStore) as InstanceType<typeof AuthStore>;
  }

  private hub?: signalR.HubConnection;

  // --------------------------------------------------------------------------
  // Connection State
  // --------------------------------------------------------------------------

  private readonly connectedSignal = signal(false);

  readonly connected = this.connectedSignal.asReadonly();

  // --------------------------------------------------------------------------
  // Joined Ticket Groups
  // --------------------------------------------------------------------------

  private readonly joinedTicketsSignal = signal<string[]>([]);

  readonly joinedTickets = this.joinedTicketsSignal.asReadonly();

  // Used when joinTicket() is called before connection is ready
  private readonly pendingTicketJoins = new Set<string>();

  // --------------------------------------------------------------------------
  // Realtime Event Signals
  // --------------------------------------------------------------------------

  readonly lastTicketCreated = signal<unknown | null>(null);

  readonly lastTicketUpdated = signal<unknown | null>(null);

  readonly lastTicketAssigned = signal<unknown | null>(null);

  readonly lastCommentAdded = signal<unknown | null>(null);

  // Dedupe using explicit BroadcastId sent by the server. Share seen IDs across
  // tabs using BroadcastChannel for cross-tab dedupe.
  private readonly seenBroadcasts = new Map<string, number>();
  private readonly broadcastTtlMs = 30_000; // keep seen ids for 30s
  private readonly bc: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('aid-broadcasts') : null;

  constructor() {
    // Listen for cross-tab broadcast id announcements
    if (this.bc) {
      this.bc.onmessage = (ev: MessageEvent) => {
        const id = ev.data as string | undefined;
        if (id) {
          this.seenBroadcasts.set(id, Date.now());
        }
      };
    }
  }

  private seenBroadcast(broadcastId: string): boolean {
    if (!broadcastId) return false;
    const now = Date.now();
    const seenAt = this.seenBroadcasts.get(broadcastId);
    if (seenAt && now - seenAt < this.broadcastTtlMs) return true;
    // mark seen and announce to other tabs
    this.seenBroadcasts.set(broadcastId, now);
    try {
      this.bc?.postMessage(broadcastId);
    } catch {
      // best-effort
    }
    return false;
  }

  private cleanupOldBroadcasts(): void {
    const now = Date.now();
    for (const [k, ts] of Array.from(this.seenBroadcasts.entries())) {
      if (now - ts > this.broadcastTtlMs * 2) {
        this.seenBroadcasts.delete(k);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Connection Builder
  // --------------------------------------------------------------------------

  private buildConnection(accessToken: string | null): signalR.HubConnection {
    const configured = (this.api?.restUrl ?? this.api?.graphqlUrl ?? '').replace(/\/$/, '');

    const base = configured.replace(/\/api(?=$|\/)/i, '');

    const hubUrl = base ? `${base}/hubs/tickets` : '/hubs/tickets';

    return new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => accessToken ?? ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();
  }

  // --------------------------------------------------------------------------
  // Start Connection
  // --------------------------------------------------------------------------

  async start(): Promise<void> {
    // Prevent duplicate connections
    if (this.hub?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    // Prevent parallel start attempts
    if (
      this.hub?.state === signalR.HubConnectionState.Connecting ||
      this.hub?.state === signalR.HubConnectionState.Reconnecting
    ) {
      return;
    }

    const auth = this.getAuth();

    const accessToken = auth.accessToken();

    if (!accessToken) {
      console.warn('[SignalR] no access token available');
      return;
    }

    this.hub = this.buildConnection(accessToken);

    // ----------------------------------------------------------------------
    // Event Handlers
    // ----------------------------------------------------------------------

    this.hub.on('TicketCreated', payload => {
      const broadcastId = payload?.BroadcastId ?? payload?.broadcastId ?? null;
      if (broadcastId && this.seenBroadcast(broadcastId)) return;
      const normalized = {
        BroadcastId: broadcastId,
        TenantId: payload?.TenantId ?? payload?.tenantId ?? null,
        Ticket: payload?.Ticket ?? payload?.ticket ?? null
      };
      console.debug('[SignalR] received TicketCreated payload:', normalized);
      this.lastTicketCreated.set(normalized);
    });

    this.hub.on('TicketUpdated', payload => {
      const broadcastId = payload?.BroadcastId ?? payload?.broadcastId ?? null;
      if (broadcastId && this.seenBroadcast(broadcastId)) return;
      const normalized = {
        BroadcastId: broadcastId,
        TenantId: payload?.TenantId ?? payload?.tenantId ?? null,
        Ticket: payload?.Ticket ?? payload?.ticket ?? null
      };
      console.debug('[SignalR] received TicketUpdated payload:', normalized);
      this.lastTicketUpdated.set(normalized);
    });

    this.hub.on('TicketAssigned', payload => {
      const broadcastId = payload?.BroadcastId ?? payload?.broadcastId ?? null;
      if (broadcastId && this.seenBroadcast(broadcastId)) return;
      const assigneeId =
        payload?.AssigneeId ?? payload?.assigneeId ?? payload?.Assignee?.id ?? payload?.Assignee?.Id ?? null;
      const assigneeName =
        payload?.AssigneeName ?? payload?.assigneeName ?? payload?.Assignee?.name ?? payload?.Assignee?.Name ?? null;
      const updatedAt = payload?.UpdatedAt ?? payload?.updatedAt ?? payload?.Ticket?.updatedAt ?? null;

      const normalized = {
        BroadcastId: broadcastId,
        TenantId: payload?.TenantId ?? payload?.tenantId ?? null,
        TicketId: payload?.TicketId ?? payload?.ticketId ?? payload?.ticket?.id ?? null,
        AssigneeId: assigneeId,
        AssigneeName: assigneeName,
        Assignee: assigneeId || assigneeName ? { id: assigneeId, name: assigneeName } : null,
        UpdatedAt: updatedAt
      };
      console.debug('[SignalR] received TicketAssigned payload:', normalized);
      this.lastTicketAssigned.set(normalized);
    });

    this.hub.on('CommentAdded', payload => {
      const broadcastId = payload?.BroadcastId ?? payload?.broadcastId ?? null;
      if (broadcastId && this.seenBroadcast(broadcastId)) return;
      const normalized = {
        BroadcastId: broadcastId,
        TenantId: payload?.TenantId ?? payload?.tenantId ?? null,
        TicketId: payload?.TicketId ?? payload?.ticketId ?? payload?.comment?.ticketId ?? null,
        Comment: payload?.Comment ?? payload?.comment ?? null
      };
      console.debug('[SignalR] received CommentAdded payload:', normalized);
      this.lastCommentAdded.set(normalized);
    });

    // ----------------------------------------------------------------------
    // Reconnect Lifecycle
    // ----------------------------------------------------------------------

    this.hub.onreconnecting(error => {
      console.warn('[SignalR] reconnecting...', error);

      this.connectedSignal.set(false);
    });

    this.hub.onreconnected(async connectionId => {
      console.info('[SignalR] reconnected', connectionId);

      this.connectedSignal.set(true);

      await this.rejoinGroups();
    });

    this.hub.onclose(error => {
      console.warn('[SignalR] connection closed', error);

      this.connectedSignal.set(false);

      this.hub = undefined;
    });

    // ----------------------------------------------------------------------
    // Start Hub
    // ----------------------------------------------------------------------

    try {
      console.debug('[SignalR] starting connection');

      await this.hub.start();

      this.connectedSignal.set(true);

      console.info('[SignalR] connected');

      // Join tenant group automatically
      const tenant = auth.tenant();

      if (tenant?.id) {
        try {
          await this.hub.invoke('JoinTenant', tenant.id);

          console.debug('[SignalR] joined tenant group', tenant.id);
        } catch (err) {
          console.warn('[SignalR] failed to join tenant group', tenant.id, err);
        }
      }

      // Process queued joins
      await this.rejoinGroups();
    } catch (error) {
      console.error('[SignalR] failed to start', error);

      this.connectedSignal.set(false);

      this.hub = undefined;

      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Stop Connection
  // --------------------------------------------------------------------------

  async stop(): Promise<void> {
    if (!this.hub) {
      return;
    }

    try {
      await this.hub.stop();
    } finally {
      this.connectedSignal.set(false);

      this.hub = undefined;

      this.joinedTicketsSignal.set([]);

      this.pendingTicketJoins.clear();
    }
  }

  // --------------------------------------------------------------------------
  // Join Ticket Group
  // --------------------------------------------------------------------------

  async joinTicket(ticketId: string): Promise<void> {
    if (!ticketId) {
      return;
    }

    // Prevent duplicates
    if (this.joinedTickets().includes(ticketId)) {
      return;
    }

    // Queue if not connected yet
    if (!this.hub || this.hub.state !== signalR.HubConnectionState.Connected) {
      console.debug('[SignalR] queueing ticket join', ticketId);

      this.pendingTicketJoins.add(ticketId);

      return;
    }

    try {
      await this.hub.invoke('JoinTicket', ticketId);

      this.joinedTicketsSignal.update(tickets => (tickets.includes(ticketId) ? tickets : [...tickets, ticketId]));

      console.debug('[SignalR] joined ticket group', ticketId);
    } catch (error) {
      console.warn('[SignalR] failed to join ticket group', ticketId, error);

      this.pendingTicketJoins.add(ticketId);
    }
  }

  // --------------------------------------------------------------------------
  // Leave Ticket Group
  // --------------------------------------------------------------------------

  async leaveTicket(ticketId: string): Promise<void> {
    if (!ticketId) {
      return;
    }

    this.pendingTicketJoins.delete(ticketId);

    this.joinedTicketsSignal.update(tickets => tickets.filter(t => t !== ticketId));

    if (!this.hub || this.hub.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    try {
      await this.hub.invoke('LeaveTicket', ticketId);

      console.debug('[SignalR] left ticket group', ticketId);
    } catch (error) {
      console.warn('[SignalR] failed to leave ticket group', ticketId, error);
    }
  }

  // --------------------------------------------------------------------------
  // Rejoin Groups After Reconnect
  // --------------------------------------------------------------------------

  private async rejoinGroups(): Promise<void> {
    if (!this.hub || this.hub.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    const ticketIds = [...this.joinedTickets(), ...Array.from(this.pendingTicketJoins)];

    const uniqueTicketIds = [...new Set(ticketIds)];

    for (const ticketId of uniqueTicketIds) {
      console.debug('[SignalR] rejoinGroups attempting join for', ticketId);
      try {
        await this.hub.invoke('JoinTicket', ticketId);

        this.joinedTicketsSignal.update(tickets => (tickets.includes(ticketId) ? tickets : [...tickets, ticketId]));

        this.pendingTicketJoins.delete(ticketId);

        console.debug('[SignalR] rejoined ticket group', ticketId);
      } catch (error) {
        console.warn('[SignalR] failed to rejoin ticket group', ticketId, error);
      }
    }
  }
}
