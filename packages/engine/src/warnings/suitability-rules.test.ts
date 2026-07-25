import { describe, it, expect } from 'vitest';
import { validatePlant, type Hardiness, type Plant, type Seasons } from '../schema/plant';
import { resolveClimate } from '../climate/resolve';
import type { ClimateProfile } from '../climate/schema';
import type { PlotConditions } from '../suitability/conditions';
import { rectangleRegion } from '../spacing/region';
import type { CropPlacement } from './model';
import { suitabilityWarningsFor } from './suitability-rules';

function plantWith(overrides: {
  light?: Plant['light'];
  hardiness?: Hardiness;
  seasons?: Seasons;
}): Plant {
  return validatePlant({
    id: 'test-crop',
    commonName: 'Test Crop',
    scientificName: 'Testum cropii',
    gbifId: null,
    category: 'vegetable',
    light: overrides.light ?? 'full-sun',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    ...(overrides.hardiness === undefined ? {} : { hardiness: overrides.hardiness }),
    ...(overrides.seasons === undefined ? {} : { seasons: overrides.seasons }),
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

const BED = rectangleRegion(100, 100);
const UK_DEFAULT: ClimateProfile = resolveClimate();
const HIGHLANDS: ClimateProfile = resolveClimate({
  kind: 'region',
  regionId: 'scotland-highlands',
});

function placementOf(plant: Plant, count = 1): CropPlacement {
  return { id: 'bed-1', plant, region: BED, count };
}

describe('suitabilityWarningsFor', () => {
  it('raises wrong-light at severity "severe" for a full-sun crop in full shade (unsuitable finding)', () => {
    const plant = plantWith({ light: 'full-sun' });
    const conditions: PlotConditions = { light: 'full-shade', climate: UK_DEFAULT };

    const warnings = suitabilityWarningsFor(placementOf(plant), conditions);
    const lightWarning = warnings.find((w) => w.kind === 'wrong-light');

    expect(lightWarning).toMatchObject({
      kind: 'wrong-light',
      severity: 'severe',
      finding: 'unsuitable',
      subjects: [{ placementId: 'bed-1', plantId: 'test-crop' }],
    });
    expect(lightWarning?.reason).toContain('Test Crop —');
  });

  it('does not raise wrong-light for a one-step surplus (marginal finding, score 0.65)', () => {
    // A one-step *shade* deficit scores 0.45 (mismatch, warning-worthy — see
    // the test above); a one-step *sun* surplus is the gentler asymmetric case
    // (ADR 0012 §5) and scores 0.65, which lands as `marginal`.
    const plant = plantWith({ light: 'partial-shade' });
    const conditions: PlotConditions = { light: 'full-sun', climate: UK_DEFAULT };

    const warnings = suitabilityWarningsFor(placementOf(plant), conditions);
    expect(warnings.find((w) => w.kind === 'wrong-light')).toBeUndefined();
  });

  it('raises wrong-light at severity "warning" for a one-step shade deficit (mismatch finding, score 0.45)', () => {
    const plant = plantWith({ light: 'full-sun' });
    const conditions: PlotConditions = { light: 'partial-shade', climate: UK_DEFAULT };

    const warnings = suitabilityWarningsFor(placementOf(plant), conditions);
    expect(warnings.find((w) => w.kind === 'wrong-light')).toMatchObject({
      severity: 'warning',
      finding: 'mismatch',
    });
  });

  it('raises climate-mismatch at severity "severe" for a tender crop in a harsh region (unsuitable finding)', () => {
    const plant = plantWith({ hardiness: { rhsRating: 'H1a' } });
    const conditions: PlotConditions = { light: 'full-sun', climate: HIGHLANDS };

    const warnings = suitabilityWarningsFor(placementOf(plant), conditions);
    const climateWarning = warnings.find((w) => w.kind === 'climate-mismatch');

    expect(climateWarning).toMatchObject({
      kind: 'climate-mismatch',
      severity: 'severe',
      finding: 'unsuitable',
    });
  });

  it('raises no warning for hardiness/season when the crop carries no data (unknown-plant)', () => {
    const plant = plantWith({});
    const conditions: PlotConditions = { light: 'full-sun', climate: HIGHLANDS, plantingMonth: 9 };

    const warnings = suitabilityWarningsFor(placementOf(plant), conditions);
    expect(warnings.some((w) => w.kind === 'climate-mismatch')).toBe(false);
    expect(warnings.some((w) => w.kind === 'wrong-sowing-season')).toBe(false);
  });

  it('raises wrong-sowing-season at severity "warning" for a month well outside the sowing window (mismatch, never unsuitable)', () => {
    const plant = plantWith({ seasons: { sow: [{ start: 3, end: 4 }] } });
    const conditions: PlotConditions = { light: 'full-sun', climate: UK_DEFAULT, plantingMonth: 9 };

    const warnings = suitabilityWarningsFor(placementOf(plant), conditions);
    const seasonWarning = warnings.find((w) => w.kind === 'wrong-sowing-season');

    expect(seasonWarning).toMatchObject({
      kind: 'wrong-sowing-season',
      severity: 'warning',
      finding: 'mismatch',
    });
    // Season never floors at 0 (ADR 0012 §4), so it can never reach "severe" via this rule.
  });

  it('raises no warning at all when light matches and the rest is unassessable (soil is never one of the five kinds)', () => {
    const plant = plantWith({});
    const conditions: PlotConditions = {
      light: 'full-sun',
      climate: UK_DEFAULT,
      soil: { texture: 'clay' },
    };
    // A soil mismatch (if any) is not one of the five warning kinds this stage
    // produces, and light/season/hardiness are all a match or unassessed here.
    expect(suitabilityWarningsFor(placementOf(plant), conditions)).toHaveLength(0);
  });
});
