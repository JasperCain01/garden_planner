import { describe, expect, it } from 'vitest';
import { cmToMetres, metresToCm } from './units.ts';

describe('metresToCm / cmToMetres', () => {
  it('converts metres to centimetres', () => {
    expect(metresToCm(3)).toBe(300);
    expect(metresToCm(1.5)).toBe(150);
  });

  it('is the inverse of cmToMetres', () => {
    expect(cmToMetres(metresToCm(2.75))).toBeCloseTo(2.75, 10);
  });
});
