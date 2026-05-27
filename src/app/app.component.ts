import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';
import { SignalRDebugComponent } from './core/signalr/signalr-debug.component';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SignalRDebugComponent, NgIf],
  template: `
    <router-outlet />
    <app-signalr-debug *ngIf="!env.production"></app-signalr-debug>
  `
})
export class AppComponent {
  readonly env = environment;
}
