import { describe, it, expect } from 'vitest';
import {
  MAX_REGION_VERTICES,
  circleRegion,
  lShapeRegion,
  rectangleRegion,
  regionAreaCm2,
  regionAreaSquareMetres,
  regionBoundingBox,
  safeValidatePlotRegion,
  validatePlotRegion,
} from './region';

/**
 * The plot-region schema. Two things are being pinned here: that the presets
 * are genuinely factories for one polygon type (so the free-form path is the
 * *only* path), and that the outlines a free-form editor really produces —
 * folded, collapsed, flattened — are rejected with something the UI can show.
 */

describe('a valid outline', () => {
  it('accepts a hand-built triangle, the smallest legal plot', () => {
    const region = validatePlotRegion({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ],
    });
    expect(region.vertices).toHaveLength(3);
    expect(regionAreaCm2(region)).toBe(5000);
  });

  it('accepts either winding, and measures both the same', () => {
    const clockwise = validatePlotRegion({
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 0 },
      ],
    });
    expect(regionAreaCm2(clockwise)).toBe(20_000);
    expect(regionAreaCm2(rectangleRegion(200, 100))).toBe(20_000);
  });

  it('accepts negative coordinates — the frame’s origin is the caller’s', () => {
    expect(() =>
      validatePlotRegion({
        vertices: [
          { x: -500, y: -500 },
          { x: -400, y: -500 },
          { x: -400, y: -400 },
        ],
      }),
    ).not.toThrow();
  });
});

describe('a rejected outline', () => {
  /** The message zod produced, joined so a test can assert on the wording. */
  function messageFor(input: unknown): string {
    const result = safeValidatePlotRegion(input);
    expect(result.success).toBe(false);
    return result.success ? '' : result.error.issues.map((issue) => issue.message).join(' | ');
  }

  it('needs at least three corners', () => {
    expect(
      messageFor({
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      }),
    ).toContain('at least 3 corners');
    expect(messageFor({ vertices: [{ x: 0, y: 0 }] })).toContain('at least 3 corners');
    expect(messageFor({ vertices: [] })).toContain('at least 3 corners');
  });

  it('rejects a self-intersecting outline, naming the offending edges', () => {
    // A corner dragged across the opposite edge — one mouse gesture in Stage
    // 3.2's editor, and the reason self-intersection is a routine user error
    // rather than a defensive check.
    const message = messageFor({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ],
    });
    expect(message).toContain('crosses itself');
    expect(message).toContain('corner 0');
    expect(message).toContain('corner 2');
  });

  it('rejects an outline whose corners all lie on one line', () => {
    expect(
      messageFor({
        vertices: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
          { x: 25, y: 0 },
        ],
      }),
    ).toMatch(/crosses itself|encloses no area/);
  });

  it('rejects an explicitly closed ring, and says the closing edge is implied', () => {
    const message = messageFor({
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 0 },
      ],
    });
    expect(message).toContain('must not be repeated at the end');
  });

  it('rejects a corner dragged exactly on top of its neighbour', () => {
    expect(
      messageFor({
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      }),
    ).toContain('same place');
  });

  it('rejects a non-finite or missing coordinate', () => {
    expect(
      messageFor({
        vertices: [
          { x: 0, y: 0 },
          { x: Number.POSITIVE_INFINITY, y: 0 },
          { x: 0, y: 100 },
        ],
      }),
    ).not.toBe('');
    expect(messageFor({ vertices: [{ x: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] })).not.toBe('');
  });

  it('rejects unknown keys, like every other schema in the project', () => {
    expect(messageFor({ vertices: rectangleRegion(10, 10).vertices, unitsAreMetres: true })).toBe(
      "Unrecognized key(s) in object: 'unitsAreMetres'",
    );
  });

  it('rejects an outline with more corners than a hand-drawn plot could have', () => {
    const tooMany = Array.from({ length: MAX_REGION_VERTICES + 1 }, (_unused, index) => ({
      x: index,
      y: index % 2,
    }));
    expect(messageFor({ vertices: tooMany })).toContain('at most');
  });

  it('throws from validatePlotRegion, mirroring validatePlant', () => {
    expect(() => validatePlotRegion({ vertices: [{ x: 0, y: 0 }] })).toThrow();
  });
});

describe('presets', () => {
  it('builds a rectangle anticlockwise from the origin', () => {
    const bed = rectangleRegion(200, 100);
    expect(bed.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
    ]);
    expect(regionAreaSquareMetres(bed)).toBe(2);
    expect(regionBoundingBox(bed)).toMatchObject({ widthCm: 200, heightCm: 100 });
  });

  it('builds an L-shape whose area is the rectangle minus the notch', () => {
    // 300 × 300 = 90,000 cm², less a 150 × 150 = 22,500 cm² bite → 67,500 cm².
    const plot = lShapeRegion({
      widthCm: 300,
      heightCm: 300,
      notchWidthCm: 150,
      notchHeightCm: 150,
    });
    expect(plot.vertices).toHaveLength(6);
    expect(regionAreaCm2(plot)).toBe(67_500);
    // Its bounding box is the full rectangle — which is the whole point of the
    // shape-vs-area distinction the calculator makes.
    expect(regionBoundingBox(plot)).toMatchObject({ widthCm: 300, heightCm: 300 });
  });

  it('approximates a circle closely enough, and conservatively', () => {
    const bed = circleRegion(200);
    const trueArea = Math.PI * 100 * 100;
    expect(regionAreaCm2(bed)).toBeLessThan(trueArea);
    expect(regionAreaCm2(bed)).toBeGreaterThan(trueArea * 0.99);
  });

  it('refuses nonsensical dimensions with a sentence about the dimension', () => {
    expect(() => rectangleRegion(0, 100)).toThrow(/width must be a positive number/);
    expect(() => rectangleRegion(100, -1)).toThrow(/height must be a positive number/);
    expect(() =>
      lShapeRegion({ widthCm: 100, heightCm: 100, notchWidthCm: 100, notchHeightCm: 50 }),
    ).toThrow(/notch width .* must be less than the width/);
    expect(() =>
      lShapeRegion({ widthCm: 100, heightCm: 100, notchWidthCm: 50, notchHeightCm: 200 }),
    ).toThrow(/notch height .* must be less than the height/);
    expect(() => circleRegion(100, 2)).toThrow(/at least 3 segments/);
  });

  it('produces regions that pass the schema — a preset can never be invalid', () => {
    for (const region of [
      rectangleRegion(1, 1),
      lShapeRegion({ widthCm: 500, heightCm: 400, notchWidthCm: 1, notchHeightCm: 399 }),
      circleRegion(30, 3),
      circleRegion(1000, 256),
    ]) {
      expect(safeValidatePlotRegion(region).success).toBe(true);
    }
  });
});
