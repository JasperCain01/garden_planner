/**
 * The workspace's centre region — the page section wrapping `PlotCanvas.tsx`
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
 *
 * **Styling (UI redesign Phase 0).** The scattered `<p>`-wrapped default
 * buttons become one toolbar row, the selected-placement readout becomes a
 * small card, and the severity word takes its colour from the `--severity-*`
 * tokens (the CSS mirror of `warnings/severity.ts`, which stays the source of
 * truth because Konva needs literals) instead of an inline `style`.
 *
 * **Layout (UI redesign Phase 1).** This is the centre of the workspace now,
 * not the third of five stacked sections: it fills the region it is given
 * (toolbar on top, the canvas in a viewport that takes all the height left,
 * selection readout and count feedback docked below), and the numbered
 * heading is gone with the rest of the false 1→2→3→4 sequence. Two things this
 * phase deliberately does **not** do, because they are Phase 2's whole brief:
 * the stage is still drawn at the fixed `PX_PER_CM` scale rather than fitted
 * to the space it now has, and the outline editor is still a second, separate
 * picture of the same plot over in the checks panel.
 */

import { useRef, useState } from 'react';
import type Konva from 'konva';
import { resolvePlotConditions, type PlotConditions } from '@garden-planner/engine';
import { usePlotStore } from '../state/plot-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import type { CanvasWarnings } from '../warnings/evaluate-canvas.ts';
import { exportPlotImage } from './export.ts';
import { PlacementFeedbackPanel } from './PlacementFeedbackPanel.tsx';
import { PlotCanvas } from './PlotCanvas.tsx';
import styles from './PlotCanvasSection.module.css';

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
    <div className={styles.region}>
      <div className={styles.toolbar}>
        <h2 className={styles.heading}>Your plot</h2>
        <div className={styles.actions}>
          {placements.length > 0 && (
            <>
              <button type="button" onClick={() => selectRelative(-1)}>
                ◀ Previous placement
              </button>
              <button type="button" onClick={() => selectRelative(1)}>
                Next placement ▶
              </button>
            </>
          )}
          <button type="button" onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting…' : 'Export image'}
          </button>
        </div>
      </div>
      <p className={styles.hint}>
        Drag a plant from the plants list onto the plot — or, without a pointer, use its &ldquo;Add
        to plot&rdquo; button, then select it with the buttons above (or click it) and nudge it into
        place with the arrow keys (hold Shift to move further). Double-click, press
        Delete/Backspace, or use the Remove button to remove a selected plant.
      </p>
      <div className={styles.viewport}>
        <PlotCanvas
          region={region}
          severityByPlacementId={canvasWarnings?.severityByPlacementId}
          stageRef={stageRef}
        />
      </div>
      <div className={styles.dock}>
        {selected !== null && (
          <div className={styles.selected}>
            <p className={styles.selectedName}>
              Selected: {selected.plant.commonName}{' '}
              <button type="button" onClick={() => removePlacement(selected.id)}>
                Remove
              </button>
            </p>
            {selectedWarnings.length > 0 && (
              <ul className={styles.selectedWarnings}>
                {selectedWarnings.map((warning) => (
                  <li
                    key={`${warning.kind}:${warning.subjects.map((subject) => subject.placementId).join(',')}`}
                  >
                    <strong className={styles.severity} data-severity={warning.severity}>
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
      </div>
    </div>
  );
}
