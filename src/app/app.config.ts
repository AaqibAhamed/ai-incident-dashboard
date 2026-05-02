import { isPlatformBrowser } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  mergeApplicationConfig,
  provideZonelessChangeDetection,
  PLATFORM_ID,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import {
  provideRouter,
  PreloadAllModules,
  withComponentInputBinding,
  withPreloading,
  withRouterConfig,
} from '@angular/router';
import { provideApollo } from 'apollo-angular';
import { AuthStore } from './core/auth/auth.store';
import { GlobalErrorHandler } from './core/error/global-error.handler';
import { apolloOptionsFactory } from './core/graphql/apollo.provider';
import { authInterceptor } from './core/http/interceptors/auth.interceptor';
import { errorInterceptor } from './core/http/interceptors/error.interceptor';
import { loadingInterceptor } from './core/http/interceptors/loading.interceptor';
import { API_CONFIG } from './core/tokens/api-config.token';
import { FEATURE_FLAGS } from './core/tokens/feature-flags.token';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

/** Shared between browser and server — no animations, no hydration */
export const appBaseConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withComponentInputBinding(),
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, loadingInterceptor, errorInterceptor]),
    ),
    provideApollo(apolloOptionsFactory),
    {
      provide: API_CONFIG,
      useValue: {
        graphqlUrl: environment.graphqlUrl,
        restUrl: environment.restUrl,
        wsUrl: environment.wsUrl,
      },
    },
    { provide: FEATURE_FLAGS, useValue: environment.featureFlags },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const auth = inject(AuthStore);
        const platformId = inject(PLATFORM_ID);
        return () => {
          if (isPlatformBrowser(platformId)) {
            auth.restoreFromStorage();
          }
        };
      },
    },
  ],
};

/** Browser-only: Material animations + hydration */
export const appConfig: ApplicationConfig = mergeApplicationConfig(appBaseConfig, {
  providers: [provideAnimationsAsync(), provideClientHydration(withEventReplay())],
});
