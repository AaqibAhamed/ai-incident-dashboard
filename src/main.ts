/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';
import { enableProdMode } from '@angular/core';

async function enableMocking(): Promise<void> {
  if (!environment.useMocks) {
    return;
  }
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' }
  });
}

if (environment.production) {
  enableProdMode();
}

void enableMocking().then(() => {
  void bootstrapApplication(AppComponent, appConfig);
});
