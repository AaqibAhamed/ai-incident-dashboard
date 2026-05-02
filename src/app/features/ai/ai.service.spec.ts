import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_CONFIG } from '../../core/tokens/api-config.token';
import { FEATURE_FLAGS } from '../../core/tokens/feature-flags.token';
import { AiService } from './ai.service';

describe('AiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AiService,
        { provide: API_CONFIG, useValue: { graphqlUrl: '/g', restUrl: '/api', wsUrl: '/g' } },
        {
          provide: FEATURE_FLAGS,
          useValue: {
            aiSummary: true,
            aiReply: true,
            aiFormAssist: true,
            aiHealth: true,
            graphqlSubscriptions: false,
          },
        },
      ],
    });
  });

  it('surfaces HTTP failure as rejection (caller maps to UX message)', async () => {
    const http = TestBed.inject(HttpTestingController);
    const ai = TestBed.inject(AiService);
    const p = ai.summarizeTicket('t-1');
    http.expectOne('/api/ai/summary').flush('', { status: 503, statusText: 'Error' });
    await expect(p).rejects.toBeDefined();
  });
});
