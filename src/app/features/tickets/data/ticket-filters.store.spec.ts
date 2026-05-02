import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { TicketFiltersStore } from './ticket-filters.store';

describe('TicketFiltersStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('computes activeFilterCount', () => {
    TestBed.runInInjectionContext(() => {
      const store = TestBed.inject(TicketFiltersStore);
      expect(store.activeFilterCount()).toBe(0);
      store.patch({ search: 'vpn' });
      expect(store.activeFilterCount()).toBe(1);
      store.patch({ status: ['OPEN'] });
      expect(store.activeFilterCount()).toBe(2);
    });
  });

  it('builds graphqlFilter', () => {
    TestBed.runInInjectionContext(() => {
      const store = TestBed.inject(TicketFiltersStore);
      store.patch({ slaBreaching: true, priority: ['P1'] });
      const f = store.graphqlFilter();
      expect(f.slaBreaching).toBe(true);
      expect(f.priority).toEqual(['P1']);
    });
  });
});
