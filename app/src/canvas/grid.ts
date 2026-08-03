/**
 * Where the plot's grid lines fall (UI redesign Phase 2 — "ground the scene":
 * a subtle grid at 50cm, a stronger one at 1m).
 *
 * Pure arithmetic over a bounding box, kept out of `PlotCanvas.tsx` for the
 * same reason `geometry.ts` is: it is the sort of thing that is either right
 * or off by one line at the edge, and that is a unit test's question, not a
 * question for a Konva scene jsdom cannot render.
 *
 * **Why a grid at all.** `docs/ui-aesthetic-review.md` §2.5: "No grid, no
 * ruler, no north/sun indicator, no plot dimensions. For a tool about
 * *space*, the space itself is unlabelled." A gardener reading "50 plants: 5
 * rows of 10 at 20 × 60 cm" below the canvas had no way to see what 20 cm
 * looked like on it.
 */

import type { RegionBounds } from './geometry.ts';

/** The fainter grid, in centimetres — half a metre, the granularity most seed-packet spacings land near. */
export const MINOR_GRID_CM = 50;

/** The stronger grid, in centimetres. A metre is the unit the plot's own dimensions are quoted in, so it is the one worth counting. */
export const MAJOR_GRID_CM = 100;

/** The x and y offsets, in centimetres, at which grid lines cross `bounds`. */
export interface GridLinesCm {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
}

/**
 * Grid offsets inside `bounds` at `stepCm`, on **absolute multiples of the
 * step** rather than offsets from the plot's own corner.
 *
 * That distinction is the whole design of this function. A grid measured from
 * the outline's top-left corner would slide every time a corner was dragged in
 * edit mode — the lines would move while the plot stayed still, which is
 * exactly backwards. Anchoring to multiples of the step in the region's own
 * coordinate frame makes the grid a property of the *ground*: drag a corner
 * and the plot's edge moves across a grid that stays put, which is what makes
 * "how much bigger did that get?" readable.
 *
 * Both edges are included when they fall exactly on a multiple, since the
 * lines are clipped to the outline anyway and a line lying under the outline
 * stroke costs nothing.
 */
export function gridLinesCm(bounds: RegionBounds, stepCm: number): GridLinesCm {
  return {
    xs: multiplesWithin(bounds.minX, bounds.maxX, stepCm),
    ys: multiplesWithin(bounds.minY, bounds.maxY, stepCm),
  };
}

/** Every multiple of `step` in `[min, max]`, ascending. */
function multiplesWithin(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) {
    values.push(value);
  }
  return values;
}

/**
 * The minor grid with every line the major grid already draws removed, so the
 * two are drawn once each rather than a faint line hiding under every strong
 * one (which would make the strong lines subtly the wrong colour where they
 * overlap, and double the shapes in Konva's hit graph for no benefit).
 */
export function minorGridLinesCm(bounds: RegionBounds): GridLinesCm {
  const minor = gridLinesCm(bounds, MINOR_GRID_CM);
  const isMajor = (value: number) => value % MAJOR_GRID_CM === 0;
  return {
    xs: minor.xs.filter((x) => !isMajor(x)),
    ys: minor.ys.filter((y) => !isMajor(y)),
  };
}

/** The major (1m) grid offsets inside `bounds`. */
export function majorGridLinesCm(bounds: RegionBounds): GridLinesCm {
  return gridLinesCm(bounds, MAJOR_GRID_CM);
}

/** A plot dimension in metres, as it is labelled on the canvas — "3.0 m". */
export function metresLabel(centimetres: number): string {
  return `${(centimetres / 100).toFixed(1)} m`;
}
