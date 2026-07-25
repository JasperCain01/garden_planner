/**
 * Public surface of the suitability-scoring module (Workplan Stage 2.1 — the
 * ⭐ keystone "brain"). Design and rationale:
 * `docs/adr/0012-suitability-scoring.md`.
 *
 * Re-exports every sibling file so consumers write
 * `import { scorePlant, rankPlants, resolvePlotConditions } from
 * '@garden-planner/engine'` without reaching into file paths — mirrors
 * `schema/index.ts` and `climate/index.ts`.
 *
 * The shape of the module:
 * - `conditions.ts` — the plot/growing-conditions schema (zod-first), and the
 *   `resolvePlotConditions` boundary that turns a location into a climate profile.
 * - `model.ts` — the score scale, weights, bands and result types; the one place
 *   the model's numbers live.
 * - `light.ts` / `hardiness.ts` / `soil.ts` / `season.ts` — the per-dimension
 *   scorers, each returning a score *and* a human-readable reason.
 * - `score.ts` — `scorePlant`, and the missing-data aggregation policy.
 * - `rank.ts` — `rankPlants`, the palette's entry point.
 * - `month-range.ts` — wrap-around-aware `MonthRange` helpers (the engine is
 *   their home, per ADR 0004's note that expanding a range is engine logic).
 */

export * from './conditions.ts';
export * from './model.ts';
export * from './month-range.ts';
export * from './light.ts';
export * from './hardiness.ts';
export * from './soil.ts';
export * from './season.ts';
export * from './score.ts';
export * from './rank.ts';
