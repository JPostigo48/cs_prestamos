import { describe, expect, it } from 'vitest';
import { deriveTrustLevel, TrustLevel } from './user.js';

describe('Trust levels', () => {
  it.each([
    [0, TrustLevel.CRITICO],
    [24.99, TrustLevel.CRITICO],
    [25, TrustLevel.EN_OBSERVACION],
    [49.99, TrustLevel.EN_OBSERVACION],
    [50, TrustLevel.CONFIABLE],
    [74.99, TrustLevel.CONFIABLE],
    [75, TrustLevel.EXCELENTE],
    [100, TrustLevel.EXCELENTE],
  ])('derives the level for %s percent', (percentage, level) => {
    expect(deriveTrustLevel(percentage)).toBe(level);
  });

  it('rejects trust values outside the allowed interval', () => {
    expect(() => deriveTrustLevel(-1)).toThrow(RangeError);
    expect(() => deriveTrustLevel(101)).toThrow(RangeError);
    expect(() => deriveTrustLevel(Number.NaN)).toThrow(RangeError);
  });
});
