import { describe, it, expect } from 'vitest';
import { validatePlant, type LightRequirement, type Plant } from '../schema/plant.ts';
import { UK_DEFAULT_CLIMATE_PROFILE } from '../climate/regions.ts';
import type { PlotConditions } from './conditions';
import { scoreLight } from './light';

/** A minimal valid plant with a given light requirement — light is all this suite scores. */
function plantWanting(light: LightRequirement): Plant {
  return validatePlant({
    id: 'test-crop',
    commonName: 'Test Crop',
    scientificName: 'Testum cropii',
    gbifId: null,
    category: 'vegetable',
    light,
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

function plotWith(light: LightRequirement): PlotConditions {
  return { light, climate: UK_DEFAULT_CLIMATE_PROFILE };
}

describe('scoreLight', () => {
  it('scores an exact match perfectly, and says so', () => {
    const result = scoreLight(plantWanting('full-sun'), plotWith('full-sun'));

    expect(result).toMatchObject({ dimension: 'light', finding: 'match', score: 1, weight: 0.35 });
    expect(result.reason).toBe('Wants full sun, and the plot is in full sun.');
  });

  it('penalises a plot one step too shady, and explains the cost', () => {
    const result = scoreLight(plantWanting('full-sun'), plotWith('partial-shade'));

    expect(result).toMatchObject({ finding: 'mismatch', score: 0.45 });
    expect(result.reason).toContain('lighter crop');
  });

  it('calls a full-sun crop in full shade unsuitable — the one hard light verdict', () => {
    const result = scoreLight(plantWanting('full-sun'), plotWith('full-shade'));

    expect(result).toMatchObject({ finding: 'unsuitable', score: 0 });
    expect(result.reason).toContain("light is the one thing a shaded bed can't be given");
  });

  it('is gentler about too much sun than too little light', () => {
    const tooDark = scoreLight(plantWanting('full-sun'), plotWith('partial-shade'));
    const tooBright = scoreLight(plantWanting('partial-shade'), plotWith('full-sun'));

    // Same one-step distance, deliberately different scores: you can shade a
    // sunny bed, but you cannot light a shaded one.
    expect(tooBright.score).toBeGreaterThan(tooDark.score ?? 0);
    expect(tooBright).toMatchObject({ finding: 'marginal', score: 0.65 });
    expect(tooBright.reason).toContain('bolting');
  });

  it('never calls too much sun unsuitable, even at two steps', () => {
    const result = scoreLight(plantWanting('full-shade'), plotWith('full-sun'));

    expect(result).toMatchObject({ finding: 'mismatch', score: 0.15 });
    expect(result.finding).not.toBe('unsuitable');
    expect(result.reason).toContain('scorch');
  });

  it('scores every combination of the ordered enum', () => {
    // The full 3×3 table, as documentation of the model. Rows are what the crop
    // wants, columns are what the plot offers.
    const table: Record<LightRequirement, Record<LightRequirement, number>> = {
      'full-sun': { 'full-sun': 1, 'partial-shade': 0.45, 'full-shade': 0 },
      'partial-shade': { 'full-sun': 0.65, 'partial-shade': 1, 'full-shade': 0.45 },
      'full-shade': { 'full-sun': 0.15, 'partial-shade': 0.65, 'full-shade': 1 },
    };

    for (const [wanted, byPlot] of Object.entries(table)) {
      for (const [offered, expected] of Object.entries(byPlot)) {
        const result = scoreLight(
          plantWanting(wanted as LightRequirement),
          plotWith(offered as LightRequirement),
        );
        expect(result.score, `${wanted} crop in a ${offered} plot`).toBe(expected);
      }
    }
  });
});
