/**
 * Live density/count feedback for the plot canvas (Workplan Stage 3.4) —
 * `DESIGN.md`'s "computes how many fit" turned into UI. Ordinary DOM/JSX (no
 * Konva), so — unlike `PlotCanvas.tsx` — this is component-tested directly
 * with `@testing-library/react` in `PlacementFeedbackPanel.test.tsx`.
 *
 * Shows two things, both driven by `fitPlant` and never re-derived by this
 * component (same "an explanation is a deliverable" rule `PlantPalette.tsx`
 * follows for `suitability.summary`):
 * 1. The engine's own `summary` sentence for whichever plant is "active" —
 *    the selected placement's plant, or the most recently placed one.
 * 2. A per-crop tally (`canvas/feedback.ts`) of how many of each placed crop
 *    are on the canvas versus how many the plot can hold in total.
 */

import { useMemo } from 'react';
import { fitPlant, type Plant, type PlotRegion } from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import { computePlacementTally } from './feedback.ts';

export interface PlacementFeedbackPanelProps {
  readonly placements: readonly PlacedPlant[];
  readonly region: PlotRegion;
  /** The plant to show the headline `fitPlant` sentence for — typically the selected placement's plant. Falls back to the most recently placed plant when `null`. */
  readonly activePlant: Plant | null;
}

export function PlacementFeedbackPanel({
  placements,
  region,
  activePlant,
}: PlacementFeedbackPanelProps) {
  const tally = useMemo(() => computePlacementTally(placements, region), [placements, region]);

  const headlinePlant = activePlant ?? placements[placements.length - 1]?.plant ?? null;
  const headlineFit = headlinePlant === null ? null : fitPlant(headlinePlant, region);

  if (placements.length === 0) {
    return (
      <p>Nothing placed yet — drag a plant from the palette onto the plot to see how many fit.</p>
    );
  }

  return (
    <div>
      {headlineFit !== null && <p>{headlineFit.summary}</p>}
      <ul>
        {tally.map((row) => (
          <li key={row.plant.id}>
            <strong>{row.plant.commonName}:</strong> {row.placedCount} placed of {row.fit.count} the
            plot can hold ({row.fit.densityPerSquareMetre} per m²)
          </li>
        ))}
      </ul>
    </div>
  );
}
