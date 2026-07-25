/**
 * `@garden-planner/engine` — framework-free horticultural logic.
 *
 * This package intentionally has **no UI-framework dependency and no DOM access**
 * so it can be unit-tested in isolation and reused anywhere (see WORKPLAN.md
 * Phase 2). The spacing/density calculator (2.2) and warnings engine (2.3) join
 * the suitability scorer here as they land.
 *
 * Stage 0.2 adds the **canonical plant-record schema** — the shape every later
 * stage builds on. It is re-exported here as the package's public surface.
 */

/**
 * The plant-record schema, inferred types, and validators (Stage 0.2). zod is the
 * single source of truth; see `schema/plant.ts`.
 */
export * from './schema/index.ts';

/**
 * Location/climate static data and the `resolveClimate` interface (Stage 1.6):
 * the UK-default profile, a small extensible region set, and the offline
 * resolver the suitability engine (Stage 2.1) and plot-definition UI (Stage
 * 3.2) consume. See `climate/index.ts` and `docs/adr/0010-*.md`.
 */
export * from './climate/index.ts';

/**
 * The suitability-scoring engine (Stage 2.1 — the ⭐ keystone "brain"): the
 * plot/growing-conditions schema, the four per-dimension scorers and their
 * reasoning, `scorePlant`, and the `rankPlants` helper the palette (Stage 3.3)
 * ranks crops with. See `suitability/index.ts` and
 * `docs/adr/0012-suitability-scoring.md`.
 */
export * from './suitability/index.ts';

/**
 * The spacing / density calculator (Stage 2.2 — ⭐ algorithmic): the plot-region
 * schema and its preset shapes, and `fitPlant`/`fitSpacing`, which answer
 * `DESIGN.md`'s "how many onions can I fit?" shape-aware (an arbitrary simple
 * polygon, not a bounding box) and method-aware (rows vs. intensive beds). See
 * `spacing/index.ts` and `docs/adr/0013-spacing-density-calculator.md`.
 */
export * from './spacing/index.ts';

/**
 * The warnings & companion-suggestion engine (Stage 2.3): `evaluatePlot`, the
 * single entry point Stage 3.5 calls per state change, returning every
 * warning (wrong light, overcrowding, wrong sowing season, antagonist
 * adjacency, climate mismatch) and companion suggestion for what's placed.
 * See `warnings/index.ts` and
 * `docs/adr/0014-warnings-and-companion-suggestions.md`.
 */
export * from './warnings/index.ts';

/** Marker the app shell reads to confirm the engine package is wired in. */
export const ENGINE_READY = true;

/**
 * Placeholder entry point kept from the Stage 0.1 scaffold.
 *
 * The real API is `scorePlant`/`rankPlants` and `fitPlant`/`fitSpacing`; this
 * survives only so the app shell's smoke test can assert the package is live.
 */
export function engineStatus(): string {
  return 'engine scaffold ready';
}
