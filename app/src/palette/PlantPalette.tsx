/**
 * The plant palette (Workplan Stage 3.3) — `DESIGN.md` §1 step 2 of the core
 * loop: "the app scores every plant in its database against the plot's
 * conditions and presents a filtered, ranked palette". Reads the current
 * plant list (`usePlantList`) and the plot store's growing-conditions input
 * directly, so it re-ranks live whenever either changes — there is no prop
 * threading between this component and `PlotDefinitionPage`'s form, only a
 * shared Zustand store (ADR 0015's convention).
 *
 * **Layout decision (the brief's one open call):** the palette renders
 * *on the plot-definition page*, below the growing-conditions form, rather
 * than behind a separate route. See `docs/architecture.md`'s Stage 3.3 note
 * for the reasoning (short version: `DESIGN.md`'s core loop reads as one
 * continuous flow, and Stage 3.4's canvas will want the palette visible
 * alongside placement rather than a nav click away).
 *
 * Ranking itself is entirely `rankPlants`' job (`@garden-planner/engine`) —
 * this component adds only **display-only** narrowing on top (search,
 * category, and an unsuitable-hiding toggle that maps onto `rankPlants`'
 * own `excludeUnsuitable` option), and never re-derives a score or reason
 * the engine already computed. `rankPlants`' own note applies here too: most
 * of today's shipped dataset has no hardiness/soil/season data, so a bare
 * score would overstate certainty — every entry shows the engine's own
 * `summary`, `confidence`, and per-dimension reasoning instead of a lone
 * number.
 *
 * **Drag affordance (Workplan Stage 3.4).** Every entry is a dnd-kit
 * `useDraggable` source (`PaletteEntry` below), carrying its `Plant` as drag
 * data (`{ plant }`, the shape `canvas/drop.ts`'s `resolveDrop` expects) —
 * the palette→canvas handoff half of the plot canvas's drag-and-drop. See
 * `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md` for why dnd-kit owns this
 * handoff and react-konva owns everything after the plant lands.
 *
 * **Keyboard alternative (Workplan Stage 6.2, ADR 0026).** dnd-kit's default
 * `KeyboardSensor` already lets a focused entry be picked up (Space/Enter)
 * and nudged (arrow keys) — `canvas/drop.ts#resolveDrop` reads the dragged
 * element's own translated rect regardless of *how* the drag started, so
 * that "just works". But it's impractical as the *primary* keyboard path: it
 * moves the card in raw screen pixels, and the canvas can be a long way down
 * the page. So every entry also renders a plain "Add to plot" `<button>` —
 * places the plant at the region's centre (`canvas/geometry.ts#regionCentre`)
 * and selects it, ready for the canvas's arrow-key nudge to fine-position.
 * See ADR 0026 for why this, and not a custom keyboard-drag interaction, is
 * the answer to "what does a keyboard-initiated drop position mean".
 *
 * The button is a **sibling** of the draggable region, not nested inside it —
 * dnd-kit's `attributes` already put `role="button"` on the draggable
 * element, and a real `<button>` nested inside another `role="button"`
 * element is exactly what axe's `nested-interactive` check flags (a screen
 * reader can't sensibly navigate into an interactive control that lives
 * inside another one). `PaletteEntry` below splits the `<li>` into a
 * draggable inner `<div>` (the drag surface + keyboard-drag target) and the
 * button next to it, both direct children of the plain `<li>`.
 */

import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  BAND_LABELS,
  EdibleCategorySchema,
  rankPlants,
  resolvePlotConditions,
  type RankedPlant,
  type SuitabilityBand,
} from '@garden-planner/engine';
import { resolveIcon } from '../icons/index.ts';
import type { PaletteDragData } from '../canvas/drop.ts';
import { regionCentre } from '../canvas/geometry.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import { usePlantList } from '../state/use-plant-list.ts';
import { usePlotStore } from '../state/plot-store.ts';
import { filterRanked, type CategoryFilter } from './filters.ts';

const CATEGORY_OPTIONS = EdibleCategorySchema.options;

/**
 * Colour cue per band, from a confident match (green) to a hard mismatch
 * (grey-out) — supplementary to `BAND_LABELS`' own text, which is what
 * actually carries the meaning (WCAG 1.4.1: colour is never the only signal
 * here, see `PaletteEntry` below).
 *
 * **Contrast (Workplan Stage 6.2 a11y pass):** every value here reaches at
 * least 4.5:1 against a white background — this is a text colour
 * (`PaletteEntry`'s band `<span>`), so that's the normal-text bar, not the
 * looser 3:1 large-text/UI-component one. `good` (`#4c8c2b`, 4.12:1) and
 * `fair` (`#9a7b0a`, 4.03:1) both fell short; darkened one step each, same
 * hue, to `#3f7522` (5.56:1) and `#8a6c00` (4.97:1). `excellent` (5.08:1),
 * `poor` (4.72:1) and `unsuitable` (4.54:1) already cleared it.
 */
const BAND_COLORS: Readonly<Record<SuitabilityBand, string>> = {
  excellent: '#1a7f37',
  good: '#3f7522',
  fair: '#8a6c00',
  poor: '#b35c00',
  unsuitable: '#767676',
};

export function PlantPalette() {
  const plants = usePlantList();
  const conditionsInput = usePlotStore((state) => state.conditionsInput);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [hideUnsuitable, setHideUnsuitable] = useState(false);

  /**
   * `conditionsInput` is the form's editable shape, not the resolved
   * `PlotConditions` `rankPlants` needs — resolve it here, at the point of
   * use, per the brief (`resolvePlotConditions` is the store's job to
   * expose, not to pre-resolve). The store's own defaults and
   * `PlotConditionsForm`'s controlled inputs mean this should not normally
   * throw, but a `try`/`catch` is cheap insurance against a corrupted value
   * reaching here, mirroring `PlotConditionsForm`'s own inline validity check.
   */
  const conditions = useMemo(() => {
    try {
      return resolvePlotConditions(conditionsInput);
    } catch {
      return null;
    }
  }, [conditionsInput]);

  const ranked = useMemo(
    () => (conditions ? rankPlants(plants, conditions, { excludeUnsuitable: hideUnsuitable }) : []),
    [plants, conditions, hideUnsuitable],
  );

  const visible = useMemo(() => filterRanked(ranked, search, category), [ranked, search, category]);

  return (
    <section>
      <h2>2. Discover suitable plants</h2>

      {conditions === null ? (
        <p role="alert">
          Fix the growing-conditions form above to see ranked suggestions — the palette needs valid
          conditions to score against.
        </p>
      ) : (
        <>
          <p>
            Ranked against your plot&rsquo;s current conditions. Most of today&rsquo;s dataset has
            no hardiness, soil or season data, so read the confidence and per-plant reasoning below,
            not just the band.
          </p>

          <div>
            <label htmlFor="palette-search">Search</label>
            <input
              id="palette-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name…"
            />
          </div>

          <div>
            <label htmlFor="palette-category">Category</label>
            <select
              id="palette-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            >
              <option value="all">All categories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={hideUnsuitable}
                onChange={(event) => setHideUnsuitable(event.target.checked)}
              />
              Hide unsuitable crops
            </label>
          </div>

          <p>
            {visible.length} of {ranked.length} crops shown.
          </p>

          {visible.length === 0 ? (
            <p>No crops match your plot&rsquo;s conditions and current filters.</p>
          ) : (
            /**
             * **Bounded height, not the page (Workplan Stage 6.2 responsive
             * fix).** Every matching crop used to render in full, unbounded —
             * with all 144 shipped crops visible at once (the common case:
             * no search, no category filter) that pushed everything below
             * the palette, including the plot canvas, arbitrarily far down
             * the page. `docs/review-pre-deployment.md` §2 measured the
             * canvas at y ≈ 3500px because of exactly this, and the figure
             * only grows as the dataset does. A capped, internally-scrolling
             * list keeps the page's own height roughly constant regardless
             * of how many crops match, which is what actually makes the
             * canvas reachable on a phone — a media-query breakpoint
             * wouldn't touch this, since the list was already a single
             * column at every width.
             */
            <ul
              style={{
                listStyle: 'none',
                padding: '0.5rem',
                margin: 0,
                maxHeight: '65vh',
                overflowY: 'auto',
                border: '1px solid #ddd',
                borderRadius: '0.5rem',
              }}
            >
              {visible.map((entry) => (
                <PaletteEntry key={entry.plant.id} entry={entry} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/**
 * One palette row. Two ways onto the plot, both landing on the same
 * `addPlacement` action:
 *
 * 1. **Pointer/keyboard drag** — `useDraggable` carries the row's `Plant` as
 *    drag data and follows the pointer via a CSS transform while dragging,
 *    so `canvas/drop.ts`'s `resolveDrop` can read the dragged card's own
 *    rect as the drop point (see that module's doc for why). Applied to the
 *    inner `<div>`, not the `<li>` — see below.
 * 2. **"Add to plot" button (Workplan Stage 6.2, ADR 0026)** — places `plant`
 *    directly at the plot's centre and selects it, no drag at all. This is
 *    the primary non-pointer path (see the module doc's "Keyboard
 *    alternative" section for why dnd-kit's keyboard-sensor drag alone isn't
 *    enough here).
 *
 * **Why the `<li>` itself isn't the draggable node.** dnd-kit's `attributes`
 * put `role="button"` and `tabIndex={0}` on whatever `setNodeRef` attaches
 * to. Putting the "Add to plot" `<button>` *inside* that element would nest
 * a real interactive control inside another one wearing an interactive
 * role — axe's `nested-interactive` check exists precisely because a screen
 * reader has no sane way to navigate into a control nested inside another
 * control. So the draggable surface is an inner `<div>` (still carrying the
 * drag `aria-label`, still keyboard-focusable), and the button is the
 * `<li>`'s other, sibling child.
 *
 * **The region is read at click-time (`usePlotStore.getState()`), not
 * subscribed to** — `handleAddToPlot` only ever needs it at the moment the
 * button is actually pressed, so there's no reason for every one of up to
 * 144 rows to re-render on every outline edit just to keep an unused prop
 * current. This trims *a* cost, but not the main one: mounting a second
 * interactive control on every matching row is genuinely more DOM, and
 * `PlotDefinitionPage.test.tsx`/`App.test.tsx` both needed longer timeouts to
 * match (see their own comments) — a real, accepted cost of the button
 * existing at all, not something this particular choice was going to erase.
 */
function PaletteEntry({ entry }: { readonly entry: RankedPlant }) {
  const { plant, suitability } = entry;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: plant.id,
    data: { plant } satisfies PaletteDragData,
  });

  const icon = resolveIcon(plant);

  function handleAddToPlot(): void {
    usePlacementsStore.getState().addPlacement(plant, regionCentre(usePlotStore.getState().region));
  }

  return (
    <li style={{ marginBottom: '0.75rem' }}>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        aria-label={`drag ${plant.commonName} onto the plot to place it`}
        style={{
          border: '1px solid #ccc',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          opacity: suitability.band === 'unsuitable' ? 0.6 : isDragging ? 0.4 : 1,
          cursor: 'grab',
          touchAction: 'none',
          transform: CSS.Translate.toString(transform),
          zIndex: isDragging ? 1 : undefined,
          position: isDragging ? 'relative' : undefined,
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start',
        }}
      >
        <img
          src={icon.url}
          alt=""
          style={{
            width: '3rem',
            height: '3rem',
            flexShrink: 0,
            borderRadius: '0.25rem',
          }}
          aria-hidden="true"
        />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>
            {plant.commonName}{' '}
            <span style={{ color: BAND_COLORS[suitability.band], fontSize: '0.85em' }}>
              {BAND_LABELS[suitability.band]}
            </span>
          </h3>
          <p style={{ margin: '0.25rem 0', fontStyle: 'italic' }}>{plant.category}</p>
          <p style={{ margin: '0.25rem 0' }}>{suitability.summary}</p>
          <p style={{ margin: '0.25rem 0', fontSize: '0.85em' }}>
            Confidence: {Math.round(suitability.confidence * 100)}%
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {suitability.dimensions.map((dimension) => (
              <li key={dimension.dimension}>
                <strong>{dimension.dimension}:</strong> {dimension.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={handleAddToPlot}
        aria-label={`Add ${plant.commonName} to the plot, without dragging`}
        style={{ marginTop: '0.5rem' }}
      >
        Add to plot
      </button>
    </li>
  );
}
