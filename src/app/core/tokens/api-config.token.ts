import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  graphqlUrl: string;
  restUrl: string;
  wsUrl: string;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');
