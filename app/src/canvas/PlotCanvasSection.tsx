/**
 * "3. Arrange your plants" — the page section wrapping `PlotCanvas.tsx`
 * (Workplan Stage 3.4). Composes the Konva scene with the plain-DOM pieces
 * around it: a pointer-accessible remove affordance for whatever's selected
 * (the canvas itself already supports Delete/Backspace and double-click —
 * see `PlotCanvas.tsx`) and the live density/count feedback panel.
 *
 * Reads `usePlotStore`'s `region` and `usePlacementsStore` directly, mirroring
 * `PlantPalette.tsx`'s convention of reading shared Zustand stores rather than
 * having props threaded down from `PlotDefinitionPage.tsx`.
 *
 * **Workplan Stage 3.5** threads `canvasWarnings` in as a prop (computed once
 * in `PlotDefinitionPage.tsx` via `warnings/useCanvasWarnings.ts`, not
 * recomputed here — see `warnings/WarningsSection.tsx`'s doc comment for why)
 * so that: every marker gets its severity badge (`PlotCanvas`'s
 * `severityByPlacementId`), and — the "on inspection" half of the brief's
 * badge requirement — selecting a placement shows that placement's own
 * warning reasons right here, next to its name and the Remove button, rather
 * than only in the separate "4. Check for problems" list.
 */

import { usePlotStore } from '../state/plot-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import type { CanvasWarnings } from '../warnings/evaluate-canvas.ts';
import { severityColor } from '../warnings/severity.ts';
import { PlacementFeedbackPanel } from './PlacementFeedbackPanel.tsx';
import { PlotCanvas } from './PlotCanvas.tsx';

export interface PlotCanvasSectionProps {
  /** `null` when the plot's growing conditions don't currently resolve (`useCanvasWarnings`'s own contract) — markers then show no badges and nothing is shown for the selected placement. */
  readonly canvasWarnings: CanvasWarnings | null;
}

export function PlotCanvasSection({ canvasWarnings }: PlotCanvasSectionProps) {
  const region = usePlotStore((state) => state.region);
  const placements = usePlacementsStore((state) => state.placements);
  const selectedId = usePlacementsStore((state) => state.selectedId);
  const removePlacement = usePlacementsStore((state) => state.removePlacement);

  const selected = placements.find((placement) => placement.id === selectedId) ?? null;
  const selectedWarnings =
    selected === null ? [] : (canvasWarnings?.warningsByPlacementId.get(selected.id) ?? []);

  return (
    <section>
      <h2>3. Arrange your plants</h2>
      <p>
        Drag a plant from the palette above onto the plot below. Click a placed plant to select it,
        drag it to move it, and double-click, press Delete/Backspace, or use the button below to
        remove it.
      </p>
      <PlotCanvas region={region} severityByPlacementId={canvasWarnings?.severityByPlacementId} />
      {selected !== null && (
        <div>
          <p>
            Selected: {selected.plant.commonName}{' '}
            <button type="button" onClick={() => removePlacement(selected.id)}>
              Remove
            </button>
          </p>
          {selectedWarnings.length > 0 && (
            <ul>
              {selectedWarnings.map((warning) => (
                <li
                  key={`${warning.kind}:${warning.subjects.map((subject) => subject.placementId).join(',')}`}
                >
                  <strong style={{ color: severityColor(warning.severity) }}>
                    {warning.severity.toUpperCase()}
                  </strong>{' '}
                  {warning.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <PlacementFeedbackPanel
        placements={placements}
        region={region}
        activePlant={selected?.plant ?? null}
      />
    </section>
  );
}
