import { inject } from '@angular/core';
import { ApolloLink, CombinedGraphQLErrors, InMemoryCache } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { HttpLink } from 'apollo-angular/http';
import { API_CONFIG } from '../tokens/api-config.token';

export function apolloOptionsFactory() {
  const httpLink = inject(HttpLink);
  const api = inject(API_CONFIG);

  const errorLink = onError(({ error }) => {
    if (CombinedGraphQLErrors.is(error)) {
      for (const e of error.errors) {
        console.error(`[GraphQL] ${e.message}`);
      }
    } else if (error) {
      console.error('[GraphQL]', error.message);
    }
  });

  const link = ApolloLink.from([
    errorLink,
    httpLink.create({
      uri: api.graphqlUrl,
    }),
  ]);

  return {
    link,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            tickets: {
              keyArgs: ['filter'],
            },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network' as const },
      query: { fetchPolicy: 'network-only' as const },
      mutate: { errorPolicy: 'all' as const },
    },
  };
}
