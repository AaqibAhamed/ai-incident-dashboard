import { inject } from '@angular/core';
import { ApolloLink, CombinedGraphQLErrors, InMemoryCache } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { HttpLink } from 'apollo-angular/http';
import { API_CONFIG } from '../tokens/api-config.token';

export function apolloOptionsFactory() {
  const httpLink = inject(HttpLink);
  const api = inject(API_CONFIG);

  const errorLink = onError((handler) => {
    // Apollo Link's onError signature varies slightly across versions.
    // We defensively read both the modern (error) and classic (graphQLErrors/networkError) shapes.
    const anyHandler = handler as unknown as {
      error?: unknown;
      graphQLErrors?: Array<{
        message: string;
        path?: ReadonlyArray<string | number>;
        extensions?: Record<string, unknown>;
      }>;
      networkError?: unknown;
      operation?: { operationName?: string };
    };

    const opName = anyHandler.operation?.operationName ?? 'unknown';

    const error = anyHandler.error;
    if (error && CombinedGraphQLErrors.is(error)) {
      for (const e of error.errors) {
        console.error(`[GraphQL:${opName}] ${e.message}`, {
          path: e.path,
          extensions: e.extensions,
        });
      }
      return;
    }

    const gqlErrors = anyHandler.graphQLErrors ?? [];
    for (const e of gqlErrors) {
      console.error(`[GraphQL:${opName}] ${e.message}`, {
        path: e.path,
        extensions: e.extensions,
      });
    }

    const netErr = anyHandler.networkError as
      | (Error & { statusCode?: number; result?: unknown; response?: unknown })
      | undefined;
    if (netErr) {
      console.error(`[GraphQL:${opName}] Network error: ${netErr.message}`, {
        statusCode: netErr.statusCode,
        result: netErr.result,
        response: netErr.response,
      });
    }

    if (error && !CombinedGraphQLErrors.is(error) && gqlErrors.length === 0 && !netErr) {
      const msg = String((error as { message?: string })?.message ?? error);
      console.error(`[GraphQL:${opName}]`, msg, error);
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
