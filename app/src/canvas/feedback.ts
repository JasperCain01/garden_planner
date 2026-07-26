/**
 * Pure "how does the plot fare so far?" logic behind the canvas's live
 * density/count feedback (Workplan Stage 3.4) — `DESIGN.md`'s "computes how
 * many fit" applied to what's actually been placed, not just a hypothetical
 * plant. Kept separate from `PlacementFeedbackPanel.tsx` for the same reason
 * `canvas/geometry.ts` is: a plain data question, testable without rendering
 * anything.
 *
 * This only reports counts and `fitPlant`'s own honest numbers — it never
 * judges whether a placement is "too many" or "too close". That judgement
 * (an overcrowding warning) is Stage 3.5's `evaluatePlot` job, not this
 * stage's.
 */

import {
  fitPlant,
  type Plant,
  type PlotRegion,
  type SpacingCalculation,
} from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';

/** One crop's row in the per-crop tally: how many are placed, and how many the plot/that method can hold in total. */
export interface PlacementTallyRow {
  readonly plant: Plant;
  /** How many instances of this plant are currently placed on the canvas. */
  readonly placedCount: number;
  /** `fitPlant(plant, region)` — the plot's total capacity for this crop, independent of what else is placed. */
  readonly fit: SpacingCalculation;
}

/**
 * Group `placements` by plant id and compute each distinct crop's `fitPlant`
 * capacity against `region`, in first-placed order (so the tally doesn't
 * reshuffle as a gardener keeps adding the same crop).
 */
export function computePlacementTally(
  placements: readonly PlacedPlant[],
  region: PlotRegion,
): PlacementTallyRow[] {
  const counts: { plant: Plant; placedCount: number }[] = [];
  const indexByPlantId = new Map<string, number>();

  for (const placement of placements) {
    const index = indexByPlantId.get(placement.plant.id);
    if (index === undefined) {
      indexByPlantId.set(placement.plant.id, counts.length);
      counts.push({ plant: placement.plant, placedCount: 1 });
    } else {
      counts[index].placedCount += 1;
    }
  }

  return counts.map(({ plant, placedCount }) => ({
    plant,
    placedCount,
    fit: fitPlant(plant, region),
  }));
}
