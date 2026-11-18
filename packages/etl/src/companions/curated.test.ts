import { describe, expect, it } from 'vitest';
import { CURATED_COMPANION_RELATIONSHIPS } from './curated.ts';

/**
 * These tests are the committed, reviewable record of the Stage 1.4
 * curation, mirroring `spacing/table.test.ts`'s role for Stage 1.3: they
 * assert the *structural* guarantees an evidence-tagged relationship dataset
 * must hold, so a human reviewer's read of the actual calls can focus on the
 * judgement rather than the plumbing.
 */
describe('CURATED_COMPANION_RELATIONSHIPS', () => {
  it('is not blanket-tagged: both evidence levels are actually used', () => {
    const evidenceLevels = new Set(CURATED_COMPANION_RELATIONSHIPS.map((r) => r.evidence));
    expect(evidenceLevels.has('well-supported')).toBe(true);
    expect(evidenceLevels.has('traditional')).toBe(true);
  });

  it('is not blanket-tagged by kind either: both companion and antagonist appear', () => {
    const kinds = new Set(CURATED_COMPANION_RELATIONSHIPS.map((r) => r.kind));
    expect(kinds.has('companion')).toBe(true);
    expect(kinds.has('antagonist')).toBe(true);
  });

  it('every well-supported relationship cites at least two independent sources', () => {
    // A higher bar than the schema requires: "well-supported" should be
    // corroborated, not resting on a single page's word.
    for (const relationship of CURATED_COMPANION_RELATIONSHIPS) {
      if (relationship.evidence !== 'well-supported') continue;
      const distinctSources = new Set(
        relationship.sources.map((s) => `${s.source} ${s.url ?? ''}`),
      );
      expect(distinctSources.size).toBeGreaterThanOrEqual(2);
    }
  });
});
