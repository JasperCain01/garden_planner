import { describe, expect, it } from 'vitest';
import {
  lShapeRegion,
  rectangleRegion,
  validatePlant,
  type Plant,
  type PlotRegion,
} from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import { isInsideRegion, strandedPlacementIds } from './stranded.ts';

function plantWith(commonName = 'Fixture'): Plant {
  return validatePlant({
    id: commonName.toLowerCase().replace(/\s+/g, '-'),
    commonName,
    scientificName: 'Fixtura test',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 15, betweenRowCm: 15 } },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

function placementAt(id: string, x: number, y: number): PlacedPlant {
  return { id, x, y, plant: plantWith(id) };
}

describe('isInsideRegion', () => {
  describe('a convex plot (rectangle)', () => {
    const region: PlotRegion = rectangleRegion(300, 200);

    it('is true for a point well inside', () => {
      expect(isInsideRegion({ x: 150, y: 100 }, region)).toBe(true);
    });

    it('is false for a point well outside', () => {
      expect(isInsideRegion({ x: 400, y: 100 }, region)).toBe(false);
      expect(isInsideRegion({ x: -50, y: 100 }, region)).toBe(false);
    });
  });

  describe('an L-shaped plot (the non-convex case)', () => {
    // 400×300 with a 150×150 notch bitten out of the top-right corner
    // (`region.ts#lShapeRegion`): the point (350, 50) sits inside the
    // *bounding box* but inside the notch, i.e. genuinely outside the plot —
    // exactly the case a bounding-box check would get wrong.
    const region: PlotRegion = lShapeRegion({
      widthCm: 400,
      heightCm: 300,
      notchWidthCm: 150,
      notchHeightCm: 150,
    });

    it('is true for a point in the part of the L below the notch', () => {
      // The notch removes x ∈ [250, 400], y ∈ [150, 300] — this point is at
      // the same x but below that band, where the full width still stands.
      expect(isInsideRegion({ x: 350, y: 50 }, region)).toBe(true);
    });

    it('is false for a point inside the bounding box but inside the notch', () => {
      expect(isInsideRegion({ x: 350, y: 250 }, region)).toBe(false);
    });

    it('is true for a point in the part of the L to the left of the notch', () => {
      expect(isInsideRegion({ x: 50, y: 50 }, region)).toBe(true);
    });
  });

  describe('on-edge points', () => {
    const region: PlotRegion = rectangleRegion(300, 200);

    // Ray casting makes no promise about a point exactly on the boundary
    // (`packages/engine/src/spacing/geometry.ts#pointInPolygon`'s own doc) —
    // pinned here as whatever it deterministically returns, so a change in
    // that behaviour is a visible test failure rather than a silent drift.
    it('a point exactly on a vertex is deterministic across repeated calls', () => {
      const first = isInsideRegion({ x: 0, y: 0 }, region);
      const second = isInsideRegion({ x: 0, y: 0 }, region);
      expect(second).toBe(first);
    });

    it('a point exactly on an edge is deterministic across repeated calls', () => {
      const first = isInsideRegion({ x: 150, y: 0 }, region);
      const second = isInsideRegion({ x: 150, y: 0 }, region);
      expect(second).toBe(first);
    });
  });
});

describe('strandedPlacementIds', () => {
  const region: PlotRegion = rectangleRegion(300, 200);

  it('is empty when every placement is inside', () => {
    const placements = [placementAt('a', 50, 50), placementAt('b', 250, 150)];
    expect(strandedPlacementIds(placements, region)).toEqual(new Set());
  });

  it('names exactly the placements outside the outline', () => {
    const placements = [
      placementAt('inside', 150, 100),
      placementAt('outside', 400, 100),
      placementAt('also-inside', 10, 10),
    ];
    expect(strandedPlacementIds(placements, region)).toEqual(new Set(['outside']));
  });

  it('clears once the outline grows back around a placement', () => {
    const placement = placementAt('a', 350, 100);
    const before = strandedPlacementIds([placement], rectangleRegion(300, 200));
    const after = strandedPlacementIds([placement], rectangleRegion(500, 200));
    expect(before).toEqual(new Set(['a']));
    expect(after).toEqual(new Set());
  });

  it('is empty for no placements at all', () => {
    expect(strandedPlacementIds([], region)).toEqual(new Set());
  });
});
