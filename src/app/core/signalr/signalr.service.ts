import { inject, Injectable, Injector, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { API_CONFIG } from '../tokens/api-config.token';
import { AuthStore } from '../auth/auth.store';
import { LogLevel } from '@microsoft/signalr';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private readonly api = inject(API_CONFIG);
  private readonly injector = inject(Injector);

  private getAuth(): InstanceType<typeof AuthStore> {
    return this.injector.get(AuthStore) as InstanceType<typeof AuthStore>;
  }

  private hub?: signalR.HubConnection;

  private connected = signal(false);
  // Expose a readonly getter for UI diagnostics
  connected$ = {
    get: () => this.connected()
  };

  // Track ticket groups we've joined (for diagnostics only)
  private joinedTickets = new Set<string>();
  joinedTickets$ = {
    get: () => Array.from(this.joinedTickets)
  };
  // Pending ticket joins requested before the hub is ready
  private pendingTicketJoins = new Set<string>();

  // Simple signals for last event payloads — facades can subscribe or we can extend with Subjects
  lastTicketCreated = signal<unknown | null>(null);
  lastTicketUpdated = signal<unknown | null>(null);
  lastTicketAssigned = signal<unknown | null>(null);
  lastCommentAdded = signal<unknown | null>(null);

  constructor() {
    // Defer auto-start/stop checks until after Angular finishes provider initialization.
    // Reading signal store state synchronously in the constructor can trigger circular DI
    // when the store itself is being created during app initialization. Using setTimeout(0)
    // schedules the checks for the next macrotask, avoiding that problem.
    setTimeout(() => {
      (async () => {
        // initial state (best-effort)
        try {
          const auth = this.getAuth();
          if (auth.isAuthenticated() && auth.tenant()?.id) {
            await this.start();
          }
        } catch {
          // best-effort
        }

        // Periodically reconcile auth state and SignalR connection.
        void setInterval(async () => {
          try {
            const auth = this.getAuth();
            if (auth.isAuthenticated() && auth.tenant()?.id) {
              if (!this.hub) await this.start();
            } else {
              if (this.hub) await this.stop();
            }
          } catch {
            // ignore
          }
        }, 1000);
      })();
    }, 0);
  }

  private buildConnection(accessToken: string | null) {
    // Prefer restUrl/graphqlUrl/wsUrl but ensure the backend hubs path (/hubs)
    // is used rather than nesting under /api. If the configured base ends
    // with '/api' (common in this project), strip that segment so the
    // negotiated path becomes '/hubs/tickets' which matches the server map.
    const configured = (this.api?.restUrl ?? this.api?.graphqlUrl ?? '').replace(/\/$/, '');
    const base = configured.replace(/\/api(?=$|\/)/i, '');
    const hubUrl = base ? `${base}/hubs/tickets` : '/hubs/tickets';
    return new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: async () => accessToken ?? '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();
  }
  // Start SignalR connection with an optional timeout (ms). Throws on failure/timeout.
  async start(timeoutMs = 5000): Promise<void> {
    if (this.hub) return;
    const auth = this.getAuth();
    const access = auth.accessToken();
    this.hub = this.buildConnection(access);

    // Wire handlers early so incoming events during start are handled.
    this.hub.on('TicketCreated', (payload: unknown) => this.lastTicketCreated.set(payload));
    this.hub.on('TicketUpdated', (payload: unknown) => this.lastTicketUpdated.set(payload));
    this.hub.on('TicketAssigned', (payload: unknown) => this.lastTicketAssigned.set(payload));
    this.hub.on('CommentAdded', (payload: unknown) => this.lastCommentAdded.set(payload));

    console.debug(
      '[SignalR] starting connection to',
      (this.api?.restUrl ?? this.api?.graphqlUrl ?? '').replace(/\/$/, '')
    );

    const startPromise = (async () => {
      await this.hub!.start();
    })();

    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('SignalR start timeout')), timeoutMs)
    );

    try {
      await Promise.race([startPromise, timeoutPromise]);
      this.connected.set(true);
      console.info('[SignalR] connected');
    } catch (err) {
      console.warn('[SignalR] failed to start connection', err);
      // Ensure hub is cleared so callers can retry later
      this.hub = undefined;
      this.connected.set(false);
      throw err;
    }

    // Connection closed handler: clear hub so reconnection logic can attempt restart
    this.hub.onclose(err => {
      console.warn('[SignalR] connection closed', err?.message ?? err);
      if (err) console.error(err);
      this.hub = undefined;
      this.connected.set(false);
    });

    // Join tenant group if available
    const tenant = auth.tenant();
    if (tenant?.id) {
      try {
        await this.hub.invoke('JoinTenant', tenant.id);
        console.debug('[SignalR] joined tenant group', tenant.id);
      } catch (err) {
        console.warn('[SignalR] failed to join tenant group', tenant.id, err);
      }
    }

    // Process any pending ticket joins requested before the hub was ready
    if (this.pendingTicketJoins.size > 0) {
      for (const tId of Array.from(this.pendingTicketJoins)) {
        try {
          await this.hub.invoke('JoinTicket', tId);
          console.debug('[SignalR] processed pending join for', tId);
          this.pendingTicketJoins.delete(tId);
          this.joinedTickets.add(tId);
        } catch (err) {
          console.warn('[SignalR] failed pending join for', tId, err);
        }
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.hub) return;
    try {
      await this.hub.stop();
    } finally {
      this.hub = undefined;
      this.connected.set(false);
    }
  }

  // Join a specific ticket group to receive ticket-level events
  async joinTicket(ticketId: string): Promise<void> {
    console.debug('[SignalR] joinTicket', ticketId);
    // If hub isn't available or not yet connected, enqueue the join and try to start
    if (!this.hub || !(await this.waitForConnected(50))) {
      this.pendingTicketJoins.add(ticketId);
      try {
        await this.start(3000).catch(() => {});
      } catch {
        // ignore — the pending set will be processed later when/if connection becomes ready
      }
      return;
    }

    // Hub is present and connected; invoke immediately
    try {
      await this.hub.invoke('JoinTicket', ticketId);
      console.debug('[SignalR] joined ticket group', ticketId);
      this.joinedTickets.add(ticketId);
    } catch (err) {
      console.warn('[SignalR] failed to join ticket group', ticketId, err);
      // If invoke fails while connected, add to pending so retry logic can process later
      this.pendingTicketJoins.add(ticketId);
    }
  }

  async leaveTicket(ticketId: string): Promise<void> {
    console.debug('[SignalR] leaveTicket', ticketId);
    try {
      // Remove from pending set (if it was queued)
      if (this.pendingTicketJoins.has(ticketId)) this.pendingTicketJoins.delete(ticketId);
      if (this.joinedTickets.has(ticketId)) this.joinedTickets.delete(ticketId);

      if (!this.hub) {
        // nothing else to do
        return;
      }

      const ready = await this.waitForConnected(1000);
      if (!ready) {
        console.debug('[SignalR] hub not connected when leaving ticket, skipping invoke', ticketId);
        return;
      }

      await this.hub.invoke('LeaveTicket', ticketId);
      this.joinedTickets.delete(ticketId);
      console.debug('[SignalR] left ticket group', ticketId);
    } catch (err) {
      console.warn('[SignalR] failed to leave ticket group', ticketId, err);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitForConnected(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (this.connected && this.connected()) return true;
      } catch {
        // ignore
      }
      // also check underlying hub state as a fallback
      try {
        if (this.hub && this.hub.state === signalR.HubConnectionState?.Connected) return true;
      } catch {
        // ignore
      }
      await this.sleep(100);
    }
    return false;
  }
}
