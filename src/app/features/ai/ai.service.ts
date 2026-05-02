import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../../core/tokens/api-config.token';
import { FEATURE_FLAGS } from '../../core/tokens/feature-flags.token';
import type { AiFormAssist, AiHealthReport, AiSuggestedReply, AiTicketSummary } from './ai.types';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);
  private readonly flags = inject(FEATURE_FLAGS);

  /**
   * AbortSignal is accepted for API symmetry with fetch; Angular HttpClient
   * cancellation uses `HttpContext` / unsubscribed subscriptions — callers
   * should unsubscribe the `firstValueFrom` subscription for true cancel.
   */
  async summarizeTicket(ticketId: string, _signal?: AbortSignal): Promise<AiTicketSummary> {
    if (!this.flags.aiSummary) {
      throw new Error('AI summary disabled');
    }
    return firstValueFrom(
      this.http.post<AiTicketSummary>(`${this.api.restUrl}/ai/summary`, { ticketId }),
    );
  }

  async suggestedReply(ticketId: string, _signal?: AbortSignal): Promise<AiSuggestedReply> {
    if (!this.flags.aiReply) {
      throw new Error('AI reply disabled');
    }
    return firstValueFrom(
      this.http.post<AiSuggestedReply>(`${this.api.restUrl}/ai/reply`, { ticketId }),
    );
  }

  async parseRequest(text: string, _signal?: AbortSignal): Promise<AiFormAssist> {
    if (!this.flags.aiFormAssist) {
      throw new Error('AI form assist disabled');
    }
    return firstValueFrom(
      this.http.post<AiFormAssist>(`${this.api.restUrl}/ai/form-assist`, { text }),
    );
  }

  async healthReport(range: string, _signal?: AbortSignal): Promise<AiHealthReport> {
    if (!this.flags.aiHealth) {
      throw new Error('AI health report disabled');
    }
    return firstValueFrom(
      this.http.post<AiHealthReport>(`${this.api.restUrl}/ai/health-report`, { range }),
    );
  }
}
