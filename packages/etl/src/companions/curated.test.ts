import { describe, expect, it } from 'vitest';
import { CURATED_COMPANION_RELATIONSHIPS } from './curated.ts';
import {
  CompanionRelationshipSchema,
  findDanglingRelationships,
  findDuplicateRelationships,
} from './schema.ts';
import { PLANT_ID_UNIVERSE } from './plant-id-universe.ts';

/**
 * These tests are the committed, reviewable record of the Stage 1.4
 * curation, mirroring `spacing/table.test.ts`'s role for Stage 1.3: they
 * assert the *structural* guarantees an evidence-tagged relationship dataset
 * must hold, so a human reviewer's read of the actual calls can focus on the
 * judgement rather than the plumbing.
 */
describe('CURATED_COMPANION_RELATIONSHIPS', () => {
  it('every relationship is schema-valid', () => {
    for (const relationship of CURATED_COMPANION_RELATIONSHIPS) {
      expect(() => CompanionRelationshipSchema.parse(relationship)).not.toThrow();
    }
  });

  it('every relationship carries an evidence tag from the closed enum', () => {
    for (const relationship of CURATED_COMPANION_RELATIONSHIPS) {
      expect(['well-supported', 'traditional']).toContain(relationship.evidence);
    }
  });

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

  it('every relationship records a non-empty reasoning note', () => {
    for (const relationship of CURATED_COMPANION_RELATIONSHIPS) {
      expect(relationship.note.length).toBeGreaterThan(0);
    }
  });

  it('every relationship cites at least one real, retrievable source', () => {
    for (const relationship of CURATED_COMPANION_RELATIONSHIPS) {
      expect(relationship.sources.length).toBeGreaterThanOrEqual(1);
      for (const source of relationship.sources) {
        expect(source.source.length).toBeGreaterThan(0);
        expect(source.url).toBeTruthy();
        expect(source.retrievedAt).toBeTruthy();
      }
    }
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

  it('has no referentially-dangling relationship against the plant-id universe', () => {
    expect(findDanglingRelationships(CURATED_COMPANION_RELATIONSHIPS, PLANT_ID_UNIVERSE)).toEqual(
      [],
    );
  });

  it('has no exact duplicate (kind, from, to) edge', () => {
    expect(findDuplicateRelationships(CURATED_COMPANION_RELATIONSHIPS)).toEqual([]);
  });

  it('never links a plant to itself', () => {
    for (const relationship of CURATED_COMPANION_RELATIONSHIPS) {
      expect(relationship.from).not.toBe(relationship.to);
    }
  });

  it('is a bounded, hand-verifiable set (not attempting exhaustive coverage)', () => {
    expect(CURATED_COMPANION_RELATIONSHIPS.length).toBeGreaterThanOrEqual(5);
    expect(CURATED_COMPANION_RELATIONSHIPS.length).toBeLessThanOrEqual(50);
  });
});
