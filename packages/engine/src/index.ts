/**
 * `@garden-planner/engine` — framework-free horticultural logic.
 *
 * This package intentionally has **no UI-framework dependency and no DOM access**
 * so it can be unit-tested in isolation and reused anywhere (see WORKPLAN.md
 * Phase 2). The real suitability-scoring and spacing/density logic arrives in
 * Stages 2.1–2.3.
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

/** Marker the app shell reads to confirm the engine package is wired in. */
export const ENGINE_READY = true;

/**
 * Placeholder entry point for the suitability/spacing engine.
 *
 * Replaced by the real API in Phase 2. Returns a short human-readable status
 * string so a smoke test (and the app shell) can assert the package is live.
 */
export function engineStatus(): string {
  return 'engine scaffold ready';
}
