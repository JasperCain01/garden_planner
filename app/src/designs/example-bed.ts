/**
 * The starter design (UI redesign Phase 5) — the review's "first-run offers
 * 'Start with an example bed' that loads a small pre-arranged plot — instant
 * demonstration of what the app does".
 *
 * **Where the offer is made matters more than what is in it.** It is a button
 * on the canvas toolbar, shown while the plot is empty, and it is deliberately
 * *not* a first-run modal. `keyboard-walkthrough.mjs` waits on `text=Plot shape`
 * four times as the whole app's readiness signal, and `e2e/a11y.spec.ts` and
 * `App.test.tsx` both reach for the header heading immediately on load — a
 * dialog covering the workspace on first paint would put every one of those in
 * a race with it. A toolbar button costs no layout row (it occupies the space
 * "Clear all" and the selection arrows take once something *is* placed, so the
 * toolbar's busiest state is unchanged) and it comes back if you empty the plot
 * again, which a once-only first-run prompt would not.
 *
 * **What is in it is chosen against the engine, not for looks.** Five crops
 * that all suit the default full-sun plot, spaced so that nothing overcrowds
 * and no antagonist pair is planted — and including carrot and onion, whose
 * companion link is the shipped dataset's `well-supported` one, so the dock
 * has something true to say the moment the bed lands. A starter bed that opened
 * with three red warnings would demonstrate the wrong thing.
 *
 * **Every crop is looked up, and a missing one is simply skipped.** The dataset
 * is a build artifact and ADR 0025 deleted 24 crops from it on purpose, so a
 * hard-coded id is a reference that can go stale between deploys — the same
 * problem `state/design-codec.ts` solves for saved designs, and it gets the same
 * answer here rather than a second one.
 */

import type { Plant } from '@garden-planner/engine';
import { DEFAULT_CONDITIONS_INPUT, DEFAULT_REGION } from '../state/plot-store.ts';
import type { PlacedPlant } from '../state/placements-store.ts';
import type { Design } from '../state/design.ts';

/** The label the history shows for this, since a diff would call it "that change to the planting". */
export const EXAMPLE_BED_LABEL = 'starting from the example bed';

/**
 * The bed: crop ids and where they sit, in the default 3×2m plot's own
 * centimetre frame.
 *
 * The positions are on a rough 2×3 grid with ~80cm between neighbours, which is
 * comfortably past the widest between-row spacing in the set (onion's 30cm) —
 * the adjacency rules derive their threshold from the crops involved
 * (`warnings/adjacency.ts`), so the margin is expressed as "more than any of
 * these crops asks for" rather than as a magic number.
 */
const EXAMPLE_BED: readonly { readonly plantId: string; readonly x: number; readonly y: number }[] =
  [
    { plantId: 'carrot', x: 60, y: 60 },
    { plantId: 'onion', x: 150, y: 60 },
    { plantId: 'radish', x: 240, y: 60 },
    { plantId: 'beet', x: 90, y: 145 },
    { plantId: 'spinach', x: 210, y: 145 },
  ];

/**
 * Build the example bed from the live plant list, or `null` if too few of its
 * crops still exist to demonstrate anything.
 *
 * The plot is reset to the default outline along with the planting: an example
 * bed dropped onto a plot the user has already reshaped would put its crops
 * wherever the old coordinates happened to land, which is the opposite of
 * "pre-arranged".
 */
export function buildExampleBed(plants: readonly Plant[]): Design | null {
  const byId = new Map(plants.map((plant) => [plant.id, plant]));
  const placements: PlacedPlant[] = [];
  for (const spot of EXAMPLE_BED) {
    const plant = byId.get(spot.plantId);
    if (plant === undefined) continue;
    placements.push({ id: `placement-${crypto.randomUUID()}`, plant, x: spot.x, y: spot.y });
  }
  if (placements.length < 2) return null;
  return {
    region: DEFAULT_REGION,
    conditionsInput: DEFAULT_CONDITIONS_INPUT,
    placements,
  };
}
