import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appBaseConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverOnlyConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideNoopAnimations(),
  ],
};

export const config = mergeApplicationConfig(appBaseConfig, serverOnlyConfig);
