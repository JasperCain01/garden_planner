/**
 * The validation half of editing the plot outline on the canvas (UI redesign
 * Phase 2). Pure: vertices in, either a validated `PlotRegion` or a message
 * out.
 *
 * This is `PlotOutlineEditor.tsx`'s `applyEdit` with the React taken off. That
 * component — the second, separate picture of the plot the review complained
 * about ("Two disconnected pictures of the same plot… users must mentally
 * reconcile them") — is gone as of this phase, but its actual *rule* was
 * right and is kept exactly: re-validate through `safeValidatePlotRegion`
 * after every single edit, and never hand an invalid outline to the store.
 * The vertex operations themselves (`plot/outline-ops.ts`) are unchanged and
 * still shared, still with their own tests.
 */

import { safeValidatePlotRegion, type PlotRegion, type Vertex } from '@garden-planner/engine';

/** A validated edit, or the first reason it isn't one. Exactly one of the two fields is non-null. */
export type OutlineEditResult =
  | { readonly region: PlotRegion; readonly error: null }
  | { readonly region: null; readonly error: string };

/**
 * Validate an edited vertex list.
 *
 * The message is the engine's own first issue, not a rewrite of it: "that
 * outline crosses itself" is the schema's wording and belongs to the schema,
 * so the two can't drift into saying different things about the same shape.
 * The generic fallback covers a zod issue list that is somehow empty, which
 * `safeValidatePlotRegion` shouldn't produce but which would otherwise render
 * as `undefined` on screen.
 */
export function validateOutlineEdit(vertices: readonly Vertex[]): OutlineEditResult {
  const result = safeValidatePlotRegion({ vertices });
  return result.success
    ? { region: result.data, error: null }
    : { region: null, error: result.error.issues[0]?.message ?? 'that outline is not valid' };
}
