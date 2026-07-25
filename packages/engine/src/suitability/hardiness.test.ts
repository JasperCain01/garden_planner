import { describe, it, expect } from 'vitest';
import { validatePlant, type Hardiness, type Plant } from '../schema/plant.ts';
import { resolveClimate } from '../climate/resolve.ts';
import type { ClimateProfile } from '../climate/schema.ts';
import type { PlotConditions } from './conditions';
import { scoreHardiness } from './hardiness';

/** A minimal valid plant carrying (or not carrying) a hardiness block. */
function plantWith(hardiness?: Hardiness): Plant {
  return validatePlant({
    id: 'test-crop',
    commonName: 'Test Crop',
    scientificName: 'Testum cropii',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    ...(hardiness === undefined ? {} : { hardiness }),
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

const UK_DEFAULT = resolveClimate(); // H4
const HIGHLANDS = resolveClimate({ kind: 'region', regionId: 'scotland-highlands' }); // H6

function plotIn(climate: ClimateProfile): PlotConditions {
  return { light: 'full-sun', climate };
}

describe('scoreHardiness', () => {
  it('reports unknown — not a default — when the crop has no hardiness data', () => {
    const result = scoreHardiness(plantWith(), plotIn(UK_DEFAULT));

    expect(result).toMatchObject({
      dimension: 'hardiness',
      finding: 'unknown-plant',
      score: null,
      weight: 0.3,
    });
    expect(result.reason).toContain('No hardiness data for this crop');
    // This is the entire shipped dataset's case today (0/160 carry hardiness).
    expect(result.score).toBeNull();
  });

  it('scores a crop hardier than the region needs as a full match', () => {
    const result = scoreHardiness(plantWith({ rhsRating: 'H6' }), plotIn(UK_DEFAULT));

    expect(result).toMatchObject({ finding: 'match', score: 1 });
    expect(result.reason).toContain('hardy enough');
  });

  it('does not reward being hardier than necessary', () => {
    const justEnough = scoreHardiness(plantWith({ rhsRating: 'H4' }), plotIn(UK_DEFAULT));
    const overkill = scoreHardiness(plantWith({ rhsRating: 'H7' }), plotIn(UK_DEFAULT));

    expect(justEnough.score).toBe(1);
    expect(overkill.score).toBe(1);
  });

  it('calls one band short marginal, with the "average winter" caveat', () => {
    const result = scoreHardiness(plantWith({ rhsRating: 'H3' }), plotIn(UK_DEFAULT));

    expect(result).toMatchObject({ finding: 'marginal', score: 0.6 });
    expect(result.reason).toContain('one band short');
  });

  it('calls two bands short a mismatch that needs protection', () => {
    const result = scoreHardiness(plantWith({ rhsRating: 'H2' }), plotIn(UK_DEFAULT));

    expect(result).toMatchObject({ finding: 'mismatch', score: 0.3 });
    expect(result.reason).toContain('two bands short');
  });

  it('calls a tender crop in a cold region unsuitable', () => {
    // A tender H2 crop in the Scottish Highlands (H6) — four bands short.
    const result = scoreHardiness(plantWith({ rhsRating: 'H2' }), plotIn(HIGHLANDS));

    expect(result).toMatchObject({ finding: 'unsuitable', score: 0 });
    expect(result.reason).toContain('4 bands short');
    expect(result.reason).toContain(HIGHLANDS.name);
  });

  it('falls back to °C when the crop quotes no RHS band', () => {
    // The UK default profile's H4 floor is -10 °C.
    expect(UK_DEFAULT.hardiness.minTempC).toBe(-10);

    expect(scoreHardiness(plantWith({ minTempC: -15 }), plotIn(UK_DEFAULT))).toMatchObject({
      finding: 'match',
      score: 1,
    });
    expect(scoreHardiness(plantWith({ minTempC: -9 }), plotIn(UK_DEFAULT))).toMatchObject({
      finding: 'marginal',
      score: 0.6,
    });
    expect(scoreHardiness(plantWith({ minTempC: -5 }), plotIn(UK_DEFAULT))).toMatchObject({
      finding: 'mismatch',
      score: 0.3,
    });
    expect(scoreHardiness(plantWith({ minTempC: 5 }), plotIn(UK_DEFAULT))).toMatchObject({
      finding: 'unsuitable',
      score: 0,
    });
  });

  it('prefers the band comparison when both sides carry a band', () => {
    // The °C figure would say "unsuitable"; the bands say "hardy enough". Bands
    // win, because that is the vocabulary both sides are authored in.
    const result = scoreHardiness(plantWith({ rhsRating: 'H5', minTempC: 5 }), plotIn(UK_DEFAULT));

    expect(result).toMatchObject({ finding: 'match', score: 1 });
  });

  it('reports unknown rather than converting between incomparable measures', () => {
    const bandOnlyRegion: ClimateProfile = {
      ...UK_DEFAULT,
      hardiness: { rhsRating: 'H4' },
    };
    const result = scoreHardiness(plantWith({ minTempC: -12 }), plotIn(bandOnlyRegion));

    expect(result).toMatchObject({ finding: 'unknown-plant', score: null });
    expect(result.reason).toContain('different measures');
  });
});
