import '@angular/compiler';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { TestBed as TB } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_CONFIG } from '../../core/tokens/api-config.token';
import { FEATURE_FLAGS } from '../../core/tokens/feature-flags.token';
import { AiService } from './ai.service';

describe('AiService', () => {
  try {
    TB.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
  } catch {}

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AiService,
        { provide: API_CONFIG, useValue: { graphqlUrl: '/g', restUrl: '/api', wsUrl: '/g' } },
        {
          provide: FEATURE_FLAGS,
          useValue: {
            aiSummary: true,
            aiReply: true,
            aiFormAssist: true,
            aiHealth: true,
            graphqlSubscriptions: false
          }
        }
        // PlatformLocation is provided by the testing module; if anything complains, a stub can be added here.
      ]
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
