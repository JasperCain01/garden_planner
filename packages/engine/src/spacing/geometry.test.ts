import { describe, it, expect } from 'vitest';
import type { Point } from './geometry';
import {
  findSelfIntersection,
  pointInPolygon,
  polygonArea,
  polygonBoundingBox,
  polygonSignedArea,
  polygonWinding,
  rectInsidePolygon,
  segmentCrossesRectInterior,
  segmentsIntersect,
} from './geometry';

/**
 * The plane-geometry primitives, tested on shapes small enough to check by
 * hand. Everything the calculator claims about *shape* — that an L-shape counts
 * fewer plants than its bounding box, that a folded outline is rejected, that
 * winding doesn't matter — rests on these four functions being right.
 */

/** The unit square scaled up: 10 cm × 10 cm, counter-clockwise from the origin. */
const SQUARE: Point[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

/**
 * An L: the 10 × 10 square with a 5 × 5 bite out of the top-right corner.
 * Area = 100 − 25 = 75 cm².
 */
const L_SHAPE: Point[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 5 },
  { x: 5, y: 5 },
  { x: 5, y: 10 },
  { x: 0, y: 10 },
];

describe('polygon area (shoelace)', () => {
  it('measures a rectangle', () => {
    // 10 × 10 = 100 cm².
    expect(polygonArea(SQUARE)).toBe(100);
  });

  it('measures a non-convex L-shape as the rectangle minus the notch', () => {
    // 10 × 10 − 5 × 5 = 75 cm². The shoelace formula handles the re-entrant
    // corner with no special case, which is exactly why it is the area used.
    expect(polygonArea(L_SHAPE)).toBe(75);
  });

  it('measures a triangle', () => {
    // Base 10, height 6 → ½ · 10 · 6 = 30 cm².
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 4, y: 6 },
      ]),
    ).toBe(30);
  });

  it('reports zero for collinear corners', () => {
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe(0);
  });

  it('is winding-independent, though the signed area is not', () => {
    const reversed = [...SQUARE].reverse();
    expect(polygonSignedArea(SQUARE)).toBe(100);
    expect(polygonSignedArea(reversed)).toBe(-100);
    expect(polygonArea(reversed)).toBe(100);
  });

  it('is translation-independent', () => {
    const moved = L_SHAPE.map((vertex) => ({ x: vertex.x - 137.5, y: vertex.y + 4000 }));
    expect(polygonArea(moved)).toBeCloseTo(75, 9);
  });
});

describe('polygonWinding', () => {
  it('names both directions, and calls a flat ring degenerate', () => {
    expect(polygonWinding(SQUARE)).toBe('counter-clockwise');
    expect(polygonWinding([...SQUARE].reverse())).toBe('clockwise');
    expect(
      polygonWinding([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe('degenerate');
  });
});

describe('polygonBoundingBox', () => {
  it('spans the extremes, whatever order the vertices arrive in', () => {
    expect(polygonBoundingBox(L_SHAPE)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10,
      widthCm: 10,
      heightCm: 10,
    });
  });

  it('handles negative coordinates (the origin is the caller’s business)', () => {
    const box = polygonBoundingBox([
      { x: -30, y: -10 },
      { x: -10, y: -10 },
      { x: -10, y: 20 },
    ]);
    expect(box).toMatchObject({ minX: -30, minY: -10, widthCm: 20, heightCm: 30 });
  });
});

describe('pointInPolygon', () => {
  it('separates inside from outside on a convex shape', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, SQUARE)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, SQUARE)).toBe(false);
    expect(pointInPolygon({ x: -0.5, y: 5 }, SQUARE)).toBe(false);
  });

  it('excludes the notch of a non-convex shape', () => {
    // (7, 7) is inside the L's *bounding box* but inside the bite, not the plot.
    expect(pointInPolygon({ x: 7, y: 7 }, L_SHAPE)).toBe(false);
    expect(pointInPolygon({ x: 7, y: 3 }, L_SHAPE)).toBe(true);
    expect(pointInPolygon({ x: 3, y: 7 }, L_SHAPE)).toBe(true);
  });

  it('counts a ray passing exactly through a vertex once, not twice', () => {
    // y = 5 runs straight through two of the L's corners. The half-open
    // crossing rule is what stops this classic case flipping the answer.
    expect(pointInPolygon({ x: 2, y: 5 }, L_SHAPE)).toBe(true);
    expect(pointInPolygon({ x: 12, y: 5 }, L_SHAPE)).toBe(false);
  });
});

describe('segmentCrossesRectInterior', () => {
  const rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

  it('sees a segment cutting across', () => {
    expect(segmentCrossesRectInterior({ x: -5, y: 5 }, { x: 15, y: 5 }, rect)).toBe(true);
  });

  it('ignores a segment lying exactly along an edge', () => {
    // The case that decides whether a 200 cm bed at 10 cm spacing reports 20
    // columns or 18: the plot outline sits precisely on the outer cells' edges.
    expect(segmentCrossesRectInterior({ x: -5, y: 0 }, { x: 15, y: 0 }, rect)).toBe(false);
    expect(segmentCrossesRectInterior({ x: 10, y: -5 }, { x: 10, y: 15 }, rect)).toBe(false);
  });

  it('ignores a segment that stops short, and one that only touches a corner', () => {
    expect(segmentCrossesRectInterior({ x: -5, y: 5 }, { x: -1, y: 5 }, rect)).toBe(false);
    expect(segmentCrossesRectInterior({ x: -5, y: 5 }, { x: 0, y: 0 }, rect)).toBe(false);
  });

  it('sees a segment that ends inside', () => {
    expect(segmentCrossesRectInterior({ x: -5, y: 5 }, { x: 5, y: 5 }, rect)).toBe(true);
  });
});

describe('rectInsidePolygon', () => {
  it('accepts a cell that touches the outline but does not cross it', () => {
    expect(rectInsidePolygon({ minX: 0, minY: 0, maxX: 5, maxY: 5 }, SQUARE)).toBe(true);
  });

  it('rejects a cell that hangs over the edge', () => {
    expect(rectInsidePolygon({ minX: 8, minY: 0, maxX: 13, maxY: 5 }, SQUARE)).toBe(false);
  });

  it('rejects a cell straddling a re-entrant corner, and one inside the notch', () => {
    // Straddling the L's notch: the corner's edges cut through the cell.
    expect(rectInsidePolygon({ minX: 3, minY: 3, maxX: 8, maxY: 8 }, L_SHAPE)).toBe(false);
    // Wholly inside the bite that was removed: no edge crosses it, but its
    // centre is outside — which is the second half of the containment test.
    expect(rectInsidePolygon({ minX: 6, minY: 6, maxX: 9, maxY: 9 }, L_SHAPE)).toBe(false);
  });

  it('accepts a cell in each arm of the L', () => {
    expect(rectInsidePolygon({ minX: 5, minY: 0, maxX: 10, maxY: 5 }, L_SHAPE)).toBe(true);
    expect(rectInsidePolygon({ minX: 0, minY: 5, maxX: 5, maxY: 10 }, L_SHAPE)).toBe(true);
  });
});

describe('segmentsIntersect', () => {
  it('sees a crossing, a touch and a collinear overlap', () => {
    const crossing = segmentsIntersect(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    );
    const touching = segmentsIntersect(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 10 },
    );
    const overlapping = segmentsIntersect(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 0 },
      { x: 15, y: 0 },
    );
    expect([crossing, touching, overlapping]).toEqual([true, true, true]);
  });

  it('leaves disjoint segments alone', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 }),
    ).toBe(false);
  });
});

describe('findSelfIntersection', () => {
  it('passes a simple convex outline and a simple non-convex one', () => {
    expect(findSelfIntersection(SQUARE)).toBeNull();
    expect(findSelfIntersection(L_SHAPE)).toBeNull();
  });

  it('catches a bow-tie — one corner dragged across the opposite edge', () => {
    const bowTie: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(findSelfIntersection(bowTie)).not.toBeNull();
  });

  it('catches a pinch where an edge grazes a far vertex', () => {
    const pinched: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 },
    ];
    expect(findSelfIntersection(pinched)).not.toBeNull();
  });

  it('catches a spike that folds back along its own edge', () => {
    // No vertex repeats, so the duplicate-corner rule would miss this one.
    const spike: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(findSelfIntersection(spike)).not.toBeNull();
  });

  it('allows a redundant corner sitting mid-edge', () => {
    // A free-form editor lets you add a corner without moving it. That is a
    // pointless corner, not a broken outline, and rejecting it would fight the UI.
    const withRedundantCorner: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(findSelfIntersection(withRedundantCorner)).toBeNull();
  });

  it('names the two conflicting edges so the UI can point at them', () => {
    const bowTie: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    // Edge 0 is (0,0)→(10,10); edge 2 is (10,0)→(0,10). They cross at (5,5).
    expect(findSelfIntersection(bowTie)).toEqual({ edgeA: 0, edgeB: 2 });
  });
});
