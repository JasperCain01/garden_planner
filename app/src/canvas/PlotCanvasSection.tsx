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
 *
 * **Export (Workplan Stage 3.7).** An "Export image" button next to the
 * remove/select toolbar triggers `canvas/export.ts`'s `exportPlotImage` —
 * this component owns getting the Konva `Stage` ref from `PlotCanvas` (via
 * the `stageRef` prop it added) and resolving the plot's conditions
 * (`resolvePlotConditions`, same call `PlotConditionsForm.tsx` already makes)
 * so the legend can name the location and hardiness band alongside the placed
 * crops. See `export.ts`'s own doc comment for why the legend is composited
 * with the 2D Canvas API rather than a Konva `Group`.
 */

import { useRef, useState } from 'react';
import type Konva from 'konva';
import { resolvePlotConditions, type PlotConditions } from '@garden-planner/engine';
import { usePlotStore } from '../state/plot-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import type { CanvasWarnings } from '../warnings/evaluate-canvas.ts';
import { severityColor } from '../warnings/severity.ts';
import { exportPlotImage } from './export.ts';
import { PlacementFeedbackPanel } from './PlacementFeedbackPanel.tsx';
import { PlotCanvas } from './PlotCanvas.tsx';

export interface PlotCanvasSectionProps {
  /** `null` when the plot's growing conditions don't currently resolve (`useCanvasWarnings`'s own contract) — markers then show no badges and nothing is shown for the selected placement. */
  readonly canvasWarnings: CanvasWarnings | null;
}

/** The plot's conditions, resolved for the legend — `null` if the current `conditionsInput` doesn't validate (mirrors `PlotConditionsForm`'s own try/catch around the same call; the legend then just says conditions aren't set rather than throwing). */
function resolveConditionsForLegend(conditionsInput: unknown): PlotConditions | null {
  try {
    return resolvePlotConditions(conditionsInput);
  } catch {
    return null;
  }
}

export function PlotCanvasSection({ canvasWarnings }: PlotCanvasSectionProps) {
  const region = usePlotStore((state) => state.region);
  const conditionsInput = usePlotStore((state) => state.conditionsInput);
  const placements = usePlacementsStore((state) => state.placements);
  const selectedId = usePlacementsStore((state) => state.selectedId);
  const removePlacement = usePlacementsStore((state) => state.removePlacement);
  const selectPlacement = usePlacementsStore((state) => state.selectPlacement);
  const stageRef = useRef<Konva.Stage>(null);
  const [isExporting, setIsExporting] = useState(false);

  const selected = placements.find((placement) => placement.id === selectedId) ?? null;
  const selectedWarnings =
    selected === null ? [] : (canvasWarnings?.warningsByPlacementId.get(selected.id) ?? []);

  /**
   * Move the selection by `offset` placements (±1), wrapping around — the
   * keyboard-operable way to select a placed plant (Workplan Stage 6.2,
   * ADR 0026). Konva shapes aren't independently focusable/tabbable the way
   * DOM elements are, so clicking a marker isn't the *only* way to select
   * one; these two buttons are real, always-tabbable `<button>`s that need
   * no pointer at all. Starts from the first (or last) placement when
   * nothing is currently selected, rather than doing nothing.
   */
  function selectRelative(offset: 1 | -1): void {
    if (placements.length === 0) {
      return;
    }
    const currentIndex = placements.findIndex((placement) => placement.id === selectedId);
    const nextIndex =
      currentIndex === -1
        ? offset === 1
          ? 0
          : placements.length - 1
        : (currentIndex + offset + placements.length) % placements.length;
    selectPlacement(placements[nextIndex].id);
  }

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      await exportPlotImage(stageRef, placements, resolveConditionsForLegend(conditionsInput));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section>
      <h2>3. Arrange your plants</h2>
      <p>
        Drag a plant from the palette above onto the plot below — or, without a pointer, use its
        &ldquo;Add to plot&rdquo; button, then select it with the buttons below (or click it) and
        nudge it into place with the arrow keys (hold Shift to move further). Double-click, press
        Delete/Backspace, or use the Remove button to remove a selected plant.
      </p>
      {/*
       * Workplan Stage 6.2: a plot large enough to make the canvas wider
       * than a phone's viewport must not force the whole *page* to scroll
       * horizontally — that would also drag the growing-conditions form,
       * palette and warnings panel out sideways with it. Scrolling
       * contained to this box, instead, keeps the canvas at full resolution
       * (unlike shrinking its pixels-per-cm to fit, which would make plant
       * icons illegible on a large plot) at the cost of a horizontal
       * scrollbar on the canvas itself for those plots — an accepted
       * trade-off recorded in ADR 0026.
       */}
      <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
        <PlotCanvas
          region={region}
          severityByPlacementId={canvasWarnings?.severityByPlacementId}
          stageRef={stageRef}
        />
      </div>
      <p>
        <button type="button" onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Exporting…' : 'Export image'}
        </button>
      </p>
      {placements.length > 0 && (
        <p>
          <button type="button" onClick={() => selectRelative(-1)}>
            ◀ Previous placement
          </button>{' '}
          <button type="button" onClick={() => selectRelative(1)}>
            Next placement ▶
          </button>
        </p>
      )}
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
