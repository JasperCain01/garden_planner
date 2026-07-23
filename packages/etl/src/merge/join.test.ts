import { describe, expect, it } from 'vitest';
import { validatePlant, type Plant } from '@garden-planner/engine';
import { validateSpacingRecord, type SpacingRecord } from '../spacing/schema.ts';
import {
  buildPlantIndex,
  canonicalPlantId,
  findSpacingTarget,
  normalizeScientificName,
  unifyPlantsByIdentity,
} from './join.ts';

function plant(overrides: Partial<Plant> = {}): Plant {
  return validatePlant({
    id: 'onion',
    commonName: 'Onion',
    scientificName: 'Allium cepa',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 8, betweenRowCm: 30 } },
    provenance: { sources: [{ source: 'OpenFarm', license: 'CC0-1.0' }] },
    ...overrides,
  });
}

function spacingRow(overrides: Partial<SpacingRecord> = {}): SpacingRecord {
  const cite = { source: 'RHS', url: 'https://example.test/a', retrievedAt: '2026-01-01' };
  const cite2 = { source: 'Almanac', url: 'https://example.test/b', retrievedAt: '2026-01-01' };
  return validateSpacingRecord({
    id: 'onion',
    commonName: 'Onion',
    scientificName: 'Allium cepa',
    category: 'vegetable',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    provenance: { row: [cite, cite2] },
    ...overrides,
  });
}

describe('normalizeScientificName', () => {
  it('trims, collapses whitespace, and lowercases', () => {
    expect(normalizeScientificName('  Allium   cepa ')).toBe('allium cepa');
  });
});

describe('findSpacingTarget', () => {
  it('matches by exact slug even when scientific names differ (leek case)', () => {
    // Real case: OpenFarm calls leek "Allium porrum"; the spacing table uses the
    // synonym "Allium ampeloprasum". A slug match must still succeed.
    const plants = [plant({ id: 'leek', scientificName: 'Allium porrum' })];
    const index = buildPlantIndex(plants);
    const join = findSpacingTarget(
      spacingRow({ id: 'leek', scientificName: 'Allium ampeloprasum' }),
      index,
      {},
    );
    expect(join).toMatchObject({ matched: true, via: 'slug' });
  });

  it('matches by unambiguous scientific name when the slug differs', () => {
    const plants = [plant({ id: 'courgette', scientificName: 'Cucurbita pepo' })];
    const index = buildPlantIndex(plants);
    const join = findSpacingTarget(
      spacingRow({ id: 'zucchini', scientificName: 'Cucurbita pepo' }),
      index,
      {},
    );
    expect(join).toMatchObject({ matched: true, via: 'scientificName' });
    if (join.matched) expect(join.plant.id).toBe('courgette');
  });

  it('does NOT auto-match an ambiguous scientific name; needs an alias', () => {
    const plants = [
      plant({ id: 'beet', scientificName: 'Beta vulgaris' }),
      plant({ id: 'chard', scientificName: 'Beta vulgaris' }),
    ];
    const index = buildPlantIndex(plants);
    const join = findSpacingTarget(
      spacingRow({ id: 'beetroot', scientificName: 'Beta vulgaris' }),
      index,
      {},
    );
    expect(join.matched).toBe(false);
    if (!join.matched) expect(join.reason).toContain('ambiguous');
  });

  it('resolves an ambiguous case via a curated alias verified by scientific name', () => {
    const plants = [
      plant({ id: 'beet', scientificName: 'Beta vulgaris' }),
      plant({ id: 'chard', scientificName: 'Beta vulgaris' }),
    ];
    const index = buildPlantIndex(plants);
    const join = findSpacingTarget(
      spacingRow({ id: 'beetroot', scientificName: 'Beta vulgaris' }),
      index,
      { beetroot: 'beet' },
    );
    expect(join).toMatchObject({ matched: true, via: 'alias' });
    if (join.matched) expect(join.plant.id).toBe('beet');
  });

  it('rejects an alias whose target scientific name disagrees (loud, not silent)', () => {
    const plants = [plant({ id: 'beet', scientificName: 'Wrongus namus' })];
    const index = buildPlantIndex(plants);
    const join = findSpacingTarget(
      spacingRow({ id: 'beetroot', scientificName: 'Beta vulgaris' }),
      index,
      { beetroot: 'beet' },
    );
    expect(join.matched).toBe(false);
    if (!join.matched) expect(join.reason).toContain('scientific names disagree');
  });

  it('reports no home when nothing matches (broad-bean case)', () => {
    const plants = [plant({ id: 'leek', scientificName: 'Allium porrum' })];
    const index = buildPlantIndex(plants);
    const join = findSpacingTarget(
      spacingRow({ id: 'broad-bean', scientificName: 'Vicia faba' }),
      index,
      {},
    );
    expect(join.matched).toBe(false);
  });

  it('prefers gbifId equality for future gbif-bearing plants (index by gbifId)', () => {
    const plants = [plant({ id: 'onion', gbifId: 2857697 })];
    const index = buildPlantIndex(plants);
    expect(index.byGbifId.get(2857697)?.id).toBe('onion');
  });
});

describe('canonicalPlantId', () => {
  const plantIds = new Set(['beet', 'onion', 'green-bean']);
  const aliases = { beetroot: 'beet', 'french-bean': 'green-bean' };

  it('returns a real plant id unchanged', () => {
    expect(canonicalPlantId('onion', plantIds, aliases)).toBe('onion');
  });
  it('remaps an aliased id to its plant', () => {
    expect(canonicalPlantId('french-bean', plantIds, aliases)).toBe('green-bean');
  });
  it('returns null for an id with no plant and no alias', () => {
    expect(canonicalPlantId('broad-bean', plantIds, aliases)).toBeNull();
  });
});

describe('unifyPlantsByIdentity', () => {
  it('leaves gbif-less plants as singletons (never merges by name)', () => {
    const groups = unifyPlantsByIdentity([
      plant({ id: 'zucchini', scientificName: 'Cucurbita pepo' }),
      plant({ id: 'acorn-squash', scientificName: 'Cucurbita pepo' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.via === 'standalone' && g.plants.length === 1)).toBe(true);
  });

  it('unifies two records that share a gbifId (cross-source dedup)', () => {
    const groups = unifyPlantsByIdentity([
      plant({ id: 'onion', gbifId: 2857697 }),
      plant({ id: 'onion-pfaf', gbifId: 2857697, scientificName: 'Allium cepa' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ via: 'gbifId', key: '2857697' });
    expect(groups[0].plants).toHaveLength(2);
  });
});
