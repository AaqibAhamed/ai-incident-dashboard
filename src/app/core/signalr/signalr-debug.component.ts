import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { SignalRService } from './signalr.service';

@Component({
  selector: 'app-signalr-debug',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      style="position:fixed;right:1rem;bottom:1rem;padding:0.4rem 0.6rem;border-radius:6px;background:rgba(0,0,0,0.7);color:#fff;font-size:12px;z-index:10000"
    >
      <div style="display:flex;gap:0.6rem;align-items:center">
        <span [title]="joinedText()">⚡</span>

        <div>
          <div>
            SignalR:
            <strong>{{ connectedText() }}</strong>
          </div>

          <div style="opacity:0.9">Joined: {{ ticketsText() }}</div>
        </div>
      </div>
    </div>
  `
})
export class SignalRDebugComponent {
  private readonly svc = inject(SignalRService);

  readonly connectedText = computed(() => (this.svc.connected() ? 'connected' : 'disconnected'));

  readonly ticketsText = computed(() => {
    const tickets = this.svc.joinedTickets();

    return tickets.length ? tickets.join(', ') : '(none)';
  });

  readonly joinedText = computed(() => {
    const tickets = this.svc.joinedTickets();

    return tickets.length ? `Joined tickets: ${tickets.join(', ')}` : 'No joined tickets';
  });
}
