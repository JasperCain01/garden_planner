/**
 * Dataset-level spacing sanity bounds for the Stage 1.5 gate (WORKPLAN.md §1.1;
 * rationale in `docs/adr/0009-dataset-merge-and-licensing.md`).
 *
 * ── Why this is separate from `spacing/schema.ts#spacingSanityIssues` ──
 * The Stage 1.3 spacing sanity check (`spacingSanityIssues`) was calibrated for
 * the **12 hand-verified vegetables** it guards: a tight 300 cm ceiling ("the
 * widest real figure here is potato rows at 75 cm") and a "between-row ≥ in-row,
 * or the values were probably transposed" heuristic. Both are exactly right for
 * *curated* data under review.
 *
 * They are the **wrong** bar for the merged, multi-source shipping dataset, for
 * two concrete reasons the real OpenFarm data exposes:
 *
 *   1. **The set includes fruit trees.** OpenFarm covers edibles well beyond the
 *      12-veg table — star fruit, guava, chestnut, kiwifruit — legitimately
 *      spaced 8–12 m apart. A 300 cm ceiling would reject dozens of valid crops.
 *   2. **OpenFarm's `spread` vs `row spacing` legitimately invert.** For sprawling
 *      crops OpenFarm's per-plant spread often exceeds its between-row figure
 *      (71 of 161 records), so the "transposed" heuristic fires as a mass false
 *      positive on data that isn't wrong, just differently shaped than a tidy
 *      row plot.
 *
 * So the **gate** enforces only *absurdity* — a misplaced decimal, a physically
 * impossible density — with a ceiling generous enough for orchard trees. The
 * strict curation-time check stays in Stage 1.3, unchanged, where it belongs. A
 * record that trips even these loose bounds is a genuine data error and is
 * **skipped with a stated reason** by the merge (`merge.ts`), which applies this
 * check to a plant's *final* spacing — after any hand-verified override, so a bad
 * scrape a good figure would replace is rescued, not dropped — never shipped and
 * never allowed to silently pass the gate.
 */

import type { Spacing } from '@garden-planner/engine';

/**
 * Absurdity bounds for shipped spacing. Deliberately looser than
 * `SPACING_SANITY_BOUNDS` (Stage 1.3): "reject the impossible", not "enforce the
 * tidy". Positivity is already guaranteed by the schema; these add the ceilings
 * and a floor that catch decimal slips.
 */
export const DATASET_SPACING_BOUNDS = {
  /** Below this, a distance is a decimal slip (`0.1` for `1`+), not a real spacing. */
  minDistanceCm: 0.5,
  /**
   * Above this, a distance is a data error, not a crop. Set to 20 m — clear of the
   * widest legitimate edible that ships (chestnut at 12 m) but tight enough to
   * reject the lone 60 m outlier the OpenFarm dump contains (a kiwifruit record
   * whose scraped spacing is a clear error — kiwi vines are planted ~3–5 m apart).
   */
  maxDistanceCm: 2000,
  /** Densest believable "plants per 30 cm × 30 cm square" (SFG itself tops at 16). */
  maxPlantsPerSquare: 36,
  /** Densest believable plants-per-m² (broadcast salad leaves ≈ a few hundred). */
  maxPerSquareMetre: 400,
  /**
   * Sparsest believable "plants per 30 cm × 30 cm square" (catches a `0.1`-for-`1`
   * decimal slip). Applies to `plantsPerSquare` only — see {@link datasetSpacingIssues}
   * for why `perSquareMetre` gets no floor (a sprawling crop is legitimately a
   * small fraction of a plant per m²).
   */
  minPlantsPerSquare: 0.1,
} as const;

/**
 * Return human-readable absurdity problems with a spacing block, or an empty list
 * if it is plausible for a shipped record. **Intentionally omits** the "between <
 * in-row transposition" heuristic — see the module doc for why that is a curation
 * signal, not a ship-blocker. Pure, so it can be reused both as the merge's
 * post-override skip filter and the gate invariant.
 */
export function datasetSpacingIssues(spacing: Spacing): string[] {
  const issues: string[] = [];
  const {
    minDistanceCm,
    maxDistanceCm,
    maxPlantsPerSquare,
    maxPerSquareMetre,
    minPlantsPerSquare,
  } = DATASET_SPACING_BOUNDS;

  if (spacing.row) {
    for (const [label, value] of [
      ['inRowCm', spacing.row.inRowCm],
      ['betweenRowCm', spacing.row.betweenRowCm],
    ] as const) {
      if (value < minDistanceCm) {
        issues.push(
          `row.${label} (${value} cm) is below the ${minDistanceCm} cm plausibility floor`,
        );
      }
      if (value > maxDistanceCm) {
        issues.push(
          `row.${label} (${value} cm) exceeds the ${maxDistanceCm} cm plausibility ceiling`,
        );
      }
    }
  }

  if (spacing.intensive) {
    // A floor only makes sense for plantsPerSquare (per 0.09 m²): a value below
    // 0.1 there is a decimal slip. perSquareMetre gets a ceiling but no floor —
    // a widely-spaced crop is legitimately a small fraction of a plant per m².
    const { plantsPerSquare, perSquareMetre } = spacing.intensive;
    if (plantsPerSquare !== undefined) {
      if (plantsPerSquare < minPlantsPerSquare) {
        issues.push(
          `intensive.plantsPerSquare (${plantsPerSquare}) is below the ${minPlantsPerSquare} floor`,
        );
      }
      if (plantsPerSquare > maxPlantsPerSquare) {
        issues.push(
          `intensive.plantsPerSquare (${plantsPerSquare}) exceeds the ${maxPlantsPerSquare} ceiling`,
        );
      }
    }
    if (perSquareMetre !== undefined && perSquareMetre > maxPerSquareMetre) {
      issues.push(
        `intensive.perSquareMetre (${perSquareMetre}) exceeds the ${maxPerSquareMetre} ceiling`,
      );
    }
  }

  return issues;
}
