import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly count = signal(0);

  readonly active = computed(() => this.count() > 0);

  begin(): void {
    this.count.update((c) => c + 1);
  }

  end(): void {
    this.count.update((c) => Math.max(0, c - 1));
  }
}
