import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { map } from 'rxjs';
import { TicketDocument, type TicketQuery } from '../../../../graphql/generated/graphql';

export const ticketResolver: ResolveFn<TicketQuery['ticket']> = (route) => {
  const apollo = inject(Apollo);
  const id = route.paramMap.get('id');
  if (!id) {
    throw new Error('Missing ticket id');
  }
  return apollo
    .query({
      query: TicketDocument,
      variables: { id },
      fetchPolicy: 'network-only',
    })
    .pipe(map((r) => r.data?.ticket ?? null));
};
