import { describe, expect, it } from 'vitest';
import {
  resolvePlotConditions,
  validatePlant,
  rankPlants,
  type Plant,
} from '@garden-planner/engine';
import { filterRanked, matchesCategory, matchesSearch } from './filters.ts';

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
    const narrowed = filterRanked(ranked, 'chard', 'all');
    expect(narrowed).toHaveLength(1);
    expect(narrowed[0].plant.id).toBe('chard');
  });

  it('narrows by category', () => {
    const ranked = rankPlants(plants, conditions);
    const narrowed = filterRanked(ranked, '', 'herb');
    expect(narrowed).toHaveLength(1);
    expect(narrowed[0].plant.id).toBe('basil');
  });

  it('combines search and category, both must match', () => {
    const ranked = rankPlants(plants, conditions);
    expect(filterRanked(ranked, 'chard', 'herb')).toHaveLength(0);
    expect(filterRanked(ranked, 'chard', 'vegetable')).toHaveLength(1);
  });
});
