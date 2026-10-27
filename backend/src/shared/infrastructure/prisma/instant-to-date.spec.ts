import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill/full';
import { instantToDate, nullableInstantToDate } from './instant-to-date.js';

describe('decoded timestamptz boundary', () => {
  it('preserves milliseconds and equivalent offsets', () => {
    const instant = Temporal.Instant.from('2026-10-27T08:09:10.123Z');
    expect(instantToDate(instant).toISOString()).toBe('2026-10-27T08:09:10.123Z');
    expect(instantToDate(Temporal.Instant.from('2026-10-27T03:09:10.123-05:00')))
      .toEqual(instantToDate(instant));
  });

  it('only preserves explicit null for nullable columns', () => {
    expect(nullableInstantToDate(null)).toBeNull();
    expect(nullableInstantToDate(Temporal.Instant.from('2026-10-27T08:09:10.123Z')))
      .toEqual(new Date('2026-10-27T08:09:10.123Z'));
    for (const invalid of [undefined, '2026-10-27T08:09:10Z', new Date(), 0]) {
      expect(() => instantToDate(invalid)).toThrow(TypeError);
      expect(() => nullableInstantToDate(invalid)).toThrow(TypeError);
    }
    expect(() => instantToDate(null)).toThrow(TypeError);
  });
});
