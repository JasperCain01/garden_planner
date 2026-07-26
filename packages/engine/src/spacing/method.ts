/**
 * Turning a crop's **method-aware spacing** (ADR 0004 §2) into the two
 * distances the packing routine needs — and deciding what to do when the crop
 * has no figure for the method the user asked for.
 *
 * ## What the shipped data actually looks like
 *
 * Of the 162 records in `data/plants.json`:
 *
 * | Spacing shape        | Records |
 * | -------------------- | ------- |
 * | `row` only           | 153     |
 * | `row` and `intensive`|   9     |
 * | `intensive` only     |   0     |
 *
 * and every one of those nine intensive blocks carries `plantsPerSquare` with
 * no `perSquareMetre`. So "the user asked for an intensive bed and this crop
 * has no intensive figure" is not an edge case — it is 94% of the catalogue,
 * and the intensive toggle would be useless if it answered "no idea" that
 * often. (`intensive` only, meanwhile, cannot happen in shipped data but a
 * user-defined crop can produce it — ADR 0011.)
 *
 * ## The rule
 *
 * **Use the method asked for when the crop has it; otherwise derive it, and say
 * so.** The derivation is honest arithmetic on the figure the crop *does*
 * carry, not a guess at the one it doesn't:
 *
 * - **intensive wanted, only rows recorded** — re-lay the row rectangle as a
 *   square of the same area: `side = √(inRow × betweenRow)`. This keeps the
 *   ground per plant exactly as the record states it, and merely drops the
 *   paths. It is deliberately **conservative**: a real intensive figure is
 *   usually denser still (onions are 10 × 30 cm in rows but 9 to a 30 cm square,
 *   three times the density), because intensive growing changes the
 *   *horticulture*, not just the geometry. Inventing that extra density from a
 *   row figure would be making data up; under-promising and labelling it is not.
 * - **rows wanted, only a density recorded** — the same square, from the other
 *   side: `side = √(10000 / perSquareMetre)`, used as both distances.
 *
 * Either way the result reports {@link SpacingSource} so the UI and Stage 2.3
 * can flag a derived figure without reading the summary sentence, exactly as
 * ADR 0012 §6 splits `finding` from `reason`.
 *
 * `auto` — the default — resolves to **rows when the crop has them**, intensive
 * otherwise. Row growing is the traditional default `DESIGN.md` describes, and
 * a crop happening to carry a square-foot figure should not silently switch the
 * user's growing method: the method belongs to the gardener, not the plant.
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import type { IntensiveSpacing, Spacing } from '../schema/plant.ts';
import type { SpacingMethod, SpacingMethodOption, SpacingSource } from './model.ts';
import { SQUARE_CM_PER_SQUARE_METRE, SQUARE_FOOT_CELL_CM } from './model.ts';

/** The two distances the packing routine works from, plus how they were arrived at. */
export interface LatticeSpacing {
  /** Centre-to-centre spacing along a row, centimetres. */
  readonly inRowCm: number;
  /** Clearance between rows, centimetres. */
  readonly betweenRowCm: number;
  /** The method these distances describe. */
  readonly method: SpacingMethod;
  /** Whether they were recorded or derived. See {@link SPACING_SOURCES}. */
  readonly source: SpacingSource;
}

/**
 * A crop's intensive density in plants per square metre, from whichever of the
 * two interchangeable figures the record carries.
 *
 * `perSquareMetre` wins when both are present: it states the density directly,
 * where `plantsPerSquare` has already been rounded to whole plants inside a
 * 30 cm cell (a crop wanting 12 per m² becomes "1 per square", losing 10%).
 * `plantsPerSquare` is nonetheless the figure every shipped record actually
 * has, so the conversion below is the one that runs in practice: a square metre
 * holds `(100/30)² ≈ 11.11` squares.
 */
export function intensiveDensityPerSquareMetre(intensive: IntensiveSpacing): number {
  if (intensive.perSquareMetre !== undefined) return intensive.perSquareMetre;
  const squaresPerSquareMetre =
    SQUARE_CM_PER_SQUARE_METRE / (SQUARE_FOOT_CELL_CM * SQUARE_FOOT_CELL_CM);
  // Safe: `IntensiveSpacingSchema` requires at least one of the two figures.
  return (intensive.plantsPerSquare ?? 0) * squaresPerSquareMetre;
}

/**
 * The side of the square each plant gets in an intensive bed, in centimetres —
 * `√(area per plant)`, which for the canonical 9-per-square onion comes out at
 * `30 / √9 = 10 cm`.
 *
 * Intensive spacing is isotropic by definition ("N per square", no notion of a
 * row), so this one distance serves as both the in-row and the between-row
 * figure and the lattice comes out square. That is also what makes offset
 * packing pay off best here: the hexagonal `√3/2` gain is exactly the
 * equal-spacing case (see `offsetRowPitchCm`).
 */
export function intensiveSquareSideCm(intensive: IntensiveSpacing): number {
  return Math.sqrt(SQUARE_CM_PER_SQUARE_METRE / intensiveDensityPerSquareMetre(intensive));
}

/**
 * Choose the distances for a calculation, applying the fallback rule described
 * in this module's doc comment.
 *
 * @param spacing - the crop's spacing block. Guaranteed by `SpacingSchema` to
 * carry at least one method, which is why this function has no "no spacing at
 * all" branch to fail in.
 * @param requested - what the caller asked for; `auto` prefers rows.
 */
export function resolveLatticeSpacing(
  spacing: Spacing,
  requested: SpacingMethodOption,
): LatticeSpacing {
  const { row, intensive } = spacing;
  // `auto` follows the crop: rows if it has them, intensive if that is all it
  // has. An explicit choice is honoured whether the crop carries it or not.
  const wantsIntensive = requested === 'intensive' || (requested === 'auto' && row === undefined);

  if (wantsIntensive) {
    if (intensive !== undefined) {
      const side = intensiveSquareSideCm(intensive);
      return { inRowCm: side, betweenRowCm: side, method: 'intensive', source: 'recorded' };
    }
    if (row !== undefined) {
      // The equal-area square — the common case, since 153 of 162 shipped
      // crops have row spacing and nothing else.
      const side = Math.sqrt(row.inRowCm * row.betweenRowCm);
      return { inRowCm: side, betweenRowCm: side, method: 'intensive', source: 'derived-from-row' };
    }
  } else {
    if (row !== undefined) {
      return {
        inRowCm: row.inRowCm,
        betweenRowCm: row.betweenRowCm,
        method: 'row',
        source: 'recorded',
      };
    }
    if (intensive !== undefined) {
      // Impossible in shipped data; reachable through a user-defined crop that
      // quoted "N per square" off a seed packet and nothing else (ADR 0011).
      const side = intensiveSquareSideCm(intensive);
      return { inRowCm: side, betweenRowCm: side, method: 'row', source: 'derived-from-intensive' };
    }
  }

  /* c8 ignore next 4 -- unreachable: SpacingSchema requires a method */
  throw new Error(
    'spacing carries neither row nor intensive figures — SpacingSchema should have rejected it',
  );
}
