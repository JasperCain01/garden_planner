import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant, type Soil } from '../schema/plant.ts';
import { UK_DEFAULT_CLIMATE_PROFILE } from '../climate/regions.ts';
import type { PlotConditions, PlotSoil } from './conditions';
import { scoreSoil } from './soil';

function plantWith(soil?: Soil): Plant {
  return validatePlant({
    id: 'test-crop',
    commonName: 'Test Crop',
    scientificName: 'Testum cropii',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    ...(soil === undefined ? {} : { soil }),
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

function plotWith(soil?: PlotSoil): PlotConditions {
  return { light: 'full-sun', climate: UK_DEFAULT_CLIMATE_PROFILE, ...(soil ? { soil } : {}) };
}

const FUSSY_CROP: Soil = {
  textures: ['loam', 'sand'],
  ph: ['neutral'],
  moisture: ['moist'],
};

describe('scoreSoil', () => {
  it('reports unknown-plant when the crop says nothing about soil', () => {
    // Nearly the whole shipped dataset's case today (160/162 carry no soil).
    const result = scoreSoil(plantWith(), plotWith({ texture: 'clay' }));

    expect(result).toMatchObject({
      dimension: 'soil',
      finding: 'unknown-plant',
      score: null,
      weight: 0.2,
    });
    expect(result.reason).toContain('No soil data for this crop');
  });

  it('reports unknown-plot — a distinct, fixable gap — when the user left soil blank', () => {
    const result = scoreSoil(plantWith(FUSSY_CROP), plotWith());

    expect(result).toMatchObject({ finding: 'unknown-plot', score: null });
    expect(result.reason).toContain("plot's soil wasn't described");
  });

  it('scores a full three-facet match perfectly', () => {
    const result = scoreSoil(
      plantWith(FUSSY_CROP),
      plotWith({ texture: 'loam', ph: 'neutral', moisture: 'moist' }),
    );

    expect(result).toMatchObject({ finding: 'match', score: 1 });
    expect(result.reason).toBe("Suits the plot's loam texture, neutral pH and moist conditions.");
  });

  it('averages over the facets, naming what fits and what does not', () => {
    const result = scoreSoil(
      plantWith(FUSSY_CROP),
      plotWith({ texture: 'clay', ph: 'neutral', moisture: 'moist' }),
    );

    // Two matches and one miss: (1 + 1 + 0.3) / 3.
    expect(result.score).toBeCloseTo(2.3 / 3, 10);
    expect(result.finding).toBe('marginal');
    expect(result.reason).toContain('prefers loam or sand texture, not clay');
    expect(result.reason).toContain('amendable');
  });

  it('only scores facets both sides describe', () => {
    // The crop states texture only; the plot's pH must not count against it.
    const result = scoreSoil(
      plantWith({ textures: ['clay'] }),
      plotWith({ texture: 'clay', ph: 'acid' }),
    );

    expect(result).toMatchObject({ finding: 'match', score: 1 });
  });

  it('reports unknown when the two sides describe no facet in common', () => {
    const result = scoreSoil(plantWith({ ph: ['acid'] }), plotWith({ texture: 'clay' }));

    expect(result).toMatchObject({ finding: 'unknown-plant', score: null });
    expect(result.reason).toContain('texture');
  });

  it('never returns 0, so soil alone can never disqualify a crop', () => {
    const worst = scoreSoil(
      plantWith(FUSSY_CROP),
      plotWith({ texture: 'chalk', ph: 'alkaline', moisture: 'dry' }),
    );

    expect(worst.score).toBe(0.3);
    expect(worst.finding).toBe('mismatch');
    expect(worst.finding).not.toBe('unsuitable');
    expect(worst.reason).toContain('job rather than a barrier');
  });

  it('treats pH bands as unordered — "one band out" is not a partial credit', () => {
    const adjacent = scoreSoil(plantWith({ ph: ['neutral'] }), plotWith({ ph: 'acid' }));
    const opposite = scoreSoil(plantWith({ ph: ['acid'] }), plotWith({ ph: 'alkaline' }));

    // Deliberate: ADR 0004 only promises an ordering for light and hardiness.
    expect(adjacent.score).toBe(opposite.score);
  });
});
