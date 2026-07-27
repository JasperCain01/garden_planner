import { describe, it, expect } from 'vitest';
import { formatCm } from './model';

/**
 * `formatCm` backs every distance mentioned in a warning's prose
 * (`antagonists.ts`, `overcrowding.ts`), but every existing warnings test
 * fixture places beds on whole-centimetre grids, so its "not a whole number"
 * branch (`.toFixed(1)`) was never actually exercised anywhere in the suite.
 */
describe('formatCm', () => {
  it('prints a whole number with no decimal point', () => {
    expect(formatCm(30)).toBe('30');
    expect(formatCm(0)).toBe('0');
  });

  it('prints a fractional value to one decimal place', () => {
    expect(formatCm(30.5)).toBe('30.5');
    expect(formatCm(12.3456)).toBe('12.3');
  });
});
