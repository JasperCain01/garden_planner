/**
 * The plot-definition page (Workplan Stage 3.2, extended in 3.3 and 3.4) —
 * `DESIGN.md` §1's whole "describe → discover → arrange → validate" core loop,
 * and since UI redesign Phase 1 the app's **workspace**: three regions on
 * screen at once rather than five sections stacked down a 640px column.
 *
 * ```
 * ┌──────────────────────────────────────────────────────────────┐
 * │ header (routes/AppShell.tsx)                                 │
 * ├────────────┬─────────────────────────────┬───────────────────┤
 * │ PLANTS     │        YOUR PLOT            │ PLOT & CHECKS     │
 * │ 320px      │        the canvas, filling  │ 300px             │
 * │ own scroll │        the space left over  │ shape · outline · │
 * │ + add-crop │                             │ conditions ·      │
 * │   dialog   │                             │ problems          │
 * └────────────┴─────────────────────────────┴───────────────────┘
 * ```
 *
 * **Why this is the shape of the app** (`docs/ui-aesthetic-review.md` §Part 1,
 * ADR 0030). The advertised gesture is "drag a plant from the palette onto the
 * plot", and until this phase the palette and the canvas were ~1,500px apart
 * and never on screen together — a drag needed dnd-kit's autoscroll to crawl
 * the page mid-gesture. Real use is a loop (tweak plot ↔ browse plants ↔
 * arrange ↔ check warnings), and a vertical document made every iteration of
 * that loop a scroll journey. Putting the palette beside the canvas, and the
 * tweak-and-check controls on the canvas's other side, is what makes it free.
 * Nothing about the *wiring* changed: same components, same stores, one
 * `DndContext` as before.
 *
 * **The numbered headings are gone.** "1. Define your plot" … "4. Check for
 * problems" enforced a sequence over what is really a loop; the workspace *is*
 * the loop, so each region says what it is instead. Every region is a labelled
 * `region` landmark, so the structure a screen-reader user navigates by is at
 * least as good as the one those headings gave (`docs/accessibility.md`).
 *
 * **The cost the layout does have, and what pays for it.** Reading order is
 * now plants → plot → settings, which puts the shape-and-conditions form
 * behind the whole 144-crop palette where it used to come first. `SkipLinks`
 * answers that with a second skip link straight to the settings column,
 * alongside Stage 6.2's existing one to the canvas — see that component's doc
 * for why this rather than re-ordering the DOM against the visible columns.
 *
 * **The `DndContext` boundary (Workplan Stage 3.4).** `PlantPalette`'s entries
 * are dnd-kit drag sources and `PlotCanvasSection`'s canvas is the drop target
 * (`canvas/drop.ts`'s `CANVAS_DROPPABLE_ID`) — both need a shared `DndContext`
 * ancestor, and this page is where they're both composed, so it owns that
 * context and the drop handler (`useCanvasDropHandler`) rather than either
 * feature reaching for its own.
 *
 * **Warnings (Workplan Stage 3.5).** `useCanvasWarnings` is called once, here,
 * and the result threaded down to both `PlotCanvasSection` (badges the
 * markers) and `WarningsSection` (the problems panel) — the same "compute once
 * at the composing page, thread down" reasoning this page already applies to
 * `handleDragEnd`, so evaluating the five warning rules doesn't happen twice
 * per render.
 *
 * **User-defined crops (Workplan Stage 3.6, relocated in Phase 1).** "Add your
 * own crop" used to take ~800px of page between the palette and the canvas for
 * a capability used rarely. It is a dialog off the foot of the plants sidebar
 * now (`user-crops/AddCropDialog.tsx`); the form inside it is unchanged.
 *
 * **The three disclosure panels.** The review asks for collapsible accordions
 * in the right-hand column, and `<details>`/`<summary>` is what that is in
 * HTML — keyboard-operable, announced as a disclosure, open and closed without
 * a line of state. All three start open: the column scrolls internally, so
 * "open" costs nothing but reach, and a first-run user should see that the
 * controls exist before learning they collapse.
 */

import type { ReactNode } from 'react';
import { DndContext } from '@dnd-kit/core';
import { usePlotStore } from '../state/plot-store.ts';
import { PlantPalette } from '../palette/PlantPalette.tsx';
import { PlotCanvasSection } from '../canvas/PlotCanvasSection.tsx';
import { useCanvasDropHandler } from '../canvas/useCanvasDropHandler.ts';
import { useCanvasWarnings } from '../warnings/useCanvasWarnings.ts';
import { WarningsSection } from '../warnings/WarningsSection.tsx';
import { AddCropDialog } from '../user-crops/AddCropDialog.tsx';
import { PlotConditionsForm } from './PlotConditionsForm.tsx';
import { PlotOutlineEditor } from './PlotOutlineEditor.tsx';
import { ShapePicker } from './ShapePicker.tsx';
import { PLOT_SETTINGS_ID, SkipLinks } from './SkipLinks.tsx';
import styles from './PlotDefinitionPage.module.css';

/**
 * One collapsible panel in the right-hand column. A plain `<details>`, with
 * the heading *inside* the `<summary>` so the panel is both a disclosure
 * control and a heading to navigate the document by — the two things the
 * numbered `<h2>`s used to do separately.
 */
function Panel({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <details className={styles.panel} open>
      <summary className={styles.panelSummary}>
        <h2 className={styles.panelTitle}>{title}</h2>
      </summary>
      <div className={styles.panelBody}>{children}</div>
    </details>
  );
}

export function PlotDefinitionPage() {
  const region = usePlotStore((state) => state.region);
  const setRegion = usePlotStore((state) => state.setRegion);
  const conditionsInput = usePlotStore((state) => state.conditionsInput);
  const setConditionsInput = usePlotStore((state) => state.setConditionsInput);
  const handleDragEnd = useCanvasDropHandler(region);
  const canvasWarnings = useCanvasWarnings(region);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SkipLinks />
      <div className={styles.workspace}>
        <section className={styles.plants} aria-label="Plants">
          <PlantPalette />
          <AddCropDialog />
        </section>

        <section className={styles.canvas} aria-label="Your plot">
          <PlotCanvasSection canvasWarnings={canvasWarnings} />
        </section>

        <section
          className={styles.checks}
          aria-label="Plot settings and checks"
          // Anchor target for the "Skip to plot settings" link, with
          // `tabIndex={-1}` so the jump actually lands focus here rather than
          // only scrolling — see `SkipLinks.tsx` for why this column needs a
          // skip link of its own now.
          id={PLOT_SETTINGS_ID}
          tabIndex={-1}
        >
          <Panel title="Plot shape & size">
            <p className={styles.panelIntro}>
              Start from a preset shape, then drag, add or remove corners until the outline matches
              your real plot.
            </p>
            <ShapePicker onApply={setRegion} />
            <PlotOutlineEditor region={region} onChange={setRegion} />
          </Panel>

          <Panel title="Growing conditions">
            <PlotConditionsForm value={conditionsInput} onChange={setConditionsInput} />
          </Panel>

          <Panel title="Problems & suggestions">
            <WarningsSection canvasWarnings={canvasWarnings} />
          </Panel>
        </section>
      </div>
    </DndContext>
  );
}
