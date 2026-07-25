/**
 * The spacing calculator's **model**: its vocabularies, its tunable numbers,
 * and the shape of the result it returns.
 *
 * This file exists for the same reason `suitability/model.ts` does — so the
 * numbers that encode a judgement live in one place and can be re-tuned
 * together, and so the whole model can be read off one screen. The reasoning
 * behind each is in `docs/adr/0013-spacing-density-calculator.md`.
 *
 * The three ideas the rest of the module rests on:
 *
 * 1. **Every plant owns a rectangular cell**, `inRowCm` wide by the row pitch
 *    tall, and it is counted only if that whole cell lies inside the plot. That
 *    is "a plant that half-fits doesn't", made into a test a computer can run —
 *    and, because the cells are disjoint and inside the outline, it is also
 *    what makes `count × cell area ≤ plot area` a theorem rather than a hope.
 * 2. **Square and offset packing differ only in the lattice**, not in the
 *    algorithm: same candidate generation, same containment test, one extra
 *    half-step on alternate rows and a shorter row pitch.
 * 3. **A count that can't explain itself is not enough** (Stage 2.1's
 *    precedent). Every result carries the method it used, whether that method
 *    was the one asked for, the effective grid, the positions, and a sentence.
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/** Centimetres per metre. Named so the conversions below read as arithmetic. */
export const CM_PER_METRE = 100;

/** Square centimetres per square metre (`100 × 100`). */
export const SQUARE_CM_PER_SQUARE_METRE = CM_PER_METRE * CM_PER_METRE;

/**
 * The side of one square-foot-gardening "square", in centimetres.
 *
 * ADR 0004 §2 fixes this at 30 cm — the metric round-down of a foot that the
 * square-foot method is universally quoted in over here. It is the bridge
 * between the two intensive figures the schema allows: `plantsPerSquare × 11.11`
 * is `perSquareMetre`, because a square metre holds (100/30)² ≈ 11.11 squares.
 */
export const SQUARE_FOOT_CELL_CM = 30;

// ---------------------------------------------------------------------------
// Vocabularies
// ---------------------------------------------------------------------------

/**
 * The two growing methods the plant schema models (ADR 0004 §2): traditional
 * rows with an in-row and a between-row distance, and intensive/square-foot
 * beds quoted as a density.
 */
export const SPACING_METHODS = ['row', 'intensive'] as const;
/** A growing method actually used for a calculation. */
export type SpacingMethod = (typeof SPACING_METHODS)[number];

/**
 * What a caller may ask for. `auto` is the default and means "use whatever this
 * crop's record actually carries" — see `method.ts` for the resolution rule.
 */
export const SPACING_METHOD_OPTIONS = ['auto', ...SPACING_METHODS] as const;
/** A caller's method choice. */
export type SpacingMethodOption = (typeof SPACING_METHOD_OPTIONS)[number];

/**
 * Where the distances used for a calculation came from — the machine-readable
 * half of the fallback story, so Stage 2.3 and the UI can flag a derived figure
 * without parsing the summary sentence (ADR 0012's `finding`/`reason` pattern).
 *
 * - `recorded` — the crop's record carries this method's spacing directly.
 * - `derived-from-row` — an intensive count asked for on a crop with only row
 *   spacing: the row rectangle was re-laid as an equal-area square grid.
 * - `derived-from-intensive` — the mirror image: a row count from a crop that
 *   only quotes a density.
 */
export const SPACING_SOURCES = ['recorded', 'derived-from-row', 'derived-from-intensive'] as const;
/** Where a calculation's distances came from. See {@link SPACING_SOURCES}. */
export type SpacingSource = (typeof SPACING_SOURCES)[number];

/**
 * How the plants are arranged on the ground.
 *
 * - `square` — a plain grid: every row starts at the same place, and the row
 *   pitch is the crop's between-row distance. What a seed packet describes.
 * - `offset` — alternate rows shifted half an in-row step, letting the rows sit
 *   closer without bringing any two plants nearer than the crop asks for. The
 *   classic hexagonal/staggered bed; see {@link offsetRowPitchCm} in
 *   `packing.ts` for the arithmetic and its limits.
 */
export const PACKING_PATTERNS = ['square', 'offset'] as const;
/** How the plants are arranged. See {@link PACKING_PATTERNS}. */
export type PackingPattern = (typeof PACKING_PATTERNS)[number];

/**
 * Which way the rows run. Only the two axis-aligned choices exist — see the ADR
 * for why an arbitrary row angle was left out.
 */
export const ROW_ORIENTATIONS = ['horizontal', 'vertical'] as const;
/** Which way the rows run. */
export type RowOrientation = (typeof ROW_ORIENTATIONS)[number];

/**
 * What a caller may ask for. `best` is the default: lay the rows both ways and
 * keep whichever fits more plants, ties going to `horizontal` so the answer is
 * deterministic. On a rectangle with square packing the two are usually equal;
 * on an L-shape, rows along one arm genuinely beat rows along the other.
 */
export const ROW_ORIENTATION_OPTIONS = ['best', ...ROW_ORIENTATIONS] as const;
/** A caller's orientation choice. */
export type RowOrientationOption = (typeof ROW_ORIENTATION_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Tunable limits
// ---------------------------------------------------------------------------

/**
 * The most candidate cells the packing routine will consider before refusing.
 *
 * A realistic worst case is a large allotment at radish spacing — 250 m² at
 * 3 × 15 cm is about 55,000 cells, and the tightest intensive figure in the
 * shipped data (radish, 16 per square) gives 7.5 cm squares, so ~440,000 cells
 * for the same plot. Two million leaves generous headroom above anything a
 * gardener will type while still catching the case this guard is really for: a
 * unit slip that asks for a lattice over a plot measured in kilometres, which
 * would otherwise hang the browser rather than report a problem.
 */
export const MAX_CANDIDATE_CELLS = 2_000_000;

// ---------------------------------------------------------------------------
// Result shapes (plain types — see ADR 0012 §7)
// ---------------------------------------------------------------------------

/**
 * Where one plant goes, in the region's own centimetre frame.
 *
 * Positions are returned, not just counted, because the calculator computes
 * them anyway to do the containment test and because Stage 3.4's canvas has to
 * draw *something* somewhere: a count without positions forces the canvas to
 * invent a layout that then disagrees with the number printed beside it.
 *
 * Coordinates are **not** rounded, unlike the summary figures. They are exact
 * lattice arithmetic (`min + (i + ½)·pitch`), so they are already stable across
 * platforms, and the canvas scales them to pixels anyway — rounding would only
 * introduce a drift between a plant's drawn position and the cell it was
 * counted in.
 */
export interface PlantPosition {
  /** Horizontal position of the plant's centre, centimetres. */
  readonly x: number;
  /** Vertical position of the plant's centre, centimetres. */
  readonly y: number;
  /**
   * Which row this plant is in, numbered from 0 among the rows that actually
   * hold plants (so it always runs `0 … rows-1`, with no gaps where a lattice
   * row fell entirely outside the outline).
   */
  readonly row: number;
}

/** The lattice a calculation actually used. */
export interface EffectiveGrid {
  /** Which way the rows ran. */
  readonly orientation: RowOrientation;
  /** Centre-to-centre distance between plants along a row, centimetres. */
  readonly inRowCm: number;
  /**
   * The between-row clearance the crop asks for, centimetres. With `square`
   * packing this *is* the row pitch; with `offset` packing the rows sit closer
   * than this while still keeping every plant at least this far from its
   * neighbours in the next row — that is the whole point of offsetting.
   */
  readonly betweenRowCm: number;
  /** The centre-to-centre distance actually used between rows, centimetres. */
  readonly rowPitchCm: number;
  /** Number of rows that hold at least one plant. */
  readonly rows: number;
  /**
   * Ground each plant is allotted, cm² (`inRowCm × rowPitchCm`). This is the
   * denominator behind the area upper bound, and the figure Stage 2.3 can
   * compare against when it decides a bed is overcrowded.
   */
  readonly areaPerPlantCm2: number;
}

/**
 * A plant count that explains itself: what fits, how, and on what basis.
 *
 * A plain TypeScript interface rather than a zod schema, for the reason ADR
 * 0012 §7 gives — a result is computed here and consumed here, never parsed
 * from untrusted input, so a runtime validator would be ceremony without a
 * guarantee. The *inputs* (the region, the options) are zod-first because they
 * cross a trust boundary.
 */
export interface SpacingCalculation {
  /** The crop's id when the calculation came from a `Plant`, else `null`. */
  readonly plantId: string | null;
  /** How many plants fit. The headline number, and an integer. */
  readonly count: number;
  /** The growing method actually used. */
  readonly method: SpacingMethod;
  /** What the caller asked for — `auto` unless they specified. */
  readonly methodRequested: SpacingMethodOption;
  /**
   * Whether the distances came from the crop's record or were derived from its
   * other method. Anything but `recorded` means the crop had no figure for the
   * method in play; the summary says so in words, and this says so in code.
   */
  readonly spacingSource: SpacingSource;
  /** Square or offset packing. */
  readonly packing: PackingPattern;
  /** The lattice used. */
  readonly grid: EffectiveGrid;
  /** The plot's area in cm², by the shoelace formula. */
  readonly regionAreaCm2: number;
  /** The plot's area in m². */
  readonly regionAreaSquareMetres: number;
  /**
   * Plants per square metre actually achieved — the count over the plot's real
   * area, not the theoretical lattice density. Lower than the lattice figure
   * whenever edges and corners waste ground, which is most of the time, and is
   * the honest number for a "your bed is at N/m²" warning.
   */
  readonly densityPerSquareMetre: number;
  /**
   * Where every plant goes, ordered by row and then along the row. See
   * {@link PlantPosition} for why these are returned.
   */
  readonly positions: readonly PlantPosition[];
  /**
   * One line the UI can show as-is: "Onion — 60 plants: 3 rows of 20 at
   * 10 × 30 cm, square packing." Follows Stage 2.1's rule that an explanation
   * is a deliverable, not a debug aid — and, as there, machine-readable fields
   * carry everything a rule needs so nothing has to parse this prose.
   */
  readonly summary: string;
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/**
 * Round a centimetre distance to two decimal places (a hundredth of a
 * centimetre).
 *
 * Derived spacings are irrational more often than not — an offset row pitch is
 * `√3/2` times something, and a density of 9 per square is a `30/3` that comes
 * out clean but 8 per square is not. Two places is far finer than anyone can
 * plant to, and it keeps results stable across platforms and readable in a test
 * expectation. Same intent as `roundScore` in `suitability/model.ts`.
 */
export function roundCm(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round a density (plants per m²) to four decimal places, matching
 * `roundScore`'s precision for the same reason: it is a computed float that
 * ends up in test expectations and in the UI.
 */
export function roundDensity(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
