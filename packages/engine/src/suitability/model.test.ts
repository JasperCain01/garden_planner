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
  it('bands each threshold inclusively, just below it as the next band down, and the extremes', () => {
    const { excellent, good, fair, poor } = BAND_THRESHOLDS;
    const cases: [number, string][] = [
      [excellent, 'excellent'],
      [excellent - 0.001, 'good'],
      [good, 'good'],
      [good - 0.001, 'fair'],
      [fair, 'fair'],
      [fair - 0.001, 'poor'],
      [poor, 'poor'],
      [poor - 0.001, 'unsuitable'],
      // 0.3 sits strictly inside poor, the one band no golden case reaches.
      [0.3, 'poor'],
      [0, 'unsuitable'],
      [1, 'excellent'],
    ];
    for (const [score, band] of cases) expect(bandForScore(score), String(score)).toBe(band);
  });
});
