/**
 * Public surface of the warnings & companion-suggestion engine (Workplan
 * Stage 2.3). Design and rationale:
 * `docs/adr/0014-warnings-and-companion-suggestions.md`.
 *
 * Turns Stage 2.1's suitability findings and Stage 2.2's spacing/geometry into
 * the last piece of `DESIGN.md`'s core loop: actionable warnings ("this won't
 * thrive here") and companion suggestions ("plant this near what you've got").
 *
 * Re-exports every sibling file so consumers write
 * `import { evaluatePlot } from '@garden-planner/engine'` without reaching
 * into file paths — mirrors `suitability/index.ts` and `spacing/index.ts`.
 *
 * The shape of the module:
 * - `model.ts` — the closed vocabularies (`WarningKind`, `WarningSeverity`),
 *   the `Warning` and `CompanionSuggestion` result shapes, the `CropPlacement`
 *   input, and the one place the model's tunable numbers live.
 * - `adjacency.ts` — what "planted nearby" means on a polygon: real
 *   region-to-region distance and a spacing-derived threshold.
 * - `suitability-rules.ts` — `wrong-light` / `wrong-sowing-season` /
 *   `climate-mismatch`: thin wrappers over Stage 2.1's per-dimension findings.
 * - `overcrowding.ts` — `overcrowded`: has the user placed more than
 *   `fitPlant` says a bed holds?
 * - `antagonists.ts` — `antagonist-adjacency`: two placed crops with a known
 *   antagonist link, too close together.
 * - `companions.ts` — companion suggestions for what's already placed,
 *   carrying the evidence tag through unaveraged.
 * - `evaluate.ts` — `evaluatePlot`, the single entry point that runs all five
 *   rules and the companion-suggestion pass in one call.
 */

export * from './model.ts';
export * from './adjacency.ts';
export * from './suitability-rules.ts';
export * from './overcrowding.ts';
export * from './antagonists.ts';
export * from './companions.ts';
export * from './evaluate.ts';
