import { describe, expect, it } from 'vitest';
import { buildPlantIdUniverse, PLANT_ID_UNIVERSE } from './plant-id-universe.ts';
import { HAND_VERIFIED_SPACING } from '../spacing/table.ts';
import type { OpenFarmCropRaw } from '../sources/openfarm/types.ts';

// 'carrot' is a real slug in OPENFARM_CATEGORY_OVERRIDES (see categories.ts),
// so this record clears mapOpenFarmCrop's category check and actually maps —
// unlike an arbitrary made-up slug, which the mapper would correctly skip.
const MAPPABLE_RECORD: OpenFarmCropRaw = {
  slug: 'carrot',
  name: 'Carrot',
  binomialName: 'Daucus carota',
  sun: 'Full Sun',
  spreadCm: 10,
  rowSpacingCm: 20,
  source: {
    origin: 'test',
    license: 'CC0-1.0',
    waybackUrl: 'https://web.archive.org/test',
    captured: '20260101',
  },
};

describe('buildPlantIdUniverse', () => {
  it('includes every given spacing id', () => {
    const universe = buildPlantIdUniverse(['onion', 'carrot'], []);
    expect(universe.has('onion')).toBe(true);
    expect(universe.has('carrot')).toBe(true);
  });

  it('includes an OpenFarm record that maps to a Plant', () => {
    const universe = buildPlantIdUniverse([], [MAPPABLE_RECORD]);
    expect(universe.has('carrot')).toBe(true);
  });

  it('excludes an OpenFarm record the mapper would skip (no curated category)', () => {
    const uncategorised: OpenFarmCropRaw = { ...MAPPABLE_RECORD, slug: 'no-category-crop' };
    const universe = buildPlantIdUniverse([], [uncategorised]);
    // 'no-category-crop' has no entry in OPENFARM_CATEGORY_OVERRIDES, so
    // mapOpenFarmCrop skips it — it must not appear in the universe.
    expect(universe.has('no-category-crop')).toBe(false);
  });

  it('is the union, not the intersection, of both inputs', () => {
    const universe = buildPlantIdUniverse(['onion'], [MAPPABLE_RECORD]);
    expect(universe.size).toBe(2);
  });
});

describe('PLANT_ID_UNIVERSE (the real, computed universe)', () => {
  it('contains every Stage 1.3 spacing-table id', () => {
    for (const record of HAND_VERIFIED_SPACING) {
      expect(PLANT_ID_UNIVERSE.has(record.id)).toBe(true);
    }
  });

  it('contains well-known OpenFarm crops that overlap the spacing table', () => {
    for (const id of ['onion', 'carrot', 'potato', 'tomato', 'garlic', 'leek', 'pea']) {
      expect(PLANT_ID_UNIVERSE.has(id)).toBe(true);
    }
  });

  it('is a real-sized universe (~161 OpenFarm ids + the 12 spacing ids, allowing overlap)', () => {
    // Loose bounds: guards against an accidental empty universe or an
    // accidental inclusion of the full unmapped 340-record dump.
    expect(PLANT_ID_UNIVERSE.size).toBeGreaterThan(100);
    expect(PLANT_ID_UNIVERSE.size).toBeLessThan(340);
  });
});
