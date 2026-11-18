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
  // A one-line wrapper over the engine's pointInPolygon, which
  // packages/engine/src/spacing/geometry.test.ts tests in depth (convex and
  // non-convex shapes, rays through vertices). One non-convex case proves the
  // wrapper passes the outline through rather than, say, its bounding box.
  it('uses the real outline, so a point in an L-shape’s notch is outside', () => {
    // 400×300 with a 150×150 notch out of the top-right corner: (350, 250) is
    // inside the bounding box but inside the notch.
    const region: PlotRegion = lShapeRegion({
      widthCm: 400,
      heightCm: 300,
      notchWidthCm: 150,
      notchHeightCm: 150,
    });
    expect(isInsideRegion({ x: 350, y: 50 }, region)).toBe(true);
    expect(isInsideRegion({ x: 350, y: 250 }, region)).toBe(false);
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
