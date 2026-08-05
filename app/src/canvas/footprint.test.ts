import { describe, expect, it } from 'vitest';
import { validatePlant, type Plant } from '@garden-planner/engine';
import {
  canopyRadiusPx,
  footprintDiameterCm,
  iconRadiusPx,
  MAX_ICON_RADIUS_PX,
  MIN_MARKER_RADIUS_PX,
  spacingLabel,
} from './footprint.ts';

function plantWith(spacing: Plant['spacing'], commonName = 'Fixture'): Plant {
  return validatePlant({
    id: commonName.toLowerCase().replace(/\s+/g, '-'),
    commonName,
    scientificName: 'Fixtura test',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing,
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

/** The two crops the review names: "a squash visibly needs more room than a radish". Real figures from `data/plants.json`. */
const RADISH = plantWith({ row: { inRowCm: 3, betweenRowCm: 15 } }, 'Radish');
const BUTTERNUT_SQUASH = plantWith({ row: { inRowCm: 150, betweenRowCm: 90 } }, 'Butternut Squash');

describe('footprintDiameterCm', () => {
  it('is the crop’s wider spacing dimension, matching `warnings/placement-derivation.ts`’s footprint square', () => {
    expect(footprintDiameterCm(RADISH)).toBe(15);
    expect(footprintDiameterCm(BUTTERNUT_SQUASH)).toBe(150);
  });

  it('resolves a crop that only carries an intensive figure, the same way `fitPlant` would', () => {
    // 9 per 30cm square → a 10cm square each (`resolveLatticeSpacing`), so the
    // footprint is isotropic and 10cm across, not undefined.
    const intensiveOnly = plantWith({ intensive: { plantsPerSquare: 9 } }, 'Intensive Onion');
    expect(footprintDiameterCm(intensiveOnly)).toBeCloseTo(10, 9);
  });
});

describe('canopyRadiusPx', () => {
  it('scales with the crop’s footprint, so a squash claims far more ground than a radish', () => {
    const pxPerCm = 2;
    expect(canopyRadiusPx(RADISH, pxPerCm)).toBe(15);
    expect(canopyRadiusPx(BUTTERNUT_SQUASH, pxPerCm)).toBe(150);
  });

  it('scales with the canvas, so zooming in grows the canopy with the plot', () => {
    expect(canopyRadiusPx(BUTTERNUT_SQUASH, 1)).toBe(75);
    expect(canopyRadiusPx(BUTTERNUT_SQUASH, 4)).toBe(300);
  });

  it('never draws a marker too small to click, however far the canvas is zoomed out', () => {
    expect(canopyRadiusPx(RADISH, 0.05)).toBe(MIN_MARKER_RADIUS_PX);
  });
});

describe('iconRadiusPx', () => {
  it('caps the icon so one large crop’s canopy doesn’t become a giant picture', () => {
    expect(iconRadiusPx(BUTTERNUT_SQUASH, 2)).toBe(MAX_ICON_RADIUS_PX);
  });

  it('never exceeds the canopy it sits on', () => {
    // A tiny crop at a low scale: canopy is at its floor, and the icon must
    // stay inside it rather than spilling out of the disc.
    expect(iconRadiusPx(RADISH, 0.05)).toBe(MIN_MARKER_RADIUS_PX);
    expect(iconRadiusPx(RADISH, 0.05)).toBeLessThanOrEqual(canopyRadiusPx(RADISH, 0.05));
  });
});

describe('spacingLabel', () => {
  it('reads like a seed packet', () => {
    expect(spacingLabel(BUTTERNUT_SQUASH)).toBe('150 × 90 cm apart');
  });

  it('gives a derived figure one decimal place rather than sixteen', () => {
    const intensiveOnly = plantWith({ intensive: { plantsPerSquare: 4 } }, 'Intensive Lettuce');
    expect(spacingLabel(intensiveOnly)).toBe('15 × 15 cm apart');
  });
});
