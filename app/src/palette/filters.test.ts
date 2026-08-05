import { describe, expect, it } from 'vitest';
import {
  resolvePlotConditions,
  validatePlant,
  rankPlants,
  type Plant,
} from '@garden-planner/engine';
import { filterRanked, matchesBand, matchesCategory, matchesSearch } from './filters.ts';

/** A minimal, schema-valid fixture plant, overridable per test. */
function fixturePlant(overrides: Partial<Plant> = {}): Plant {
  return validatePlant({
    id: 'chard',
    commonName: 'Swiss Chard',
    scientificName: 'Beta vulgaris',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 30, betweenRowCm: 45 } },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
    ...overrides,
  });
}

describe('matchesSearch', () => {
  it('matches everything for an empty or whitespace-only query', () => {
    const plant = fixturePlant();
    expect(matchesSearch(plant, '')).toBe(true);
    expect(matchesSearch(plant, '   ')).toBe(true);
  });

  it('matches case-insensitively against the common name', () => {
    expect(matchesSearch(fixturePlant(), 'CHARD')).toBe(true);
    expect(matchesSearch(fixturePlant(), 'swiss')).toBe(true);
  });

  it('matches against the scientific name', () => {
    expect(matchesSearch(fixturePlant(), 'beta vulgaris')).toBe(true);
  });

  it('matches against a synonym even when the common name differs', () => {
    const plant = fixturePlant({ commonName: 'Silverbeet', synonyms: ['Swiss chard'] });
    expect(matchesSearch(plant, 'chard')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(matchesSearch(fixturePlant(), 'onion')).toBe(false);
  });
});

describe('matchesCategory', () => {
  it('matches every plant when the filter is "all"', () => {
    expect(matchesCategory(fixturePlant({ category: 'herb' }), 'all')).toBe(true);
  });

  it("matches only the plant's own category otherwise", () => {
    expect(matchesCategory(fixturePlant({ category: 'vegetable' }), 'vegetable')).toBe(true);
    expect(matchesCategory(fixturePlant({ category: 'vegetable' }), 'fruit')).toBe(false);
  });
});

describe('matchesBand', () => {
  it('matches every band when the filter is "all"', () => {
    for (const band of ['excellent', 'good', 'fair', 'poor', 'unsuitable'] as const) {
      expect(matchesBand(band, 'all'), band).toBe(true);
    }
  });

  it('keeps only excellent and good under "great" — fair is not a great fit', () => {
    expect(matchesBand('excellent', 'great')).toBe(true);
    expect(matchesBand('good', 'great')).toBe(true);
    // `fair` is where "we know almost nothing about this crop" lands, given
    // most of the shipped dataset has no hardiness/soil/season data — see the
    // predicate's own comment for why the review's "excellent + good" is taken
    // literally rather than widened.
    expect(matchesBand('fair', 'great')).toBe(false);
    expect(matchesBand('poor', 'great')).toBe(false);
    expect(matchesBand('unsuitable', 'great')).toBe(false);
  });
});

describe('filterRanked', () => {
  const conditions = resolvePlotConditions({ light: 'full-sun' });
  const plants = [
    fixturePlant({ id: 'chard', commonName: 'Swiss Chard', category: 'vegetable' }),
    fixturePlant({
      id: 'basil',
      commonName: 'Basil',
      scientificName: 'Ocimum basilicum',
      category: 'herb',
    }),
  ];

  it('narrows by search without reordering the survivors', () => {
    const ranked = rankPlants(plants, conditions);
    const narrowed = filterRanked(ranked, 'chard', 'all', 'all');
    expect(narrowed).toHaveLength(1);
    expect(narrowed[0].plant.id).toBe('chard');
  });

  it('narrows by category', () => {
    const ranked = rankPlants(plants, conditions);
    const narrowed = filterRanked(ranked, '', 'herb', 'all');
    expect(narrowed).toHaveLength(1);
    expect(narrowed[0].plant.id).toBe('basil');
  });

  it('combines search and category, both must match', () => {
    const ranked = rankPlants(plants, conditions);
    expect(filterRanked(ranked, 'chard', 'herb', 'all')).toHaveLength(0);
    expect(filterRanked(ranked, 'chard', 'vegetable', 'all')).toHaveLength(1);
  });

  /**
   * Both fixtures are full-sun crops on a full-sun plot with nothing else
   * known, so the engine bands them `good` (its own note: with only light
   * known the best attainable ranking score is 0.675). That makes them a clean
   * pair for "great keeps them, and a band the filter excludes drops them"
   * without pinning this test to a particular score.
   */
  it('narrows by band, alongside the other two', () => {
    const ranked = rankPlants(plants, conditions);
    expect(ranked.map((entry) => entry.suitability.band)).toEqual(['good', 'good']);

    expect(filterRanked(ranked, '', 'all', 'great')).toHaveLength(2);
    expect(filterRanked(ranked, 'chard', 'all', 'great')).toHaveLength(1);

    // A shady plot demotes both full-sun crops out of "great".
    const shady = rankPlants(plants, resolvePlotConditions({ light: 'full-shade' }));
    expect(filterRanked(shady, '', 'all', 'all')).toHaveLength(2);
    expect(filterRanked(shady, '', 'all', 'great')).toHaveLength(0);
  });
});
