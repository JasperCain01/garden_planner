/**
 * The plot-definition page (Workplan Stage 3.2, extended in 3.3 and 3.4) —
 * `DESIGN.md` §1's whole "describe → discover → arrange" core loop.
 * Composes the plot-definition pieces against the plot store
 * (`state/plot-store.ts`): pick a preset shape, adjust its outline
 * free-form, describe the growing conditions, browse the ranked plant
 * palette (Stage 3.3), and — as of Stage 3.4 — drag plants from it onto the
 * plot canvas. This is what `routes/Home` renders as the app's index route
 * (Stage 3.1 left `Home` as a placeholder specifically for this to replace —
 * see that route's history in `docs/stage-3.1-brief.md`).
 *
 * **Why the palette (and now the canvas) live on this page rather than a
 * separate route:** see `docs/architecture.md`'s Stage 3.3 note. Short
 * version — `DESIGN.md`'s "describe → discover → arrange → validate" loop
 * reads as one continuous flow, not four separate pages, and the canvas
 * needs the palette visible *alongside* placement (drag a plant from the
 * palette onto the canvas) rather than navigated away from.
 *
 * **The `DndContext` boundary (Workplan Stage 3.4).** `PlantPalette`'s
 * entries are dnd-kit drag sources and `PlotCanvasSection`'s canvas is the
 * drop target (`canvas/drop.ts`'s `CANVAS_DROPPABLE_ID`) — both need a
 * shared `DndContext` ancestor, and this page is where they're both already
 * composed, so it owns that context and the drop handler
 * (`useCanvasDropHandler`) rather than either feature reaching for its own.
 *
 * **Warnings (Workplan Stage 3.5).** `useCanvasWarnings` is called once,
 * here, and the result threaded down to both `PlotCanvasSection` (badges the
 * markers) and the new `WarningsSection` (the "4. Check for problems" list) —
 * the same "compute once at the composing page, thread down" reasoning this
 * page already applies to `handleDragEnd`, so evaluating the five warning
 * rules doesn't happen twice per render.
 *
 * **User-defined crops (Workplan Stage 3.6).** `UserCropsSection` sits
 * between the palette and the canvas — `DESIGN.md` frames "add your own
 * crop" as a capability *beyond* the four-step core loop, so it gets its own
 * unnumbered section rather than a fifth numbered step, positioned so a
 * newly-added crop is visible in the palette immediately above before the
 * user scrolls down to place it.
 *
 * **Skip link (Workplan Stage 6.2).** `SkipToCanvasLink` is the one addition
 * this stage's keyboard-only walkthrough turned up as worth making: see that
 * component's own doc for the friction it closes.
 *
 * **Styling (UI redesign Phase 0).** Each section is now a card
 * (`styles/global.css`'s `.card`) and this page sets the gap between them
 * (`PlotDefinitionPage.module.css`). The composition — which components
 * render, in what order, inside one `DndContext` — is untouched: replacing
 * this stacked document with a workspace layout where the palette and canvas
 * are visible at the same time is Phase 1's job, and the single biggest win in
 * `docs/ui-aesthetic-review.md`.
 */

import { DndContext } from '@dnd-kit/core';
import { usePlotStore } from '../state/plot-store.ts';
import { PlantPalette } from '../palette/PlantPalette.tsx';
import { PlotCanvasSection } from '../canvas/PlotCanvasSection.tsx';
import { useCanvasDropHandler } from '../canvas/useCanvasDropHandler.ts';
import { useCanvasWarnings } from '../warnings/useCanvasWarnings.ts';
import { WarningsSection } from '../warnings/WarningsSection.tsx';
import { UserCropsSection } from '../user-crops/UserCropsSection.tsx';
import { PlotConditionsForm } from './PlotConditionsForm.tsx';
import { PlotOutlineEditor } from './PlotOutlineEditor.tsx';
import { ShapePicker } from './ShapePicker.tsx';
import { SkipToCanvasLink } from './SkipToCanvasLink.tsx';
import styles from './PlotDefinitionPage.module.css';

export function PlotDefinitionPage() {
  const region = usePlotStore((state) => state.region);
  const setRegion = usePlotStore((state) => state.setRegion);
  const conditionsInput = usePlotStore((state) => state.conditionsInput);
  const setConditionsInput = usePlotStore((state) => state.setConditionsInput);
  const handleDragEnd = useCanvasDropHandler(region);
  const canvasWarnings = useCanvasWarnings(region);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SkipToCanvasLink />
      <div className={styles.page}>
        <section className="card">
          <h2>1. Define your plot</h2>
          <p className={styles.intro}>
            Start from a preset shape, then drag, add or remove corners until the outline matches
            your real plot.
          </p>
          <ShapePicker onApply={setRegion} />
          <PlotOutlineEditor region={region} onChange={setRegion} />
          <PlotConditionsForm value={conditionsInput} onChange={setConditionsInput} />
        </section>
        <PlantPalette />
        <UserCropsSection />
        <PlotCanvasSection canvasWarnings={canvasWarnings} />
        <WarningsSection canvasWarnings={canvasWarnings} />
      </div>
    </DndContext>
  );
}
