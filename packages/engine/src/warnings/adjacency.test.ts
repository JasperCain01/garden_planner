import { describe, it, expect } from 'vitest';
import { rectangleRegion } from '../spacing/region';
import type { Spacing } from '../schema/plant';
import { adjacencyThresholdCm, regionDistanceCm } from './adjacency';

/** Move every vertex of a rectangle region by `(dx, dy)`. */
function translate(region: ReturnType<typeof rectangleRegion>, dx: number, dy: number) {
  return { vertices: region.vertices.map((v) => ({ x: v.x + dx, y: v.y + dy })) };
}

describe('regionDistanceCm', () => {
  it('is zero for touching beds (sharing an edge)', () => {
    const bedA = rectangleRegion(100, 100); // [0,100] x [0,100]
    const bedB = translate(rectangleRegion(100, 100), 100, 0); // [100,200] x [0,100]
    expect(regionDistanceCm(bedA, bedB)).toBe(0);
  });

  it('is zero for overlapping beds', () => {
    const bedA = rectangleRegion(100, 100);
    const bedB = translate(rectangleRegion(100, 100), 50, 50);
    expect(regionDistanceCm(bedA, bedB)).toBe(0);
  });

  it('is zero when one bed is entirely inside another', () => {
    const outer = rectangleRegion(500, 500);
    const inner = translate(rectangleRegion(50, 50), 200, 200);
    expect(regionDistanceCm(outer, inner)).toBe(0);
  });

  it('measures the real gap between two separated beds', () => {
    const bedA = rectangleRegion(100, 100); // [0,100] x [0,100]
    const bedB = translate(rectangleRegion(100, 100), 130, 0); // [130,230] x [0,100]
    expect(regionDistanceCm(bedA, bedB)).toBeCloseTo(30, 6);
  });

  it('measures a diagonal gap correctly (not the axis-aligned shortcut)', () => {
    const bedA = rectangleRegion(100, 100); // [0,100] x [0,100]
    const bedB = translate(rectangleRegion(100, 100), 130, 130); // [130,230] x [130,230]
    // Nearest corners are (100,100) and (130,130): distance = sqrt(30^2+30^2).
    expect(regionDistanceCm(bedA, bedB)).toBeCloseTo(Math.sqrt(30 * 30 + 30 * 30), 6);
  });

  it('is symmetric', () => {
    const bedA = rectangleRegion(100, 100);
    const bedB = translate(rectangleRegion(60, 60), 250, 40);
    expect(regionDistanceCm(bedA, bedB)).toBeCloseTo(regionDistanceCm(bedB, bedA), 6);
  });

  it('is zero for a plus-shaped overlap where neither bed has a vertex inside the other', () => {
    // A wide-short rectangle and a narrow-tall one, crossing like a "+". Every
    // corner of each lies outside the other (e.g. bedA's (0,40) has x=0, well
    // outside bedB's x:[40,60] span), so the two containment checks at the top
    // of `regionDistanceCm` both find nothing — this exercises the edge-pair
    // scan's own zero-distance path (`segmentsIntersect`), not containment.
    const bedA = {
      vertices: [
        { x: 0, y: 40 },
        { x: 100, y: 40 },
        { x: 100, y: 60 },
        { x: 0, y: 60 },
      ],
    };
    const bedB = {
      vertices: [
        { x: 40, y: 0 },
        { x: 60, y: 0 },
        { x: 60, y: 100 },
        { x: 40, y: 100 },
      ],
    };
    expect(regionDistanceCm(bedA, bedB)).toBe(0);
  });

  it('treats a degenerate (zero-length) edge as the single point it collapses to', () => {
    // A hand-drawn outline can end up with two coincident corners (a dragged
    // corner dropped exactly onto its neighbour). `distancePointToSegment`'s
    // degenerate-segment branch keeps this from producing NaN or Infinity.
    const point = {
      vertices: [
        { x: 300, y: 300 },
        { x: 300, y: 300 },
        { x: 300, y: 300 },
      ],
    };
    const bed = rectangleRegion(100, 100); // [0,100] x [0,100]
    expect(regionDistanceCm(point, bed)).toBeCloseTo(Math.sqrt(200 * 200 + 200 * 200), 6);
  });
});

describe('adjacencyThresholdCm', () => {
  it('takes the larger of the two crops’ resolved between-row distances', () => {
    const narrow: Spacing = { row: { inRowCm: 10, betweenRowCm: 20 } };
    const wide: Spacing = { row: { inRowCm: 45, betweenRowCm: 60 } };
    expect(adjacencyThresholdCm(narrow, wide)).toBe(60);
    expect(adjacencyThresholdCm(wide, narrow)).toBe(60);
  });

  it('derives a distance for an intensive-only crop rather than failing', () => {
    // Onion-like: 9 per 30 cm square -> derived side 10 cm, used as both distances.
    const intensiveOnly: Spacing = { intensive: { plantsPerSquare: 9 } };
    const rowOnly: Spacing = { row: { inRowCm: 10, betweenRowCm: 30 } };
    expect(adjacencyThresholdCm(intensiveOnly, rowOnly)).toBe(30);
  });
});
