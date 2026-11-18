import { describe, it, expect } from 'vitest';
import {
  validatePlant,
  safeValidatePlant,
  lightRequirementRank,
  rhsHardinessRank,
  LIGHT_REQUIREMENTS,
  RHS_HARDINESS_RATINGS,
  type Plant,
} from './plant';

/**
 * These tests do double duty: they check the schema, and the valid records below
 * are hand-written, realistic **worked examples** of what a plant record looks
 * like — the closest thing to living documentation of the schema. Each is typed
 * as `Plant`, so if the schema shape changes and a sample no longer fits, the
 * type checker flags it here first.
 *
 * Figures are representative British-growing values, not authoritative — the
 * hand-verified spacing table is a separate, cross-checked effort (Stage 1.3).
 * `gbifId` is left `null` on purpose: it is filled by the resolver in Stage 1.1.
 */

/** Onion — the canonical method-aware example from `DESIGN.md`: both row and
 *  intensive spacing, and they genuinely differ. */
const onion: Plant = {
  id: 'onion',
  commonName: 'Onion',
  scientificName: 'Allium cepa',
  gbifId: null,
  category: 'vegetable',
  edibleParts: ['bulb'],
  light: 'full-sun',
  spacing: {
    // Traditional plot: tight along the row, wide between rows.
    row: { inRowCm: 10, betweenRowCm: 30 },
    // Intensive bed: ~8 cm all round → 9 to a square-foot square, ~100 per m².
    intensive: { perSquareMetre: 100, plantsPerSquare: 9 },
  },
  hardiness: { rhsRating: 'H5', minTempC: -15 },
  soil: { textures: ['loam', 'sand'], ph: ['neutral'], moisture: ['moist'] },
  seasons: { sow: [{ start: 3, end: 4 }], harvest: [{ start: 8, end: 9 }] },
  companions: [{ plantId: 'carrot', evidence: 'traditional', note: 'mutual pest confusion' }],
  antagonists: [{ plantId: 'pea', evidence: 'traditional', note: 'alliums check legumes' }],
  icon: 'onion',
  provenance: {
    sources: [{ source: 'hand-verified', note: 'illustrative sample record' }],
  },
};

/** Lettuce — partial-shade tolerant, and a crop with two sowing windows. */
const lettuce: Plant = {
  id: 'lettuce',
  commonName: 'Lettuce',
  scientificName: 'Lactuca sativa',
  gbifId: null,
  category: 'vegetable',
  edibleParts: ['leaf'],
  light: 'partial-shade',
  spacing: {
    row: { inRowCm: 30, betweenRowCm: 30 },
    intensive: { perSquareMetre: 16, plantsPerSquare: 4 },
  },
  hardiness: { rhsRating: 'H4' },
  soil: { moisture: ['moist'] },
  // Sown spring and again late summer for succession; wide harvest window.
  seasons: {
    sow: [
      { start: 3, end: 5 },
      { start: 8, end: 9 },
    ],
    harvest: [{ start: 5, end: 10 }],
  },
  provenance: {
    sources: [{ source: 'hand-verified', note: 'illustrative sample record' }],
    // Demonstrates per-field attribution: spacing verified separately from the rest.
    fields: {
      spacing: [{ source: 'RHS', note: 'illustrative' }],
    },
  },
};

/** Strawberry — the required "a fruit"; both methods populated. */
const strawberry: Plant = {
  id: 'strawberry',
  commonName: 'Strawberry',
  scientificName: 'Fragaria × ananassa',
  gbifId: null,
  category: 'fruit',
  edibleParts: ['fruit'],
  light: 'full-sun',
  spacing: {
    row: { inRowCm: 35, betweenRowCm: 75 },
    intensive: { perSquareMetre: 6, plantsPerSquare: 1 },
  },
  hardiness: { rhsRating: 'H6', minTempC: -20 },
  seasons: { harvest: [{ start: 6, end: 7 }] },
  companions: [{ plantId: 'borage', evidence: 'traditional' }],
  provenance: { sources: [{ source: 'hand-verified', note: 'illustrative sample record' }] },
};

/** Apple cordon — a fruit *tree*: row spacing only, and hardiness by min
 *  temperature alone (no RHS band). Proves methods and representations are
 *  independently optional. */
const appleCordon: Plant = {
  id: 'apple-cordon',
  commonName: 'Apple (cordon)',
  scientificName: 'Malus domestica',
  gbifId: null,
  category: 'fruit',
  edibleParts: ['fruit'],
  light: 'full-sun',
  spacing: {
    // Trees have no meaningful "intensive" density; only row/tree spacing applies.
    row: { inRowCm: 75, betweenRowCm: 200 },
  },
  hardiness: { minTempC: -25 },
  provenance: { sources: [{ source: 'hand-verified', note: 'illustrative sample record' }] },
};

describe('validatePlant — valid records', () => {
  it.each([onion, lettuce, strawberry, appleCordon])(
    'accepts a realistic $commonName record',
    (record) => {
      expect(() => validatePlant(record)).not.toThrow();
      // Returned value round-trips unchanged.
      expect(validatePlant(record)).toEqual(record);
    },
  );

  it('accepts a minimal record with only required fields', () => {
    // The floor: identity + category + light + one spacing method + one source.
    const minimal: Plant = {
      id: 'radish',
      commonName: 'Radish',
      scientificName: 'Raphanus sativus',
      gbifId: null,
      category: 'vegetable',
      light: 'full-sun',
      spacing: { intensive: { plantsPerSquare: 16 } },
      provenance: { sources: [{ source: 'hand-verified' }] },
    };
    expect(() => validatePlant(minimal)).not.toThrow();
  });

  it('accepts a resolved GBIF id (positive integer)', () => {
    const resolved = { ...onion, gbifId: 2857697 };
    expect(() => validatePlant(resolved)).not.toThrow();
  });
});

describe('validatePlant — rejected records', () => {
  // Each case mutates one field of a valid record and names where the schema
  // must report the problem. Checking the path, not just that parsing threw,
  // proves each record fails for the reason in its description.
  const without = (key: string): Record<string, unknown> => {
    const copy: Record<string, unknown> = { ...onion };
    delete copy[key];
    return copy;
  };
  it.each<[string, unknown, (string | number)[]]>([
    [
      'a sow month above 12',
      { ...onion, seasons: { sow: [{ start: 3, end: 13 }] } },
      ['seasons', 'sow', 0, 'end'],
    ],
    [
      'a month of 0',
      { ...onion, seasons: { harvest: [{ start: 0, end: 5 }] } },
      ['seasons', 'harvest', 0, 'start'],
    ],
    [
      'a non-integer month',
      { ...onion, seasons: { sow: [{ start: 3.5, end: 4 }] } },
      ['seasons', 'sow', 0, 'start'],
    ],
    [
      'negative in-row spacing',
      { ...onion, spacing: { row: { inRowCm: -10, betweenRowCm: 30 } } },
      ['spacing', 'row', 'inRowCm'],
    ],
    [
      'zero spacing (must be strictly positive)',
      { ...onion, spacing: { intensive: { perSquareMetre: 0 } } },
      ['spacing', 'intensive', 'perSquareMetre'],
    ],
    ['spacing with no growing method at all', { ...onion, spacing: {} }, ['spacing']],
    [
      'an intensive block with no density figure',
      { ...onion, spacing: { intensive: {} } },
      ['spacing', 'intensive'],
    ],
    [
      'a row block missing between-row spacing',
      { ...onion, spacing: { row: { inRowCm: 10 } } },
      ['spacing', 'row', 'betweenRowCm'],
    ],
    ['an unknown light value', { ...onion, light: 'shade' }, ['light']],
    ['an unknown edible category', { ...onion, category: 'mushroom' }, ['category']],
    ['a missing scientificName', without('scientificName'), ['scientificName']],
    ['an id that is not a slug', { ...onion, id: 'Onion Bulb' }, ['id']],
    [
      'a companion link missing its evidence tag',
      { ...onion, companions: [{ plantId: 'carrot' }] },
      ['companions', 0, 'evidence'],
    ],
    [
      'a companion link to a non-slug id',
      { ...onion, companions: [{ plantId: 'Carrot!', evidence: 'traditional' }] },
      ['companions', 0, 'plantId'],
    ],
    [
      'provenance with no sources',
      { ...onion, provenance: { sources: [] } },
      ['provenance', 'sources'],
    ],
    ['a missing provenance block', without('provenance'), ['provenance']],
    ['a fractional GBIF id', { ...onion, gbifId: 2.5 }, ['gbifId']],
    ['an empty hardiness block', { ...onion, hardiness: {} }, ['hardiness']],
    // Strict mode: a typo'd field name must fail rather than be silently
    // dropped, or a record ships with that fact missing (ADR-0004).
    ['an unknown top-level key', { ...onion, hardyness: { minTempC: -5 } }, []],
    [
      'an unknown key inside a nested object',
      { ...onion, spacing: { row: { inRowCm: 10, betweenRowCm: 30, depthCm: 2 } } },
      ['spacing', 'row'],
    ],
  ])('rejects %s, reporting it at the offending field', (_case, record, path) => {
    expect(() => validatePlant(record)).toThrow();
    const result = safeValidatePlant(record);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toContainEqual(path);
    }
  });
});

describe('safeValidatePlant', () => {
  it('returns success for a valid record', () => {
    const result = safeValidatePlant(onion);
    expect(result.success).toBe(true);
  });
});

describe('ordered-enum rank helpers', () => {
  it('ranks light from full sun (0) to full shade', () => {
    expect(lightRequirementRank('full-sun')).toBe(0);
    expect(lightRequirementRank('partial-shade')).toBe(1);
    expect(lightRequirementRank('full-shade')).toBe(2);
    // Ranks are strictly increasing in the declared order.
    const ranks = LIGHT_REQUIREMENTS.map(lightRequirementRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('ranks RHS hardiness from most tender (H1a = 0) to hardiest (H7)', () => {
    expect(rhsHardinessRank('H1a')).toBe(0);
    expect(rhsHardinessRank('H7')).toBe(RHS_HARDINESS_RATINGS.length - 1);
    expect(rhsHardinessRank('H5')).toBeGreaterThan(rhsHardinessRank('H3'));
  });
});
