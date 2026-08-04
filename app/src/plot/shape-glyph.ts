/**
 * The outline drawn on a shape tile, as SVG (UI redesign Phase 4). Pure data
 * in, pure data out, no React — the same split `canvas/geometry.ts` and
 * `palette/filters.ts` already use, so the interesting part is unit-testable
 * without rendering anything.
 *
 * **The glyph is built by the engine factory the tile applies.** `ShapePicker`
 * turns the user's metres into a `PlotRegion` with `rectangleRegion` /
 * `lShapeRegion` / `circleRegion`; this calls the *same* function with the
 * *same* dimensions and draws the polygon that comes back. So a tile is not an
 * illustration of a rectangle — it is the outline you will get, at the aspect
 * you will get it, including the L's notch moving as you retype its size.
 * Nothing here re-derives a shape the engine already knows how to make.
 *
 * **It reads the picker's own metre state, never `plot-store`'s region.**
 * `region.ts`'s module doc is explicit that "nothing remembers it was a
 * preset": once the outline has been dragged on the canvas there is no width
 * and height to read back off the polygon. A tile fed from the committed region
 * would start redrawing itself when a corner is dragged — showing a shape the
 * picker cannot rebuild — so the input here is the form's dimensions and only
 * the form's dimensions. `ShapePicker` holds them; this converts them.
 *
 * **A bad number draws the empty tile, it does not throw.** The factories raise
 * `RangeError` on a nonsensical dimension (zero, negative, a notch bigger than
 * the plot) and the field it came from is mid-edit for as long as it takes to
 * type "0.5" — the "0." is transiently invalid. A tile that vanished, or a
 * render that threw, would punish typing; {@link shapeGlyph} returns `null`
 * instead and the tile falls back to a neutral outline until the number makes
 * sense again. The *error message* still belongs to the apply path, which is
 * where the user asked for a shape.
 */

import type { PlotRegion } from '@garden-planner/engine';
import { circleRegion, lShapeRegion, rectangleRegion } from '@garden-planner/engine';
import { metresToCm } from './units.ts';

/** The three presets `ShapePicker` offers, and the discriminant of {@link ShapeDimensions}. */
export type Preset = 'rectangle' | 'l-shape' | 'circle';

/** Every dimension the picker holds, in metres — its whole form state, less the current preset. */
export interface ShapeDimensions {
  readonly rectangle: { readonly widthM: number; readonly heightM: number };
  readonly lShape: {
    readonly widthM: number;
    readonly heightM: number;
    readonly notchWidthM: number;
    readonly notchHeightM: number;
  };
  readonly circle: { readonly diameterM: number };
}

/** An SVG `<polygon>`'s worth of geometry: the points, and the `viewBox` they were normalised into. */
export interface ShapeGlyph {
  /** `"x,y x,y …"`, ready for a `<polygon points>` attribute. */
  readonly points: string;
  /** `"0 0 w h"`, where `w`/`h` are the outline's own proportions — so `preserveAspectRatio` scales the glyph to the tile without distorting it. */
  readonly viewBox: string;
}

/** Either the region a preset's dimensions describe, or the engine's own reason they don't. */
export type BuildResult =
  | { readonly ok: true; readonly region: PlotRegion }
  | { readonly ok: false; readonly message: string };

/**
 * Build the `PlotRegion` a preset's current dimensions describe.
 *
 * One function for two callers on purpose: the tiles draw what it returns and
 * "Use this shape" applies what it returns, so the two cannot disagree about
 * what "L-shape, 4 × 3, notch 1.5 × 1" is.
 *
 * A result type rather than a throw, because the failing case is *ordinary*
 * here — this runs on every keystroke to redraw the tiles, and half of typing
 * "0.5" is an invalid dimension. It carries the factory's own message rather
 * than a flag, so the picker can show the engine's words ("notch width (1000)
 * must be less than the width (400)") without re-implementing the rule that
 * produced them.
 */
export function buildRegion(preset: Preset, dimensions: ShapeDimensions): BuildResult {
  try {
    if (preset === 'rectangle') {
      return {
        ok: true,
        region: rectangleRegion(
          metresToCm(dimensions.rectangle.widthM),
          metresToCm(dimensions.rectangle.heightM),
        ),
      };
    }
    if (preset === 'l-shape') {
      return {
        ok: true,
        region: lShapeRegion({
          widthCm: metresToCm(dimensions.lShape.widthM),
          heightCm: metresToCm(dimensions.lShape.heightM),
          notchWidthCm: metresToCm(dimensions.lShape.notchWidthM),
          notchHeightCm: metresToCm(dimensions.lShape.notchHeightM),
        }),
      };
    }
    return { ok: true, region: circleRegion(metresToCm(dimensions.circle.diameterM)) };
  } catch (thrown) {
    return {
      ok: false,
      message: thrown instanceof Error ? thrown.message : 'could not build that shape',
    };
  }
}

/**
 * The tile glyph for `preset` at the picker's current dimensions, or `null`
 * when those dimensions don't build a shape.
 *
 * The polygon is translated to the origin and left at its own centimetre
 * scale — the `viewBox` carries the size, so the SVG element scales it to
 * whatever the tile is and `preserveAspectRatio` keeps the proportions honest.
 * A 5 × 0.5 m bed therefore draws as a sliver, which is the point: the review
 * asks for "the actual aspect from current dimensions", and a shape picker
 * whose rectangle is always a pleasant golden rectangle is telling the user
 * nothing about their plot.
 */
export function shapeGlyph(preset: Preset, dimensions: ShapeDimensions): ShapeGlyph | null {
  const built = buildRegion(preset, dimensions);
  if (!built.ok) {
    return null;
  }
  const { region } = built;
  const xs = region.vertices.map((vertex) => vertex.x);
  const ys = region.vertices.map((vertex) => vertex.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;

  // A degenerate box would make the viewBox `0 0 0 h` and SVG would refuse to
  // scale it. The factories reject zero-width shapes, so this is belt and
  // braces against a future preset rather than a case reachable today.
  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  return {
    points: region.vertices
      .map((vertex) => `${round(vertex.x - minX)},${round(vertex.y - minY)}`)
      .join(' '),
    viewBox: `0 0 ${round(width)} ${round(height)}`,
  };
}

/** Two decimal places — enough for a 32-gon's vertices at any plot size, and short enough that the attribute stays readable in the DOM. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
