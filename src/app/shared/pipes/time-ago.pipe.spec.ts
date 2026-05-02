import { describe, expect, it } from 'vitest';
import { TimeAgoPipe } from './time-ago.pipe';

describe('TimeAgoPipe', () => {
  const pipe = new TimeAgoPipe();

  it('returns just now for recent timestamps', () => {
    expect(pipe.transform(new Date())).toBe('just now');
  });

  it('formats minutes', () => {
    const d = new Date(Date.now() - 5 * 60 * 1000);
    expect(pipe.transform(d)).toBe('5m ago');
  });
});
