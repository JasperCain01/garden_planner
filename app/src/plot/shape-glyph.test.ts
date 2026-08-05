import { describe, expect, it } from 'vitest';
import { validatePlotRegion } from '@garden-planner/engine';
import { buildRegion, shapeGlyph, type ShapeDimensions } from './shape-glyph.ts';

const DIMENSIONS: ShapeDimensions = {
  rectangle: { widthM: 3, heightM: 2 },
  lShape: { widthM: 4, heightM: 3, notchWidthM: 1.5, notchHeightM: 1 },
  circle: { diameterM: 2.5 },
};

/** `"x,y x,y …"` back to numbers, so an assertion can be about geometry rather than about string formatting. */
function parsePoints(points: string): { x: number; y: number }[] {
  return points.split(' ').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
  });
}

describe('buildRegion', () => {
  it('builds the region the engine factory would, in centimetres', () => {
    const built = buildRegion('rectangle', DIMENSIONS);

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(() => validatePlotRegion(built.region)).not.toThrow();
    // 3 x 2 metres, converted at the UI boundary (`units.ts`).
    expect(built.region.vertices).toContainEqual({ x: 300, y: 200 });
  });

  it("carries the factory's own message rather than a flag when a dimension is nonsensical", () => {
    const built = buildRegion('l-shape', {
      ...DIMENSIONS,
      lShape: { ...DIMENSIONS.lShape, notchWidthM: 10 },
    });

    expect(built.ok).toBe(false);
    if (built.ok) return;
    // The engine names the offending dimension and both numbers; the picker
    // shows this verbatim, so a paraphrase here would be a second copy to keep
    // in step.
    expect(built.message).toMatch(/notch width/i);
    expect(built.message).toMatch(/1000/);
  });
});

describe('shapeGlyph', () => {
  it("gives the rectangle tile the current dimensions' own aspect", () => {
    expect(shapeGlyph('rectangle', DIMENSIONS)?.viewBox).toBe('0 0 300 200');

    const tall = shapeGlyph('rectangle', {
      ...DIMENSIONS,
      rectangle: { widthM: 1, heightM: 4 },
    });
    expect(tall?.viewBox).toBe('0 0 100 400');
  });

  it("draws the L's notch where the engine puts it, and moves it as the notch is retyped", () => {
    const before = shapeGlyph('l-shape', DIMENSIONS);
    const after = shapeGlyph('l-shape', {
      ...DIMENSIONS,
      lShape: { ...DIMENSIONS.lShape, notchWidthM: 3 },
    });

    // Six corners, because that is what `lShapeRegion` produces — the tile is
    // the factory's polygon, not an illustration of one.
    expect(parsePoints(before?.points ?? '')).toHaveLength(6);
    expect(before?.points).not.toBe(after?.points);
    // The overall box is unchanged; only the bite out of it moved.
    expect(after?.viewBox).toBe(before?.viewBox);
  });

  it('normalises the polygon to the origin, so the viewBox starts at 0 0', () => {
    const glyph = shapeGlyph('circle', DIMENSIONS);
    const points = parsePoints(glyph?.points ?? '');

    expect(Math.min(...points.map((point) => point.x))).toBe(0);
    expect(Math.min(...points.map((point) => point.y))).toBe(0);
  });

  it('returns null rather than throwing while a dimension is mid-edit', () => {
    // What a field holds after the "0" of "0.5" — invalid, transient, and not
    // an error worth showing. The tile falls back to its empty outline.
    expect(shapeGlyph('rectangle', { ...DIMENSIONS, rectangle: { widthM: 0, heightM: 2 } })).toBe(
      null,
    );
    expect(
      shapeGlyph('circle', {
        ...DIMENSIONS,
        circle: { diameterM: Number.NaN },
      }),
    ).toBe(null);
  });
});
