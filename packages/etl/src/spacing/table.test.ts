import { describe, expect, it } from 'vitest';
import { HAND_VERIFIED_SPACING } from './table.ts';
import { MIN_SOURCES_PER_METHOD, spacingRecordSources, validateSpacingTable } from './schema.ts';

/**
 * These tests are the committed, reviewable record of the Stage 1.3 verification
 * (WORKPLAN.md §1.1: "the record of it is committed and reviewable"). They assert
 * the *structural* guarantees — schema validity, ≥2 sources per figure, unique
 * ids — that a human reviewer's sign-off on the actual numbers rests on.
 */
describe('HAND_VERIFIED_SPACING — the curated data', () => {
  it('every row is schema-valid and all ids are unique', () => {
    // validateSpacingTable throws on the first invalid row or duplicate id, so a
    // clean return is the whole-table guarantee.
    expect(() => validateSpacingTable(HAND_VERIFIED_SPACING)).not.toThrow();
  });

  it('is a bounded starter set (small enough to be hand-verified)', () => {
    expect(HAND_VERIFIED_SPACING.length).toBeGreaterThanOrEqual(10);
    expect(HAND_VERIFIED_SPACING.length).toBeLessThanOrEqual(40);
  });

  it('includes the Stage 1.1 demo five (for maximum downstream overlap)', () => {
    const ids = new Set(HAND_VERIFIED_SPACING.map((r) => r.id));
    for (const demo of ['onion', 'lettuce', 'carrot', 'potato', 'tomato']) {
      expect(ids.has(demo)).toBe(true);
    }
  });

  it('every present method carries >= the required number of citations', () => {
    for (const row of HAND_VERIFIED_SPACING) {
      if (row.spacing.row) {
        expect(row.provenance.row?.length ?? 0).toBeGreaterThanOrEqual(MIN_SOURCES_PER_METHOD);
      }
      if (row.spacing.intensive) {
        expect(row.provenance.intensive?.length ?? 0).toBeGreaterThanOrEqual(
          MIN_SOURCES_PER_METHOD,
        );
      }
    }
  });

  it('cites at least two *distinct* sources per method (not the same source twice)', () => {
    for (const row of HAND_VERIFIED_SPACING) {
      for (const method of ['row', 'intensive'] as const) {
        const refs = row.provenance[method];
        if (!refs) continue;
        const distinct = new Set(refs.map((r) => `${r.source} ${r.url ?? ''}`));
        expect(distinct.size).toBeGreaterThanOrEqual(MIN_SOURCES_PER_METHOD);
      }
    }
  });

  it('every citation records a source name, a URL, and a retrieval date', () => {
    for (const row of HAND_VERIFIED_SPACING) {
      const allRefs = [...(row.provenance.row ?? []), ...(row.provenance.intensive ?? [])];
      for (const ref of allRefs) {
        expect(ref.source.length).toBeGreaterThan(0);
        expect(ref.url).toBeTruthy();
        expect(ref.retrievedAt).toBeTruthy();
      }
    }
  });

  it('every intensive figure is cross-checked against a square-foot-gardening source', () => {
    // Guards the anti-inference rule at the data level: an intensive density must
    // be backed by a genuine SFG citation, never derived from the row figures.
    for (const row of HAND_VERIFIED_SPACING) {
      if (!row.spacing.intensive) continue;
      const isSfgSource = (r: { source: string; url?: string }): boolean =>
        /square.?foot|\bsfg\b/i.test(r.source) ||
        /squarefootgardening|square-?foot-?garden/i.test(r.url ?? '');
      const hasSfg = (row.provenance.intensive ?? []).some(isSfgSource);
      expect(hasSfg, `expected an SFG citation for ${row.id}`).toBe(true);
    }
  });

  it('every crop is one of the three edible categories', () => {
    for (const row of HAND_VERIFIED_SPACING) {
      expect(['vegetable', 'herb', 'fruit']).toContain(row.category);
    }
  });

  it('flattens each row into a non-empty, de-duplicated SourceRef list for Stage 1.5', () => {
    for (const row of HAND_VERIFIED_SPACING) {
      const sources = spacingRecordSources(row);
      expect(sources.length).toBeGreaterThanOrEqual(MIN_SOURCES_PER_METHOD);
      const keys = sources.map((s) => `${s.source} ${s.url ?? ''}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
