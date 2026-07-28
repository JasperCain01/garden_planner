/**
 * The "Problems & suggestions" panel's contents — wires `WarningsPanel.tsx`
 * (the plain-DOM presentation) to the runtime plant list and the placements
 * store's selection action. Mirrors `canvas/PlotCanvasSection.tsx`'s own
 * split between store-wiring and presentation.
 *
 * **Where it sits (UI redesign Phase 1).** This used to be section 4 of a
 * stacked document — the highest-value live feedback the engine produces, in
 * the least visible place on the page, four screens from the form that changes
 * it (`docs/ui-aesthetic-review.md` §2.6). It is now a disclosure panel in the
 * workspace's right-hand column, directly under the conditions form and beside
 * the canvas, so the tweak-and-check loop happens without scrolling. The panel
 * supplies the heading; this renders only the contents.
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
    <div>
      <p className="muted">
        Recomputed live as you place, move or remove plants, or change the plot&rsquo;s growing
        conditions.
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
    </div>
  );
}
