/**
 * The workspace's centre region — the page section wrapping `PlotCanvas.tsx`
 * (Workplan Stage 3.4). Composes the Konva scene with the plain-DOM pieces
 * around it: the toolbar above it, and below it a pointer-accessible remove
 * affordance for whatever's selected (the canvas itself already supports
 * Delete/Backspace and double-click — see `PlotCanvas.tsx`) plus the live
 * density/count feedback panel.
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
 * warning reasons right here, next to its name and the Remove button.
 *
 * **Export (Workplan Stage 3.7).** An "Export image" toolbar button triggers
 * `canvas/export.ts`'s `exportPlotImage` — this component owns getting the
 * Konva `Stage` ref from `PlotCanvas` (via the `stageRef` prop) and resolving
 * the plot's conditions (`resolvePlotConditions`, same call
 * `PlotConditionsForm.tsx` already makes) so the legend can name the location
 * and hardiness band alongside the placed crops. See `export.ts`'s own doc
 * comment for why the legend is composited with the 2D Canvas API rather than
 * a Konva `Group`, and why it is handed the live scale.
 *
 * **Layout (UI redesign Phase 1).** This is the centre of the workspace: it
 * fills the region it is given (toolbar on top, the canvas in a viewport that
 * takes all the height left, selection readout and count feedback docked
 * below), and the numbered heading is gone with the rest of the false 1→2→3→4
 * sequence.
 *
 * **The canvas actually uses that space now (UI redesign Phase 2, ADR 0031).**
 * Three things landed here for it:
 *
 * - This component measures its own `.viewport` (`useMeasuredViewport`), which
 *   is what every scale in the app is derived from — the stage is drawn at
 *   `useCanvasScale`'s fitted-and-zoomed `pxPerCm` rather than a fixed 0.6.
 * - The toolbar gained zoom controls, an "Edit shape" toggle, and "Clear all";
 *   in edit mode the Previous/Next *placement* buttons become Previous/Next
 *   *corner*, because that is what the canvas's arrow keys are acting on.
 *   Every one of those is a real `<button>`, so the whole of Phase 2's new
 *   interaction surface is keyboard-operable by construction (ADR 0026's
 *   standing requirement).
 * - The outline editor moved *into* the canvas, so `plot/PlotOutlineEditor.tsx`
 *   — the second, differently-scaled picture of the same plot — is gone.
 *
 * **"Show me" lands here (UI redesign Phase 4, ADR 0033 §6).** The warnings
 * dock's button has to *scroll the plot to* a marker, and ADR 0031 §7 made
 * panning this viewport element's own native scroll — so the request travels as
 * plain data through `state/canvas-view-store.ts` and the scrolling happens in
 * `useRevealPlacement`, called here because this is the component that holds
 * the viewport ref. The alternative, a DOM node in a store, would be the second
 * notion of "where the plot is" that ADR 0031 exists to prevent.
 */

import { useRef, useState } from 'react';
import type Konva from 'konva';
import { resolvePlotConditions, type PlotConditions } from '@garden-planner/engine';
import { ModalDialog } from '../ui/ModalDialog.tsx';
import { usePlotStore } from '../state/plot-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import type { CanvasWarnings } from '../warnings/evaluate-canvas.ts';
import { SeverityIcon } from '../warnings/SeverityIcon.tsx';
import { exportPlotImage } from './export.ts';
import { PlacementFeedbackPanel } from './PlacementFeedbackPanel.tsx';
import { PlotCanvas } from './PlotCanvas.tsx';
import { useCanvasScale, useMeasuredViewport } from './useCanvasScale.ts';
import { useDisplayRegion, useOutlineEditing } from './useOutlineEditing.ts';
import { useRevealPlacement } from './useRevealPlacement.ts';
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
  const conditionsInput = usePlotStore((state) => state.conditionsInput);
  const placements = usePlacementsStore((state) => state.placements);
  const selectedId = usePlacementsStore((state) => state.selectedId);
  const removePlacement = usePlacementsStore((state) => state.removePlacement);
  const selectPlacement = usePlacementsStore((state) => state.selectPlacement);
  const clearPlacements = usePlacementsStore((state) => state.clearPlacements);
  const stageRef = useRef<Konva.Stage>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // The region the *scene* is drawn from: the committed outline, or the draft
  // while an outline edit is mid-flight and invalid (`useOutlineEditing.ts`).
  const region = useDisplayRegion();
  const outlineEditing = useOutlineEditing();
  useMeasuredViewport(viewportRef);
  const scale = useCanvasScale(region);
  useRevealPlacement(viewportRef, region, scale.pxPerCm);

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
      await exportPlotImage(
        stageRef,
        placements,
        resolveConditionsForLegend(conditionsInput),
        scale.pxPerCm,
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className={styles.region}>
      <div className={styles.toolbar}>
        <h2 className={styles.heading}>Your plot</h2>
        <div className={styles.actions}>
          {/*
           * Zoom. Three real buttons rather than a scroll gesture alone: a
           * gesture has no keyboard equivalent, and ADR 0026 makes every
           * interaction's keyboard path contractual. The readout is
           * `aria-live` so pressing them tells a screen-reader user what
           * happened — otherwise "zoom in" is a button whose effect is
           * invisible to them.
           */}
          <div className={styles.zoom} role="group" aria-label="Zoom">
            <button
              type="button"
              onClick={scale.zoomOut}
              disabled={!scale.canZoomOut}
              aria-label="Zoom out"
              className={styles.iconButton}
            >
              −
            </button>
            <span className={styles.zoomReadout} aria-live="polite">
              {Math.round(scale.zoomRatio * 100)}%
            </span>
            <button
              type="button"
              onClick={scale.zoomIn}
              disabled={!scale.canZoomIn}
              aria-label="Zoom in"
              className={styles.iconButton}
            >
              +
            </button>
            <button type="button" onClick={scale.zoomToFit} aria-label="Fit the plot to the screen">
              Fit
            </button>
          </div>

          <button
            type="button"
            onClick={() => outlineEditing.setActive(!outlineEditing.active)}
            aria-pressed={outlineEditing.active}
            data-variant={outlineEditing.active ? 'primary' : undefined}
          >
            {outlineEditing.active ? 'Done editing shape' : 'Edit shape'}
          </button>

          {/* In edit mode the arrow keys act on a corner, so the selection
              buttons follow them there. Two modes, one pair of buttons: the
              alternative is four buttons of which two are always inert. */}
          {outlineEditing.active ? (
            <>
              <button
                type="button"
                onClick={() => outlineEditing.selectRelativeCorner(-1)}
                aria-label="Previous corner"
                className={styles.iconButton}
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => outlineEditing.selectRelativeCorner(1)}
                aria-label="Next corner"
                className={styles.iconButton}
              >
                ▶
              </button>
              <button
                type="button"
                onClick={() =>
                  outlineEditing.addCornerAfter(outlineEditing.selectedCornerIndex ?? 0)
                }
              >
                Add corner
              </button>
              <button
                type="button"
                onClick={() => outlineEditing.removeCorner(outlineEditing.selectedCornerIndex ?? 0)}
                disabled={outlineEditing.selectedCornerIndex === null}
              >
                Remove corner
              </button>
            </>
          ) : (
            placements.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => selectRelative(-1)}
                  aria-label="Previous placement"
                  className={styles.iconButton}
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => selectRelative(1)}
                  aria-label="Next placement"
                  className={styles.iconButton}
                >
                  ▶
                </button>
              </>
            )
          )}

          {placements.length > 0 && (
            <button type="button" onClick={() => setIsConfirmingClear(true)}>
              Clear all
            </button>
          )}
          <button type="button" onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting…' : 'Export image'}
          </button>
        </div>
      </div>
      <p className={styles.hint}>
        {outlineEditing.active ? (
          <>
            Drag a corner to reshape the plot, or click a small blue handle to add one. Without a
            pointer: pick a corner with the ◀/▶ buttons above, move it with the arrow keys (hold
            Shift to move further), and press Delete to remove it.
          </>
        ) : (
          <>
            Drag a plant from the plants list onto the plot — or, without a pointer, use its
            &ldquo;Add to plot&rdquo; button, then select it with the ◀/▶ buttons above (or click
            it) and nudge it into place with the arrow keys (hold Shift to move further).
            Double-click, press Delete/Backspace, or use the Remove button to remove a selected
            plant. Each plant is drawn at the space it actually needs.
          </>
        )}
      </p>
      <div className={styles.viewport} ref={viewportRef}>
        <PlotCanvas
          region={region}
          pxPerCm={scale.pxPerCm}
          severityByPlacementId={canvasWarnings?.severityByPlacementId}
          stageRef={stageRef}
          outlineEditing={outlineEditing}
          panContainerRef={viewportRef}
        />
      </div>
      <div className={styles.dock}>
        {outlineEditing.error !== null && (
          <p role="alert" className={styles.outlineError}>
            {outlineEditing.error}
          </p>
        )}
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
                    {/* The same mark the dock uses, and the same one Konva
                        draws on the marker itself — UI redesign Phase 4
                        replaced the uppercase severity word everywhere at once,
                        so one severity never reads two ways on one screen. */}
                    <SeverityIcon severity={warning.severity} /> {warning.reason}
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

      {/*
       * "Clear all" confirms first, because it throws away every placement and
       * there is no undo until Phase 5. It reuses `ui/ModalDialog.tsx` (Phase
       * 1's `<dialog>` primitive) rather than `window.confirm`: same focus
       * trap, Esc and focus-return the add-crop dialog gets from the browser,
       * and it renders inside the app rather than as OS chrome the page can't
       * style or a headless browser reliably drive.
       */}
      <ModalDialog
        open={isConfirmingClear}
        onClose={() => setIsConfirmingClear(false)}
        title="Clear the whole plot?"
      >
        <p>
          This removes all {placements.length}{' '}
          {placements.length === 1 ? 'placed plant' : 'placed plants'}. It can&rsquo;t be undone.
        </p>
        <div className={styles.confirmActions}>
          <button type="button" onClick={() => setIsConfirmingClear(false)}>
            Keep them
          </button>
          <button
            type="button"
            data-variant="primary"
            onClick={() => {
              clearPlacements();
              setIsConfirmingClear(false);
            }}
          >
            Clear all plants
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
