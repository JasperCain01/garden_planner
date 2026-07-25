import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant, type Spacing } from '../schema/plant';
import { rectangleRegion } from '../spacing/region';
import type { CropPlacement } from './model';
import { overcrowdingWarning } from './overcrowding';

function plantWith(spacing: Spacing): Plant {
  return validatePlant({
    id: 'test-crop',
    commonName: 'Test Crop',
    scientificName: 'Testum cropii',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing,
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

// A 1 m^2 bed at 10 x 30 cm row spacing fits floor(100/10) x floor(100/30) = 10 x 3 = 30 plants.
const ONE_SQUARE_METRE = rectangleRegion(100, 100);
const ROW_SPACING: Spacing = { row: { inRowCm: 10, betweenRowCm: 30 } };

describe('overcrowdingWarning', () => {
  it('is silent when the planted count fits', () => {
    const placement: CropPlacement = {
      id: 'bed-1',
      plant: plantWith(ROW_SPACING),
      region: ONE_SQUARE_METRE,
      count: 30,
    };
    expect(overcrowdingWarning(placement)).toBeUndefined();
  });

  it('warns at severity "warning" for a modest excess', () => {
    const placement: CropPlacement = {
      id: 'bed-1',
      plant: plantWith(ROW_SPACING),
      region: ONE_SQUARE_METRE,
      count: 36, // 1.2x of 30 -- below the 1.5x "severe" ratio
    };
    const warning = overcrowdingWarning(placement);
    expect(warning).toMatchObject({
      kind: 'overcrowded',
      severity: 'warning',
      plantedCount: 36,
      maxCount: 30,
      spacingSource: 'recorded',
      subjects: [{ placementId: 'bed-1', plantId: 'test-crop' }],
    });
    expect(warning?.reason).toContain('Test Crop — 36 planted but only 30 fit');
  });

  it('escalates to severity "severe" once the planted count is 1.5x capacity or more', () => {
    const placement: CropPlacement = {
      id: 'bed-1',
      plant: plantWith(ROW_SPACING),
      region: ONE_SQUARE_METRE,
      count: 45, // exactly 1.5x of 30
    };
    expect(overcrowdingWarning(placement)?.severity).toBe('severe');
  });

  it('is always severe when nothing at all fits', () => {
    // A bed far too small for even one plant.
    const tinyBed = rectangleRegion(1, 1);
    const placement: CropPlacement = {
      id: 'bed-1',
      plant: plantWith(ROW_SPACING),
      region: tinyBed,
      count: 1,
    };
    const warning = overcrowdingWarning(placement);
    expect(warning).toMatchObject({ severity: 'severe', maxCount: 0, plantedCount: 1 });
  });

  it('softens its wording when the spacing figure was derived rather than recorded', () => {
    // Intensive-only crop: asking for row-method spacing forces a derivation.
    const intensiveOnly: Spacing = { intensive: { plantsPerSquare: 9 } };
    const placement: CropPlacement = {
      id: 'bed-1',
      plant: plantWith(intensiveOnly),
      region: ONE_SQUARE_METRE,
      count: 200,
      options: { method: 'row' },
    };
    const warning = overcrowdingWarning(placement);
    expect(warning?.spacingSource).toBe('derived-from-intensive');
    expect(warning?.reason).toContain('derived from this crop');
  });
});
