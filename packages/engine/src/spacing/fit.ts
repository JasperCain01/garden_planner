/**
 * The public entry points: **"how many onions can I fit?"**
 *
 * `DESIGN.md` §1 calls this one of the two calculations that make the app
 * useful, and the interesting part is what comes back. Following Stage 2.1's
 * precedent (ADR 0012 §6), a bare integer is not the deliverable: the result
 * carries the method it used, whether that was the method asked for, the
 * effective grid, the plant positions, and a sentence the UI can print. Stage
 * 2.3 keys overcrowding rules off the machine-readable fields; Stage 3.4 draws
 * the positions and shows the sentence. Neither has to parse the other's half.
 *
 * ## Where the trust boundary is
 *
 * The **region and the options are parsed with zod here**, because they come
 * from the plot form and the packing routine has no business defending against
 * a self-intersecting outline. The **spacing does not**, because it arrives
 * inside an already-validated `Plant` — `validatePlant` for a shipped crop,
 * `createUserPlant` for a hand-typed one (ADR 0011). Same rule ADR 0012 §7
 * states: inputs that cross a trust boundary are zod, computed values are plain
 * types.
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import { z } from 'zod';
import type { Plant, Spacing } from '../schema/plant.ts';
import type { PackingPattern, PlantPosition, SpacingCalculation } from './model.ts';
import {
  PACKING_PATTERNS,
  ROW_ORIENTATION_OPTIONS,
  SPACING_METHOD_OPTIONS,
  SQUARE_CM_PER_SQUARE_METRE,
  roundCm,
  roundDensity,
} from './model.ts';
import type { PackingLayout } from './packing.ts';
import { layOutPlants, layOutPlantsBestOrientation } from './packing.ts';
import type { PlotRegion } from './region.ts';
import { PlotRegionSchema, regionAreaCm2 } from './region.ts';
import type { LatticeSpacing } from './method.ts';
import { resolveLatticeSpacing } from './method.ts';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * How to count. Every field has a defensible default, so the common call is
 * `fitPlant(plant, region)`.
 */
export const SpacingOptionsSchema = z
  .object({
    /**
     * Which growing method to plan for. `auto` (the default) follows the crop's
     * record — see `method.ts` for the rule and the fallback when the crop has
     * no figure for the method asked for.
     */
    method: z.enum(SPACING_METHOD_OPTIONS).default('auto'),
    /**
     * `square` (the default) is the plain grid a seed packet describes.
     * `offset` staggers alternate rows for roughly 15% more plants in a large
     * bed — an explicit opt-in, because it is a real change to how the bed is
     * planted rather than a free optimisation.
     */
    packing: z.enum(PACKING_PATTERNS).default('square'),
    /**
     * Which way the rows run. `best` (the default) tries both and keeps the
     * higher count, reporting which way it chose.
     */
    orientation: z.enum(ROW_ORIENTATION_OPTIONS).default('best'),
    /**
     * A margin, in centimetres, to keep clear inside the plot's outline — for a
     * path, an overhanging fence, or a wall the crop should not touch. Defaults
     * to `0`: plants may sit right up against the boundary, because the edge of
     * a bed has no neighbouring plant to crowd.
     */
    edgeInsetCm: z.number().finite().nonnegative().default(0),
  })
  .strict();

/** What a caller may pass — every field optional. */
export type SpacingOptions = z.input<typeof SpacingOptionsSchema>;
/** The same, with defaults applied. */
export type ResolvedSpacingOptions = z.infer<typeof SpacingOptionsSchema>;

// ---------------------------------------------------------------------------
// Explanation
// ---------------------------------------------------------------------------

/**
 * Format a centimetre distance for prose: whole numbers stay whole, derived
 * distances get one decimal place. "10 × 30 cm" and "an even 17.3 cm grid" both
 * read like something off a seed packet; "17.320508075688775" does not.
 */
function formatCm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** How many plants each row holds, in row order. */
function countByRow(positions: readonly PlantPosition[], rows: number): number[] {
  const counts = new Array<number>(rows).fill(0);
  for (const position of positions) counts[position.row] += 1;
  return counts;
}

/**
 * The sentence attached to every result — a **deliverable, not a debug aid**
 * (ADR 0012 §6). It says what fits and on what basis, and when the spacing had
 * to be derived it says that too, because a user planning an intensive bed
 * deserves to know the figure came from the crop's row spacing rather than from
 * a square-foot chart.
 */
function summarise(
  cropName: string | null,
  count: number,
  layout: PackingLayout,
  spacing: LatticeSpacing,
  packing: PackingPattern,
): string {
  const subject = cropName === null ? '' : `${cropName} — `;
  const grid = `${formatCm(spacing.inRowCm)} × ${formatCm(spacing.betweenRowCm)} cm`;
  const note = derivationNote(spacing);

  if (count === 0) {
    return `${subject}nothing fits: the plot has no room for even one plant at ${grid}.${note}`;
  }

  const rowCounts = countByRow(layout.positions, layout.rows);
  const uniform = rowCounts.every((rowCount) => rowCount === rowCounts[0]);
  // "3 rows of 20" is the phrasing a gardener uses, but it is only honest when
  // the rows really are equal — on a polygon they usually are not.
  const shape =
    uniform && layout.rows > 1
      ? `${layout.rows} rows of ${rowCounts[0]}`
      : `${layout.rows} ${layout.rows === 1 ? 'row' : 'rows'}`;
  return `${subject}${count} plants: ${shape} at ${grid}, ${packing} packing.${note}`;
}

/** The trailing clause that owns up to a derived spacing figure. */
function derivationNote(spacing: LatticeSpacing): string {
  const side = `${formatCm(spacing.inRowCm)} cm`;
  switch (spacing.source) {
    case 'derived-from-row':
      return ` No intensive spacing is recorded for this crop, so its row spacing was re-laid as an even ${side} grid — a real square-foot figure would usually be tighter.`;
    case 'derived-from-intensive':
      return ` No row spacing is recorded for this crop, so its bed density was laid out as an even ${side} grid.`;
    case 'recorded':
      return '';
  }
}

// ---------------------------------------------------------------------------
// The calculation
// ---------------------------------------------------------------------------

/**
 * Count how many plants at the given spacing fit into the given plot.
 *
 * @param spacing - a crop's method-aware spacing, from an already-validated
 * `Plant` (see the module doc on where the trust boundary sits).
 * @param region - the plot outline. Validated here.
 * @param options - see {@link SpacingOptionsSchema}. Validated here.
 * @throws {z.ZodError} if the region or the options are invalid.
 * @throws {RegionTooLargeError} if the plot is implausibly large for the
 * spacing (almost always metres typed as centimetres).
 */
export function fitSpacing(
  spacing: Spacing,
  region: PlotRegion,
  options: SpacingOptions = {},
): SpacingCalculation {
  return calculate(spacing, region, options, null, null);
}

/**
 * {@link fitSpacing} for a whole crop record: the same calculation, with the
 * crop's id on the result and its name in the summary ("Onion — 60 plants: …").
 *
 * This is what Stage 3.4's canvas calls as plants are dragged around, and what
 * Stage 2.3 will call to decide whether a bed is overcrowded.
 */
export function fitPlant(
  plant: Plant,
  region: PlotRegion,
  options: SpacingOptions = {},
): SpacingCalculation {
  return calculate(plant.spacing, region, options, plant.id, plant.commonName);
}

/** Shared body of the two entry points. */
function calculate(
  spacing: Spacing,
  region: PlotRegion,
  options: SpacingOptions,
  plantId: string | null,
  cropName: string | null,
): SpacingCalculation {
  const settings = SpacingOptionsSchema.parse(options);
  const validRegion = PlotRegionSchema.parse(region);
  const lattice = resolveLatticeSpacing(spacing, settings.method);

  const request = {
    inRowCm: lattice.inRowCm,
    betweenRowCm: lattice.betweenRowCm,
    packing: settings.packing,
    edgeInsetCm: settings.edgeInsetCm,
  };
  const layout =
    settings.orientation === 'best'
      ? layOutPlantsBestOrientation(validRegion, request)
      : layOutPlants(validRegion, { ...request, orientation: settings.orientation });

  const count = layout.positions.length;
  const areaCm2 = regionAreaCm2(validRegion);
  const areaSquareMetres = areaCm2 / SQUARE_CM_PER_SQUARE_METRE;

  return {
    plantId,
    count,
    method: lattice.method,
    methodRequested: settings.method,
    spacingSource: lattice.source,
    packing: settings.packing,
    grid: {
      orientation: layout.orientation,
      inRowCm: roundCm(lattice.inRowCm),
      betweenRowCm: roundCm(lattice.betweenRowCm),
      rowPitchCm: roundCm(layout.rowPitchCm),
      rows: layout.rows,
      areaPerPlantCm2: roundCm(lattice.inRowCm * layout.rowPitchCm),
    },
    regionAreaCm2: roundCm(areaCm2),
    regionAreaSquareMetres: roundDensity(areaSquareMetres),
    densityPerSquareMetre: roundDensity(count / areaSquareMetres),
    positions: layout.positions,
    summary: summarise(cropName, count, layout, lattice, settings.packing),
  };
}
