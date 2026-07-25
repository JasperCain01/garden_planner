/**
 * The packing routine — the algorithmic heart of Stage 2.2.
 *
 * ## The algorithm in one paragraph
 *
 * Lay a lattice over the region's **bounding box**, then keep the positions
 * whose plants actually fit inside the **outline**. Square and offset packing
 * are the same routine with a different lattice; a non-convex plot needs no
 * special case, because "does this plant fit?" is asked of the real polygon.
 * That is the difference between a shape-aware count and an area-aware one: on
 * an L-shaped bed, the cells that straddle the notch simply fail the test.
 *
 * ## What "fits" means, precisely
 *
 * Every plant owns an **axis-aligned rectangle**, `inRowCm` along the row by
 * `rowPitchCm` across, centred on it, and a plant is counted only if that whole
 * rectangle lies inside the outline. Three things follow, and they are the
 * decisions the ADR records:
 *
 * - **A plant that half-fits doesn't.** A 106 cm bed at 10 cm spacing holds ten
 *   plants, not eleven: the eleventh's cell would hang 4 cm over the edge.
 * - **The count can never beat the area.** The cells are disjoint and all
 *   inside the outline, so `count × cell area ≤ plot area` — the property test's
 *   upper bound is a theorem here, not an empirical hope.
 * - **Plants may sit right on the boundary.** A cell may touch the outline, so
 *   the outermost plants stand half a spacing in from the edge — which is what
 *   a gardener does at the edge of a raised bed, where there is no neighbouring
 *   plant to crowd. Callers who want a margin (a path, an overhanging fence)
 *   pass `edgeInsetCm`, which inflates the tested rectangle and so erodes the
 *   usable region by that much on every side.
 *
 * ## Where the lattice starts
 *
 * At the bounding box's minimum corner: the first cell spans `[min, min + pitch]`
 * and its plant sits at the centre. The lattice is therefore **anchored to the
 * plot, not to the coordinate origin**, which makes the count
 * translation-invariant — the same allotment drawn at a different offset must
 * count the same. It also makes a rectangle's answer exactly the arithmetic a
 * gardener would do by hand: `floor(width / inRow) × floor(height / pitch)`.
 *
 * The cost of anchoring to the plot is that *growing* a region leftwards or
 * downwards shifts the whole lattice, so a strictly larger plot can very
 * occasionally hold one fewer plant. Anchoring to a fixed global origin would
 * trade that for the far worse property that sliding a plot 3 cm sideways
 * changes its answer. See the ADR.
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import type { BoundingBox, Point, Rect } from './geometry.ts';
import { GEOMETRY_EPSILON, polygonBoundingBox, rectInsidePolygon } from './geometry.ts';
import type { PackingPattern, PlantPosition, RowOrientation } from './model.ts';
import { MAX_CANDIDATE_CELLS, ROW_ORIENTATIONS } from './model.ts';
import type { PlotRegion } from './region.ts';

/**
 * The row pitch that makes offset packing worth doing, and the one piece of
 * arithmetic in this stage that deserves a worked comment.
 *
 * Staggering alternate rows by half an in-row step (`s/2`) moves each plant
 * away from the two it would otherwise sit directly between, which buys room to
 * pull the rows *closer* without bringing any two plants nearer than the crop
 * asks for. How much closer? With rows a pitch `p` apart and a stagger of
 * `s/2`, a plant's nearest neighbour in the next row is
 *
 * ```
 *     d = √( (s/2)² + p² )        (Pythagoras on the stagger and the pitch)
 * ```
 *
 * and we need `d ≥ b`, the crop's between-row clearance. Solving for `p`:
 *
 * ```
 *     p = √( b² − (s/2)² )
 * ```
 *
 * **The classic case.** When the spacing is the same in both directions
 * (`s = b`, which is what an intensive bed's single density figure means), this
 * collapses to the hexagonal-packing constant every gardening book quotes:
 *
 * ```
 *     p = √( s² − s²/4 ) = (√3/2)·s ≈ 0.866·s
 * ```
 *
 * — rows 13.4% closer, so about **15% more plants** in the same bed
 * (`1 / 0.866 = 1.155`). That is the number the tests pin, asymptotically: on a
 * small bed the boundary losses eat most of the gain, and the stagger costs
 * half a column on every other row, so a *small* plot can even come out
 * slightly worse offset than square. The advantage is real but it is a
 * large-bed effect.
 *
 * **Two guards on the general case.** With row spacing much wider than in-row
 * spacing — 45 × 60 cm tomatoes, say — the stagger is small next to the
 * clearance and the formula correctly says the gain is nearly nothing. Two ends
 * of the range still need catching:
 *
 * - if `s/2 ≥ b`, the stagger already exceeds the clearance and there is no
 *   room to pull the rows in at all, so the pitch stays at `b`;
 * - the plants two rows apart sit `2p` apart with no stagger between them, so
 *   `p` may never drop below `b/2` however wide the in-row spacing is. This
 *   caps the gain at 2×, which is reached only for absurdly elongated spacings.
 *
 * @param inRowCm - the crop's in-row spacing `s`.
 * @param betweenRowCm - the crop's between-row clearance `b`.
 * @returns the centre-to-centre row pitch for offset packing, in centimetres.
 */
export function offsetRowPitchCm(inRowCm: number, betweenRowCm: number): number {
  const stagger = inRowCm / 2;
  if (stagger >= betweenRowCm) return betweenRowCm;
  const diagonalPitch = Math.sqrt(betweenRowCm * betweenRowCm - stagger * stagger);
  return Math.max(betweenRowCm / 2, diagonalPitch);
}

/** What to lay out, and how. All distances in centimetres. */
export interface PackingRequest {
  /** Centre-to-centre spacing along a row. */
  readonly inRowCm: number;
  /** The clearance the crop wants between rows. */
  readonly betweenRowCm: number;
  /** Square grid or staggered rows. */
  readonly packing: PackingPattern;
  /** Which way the rows run. */
  readonly orientation: RowOrientation;
  /**
   * A margin to keep clear inside the outline, centimetres. `0` — the default
   * the calculator applies — lets plants sit right up against the boundary.
   */
  readonly edgeInsetCm: number;
}

/** The result of laying one lattice over one region. */
export interface PackingLayout {
  /** Every plant that fits, ordered by row and then along the row. */
  readonly positions: readonly PlantPosition[];
  /** How many rows hold at least one plant. */
  readonly rows: number;
  /** The centre-to-centre row pitch used (see {@link offsetRowPitchCm}). */
  readonly rowPitchCm: number;
  /** Which way the rows ran — echoed back so `best` can report its choice. */
  readonly orientation: RowOrientation;
}

/**
 * Thrown when a region and a spacing would need an unreasonable number of
 * candidate positions — almost always a unit slip (metres typed as
 * centimetres), which is worth a clear message rather than a frozen tab.
 */
export class RegionTooLargeError extends Error {
  constructor(cells: number) {
    super(
      `this plot would need ${Math.round(cells).toLocaleString('en-GB')} candidate positions at ` +
        `that spacing (the limit is ${MAX_CANDIDATE_CELLS.toLocaleString('en-GB')}) — check the ` +
        `plot's dimensions are in centimetres`,
    );
    this.name = 'RegionTooLargeError';
  }
}

/**
 * How many whole steps of `pitch` fit into `span`.
 *
 * The `GEOMETRY_EPSILON` slack matters more than it looks: a 200 cm bed at
 * 10 cm spacing must give 20, and `200 / 10` is not reliably `20` once the span
 * has been through a subtraction of two floats. Without the slack, an exact fit
 * loses its last column about as often as not.
 */
function wholeSteps(span: number, pitch: number): number {
  return Math.floor((span + GEOMETRY_EPSILON) / pitch);
}

/**
 * Lay out one lattice over one region and keep the plants that fit.
 *
 * Works in "along the row / across the rows" coordinates and maps back to x/y
 * at the very end, so the horizontal and vertical cases are one piece of code
 * rather than two that can drift apart.
 *
 * @throws {RegionTooLargeError} if the bounding box would need more than
 * {@link MAX_CANDIDATE_CELLS} candidate positions.
 */
export function layOutPlants(region: PlotRegion, request: PackingRequest): PackingLayout {
  const { inRowCm, betweenRowCm, packing, orientation, edgeInsetCm } = request;
  const horizontal = orientation === 'horizontal';
  const box: BoundingBox = polygonBoundingBox(region.vertices);

  // Rows run "along"; successive rows step "across".
  const alongMin = horizontal ? box.minX : box.minY;
  const acrossMin = horizontal ? box.minY : box.minX;
  const alongSpan = horizontal ? box.widthCm : box.heightCm;
  const acrossSpan = horizontal ? box.heightCm : box.widthCm;

  const rowPitchCm = packing === 'offset' ? offsetRowPitchCm(inRowCm, betweenRowCm) : betweenRowCm;

  // Only cells wholly inside the bounding box can be wholly inside the outline,
  // so the bounding box bounds the search exactly — no candidate is missed.
  const rowCount = wholeSteps(acrossSpan, rowPitchCm);
  const fullColumnCount = wholeSteps(alongSpan, inRowCm);
  if (rowCount <= 0 || fullColumnCount <= 0) {
    return { positions: [], rows: 0, rowPitchCm, orientation };
  }
  const candidates = rowCount * fullColumnCount;
  if (candidates > MAX_CANDIDATE_CELLS) throw new RegionTooLargeError(candidates);

  const halfIn = inRowCm / 2;
  const halfPitch = rowPitchCm / 2;
  const positions: PlantPosition[] = [];
  let rows = 0;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    // Alternate rows step half an in-row spacing along; that stagger is the
    // whole of the difference between the two packings.
    const stagger = packing === 'offset' && rowIndex % 2 === 1 ? halfIn : 0;
    const columnCount = wholeSteps(alongSpan - stagger, inRowCm);
    const acrossCentre = acrossMin + (rowIndex + 0.5) * rowPitchCm;
    let rowHasPlants = false;

    for (let column = 0; column < columnCount; column += 1) {
      const alongCentre = alongMin + stagger + (column + 0.5) * inRowCm;
      // The plant's own patch of ground, grown by any requested edge inset.
      const cell: Rect = {
        minX: (horizontal ? alongCentre - halfIn : acrossCentre - halfPitch) - edgeInsetCm,
        maxX: (horizontal ? alongCentre + halfIn : acrossCentre + halfPitch) + edgeInsetCm,
        minY: (horizontal ? acrossCentre - halfPitch : alongCentre - halfIn) - edgeInsetCm,
        maxY: (horizontal ? acrossCentre + halfPitch : alongCentre + halfIn) + edgeInsetCm,
      };
      if (!rectInsidePolygon(cell, region.vertices)) continue;
      if (!rowHasPlants) {
        rowHasPlants = true;
        rows += 1;
      }
      const centre: Point = horizontal
        ? { x: alongCentre, y: acrossCentre }
        : { x: acrossCentre, y: alongCentre };
      positions.push({ x: centre.x, y: centre.y, row: rows - 1 });
    }
  }

  return { positions, rows, rowPitchCm, orientation };
}

/**
 * Lay the rows both ways and keep whichever fits more plants.
 *
 * Orientation matters more than it did when regions were rectangles: on an
 * L-shaped bed with 15 × 45 cm beans, rows along the long arm and rows across
 * it genuinely hold different numbers, and neither is obviously right. Trying
 * both and keeping the better one is a defensible default *because* it is
 * cheap — two passes over a lattice — and the result reports which way it
 * chose, so the canvas draws what was counted.
 *
 * A tie on the count is broken towards **fewer rows** — the same plants in
 * longer rows means fewer paths to tread and reads better in the summary ("1
 * row of 50", not "50 rows of 1", which is what a 12 cm-wide strip would
 * otherwise report) — and a remaining tie towards `horizontal`, so the answer
 * never depends on iteration order.
 */
export function layOutPlantsBestOrientation(
  region: PlotRegion,
  request: Omit<PackingRequest, 'orientation'>,
): PackingLayout {
  const layouts = ROW_ORIENTATIONS.map((orientation) =>
    layOutPlants(region, { ...request, orientation }),
  );
  let best = layouts[0];
  for (const layout of layouts) {
    const morePlants = layout.positions.length > best.positions.length;
    const sameButTidier =
      layout.positions.length === best.positions.length && layout.rows < best.rows;
    if (morePlants || sameButTidier) best = layout;
  }
  return best;
}
