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
import { buildExampleBed, EXAMPLE_BED_LABEL } from '../designs/example-bed.ts';
import { applyDesign } from '../state/design.ts';
import { recordAs } from '../state/design-history.ts';
import { usePlotStore } from '../state/plot-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import { usePlantList } from '../state/use-plant-list.ts';
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
  const plants = usePlantList();
  const stageRef = useRef<Konva.Stage>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  /**
   * Load the starter bed as **one** undo step, named.
   *
   * `recordAs` rather than three separate writes: it replaces the outline, the
   * conditions and the planting at once, and a user who tried it and did not
   * want it should get their empty plot back with one Ctrl+Z rather than three.
   */
  function handleExampleBed(): void {
    const design = buildExampleBed(plants);
    if (design === null) return;
    recordAs(EXAMPLE_BED_LABEL, () => applyDesign(design));
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
            // Post-review fix B2: full phrase kept in the accessible name
            // (WCAG 2.5.3 — the visible "Done" is contained in it) via
            // `aria-label`, the same visible/accessible-name split
            // `ShapePicker.tsx`'s `MetreField` uses for a unit and this
            // component's own "Example bed" button already uses below. Every
            // existing `/done editing shape/i` lookup still matches.
            aria-label={outlineEditing.active ? 'Done editing shape' : undefined}
            data-variant={outlineEditing.active ? 'primary' : undefined}
          >
            {outlineEditing.active ? 'Done' : 'Edit shape'}
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
              {/* Post-review fix B2: "Add"/"Remove", not "Add corner"/"Remove
                  corner" — same accessible-name split as "Done" above, so the
                  edit-mode button set (this pair, the corner-selection pair,
                  and the toggle) fits alongside the heading on one row at
                  1440×900 instead of wrapping the toolbar to a second, which
                  used to shift the canvas viewport down on every mode toggle. */}
              <button
                type="button"
                onClick={() =>
                  outlineEditing.addCornerAfter(outlineEditing.selectedCornerIndex ?? 0)
                }
                aria-label="Add corner"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => outlineEditing.removeCorner(outlineEditing.selectedCornerIndex ?? 0)}
                disabled={outlineEditing.selectedCornerIndex === null}
                aria-label="Remove corner"
              >
                Remove
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

          {/*
           * "Clear all" no longer asks first (UI redesign Phase 5, ADR 0034
           * §5). It used to open a confirmation dialog, and the reason it gave
           * was that clearing "throws away every placement and there is no undo
           * until Phase 5" — so with undo, the dialog's entire justification is
           * gone, and a confirmation for a reversible action is a click that
           * buys nothing. The affordance that replaced it is the header's Undo
           * button, whose accessible name says what it will bring back ("Undo
           * clearing the plot"), which the dialog never did.
           *
           * The rule is *reversibility*, not destructiveness: deleting a saved
           * design still confirms (`designs/DesignsDialog.tsx`), because the
           * history is per-design and cannot reach it.
           *
           * **Hidden while editing the shape (post-review fix B2).** It acts on
           * placements, not the outline, so it has no job in this mode — and
           * hiding it (along with "Export image", below) is what keeps the
           * busier edit-mode button set ("Done editing shape", the corner
           * selection pair, "Add corner", "Remove corner") on one row at the
           * supported widths instead of wrapping to a second, which used to
           * shift the canvas viewport's top edge down on every mode toggle.
           */}
          {!outlineEditing.active && placements.length > 0 && (
            <button type="button" onClick={clearPlacements}>
              Clear all
            </button>
          )}
          {/*
           * The first-run offer, on the toolbar rather than in a modal — see
           * `designs/example-bed.ts` for why not a dialog, and why this reappears
           * whenever the plot is empty rather than only on the first visit. It
           * occupies exactly the space "Clear all" and the selection arrows take
           * once something is placed, so the toolbar's busiest state is unchanged.
           */}
          {placements.length === 0 && !outlineEditing.active && (
            <button
              type="button"
              onClick={handleExampleBed}
              // The offer in full is the accessible name and the tooltip; the
              // visible label is the short form, and that is a measurement
              // rather than a preference. The toolbar is one row at 1440×900
              // with 788px to spend, and "Start with an example bed" spelled
              // out took the actions row to 703px against the 698px left beside
              // the "Your plot" heading — it wrapped, and a second toolbar row
              // costs 35px of the canvas that `e2e/canvas-scale.spec.ts`
              // measures. WCAG 2.5.3 holds: the visible text is contained in
              // the accessible name.
              aria-label="Start with an example bed"
              title="Start with an example bed"
            >
              Example bed
            </button>
          )}
          {/* Hidden while editing the shape (post-review fix B2) — see the
              "Clear all" comment above; it acts on placements too. */}
          {!outlineEditing.active && (
            <button type="button" onClick={handleExport} disabled={isExporting}>
              {isExporting ? 'Exporting…' : 'Export image'}
            </button>
          )}
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
    </div>
  );
}
