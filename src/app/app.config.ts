import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withComponentInputBinding(),
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
    ),
    provideHttpClient(withInterceptors([authInterceptor, loadingInterceptor, errorInterceptor])),
    provideApollo(apolloOptionsFactory),
    { provide: API_CONFIG, useValue: { graphqlUrl: environment.graphqlUrl, restUrl: environment.restUrl, wsUrl: environment.wsUrl } },
    { provide: FEATURE_FLAGS, useValue: environment.featureFlags },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const auth = inject(AuthStore);
        return () => {
          auth.restoreFromStorage();
        };
      },
    },
  ],
};
