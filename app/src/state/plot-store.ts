/**
 * The plot-definition store (Workplan Stage 3.2): the current outline
 * (`PlotRegion`) and growing-conditions input (`PlotConditionsInput`) — the
 * two values every downstream stage (3.3's ranked palette, 3.4's canvas,
 * 3.5's warnings) needs as "the current plot". Follows the ADR
 * [0015](../../../docs/adr/0015-app-state-management.md) convention: one
 * small, focused Zustand store per concern, plain data in and out.
 *
 * Holds the *input* shapes, not resolved `PlotConditions` — `conditionsInput`
 * keeps the user's original soil/location choices editable across repeat
 * visits to the form. Call `resolvePlotConditions` (`@garden-planner/engine`)
 * at the point a downstream stage actually needs the resolved climate
 * profile, rather than storing a second, already-resolved copy that would
 * drift out of sync with further edits.
 */

import { create } from 'zustand';
import { rectangleRegion, type PlotConditionsInput, type PlotRegion } from '@garden-planner/engine';

/**
 * A modest starting outline (3m x 2m) so the outline editor always has
 * something to show and adjust from the first render, rather than opening on
 * a blank canvas with nothing to drag.
 *
 * Exported since UI redesign Phase 5, because "New design" means *this* plot
 * and this is where it is defined — `state/designs-store.ts` reaching for its
 * own 300×200 would be a second definition of the app's starting point.
 */
export const DEFAULT_REGION: PlotRegion = rectangleRegion(300, 200);

/**
 * `light` is the one condition every plot has (`PlotConditionsInputSchema`),
 * so the form needs a starting value; full sun is the most common default for
 * an open allotment bed.
 */
export const DEFAULT_CONDITIONS_INPUT: PlotConditionsInput = { light: 'full-sun' };

interface PlotState {
  /** The current outline. Always a validated `PlotRegion` — never a mid-edit, possibly-invalid draft (that lives in `PlotOutlineEditor`'s own local state). */
  readonly region: PlotRegion;
  /** The current growing-conditions input, as collected by `PlotConditionsForm` — resolve via `resolvePlotConditions` when a resolved `PlotConditions` is needed. */
  readonly conditionsInput: PlotConditionsInput;
  readonly setRegion: (region: PlotRegion) => void;
  readonly setConditionsInput: (input: PlotConditionsInput) => void;
}

export const usePlotStore = create<PlotState>((set) => ({
  region: DEFAULT_REGION,
  conditionsInput: DEFAULT_CONDITIONS_INPUT,
  setRegion: (region) => set({ region }),
  setConditionsInput: (input) => set({ conditionsInput: input }),
}));
