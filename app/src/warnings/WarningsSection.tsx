/**
 * The "Problems & suggestions" panel's contents — wires `WarningsPanel.tsx`
 * (the plain-DOM presentation) to the runtime plant list and the placements
 * store's selection action. Mirrors `canvas/PlotCanvasSection.tsx`'s own
 * split between store-wiring and presentation.
 *
 * **Where it sits (UI redesign Phases 1 and 4).** This used to be section 4 of
 * a stacked document — the highest-value live feedback the engine produces, in
 * the least visible place on the page, four screens from the form that changes
 * it (`docs/ui-aesthetic-review.md` §2.6). Phase 1 made it a disclosure panel
 * in the workspace's right-hand column, which got it closer but not into view:
 * with two crops placed its top edge still sat **263px below the bottom of the
 * column**. Phase 4 pins it there as a dock the two form panels scroll above
 * (ADR 0033 §1). The panel supplies the heading; this renders only the
 * contents.
 *
 * **"Show me" now shows you (Phase 4, ADR 0033 §6).** It used to pass
 * `selectPlacement` straight through, which on a zoomed-in plot selects a
 * marker that is off screen: something is highlighted, nothing visibly happens.
 * It selects *and* asks the canvas to scroll the marker into view — two
 * actions on two stores, because they are two different facts (what is
 * selected; where the plot is being looked at) and this is the one place that
 * wants both. The scrolling itself belongs to whoever owns the viewport
 * element: `canvas/useRevealPlacement.ts`.
 *
 * **The "recomputed live" caption is gone**, and that is Phase 4's doing too.
 * It described behaviour the dock now demonstrates: warnings change in front of
 * you as you edit the form above them, which is the entire point of pinning it.
 * Three lines explaining that cost the dock ~60px of the height that makes it
 * observable.
 *
 * `canvasWarnings` is threaded down from `PlotDefinitionPage.tsx` rather than
 * computed here a second time: `canvas/PlotCanvasSection.tsx` also needs it
 * (to badge markers on the canvas itself), and `PlotDefinitionPage` is already
 * the one place both are composed — computing it once there and passing it to
 * both avoids evaluating every warning rule twice per render.
 */

import { useCallback } from 'react';
import type { CanvasWarnings } from './evaluate-canvas.ts';
import { WarningsPanel } from './WarningsPanel.tsx';
import { useCanvasViewStore } from '../state/canvas-view-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import { usePlantList } from '../state/use-plant-list.ts';

export interface WarningsSectionProps {
  /** `null` when the plot's growing conditions don't currently resolve (`useCanvasWarnings`'s own contract) — mirrors `PlantPalette`'s inline-alert fallback for the same case. */
  readonly canvasWarnings: CanvasWarnings | null;
}

export function WarningsSection({ canvasWarnings }: WarningsSectionProps) {
  const plants = usePlantList();
  const selectPlacement = usePlacementsStore((state) => state.selectPlacement);
  const requestReveal = useCanvasViewStore((state) => state.requestReveal);

  const showPlacement = useCallback(
    (placementId: string) => {
      selectPlacement(placementId);
      requestReveal(placementId);
    },
    [selectPlacement, requestReveal],
  );

  return (
    <>
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
          onFocusPlacement={showPlacement}
        />
      )}
    </>
  );
}
