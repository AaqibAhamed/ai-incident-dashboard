import { InjectionToken } from '@angular/core';

export interface FeatureFlags {
  aiSummary: boolean;
  aiReply: boolean;
  aiFormAssist: boolean;
  aiHealth: boolean;
  graphqlSubscriptions: boolean;
}

export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>('FEATURE_FLAGS');
