/**
 * Pure pixel ⟷ centimetre conversion for the plot canvas (`PlotCanvas.tsx`,
 * Workplan Stage 3.4). Kept separate from the component for the same reason
 * `plot/outline-ops.ts` and `palette/filters.ts` are: plain data in, plain
 * data out, testable with no DOM, no Konva, no canvas element at all.
 *
 * **The scale is live now (UI redesign Phase 2).** Until this phase every
 * function here defaulted `pxPerCm` to a fixed `PX_PER_CM = 0.6`, and every
 * caller took the default — so the app's signature feature drew the default
 * 3×2m plot as a ~228×168px rectangle no matter how much room it had. That
 * constant is gone and `pxPerCm` is a **required** parameter throughout. It is
 * required rather than defaulted deliberately: the two callers most likely to
 * be forgotten (`drop.ts`, which converts a drop point, and `export.ts`, which
 * rasterises the stage) fail *silently* when they use a scale the stage isn't
 * drawn at — a plant lands somewhere the user didn't drop it, an export
 * changes size — and a required parameter turns both into compile errors
 * instead. {@link fitPxPerCm} computes the live value from the viewport's
 * measured size; {@link FALLBACK_PX_PER_CM} is what an unmeasured viewport
 * falls back to, and is the old constant's value so a pre-measurement render
 * looks exactly like it used to rather than collapsing to nothing.
 *
 * **The fixed-scale trick still holds** (ADR 0016, and ADR 0031 for what
 * changed): the canvas's rendered size is set to exactly
 * `(bounds + padding) * pxPerCm`, so converting a pixel offset within the
 * canvas element to a plot centimetre position stays pure arithmetic — no
 * `getBoundingClientRect`/`getScreenCTM` call, both awkward-to-nonexistent
 * under jsdom. What changed is only *where the ratio comes from*: a measured
 * viewport rather than a literal. Everything downstream of it is the same
 * arithmetic it always was.
 */

import type { Plant, PlotRegion } from '@garden-planner/engine';
import { footprintDiameterCm } from './footprint.ts';

/**
 * The scale used when the viewport hasn't been measured yet — the first render
 * before the `ResizeObserver` reports, and every jsdom component test (jsdom
 * implements no layout, so every element measures 0×0 there forever).
 *
 * It is the value of the `PX_PER_CM` constant this phase removed, so a canvas
 * that never gets measured renders exactly the size it did before Phase 2
 * rather than at some new arbitrary number.
 */
export const FALLBACK_PX_PER_CM = 0.6;

/**
 * The scale clamp. The floor stops an enormous plot (a 100m field, which
 * `PlotRegionSchema` happily accepts) from being scaled down to an
 * indistinguishable smudge — past this point the stage simply overflows and
 * the viewport scrolls, which is a scrollbar rather than a blank screen. The
 * ceiling stops zoom from producing a stage so large that Konva is
 * rasterising tens of megapixels for a 3m bed.
 */
export const MIN_PX_PER_CM = 0.05;
/** See {@link MIN_PX_PER_CM}. */
export const MAX_PX_PER_CM = 6;

/**
 * Pixels of slack left on each axis when fitting, so "fits exactly" cannot
 * round into "overflows by half a pixel".
 *
 * The canvas viewport is `overflow: auto` and its measured *content* box is
 * what the fit is computed from, so a stage one pixel too wide would raise a
 * scrollbar, which shrinks the content box, which re-fits smaller, which drops
 * the scrollbar — a measurement loop that flickers rather than settles. Two
 * pixels of slack are invisible and make the loop impossible to enter at the
 * fitted scale.
 */
const FIT_SLACK_PX = 2;

/** Padding around the outline's bounding box, in plot centimetres, so edge-placed plants, the outline stroke and the dimension labels aren't clipped. */
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

/** A measured element's content box, in CSS pixels. */
export interface ViewportPx {
  readonly width: number;
  readonly height: number;
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

/** Hold `pxPerCm` inside {@link MIN_PX_PER_CM}…{@link MAX_PX_PER_CM}. */
export function clampPxPerCm(pxPerCm: number): number {
  return Math.min(Math.max(pxPerCm, MIN_PX_PER_CM), MAX_PX_PER_CM);
}

/**
 * The scale at which `region`'s **padded** bounding box exactly fills
 * `viewport` — the "scale to fit" of UI redesign Phase 2's first bullet.
 *
 * The padded box, not the bare outline, because the padding is where the
 * dimension labels and the outline stroke live: fitting the raw bounds would
 * put both under the viewport's edge. Whichever axis runs out first wins
 * (`Math.min`), so the whole plot is always visible and its aspect ratio is
 * never distorted.
 *
 * An unmeasured viewport (`0`, `NaN`, a negative from some future caller)
 * yields {@link FALLBACK_PX_PER_CM} rather than `Infinity` or `0` — see that
 * constant for why it is the number it is. The `> 0` test is written that way
 * round on purpose: `NaN > 0` is false, so `NaN` takes the fallback branch too.
 */
export function fitPxPerCm(region: PlotRegion, viewport: ViewportPx): number {
  if (!(viewport.width > 0) || !(viewport.height > 0)) {
    return FALLBACK_PX_PER_CM;
  }
  const bounds = regionBounds(region);
  return clampPxPerCm(
    Math.min(
      (viewport.width - FIT_SLACK_PX) / (bounds.width + CANVAS_PADDING_CM * 2),
      (viewport.height - FIT_SLACK_PX) / (bounds.height + CANVAS_PADDING_CM * 2),
    ),
  );
}

/** The canvas element's rendered size, in pixels, for `region` at `pxPerCm` — the padded bounding box, scaled. */
export function canvasSizePx(
  region: PlotRegion,
  pxPerCm: number,
): { readonly width: number; readonly height: number } {
  const bounds = regionBounds(region);
  return {
    width: (bounds.width + CANVAS_PADDING_CM * 2) * pxPerCm,
    height: (bounds.height + CANVAS_PADDING_CM * 2) * pxPerCm,
  };
}

/** Convert a centimetre position to a pixel position on the canvas element (top-left origin). */
export function cmToPx(point: CmPoint, region: PlotRegion, pxPerCm: number): PxPoint {
  const bounds = regionBounds(region);
  return {
    x: (point.x - bounds.minX + CANVAS_PADDING_CM) * pxPerCm,
    y: (point.y - bounds.minY + CANVAS_PADDING_CM) * pxPerCm,
  };
}

/** The inverse of {@link cmToPx}: a pixel position on the canvas element back to a centimetre position. */
export function pxToCm(point: PxPoint, region: PlotRegion, pxPerCm: number): CmPoint {
  const bounds = regionBounds(region);
  return {
    x: point.x / pxPerCm + bounds.minX - CANVAS_PADDING_CM,
    y: point.y / pxPerCm + bounds.minY - CANVAS_PADDING_CM,
  };
}

/**
 * The centre of a region's bounding box, in centimetres.
 *
 * Was the drop position for the keyboard-operable "Add to plot" action until
 * UI redesign Phase 2 — see {@link firstFreePosition} for why it no longer is,
 * and note it is still that search's *origin* and its last-resort answer.
 * Always inside the bounding box (hence never needs {@link clampToBounds}).
 */
export function regionCentre(region: PlotRegion): CmPoint {
  const bounds = regionBounds(region);
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

/**
 * The smallest search step {@link firstFreePosition} will use, in centimetres.
 *
 * A crop whose spacing is genuinely tiny (an icicle radish wants 8 cm) would
 * otherwise scatter its instances so close together that the markers overlap
 * anyway, since a marker is never drawn smaller than
 * `footprint.ts`'s `MIN_MARKER_RADIUS_PX` regardless of how little ground the
 * plant needs. This is the one place the search is allowed to know that the
 * answer is looked at, not just computed.
 */
export const MIN_SEARCH_STEP_CM = 20;

/**
 * The first position at least `separationCm` away from every point in
 * `occupied`, searched outward from the region's centre — the fix for what
 * `docs/ui-aesthetic-review.md` calls "the single worst first-run
 * bug-that-isn't-a-bug".
 *
 * **What was wrong.** "Add to plot" (`palette/PlantPalette.tsx`, the
 * keyboard-operable placement path of Workplan Stage 6.2 / ADR 0026) placed
 * every crop at {@link regionCentre}. A pointer drag has a natural drop point;
 * a keyboard activation doesn't, so it needed *some* deterministic answer, and
 * the centre was one. But it is the same answer every time: three clicks
 * produced three markers in one spot and the plot appeared to eat two of them.
 *
 * **The search.** Candidates are walked in square (Chebyshev) rings of
 * `step` centimetres around the centre, each ring's candidates ordered by true
 * distance so the result grows outward as a rough spiral rather than a square.
 * The first candidate that is inside the bounding box and at least `step` from
 * every occupied point wins. Deterministic, allocation-light, and — the
 * reason it lives here rather than in the component — a pure function of three
 * plain values, so `geometry.test.ts` can pin the actual positions rather than
 * a component test asserting "they're different somehow".
 *
 * **The step is one number, not a per-pair calculation.** `separationCm` is
 * the incoming plant's own footprint ({@link plantSeparationCm}), not some
 * combination of it and each neighbour's. A pair only needs the larger of the
 * two to be clear of the other, and the crop being placed is the one whose
 * room the user is asking about; carrying a radius per occupied point would
 * buy a slightly tighter packing for a good deal more arithmetic, in a
 * function whose job is "somewhere visibly free", not "optimal packing"
 * (`fitPlant` is what answers that, and the feedback panel already prints it).
 *
 * **When the plot is full** — every ring exhausted with nothing free — the
 * centre comes back, i.e. the old behaviour, stacking and all. That is the
 * honest answer: there is nowhere free, the plot really is that crowded, and
 * the count feedback below the canvas is already saying so. Silently placing
 * it outside the plot instead would be worse.
 *
 * @param occupied - every currently-placed position, in the region's own
 * centimetre frame. Not grouped by crop: a squash needs room from a radish
 * just as much as from another squash.
 */
export function firstFreePosition(
  region: PlotRegion,
  occupied: readonly CmPoint[],
  separationCm: number,
): CmPoint {
  const bounds = regionBounds(region);
  const centre = regionCentre(region);
  const step = Math.max(separationCm, MIN_SEARCH_STEP_CM);

  // One ring more than it takes to cross the plot's larger dimension: past
  // that every candidate is outside the bounding box and the loop is only
  // burning cycles to reach the same fallback.
  const maxRing = Math.ceil(Math.max(bounds.width, bounds.height) / step) + 1;

  for (let ring = 0; ring <= maxRing; ring += 1) {
    for (const candidate of ringCandidates(centre, ring, step)) {
      if (
        candidate.x < bounds.minX ||
        candidate.x > bounds.maxX ||
        candidate.y < bounds.minY ||
        candidate.y > bounds.maxY
      ) {
        continue;
      }
      const isFree = occupied.every(
        (point) => Math.hypot(point.x - candidate.x, point.y - candidate.y) >= step,
      );
      if (isFree) {
        return candidate;
      }
    }
  }

  return centre;
}

/**
 * The `ring`-th square ring of candidates around `centre`, `step` centimetres
 * apart, nearest-first.
 *
 * Ring 0 is the centre itself. Ring _r_ is every offset whose Chebyshev
 * distance from the centre is exactly _r_ — the perimeter of a
 * `(2r+1)×(2r+1)` grid. Sorting each ring by true (Euclidean) distance is what
 * makes the walk read as a spiral: the four orthogonal neighbours come before
 * the four diagonal ones, which are `√2` further away. `Array#sort` is stable
 * in every engine this app targets, so equal distances keep generation order
 * and the whole function stays deterministic.
 */
function ringCandidates(centre: CmPoint, ring: number, step: number): CmPoint[] {
  if (ring === 0) {
    return [centre];
  }
  const candidates: CmPoint[] = [];
  for (let dy = -ring; dy <= ring; dy += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
        continue;
      }
      candidates.push({ x: centre.x + dx * step, y: centre.y + dy * step });
    }
  }
  return candidates.sort(
    (a, b) =>
      Math.hypot(a.x - centre.x, a.y - centre.y) - Math.hypot(b.x - centre.x, b.y - centre.y),
  );
}

/**
 * How much clear ground a crop wants around it before another plant is "on top
 * of it", in centimetres — {@link firstFreePosition}'s `separationCm`.
 *
 * The crop's own spacing footprint (`footprint.ts`), which is also what the
 * marker's canopy disc is drawn at and what `warnings/placement-derivation.ts`
 * already treats as a placement's personal space. Using the same figure for
 * all three means the scatter puts markers exactly far enough apart not to
 * overlap on screen, which is the thing the user actually sees.
 */
export function plantSeparationCm(plant: Plant): number {
  return footprintDiameterCm(plant);
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
