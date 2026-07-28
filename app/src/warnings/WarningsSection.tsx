/**
 * "4. Check for problems" page section — wires `WarningsPanel.tsx` (the
 * plain-DOM presentation) to the runtime plant list and the placements
 * store's selection action. Mirrors `canvas/PlotCanvasSection.tsx`'s own
 * split between store-wiring and presentation.
 *
 * `canvasWarnings` is threaded down from `PlotDefinitionPage.tsx` rather than
 * computed here a second time: `canvas/PlotCanvasSection.tsx` also needs it
 * (to badge markers on the canvas itself), and `PlotDefinitionPage` is already
 * the one place both are composed — computing it once there and passing it to
 * both avoids evaluating every warning rule twice per render.
 */

import type { CanvasWarnings } from './evaluate-canvas.ts';
import { WarningsPanel } from './WarningsPanel.tsx';
import { usePlacementsStore } from '../state/placements-store.ts';
import { usePlantList } from '../state/use-plant-list.ts';

export interface WarningsSectionProps {
  /** `null` when the plot's growing conditions don't currently resolve (`useCanvasWarnings`'s own contract) — mirrors `PlantPalette`'s inline-alert fallback for the same case. */
  readonly canvasWarnings: CanvasWarnings | null;
}

export function WarningsSection({ canvasWarnings }: WarningsSectionProps) {
  const plants = usePlantList();
  const selectPlacement = usePlacementsStore((state) => state.selectPlacement);

  return (
    <section className="card">
      <h2>4. Check for problems</h2>
      <p>
        Warnings and companion suggestions for what&rsquo;s currently placed, recomputed live as you
        place, move or remove plants, or change the plot&rsquo;s growing conditions.
      </p>
      {canvasWarnings === null ? (
        <p role="alert">
          Fix the growing-conditions form above to see warnings — this needs valid conditions to
          check against.
        </p>
      ) : (
        <WarningsPanel
          warnings={canvasWarnings.warnings}
          suggestions={canvasWarnings.suggestions}
          plants={plants}
          onFocusPlacement={selectPlacement}
        />
      )}
    </section>
  );
}
