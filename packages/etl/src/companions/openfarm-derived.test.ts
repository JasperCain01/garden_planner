import { describe, expect, it } from 'vitest';
import {
  deriveOpenFarmCompanionRelationships,
  OPENFARM_DERIVED_COMPANION_RELATIONSHIPS,
} from './openfarm-derived.ts';
import { CompanionRelationshipSchema, findDanglingRelationships } from './schema.ts';
import { PLANT_ID_UNIVERSE } from './plant-id-universe.ts';
import type { OpenFarmCropRaw } from '../sources/openfarm/types.ts';

const RETRIEVED_AT = '2026-07-18';

function rawRecord(overrides: Partial<OpenFarmCropRaw>): OpenFarmCropRaw {
  return {
    slug: 'a',
    name: 'A',
    source: {
      origin: 'test',
      license: 'CC0-1.0',
      waybackUrl: 'https://web.archive.org/a',
      captured: '20260101',
    },
    ...overrides,
  };
}

describe('deriveOpenFarmCompanionRelationships', () => {
  it('derives a relationship when both ends are in the universe', () => {
    const universe = new Set(['a', 'b']);
    const records = [rawRecord({ slug: 'a', companions: ['b'] })];
    const relationships = deriveOpenFarmCompanionRelationships(records, universe, RETRIEVED_AT);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      from: 'a',
      to: 'b',
      kind: 'companion',
      evidence: 'traditional',
    });
  });

  it('every derived relationship is schema-valid', () => {
    const universe = new Set(['a', 'b']);
    const records = [rawRecord({ slug: 'a', companions: ['b'] })];
    for (const relationship of deriveOpenFarmCompanionRelationships(
      records,
      universe,
      RETRIEVED_AT,
    )) {
      expect(() => CompanionRelationshipSchema.parse(relationship)).not.toThrow();
    }
  });

  it('drops a companion pointing outside the id universe', () => {
    const universe = new Set(['a']); // 'b' not included
    const records = [rawRecord({ slug: 'a', companions: ['b'] })];
    expect(deriveOpenFarmCompanionRelationships(records, universe, RETRIEVED_AT)).toEqual([]);
  });

  it("skips a record whose own slug isn't in the id universe", () => {
    const universe = new Set(['b']); // 'a' (the "from") not included
    const records = [rawRecord({ slug: 'a', companions: ['b'] })];
    expect(deriveOpenFarmCompanionRelationships(records, universe, RETRIEVED_AT)).toEqual([]);
  });

  it('drops a self-referential companion entry', () => {
    const universe = new Set(['a']);
    const records = [rawRecord({ slug: 'a', companions: ['a'] })];
    expect(deriveOpenFarmCompanionRelationships(records, universe, RETRIEVED_AT)).toEqual([]);
  });

  it('produces no relationships for a record with no companions field', () => {
    const universe = new Set(['a', 'b']);
    const records = [rawRecord({ slug: 'a' })];
    expect(deriveOpenFarmCompanionRelationships(records, universe, RETRIEVED_AT)).toEqual([]);
  });

  it('always records symmetric: false (never invents the reverse direction)', () => {
    const universe = new Set(['a', 'b']);
    const records = [rawRecord({ slug: 'a', companions: ['b'] })];
    const [relationship] = deriveOpenFarmCompanionRelationships(records, universe, RETRIEVED_AT);
    expect(relationship?.symmetric).toBe(false);
  });

  it('produces two directed edges when both records reciprocally list each other', () => {
    const universe = new Set(['a', 'b']);
    const records = [
      rawRecord({ slug: 'a', companions: ['b'] }),
      rawRecord({ slug: 'b', name: 'B', companions: ['a'] }),
    ];
    const relationships = deriveOpenFarmCompanionRelationships(records, universe, RETRIEVED_AT);
    expect(relationships).toHaveLength(2);
    expect(relationships.some((r) => r.from === 'a' && r.to === 'b')).toBe(true);
    expect(relationships.some((r) => r.from === 'b' && r.to === 'a')).toBe(true);
  });

  it("cites the record's own OpenFarm wayback URL as the source", () => {
    const universe = new Set(['a', 'b']);
    const records = [rawRecord({ slug: 'a', companions: ['b'] })];
    const [relationship] = deriveOpenFarmCompanionRelationships(records, universe, RETRIEVED_AT);
    expect(relationship?.sources[0]?.url).toBe('https://web.archive.org/a');
    expect(relationship?.sources[0]?.retrievedAt).toBe(RETRIEVED_AT);
  });
});

describe('OPENFARM_DERIVED_COMPANION_RELATIONSHIPS (the real, computed set)', () => {
  it('is a non-trivial set derived from the real cache', () => {
    expect(OPENFARM_DERIVED_COMPANION_RELATIONSHIPS.length).toBeGreaterThan(0);
  });

  it('every relationship is schema-valid', () => {
    for (const relationship of OPENFARM_DERIVED_COMPANION_RELATIONSHIPS) {
      expect(() => CompanionRelationshipSchema.parse(relationship)).not.toThrow();
    }
  });

  it('every relationship is tagged traditional (an uncited scraped field never becomes well-supported)', () => {
    for (const relationship of OPENFARM_DERIVED_COMPANION_RELATIONSHIPS) {
      expect(relationship.evidence).toBe('traditional');
    }
  });

  it('has no referentially-dangling relationship against the plant-id universe', () => {
    expect(
      findDanglingRelationships(OPENFARM_DERIVED_COMPANION_RELATIONSHIPS, PLANT_ID_UNIVERSE),
    ).toEqual([]);
  });
});
