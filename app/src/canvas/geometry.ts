/**
 * Pure pixel ⟷ centimetre conversion for the plot canvas (`PlotCanvas.tsx`,
 * Workplan Stage 3.4). Kept separate from the component for the same reason
 * `plot/outline-ops.ts` and `palette/filters.ts` are: plain data in, plain
 * data out, testable with no DOM, no Konva, no canvas element at all.
 *
 * **The same fixed-scale trick as `PlotOutlineEditor`** (ADR 0016): the
 * canvas's rendered size is set to exactly `(bounds + padding) * PX_PER_CM`,
 * so converting a pixel offset within the canvas element to a plot
 * centimetre position is pure arithmetic — no `getBoundingClientRect`/
 * `getScreenCTM` call, both awkward-to-nonexistent under jsdom. This module
 * does **not** reuse `PlotOutlineEditor`'s `PX_PER_CM` constant or import it
 * — the brief is explicit that the canvas may pick its own scale (plant
 * icons need to stay legible at a size a handful of polygon-corner handles
 * never had to justify), and importing across sibling features would couple
 * two components that Stage 3.2 deliberately kept independent.
 */

import type { PlotRegion } from '@garden-planner/engine';

/** Rendered screen pixels per plot centimetre on the plot canvas. */
export const PX_PER_CM = 0.6;

/** Padding around the outline's bounding box, in plot centimetres, so edge-placed plants and the outline stroke aren't clipped. */
export const CANVAS_PADDING_CM = 40;

/** A point in the region's own centimetre frame (the same frame `PlotRegion.vertices` uses). */
export interface CmPoint {
  readonly x: number;
  readonly y: number;
}

/** A point in canvas pixels, relative to the canvas element's top-left corner. */
export interface PxPoint {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned bounds of a region's vertices, in centimetres — the frame every conversion below is relative to. */
export interface RegionBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

/** The bounding box of `region`'s vertices, unpadded. */
export function regionBounds(region: PlotRegion): RegionBounds {
  const xs = region.vertices.map((vertex) => vertex.x);
  const ys = region.vertices.map((vertex) => vertex.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** The canvas element's rendered size, in pixels, for `region` at `pxPerCm` — the padded bounding box, scaled. */
export function canvasSizePx(
  region: PlotRegion,
  pxPerCm: number = PX_PER_CM,
): { readonly width: number; readonly height: number } {
  const bounds = regionBounds(region);
  return {
    width: (bounds.width + CANVAS_PADDING_CM * 2) * pxPerCm,
    height: (bounds.height + CANVAS_PADDING_CM * 2) * pxPerCm,
  };
}

/** Convert a centimetre position to a pixel position on the canvas element (top-left origin). */
export function cmToPx(point: CmPoint, region: PlotRegion, pxPerCm: number = PX_PER_CM): PxPoint {
  const bounds = regionBounds(region);
  return {
    x: (point.x - bounds.minX + CANVAS_PADDING_CM) * pxPerCm,
    y: (point.y - bounds.minY + CANVAS_PADDING_CM) * pxPerCm,
  };
}

/** The inverse of {@link cmToPx}: a pixel position on the canvas element back to a centimetre position. */
export function pxToCm(point: PxPoint, region: PlotRegion, pxPerCm: number = PX_PER_CM): CmPoint {
  const bounds = regionBounds(region);
  return {
    x: point.x / pxPerCm + bounds.minX - CANVAS_PADDING_CM,
    y: point.y / pxPerCm + bounds.minY - CANVAS_PADDING_CM,
  };
}

/**
 * Clamp a centimetre position to the region's bounding box.
 *
 * Not full polygon containment — a plant dropped in the notch of an L-shaped
 * plot still lands at the clamped point even though that point may be
 * outside the real outline. Whether a placement is actually *inside* the
 * plot is a validation question, and validation is explicitly Stage 3.5's
 * job (`docs/stage-3.4-brief.md`); this is only a sanity clamp so a drop
 * outside the canvas element (or a drag flung past its edge) can't land a
 * plant thousands of centimetres from the plot.
 */
export function clampToBounds(point: CmPoint, region: PlotRegion): CmPoint {
  const bounds = regionBounds(region);
  return {
    x: Math.min(Math.max(point.x, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(point.y, bounds.minY), bounds.maxY),
  };
}
