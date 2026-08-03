import { describe, expect, it } from 'vitest';
import {
  rectangleRegion,
  validatePlant,
  type Plant,
  type PlotRegion,
} from '@garden-planner/engine';
import {
  CANVAS_PADDING_CM,
  canvasSizePx,
  clampPxPerCm,
  clampToBounds,
  cmToPx,
  FALLBACK_PX_PER_CM,
  firstFreePosition,
  fitPxPerCm,
  MAX_PX_PER_CM,
  MIN_PX_PER_CM,
  MIN_SEARCH_STEP_CM,
  plantSeparationCm,
  pxToCm,
  regionBounds,
  regionCentre,
} from './geometry.ts';

// A 300 x 200 cm rectangle at the origin: vertices (0,0) (300,0) (300,200) (0,200).
const REGION: PlotRegion = rectangleRegion(300, 200);

describe('regionBounds', () => {
  it('reads the axis-aligned bounds off a rectangle region', () => {
    expect(regionBounds(REGION)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 300,
      maxY: 200,
      width: 300,
      height: 200,
    });
  });

  it('handles a region translated away from the origin', () => {
    const shifted: PlotRegion = {
      vertices: REGION.vertices.map((v) => ({ x: v.x + 500, y: v.y - 100 })),
    };
    expect(regionBounds(shifted)).toEqual({
      minX: 500,
      minY: -100,
      maxX: 800,
      maxY: 100,
      width: 300,
      height: 200,
    });
  });
});

describe('canvasSizePx', () => {
  it('scales the padded bounding box by the given px-per-cm ratio', () => {
    const size = canvasSizePx(REGION, 2);
    expect(size).toEqual({
      width: (300 + CANVAS_PADDING_CM * 2) * 2,
      height: (200 + CANVAS_PADDING_CM * 2) * 2,
    });
  });
});

describe('cmToPx / pxToCm', () => {
  it('round-trips a centimetre point through pixels and back', () => {
    const original = { x: 123.4, y: 56.7 };
    const px = cmToPx(original, REGION, 2);
    const back = pxToCm(px, REGION, 2);
    expect(back.x).toBeCloseTo(original.x, 9);
    expect(back.y).toBeCloseTo(original.y, 9);
  });

  it('places the region origin at (padding * pxPerCm, padding * pxPerCm)', () => {
    const px = cmToPx({ x: 0, y: 0 }, REGION, 3);
    expect(px).toEqual({ x: CANVAS_PADDING_CM * 3, y: CANVAS_PADDING_CM * 3 });
  });

  it('places a pixel point at the canvas origin back at the padded-out corner', () => {
    const cm = pxToCm({ x: 0, y: 0 }, REGION, 3);
    expect(cm).toEqual({ x: -CANVAS_PADDING_CM, y: -CANVAS_PADDING_CM });
  });
});

describe('regionCentre', () => {
  it('gives the bounding box midpoint for a rectangle at the origin', () => {
    expect(regionCentre(REGION)).toEqual({ x: 150, y: 100 });
  });

  it('is always inside the bounding box, so clampToBounds never needs to touch it', () => {
    const centre = regionCentre(REGION);
    expect(clampToBounds(centre, REGION)).toEqual(centre);
  });
});

describe('fitPxPerCm', () => {
  // The padded box for REGION is (300 + 80) x (200 + 80) = 380 x 280 cm.
  it('fits the padded bounding box to whichever axis runs out first', () => {
    // 762 wide leaves 760 after the fit slack: 760 / 380 = 2 px/cm. The height
    // is the roomier axis here (562 - 2) / 280 ≈ 2.0, so width wins by a hair.
    expect(fitPxPerCm(REGION, { width: 762, height: 1000 })).toBeCloseTo(2, 9);
    expect(fitPxPerCm(REGION, { width: 5000, height: 562 })).toBeCloseTo(2, 9);
  });

  it('fits the *padded* box, so the dimension labels are never under the viewport edge', () => {
    // If it fitted the bare 300cm width instead, this would come out at 2.53.
    const pxPerCm = fitPxPerCm(REGION, { width: 762, height: 10_000 });
    expect(canvasSizePx(REGION, pxPerCm).width).toBeLessThanOrEqual(762);
  });

  it('falls back to the pre-Phase-2 fixed scale when the viewport has not been measured', () => {
    // jsdom has no layout, so this is what every component test renders at.
    expect(fitPxPerCm(REGION, { width: 0, height: 0 })).toBe(FALLBACK_PX_PER_CM);
    expect(fitPxPerCm(REGION, { width: Number.NaN, height: 500 })).toBe(FALLBACK_PX_PER_CM);
  });

  it('clamps rather than scaling a very large plot into an invisible smudge', () => {
    const field: PlotRegion = rectangleRegion(10_000, 10_000);
    expect(fitPxPerCm(field, { width: 200, height: 200 })).toBe(MIN_PX_PER_CM);
  });

  it('clamps rather than blowing a tiny plot up past the maximum scale', () => {
    const windowBox: PlotRegion = rectangleRegion(20, 20);
    expect(fitPxPerCm(windowBox, { width: 4000, height: 4000 })).toBe(MAX_PX_PER_CM);
  });
});

describe('clampPxPerCm', () => {
  it('holds a scale inside the usable range and leaves one inside it alone', () => {
    expect(clampPxPerCm(0.0001)).toBe(MIN_PX_PER_CM);
    expect(clampPxPerCm(1000)).toBe(MAX_PX_PER_CM);
    expect(clampPxPerCm(1.5)).toBe(1.5);
  });
});

/**
 * The fix for what the review calls "the single worst first-run
 * bug-that-isn't-a-bug": three "Add to plot" presses used to produce three
 * markers in one spot, because every press resolved to `regionCentre`.
 */
describe('firstFreePosition', () => {
  it('returns the centre when nothing is placed', () => {
    expect(firstFreePosition(REGION, [], 50)).toEqual(regionCentre(REGION));
  });

  it('steps to the nearest orthogonal neighbour when the centre is taken', () => {
    // Ring 1 is walked nearest-first, so the four orthogonal candidates (50cm
    // away) are all offered before the diagonals (70.7cm).
    const next = firstFreePosition(REGION, [regionCentre(REGION)], 50);
    expect(Math.hypot(next.x - 150, next.y - 100)).toBeCloseTo(50, 9);
  });

  it('keeps every position at least the separation apart for a run of presses', () => {
    const separation = 50;
    const placed: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i += 1) {
      placed.push(firstFreePosition(REGION, placed, separation));
    }

    expect(new Set(placed.map(({ x, y }) => `${x},${y}`)).size).toBe(8);
    for (let a = 0; a < placed.length; a += 1) {
      for (let b = a + 1; b < placed.length; b += 1) {
        expect(
          Math.hypot(placed[a].x - placed[b].x, placed[a].y - placed[b].y),
        ).toBeGreaterThanOrEqual(separation);
      }
    }
  });

  it('never returns a position outside the plot’s bounding box', () => {
    // A separation wider than the plot itself: every ring-1 candidate is out
    // of bounds, so the search has nowhere to go but the fallback.
    const placed: { x: number; y: number }[] = [];
    for (let i = 0; i < 12; i += 1) {
      const next = firstFreePosition(REGION, placed, 90);
      expect(next.x).toBeGreaterThanOrEqual(0);
      expect(next.x).toBeLessThanOrEqual(300);
      expect(next.y).toBeGreaterThanOrEqual(0);
      expect(next.y).toBeLessThanOrEqual(200);
      placed.push(next);
    }
  });

  it('falls back to the centre once the plot genuinely has no room left', () => {
    // One crop wanting a 400cm berth cannot be followed by a second anywhere
    // in a 3x2m plot. Stacking is then the honest answer — the plot really is
    // that full — rather than placing it outside the outline.
    const centre = regionCentre(REGION);
    expect(firstFreePosition(REGION, [centre], 400)).toEqual(centre);
  });

  it('spaces tiny-footprint crops by the minimum search step, not by their own spacing', () => {
    // A crop wanting 3cm would otherwise scatter closer together than its own
    // marker is drawn (`footprint.ts`'s MIN_MARKER_RADIUS_PX), which looks
    // exactly like the stacking bug this function exists to fix.
    const first = firstFreePosition(REGION, [], 3);
    const second = firstFreePosition(REGION, [first], 3);
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThanOrEqual(
      MIN_SEARCH_STEP_CM,
    );
  });
});

describe('plantSeparationCm', () => {
  const plantWith = (inRowCm: number, betweenRowCm: number): Plant =>
    validatePlant({
      id: 'fixture',
      commonName: 'Fixture',
      scientificName: 'Fixtura test',
      gbifId: null,
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm, betweenRowCm } },
      provenance: { sources: [{ source: 'hand-written test fixture' }] },
    });

  it('is the crop’s wider spacing dimension — the same square `placement-derivation.ts` models', () => {
    expect(plantSeparationCm(plantWith(3, 15))).toBe(15);
    expect(plantSeparationCm(plantWith(150, 90))).toBe(150);
  });
});

describe('clampToBounds', () => {
  it('leaves a point already inside the bounding box untouched', () => {
    expect(clampToBounds({ x: 150, y: 100 }, REGION)).toEqual({ x: 150, y: 100 });
  });

  it('clamps a point outside the bounding box to its nearest edge', () => {
    expect(clampToBounds({ x: -50, y: 5000 }, REGION)).toEqual({ x: 0, y: 200 });
  });
});
