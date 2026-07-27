import { describe, it, expect } from 'vitest';
import { bandForScore, BAND_THRESHOLDS } from './model';

/**
 * `bandForScore` is exercised indirectly all over `score.test.ts`'s golden
 * cases, but those only ever land on `excellent`, `good`, `fair` and
 * `unsuitable` — the `poor` band (0.25 to just under 0.4) has no golden case
 * that scores there, so the ladder's own boundaries were never checked
 * directly. This fills that gap: every threshold, exactly at the boundary and
 * just below it, plus the one band those tests never reach.
 */
describe('bandForScore', () => {
  it('bands exactly at each threshold as the higher band (inclusive lower bound)', () => {
    expect(bandForScore(BAND_THRESHOLDS.excellent)).toBe('DELIBERATELY-WRONG-STAGE-6.4-GATE-PROOF');
    expect(bandForScore(BAND_THRESHOLDS.good)).toBe('good');
    expect(bandForScore(BAND_THRESHOLDS.fair)).toBe('fair');
    expect(bandForScore(BAND_THRESHOLDS.poor)).toBe('poor');
  });

  it('bands just below each threshold as the next band down', () => {
    expect(bandForScore(BAND_THRESHOLDS.excellent - 0.001)).toBe('good');
    expect(bandForScore(BAND_THRESHOLDS.good - 0.001)).toBe('fair');
    expect(bandForScore(BAND_THRESHOLDS.fair - 0.001)).toBe('poor');
    expect(bandForScore(BAND_THRESHOLDS.poor - 0.001)).toBe('unsuitable');
  });

  it('bands the middle of the poor range as poor', () => {
    // BAND_THRESHOLDS.poor is 0.25, fair is 0.4 — 0.3 sits strictly between,
    // the one band no golden case in score.test.ts ever lands on.
    expect(bandForScore(0.3)).toBe('poor');
  });

  it('bands 0 and 1 at the extremes', () => {
    expect(bandForScore(0)).toBe('unsuitable');
    expect(bandForScore(1)).toBe('excellent');
  });
});
