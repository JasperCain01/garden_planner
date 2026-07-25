/**
 * `evaluatePlot` — the single entry point Stage 3.5 calls once per state
 * change, per the Stage 2.3 brief ("Stage 3.5 wants one call per state change,
 * not five"): take a plot's growing conditions and everything currently
 * placed on it, and return every warning and every companion suggestion at
 * once.
 *
 * This module only composes the five rule modules; none of the actual rule
 * logic lives here (see `suitability-rules.ts`, `overcrowding.ts`,
 * `antagonists.ts` and `companions.ts`).
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import type { PlotConditions } from '../suitability/conditions.ts';
import { antagonistWarnings } from './antagonists.ts';
import { companionSuggestions } from './companions.ts';
import type { CropPlacement, PlotEvaluation, Warning } from './model.ts';
import { PlacementCountSchema } from './model.ts';
import { overcrowdingWarning } from './overcrowding.ts';
import { suitabilityWarningsFor } from './suitability-rules.ts';

/**
 * Evaluate one plot: every warning (wrong light, overcrowding, wrong sowing
 * season, antagonist adjacency, climate mismatch) and every companion
 * suggestion for what's currently placed.
 *
 * @param conditions - the plot's resolved growing conditions
 *   (`resolvePlotConditions`'s output). Assumed already valid, exactly as
 *   `scorePlant` assumes (ADR 0012 §7) — this function calls `scorePlant`
 *   once per placement and would gain nothing by re-validating it every time.
 * @param placements - every crop currently on the plot, each with its own bed
 *   and how many the user has put there. `plant` and `region` are likewise
 *   assumed already valid (see {@link CropPlacement}'s own doc comment for
 *   why); `count` is validated here because it is new to this stage.
 * @throws {z.ZodError} if any placement's `count` isn't a non-negative integer.
 */
export function evaluatePlot(
  conditions: PlotConditions,
  placements: readonly CropPlacement[],
): PlotEvaluation {
  const warnings: Warning[] = [];

  for (const placement of placements) {
    PlacementCountSchema.parse(placement.count);
    warnings.push(...suitabilityWarningsFor(placement, conditions));
    const overcrowding = overcrowdingWarning(placement);
    if (overcrowding !== undefined) warnings.push(overcrowding);
  }
  warnings.push(...antagonistWarnings(placements));

  return { warnings, suggestions: companionSuggestions(placements) };
}
