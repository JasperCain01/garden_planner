/**
 * `wrong-light`, `wrong-sowing-season` and `climate-mismatch` — the three
 * warning kinds that are, as the Stage 2.3 brief puts it, "mostly a matter of
 * mapping `(dimension, finding)` pairs onto warnings and deciding severity;
 * the scoring is done" (Stage 2.1, ADR 0012).
 *
 * `soil` is a fourth `SuitabilityDimension` but produces no warning here —
 * `WORKPLAN.md`'s Stage 2.3 entry names exactly five warning kinds and soil
 * mismatch isn't one of them (see `model.ts`'s note on `WARNING_KINDS`).
 *
 * The missing-data policy this module must not break (ADR 0012, restated in
 * `docs/adr/0014` for this stage): **`unknown-plant` and `unknown-plot` never
 * produce a warning.** Zero of the 160 shipped records carry hardiness, soil
 * or seasons, so a rule that fired on "anything that isn't `match`" would warn
 * on nearly every crop for reasons that are gaps in the data, not problems
 * with the plot. `marginal` doesn't either (see `docs/adr/0014`'s reasoning) —
 * only `mismatch` and `unsuitable` are warning-worthy ({@link isWarningFinding}).
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import type { PlotConditions } from '../suitability/conditions.ts';
import type { DimensionScore, SuitabilityDimension } from '../suitability/model.ts';
import { scorePlant } from '../suitability/score.ts';
import type { CropPlacement, SuitabilityWarning } from './model.ts';
import { FINDING_SEVERITY, isWarningFinding } from './model.ts';

/** Which suitability dimension backs which warning kind, and in what order to check them. */
const DIMENSION_TO_WARNING_KIND: Readonly<
  Partial<Record<SuitabilityDimension, SuitabilityWarning['kind']>>
> = {
  light: 'wrong-light',
  season: 'wrong-sowing-season',
  hardiness: 'climate-mismatch',
};

/**
 * Score one placement's crop against the plot's conditions and turn any
 * warning-worthy dimension into a {@link SuitabilityWarning}.
 *
 * Reuses `scorePlant` wholesale rather than re-implementing any scoring: this
 * stage's whole point (per the brief) is to consume Stage 2.1's findings, not
 * to second-guess them. `conditions` is assumed already resolved and valid,
 * exactly as `scorePlant` itself assumes (ADR 0012 §7) — `evaluatePlot`'s
 * caller is expected to have gone through `resolvePlotConditions`.
 */
export function suitabilityWarningsFor(
  placement: CropPlacement,
  conditions: PlotConditions,
): SuitabilityWarning[] {
  const result = scorePlant(placement.plant, conditions);
  const warnings: SuitabilityWarning[] = [];

  for (const dimension of result.dimensions) {
    const kind = DIMENSION_TO_WARNING_KIND[dimension.dimension];
    if (kind === undefined) continue; // soil: not one of the five named warning kinds.
    if (!isWarningFinding(dimension.finding)) continue; // match / marginal / unknown-*: silence.

    warnings.push({
      kind,
      severity: FINDING_SEVERITY[dimension.finding] ?? 'warning',
      subjects: [{ placementId: placement.id, plantId: placement.plant.id }],
      finding: dimension.finding,
      reason: suitabilityReason(placement, dimension),
    });
  }

  return warnings;
}

/**
 * Reuse the dimension scorer's own `reason` — it is already a deliverable
 * sentence (ADR 0012 §6) — prefixed with the crop's name, which the
 * per-dimension reason omits because a palette entry already groups by crop
 * (`suitability/score.ts`'s `summarise`), but a flat list of warnings across
 * many different placements needs to say whose warning this is.
 */
function suitabilityReason(placement: CropPlacement, dimension: DimensionScore): string {
  return `${placement.plant.commonName} — ${dimension.reason}`;
}
