import { inject, Injectable, signal } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import {
  DashboardMetricsDocument,
  type DashboardMetricsQuery,
  type DashboardMetricsQueryVariables,
} from '../../../../graphql/generated/graphql';

@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  private readonly apollo = inject(Apollo);

  readonly metrics = signal<DashboardMetricsQuery['dashboardMetrics'] | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(range: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const vars: DashboardMetricsQueryVariables = { range };
      const res = await firstValueFrom(
        this.apollo.query({
          query: DashboardMetricsDocument,
          variables: vars,
          fetchPolicy: 'network-only',
        }),
      );
      this.metrics.set(res.data?.dashboardMetrics ?? null);
    } catch {
      this.error.set('Failed to load dashboard metrics');
    } finally {
      this.loading.set(false);
    }
  }
}
