import type { FeatureFlags } from '../app/core/tokens/feature-flags.token';

export const environment = {
  production: false,
  graphqlUrl: '/graphql',
  restUrl: '/api',
  wsUrl: 'ws://localhost:4200/graphql',
  useMocks: true,
  featureFlags: {
    aiSummary: true,
    aiReply: true,
    aiFormAssist: true,
    aiHealth: true,
    graphqlSubscriptions: false,
  } satisfies FeatureFlags,
};
