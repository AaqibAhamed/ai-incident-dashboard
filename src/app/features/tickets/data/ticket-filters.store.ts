import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type {
  TicketFilterInput,
  TicketPriority,
  TicketStatus,
} from '../../../../graphql/generated/graphql';

type FiltersState = {
  status: TicketStatus[];
  priority: TicketPriority[];
  assigneeId: string | null;
  tags: string[];
  slaBreaching: boolean;
  search: string;
};

const initial: FiltersState = {
  status: [],
  priority: [],
  assigneeId: null,
  tags: [],
  slaBreaching: false,
  search: '',
};

export const TicketFiltersStore = signalStore(
  { providedIn: 'root' },
  withState<FiltersState>(initial),
  withComputed((store) => ({
    activeFilterCount: computed(() => {
      let n = 0;
      if (store.status().length) n++;
      if (store.priority().length) n++;
      if (store.assigneeId()) n++;
      if (store.tags().length) n++;
      if (store.slaBreaching()) n++;
      if (store.search().trim()) n++;
      return n;
    }),
    graphqlFilter: computed((): TicketFilterInput => {
      const s = store.status();
      const p = store.priority();
      return {
        status: s.length ? s : undefined,
        priority: p.length ? p : undefined,
        assigneeId: store.assigneeId() ?? undefined,
        tags: store.tags().length ? store.tags() : undefined,
        slaBreaching: store.slaBreaching() ? true : undefined,
        search: store.search().trim() || undefined,
      };
    }),
  })),
  withMethods((store) => ({
    patch(partial: Partial<FiltersState>): void {
      patchState(store, partial);
    },
    reset(): void {
      patchState(store, initial);
    },
  })),
);
