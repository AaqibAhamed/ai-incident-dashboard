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
      this.lastTicketCreated.set(payload);
    });

    this.hub.on('TicketUpdated', payload => {
      this.lastTicketUpdated.set(payload);
    });

    this.hub.on('TicketAssigned', payload => {
      this.lastTicketAssigned.set(payload);
    });

    this.hub.on('CommentAdded', payload => {
      this.lastCommentAdded.set(payload);
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
        await this.hub.invoke('JoinTenant', tenant.id);

        console.debug('[SignalR] joined tenant group', tenant.id);
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
