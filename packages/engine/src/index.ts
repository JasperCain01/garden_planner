/**
 * `@garden-planner/engine` — framework-free horticultural logic.
 *
 * This package intentionally has **no UI-framework dependency and no DOM access**
 * so it can be unit-tested in isolation and reused anywhere (see WORKPLAN.md
 * Phase 2). The real suitability-scoring and spacing/density logic arrives in
 * Stages 2.1–2.3.
 *
 * For now the package exposes a single marker so the app shell can prove the
 * cross-workspace wiring type-checks and bundles end-to-end.
 */

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
