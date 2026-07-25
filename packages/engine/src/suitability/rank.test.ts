import { describe, it, expect } from 'vitest';
import { validatePlant, type LightRequirement, type Plant } from '../schema/plant.ts';
import { resolvePlotConditions } from './conditions';
import { rankPlants } from './rank';

function crop(id: string, light: LightRequirement, overrides: Partial<Plant> = {}): Plant {
  return validatePlant({
    id,
    commonName: id.charAt(0).toUpperCase() + id.slice(1),
    scientificName: `Testum ${id}`,
    gbifId: null,
    category: 'vegetable',
    light,
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
    ...overrides,
  });
}

const SUNNY_PLOT = resolvePlotConditions({ light: 'full-sun' });
const SHADY_PLOT = resolvePlotConditions({ light: 'full-shade' });

describe('rankPlants', () => {
  it('returns crops best-first, carrying the plant and its full result', () => {
    const ranked = rankPlants(
      [
        crop('shade-lover', 'full-shade'),
        crop('sun-lover', 'full-sun'),
        crop('dappled', 'partial-shade'),
      ],
      SUNNY_PLOT,
    );

    expect(ranked.map((entry) => entry.plant.id)).toEqual(['sun-lover', 'dappled', 'shade-lover']);
    expect(ranked[0].suitability.summary).toContain('Good match');
    expect(ranked[0].plant.commonName).toBe('Sun-lover');
  });

  it('prefers a well-evidenced good match over a barely-known perfect one', () => {
    // Both are a perfect light match; only one has anything else on record.
    const known = crop('known', 'full-sun', {
      hardiness: { rhsRating: 'H5' },
      soil: { textures: ['loam'] },
      seasons: { sow: [{ start: 3, end: 4 }] },
    });
    const sparse = crop('sparse', 'full-sun');

    const plot = resolvePlotConditions({ light: 'full-sun', soil: { texture: 'loam' } });
    const ranked = rankPlants([sparse, known], plot);

    expect(ranked.map((entry) => entry.plant.id)).toEqual(['known', 'sparse']);
  });

  it('is deterministic and independent of the input order', () => {
    const plants = [
      crop('beetroot', 'full-sun'),
      crop('carrot', 'full-sun'),
      crop('kale', 'full-sun'),
    ];

    const forwards = rankPlants(plants, SUNNY_PLOT).map((entry) => entry.plant.id);
    const backwards = rankPlants([...plants].reverse(), SUNNY_PLOT).map((entry) => entry.plant.id);

    // All three tie on score and confidence, so the name tie-break decides —
    // and it decides the same way whichever order they arrived in.
    expect(forwards).toEqual(['beetroot', 'carrot', 'kale']);
    expect(backwards).toEqual(forwards);
  });

  it('breaks a score tie on confidence before falling back to the name', () => {
    // Both score 1 on what they state; "zucchini" knows more about itself, so it
    // outranks "aubergine" despite losing the alphabetical tie-break.
    const vague = crop('aubergine', 'full-sun');
    const detailed = crop('zucchini', 'full-sun', { hardiness: { rhsRating: 'H5' } });

    const ranked = rankPlants([vague, detailed], SUNNY_PLOT);

    expect(ranked.map((entry) => entry.plant.id)).toEqual(['zucchini', 'aubergine']);
  });

  it('handles an empty plant list', () => {
    expect(rankPlants([], SUNNY_PLOT)).toEqual([]);
  });

  describe('the all-shade plot (a Workplan edge case)', () => {
    const plants = [crop('sun-lover', 'full-sun'), crop('dappled', 'partial-shade')];

    it('marks full-sun crops unsuitable and floats shade-tolerant ones to the top', () => {
      const ranked = rankPlants(plants, SHADY_PLOT);

      expect(ranked[0].plant.id).toBe('dappled');
      expect(ranked[0].suitability.band).toBe('fair');
      expect(ranked[1].suitability.band).toBe('unsuitable');
      expect(ranked[1].suitability.limitedBy).toEqual(['light']);
    });

    it('still returns every crop by default — the UI decides what to show', () => {
      expect(rankPlants(plants, SHADY_PLOT)).toHaveLength(2);
    });

    it('returns nothing when every crop is unsuitable (the "no matching plants" case)', () => {
      const fullSunOnly = [crop('sun-lover', 'full-sun'), crop('tomato', 'full-sun')];

      expect(rankPlants(fullSunOnly, SHADY_PLOT, { excludeUnsuitable: true })).toEqual([]);
    });
  });

  it('filters below a minimum ranking score', () => {
    const plants = [crop('sun-lover', 'full-sun'), crop('dappled', 'partial-shade')];

    // 0.675 for the sun-lover, 0.5525 for the shade-tolerant one.
    const ranked = rankPlants(plants, SUNNY_PLOT, { minimumScore: 0.6 });

    expect(ranked.map((entry) => entry.plant.id)).toEqual(['sun-lover']);
    expect(rankPlants(plants, SUNNY_PLOT, { minimumScore: 0.99 })).toEqual([]);
  });

  it('limits the result after sorting, not before', () => {
    const plants = [crop('dappled', 'partial-shade'), crop('sun-lover', 'full-sun')];

    const ranked = rankPlants(plants, SUNNY_PLOT, { limit: 1 });

    expect(ranked.map((entry) => entry.plant.id)).toEqual(['sun-lover']);
    expect(rankPlants(plants, SUNNY_PLOT, { limit: 0 })).toEqual([]);
  });

  it('combines filters', () => {
    const plants = [
      crop('sun-lover', 'full-sun'),
      crop('dappled', 'partial-shade'),
      crop('shade-lover', 'full-shade'),
    ];

    const ranked = rankPlants(plants, SHADY_PLOT, { excludeUnsuitable: true, limit: 1 });

    expect(ranked.map((entry) => entry.plant.id)).toEqual(['shade-lover']);
  });
});
