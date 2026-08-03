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
 * *on the plot-definition page*, rather than behind a separate route. See
 * `docs/architecture.md`'s Stage 3.3 note for the reasoning (short version:
 * `DESIGN.md`'s core loop reads as one continuous flow, and Stage 3.4's canvas
 * will want the palette visible alongside placement rather than a nav click
 * away). UI redesign Phase 1 finally delivers on the second half of that:
 * the palette is the workspace's left sidebar, permanently on screen beside
 * the canvas, so "drag a plant onto the plot" is a short gesture instead of a
 * ~1,500px journey down the page.
 *
 * **What this component owns after Phase 1.** It fills the height it is given
 * and scrolls its crop list internally — the filters stay put at the top while
 * the list moves. It no longer draws a card or a numbered heading: the sidebar
 * is the surface, and the workspace replaced the false 1→2→3→4 sequence. The
 * *contents* of a row are untouched; compacting them (icon, name, band chip,
 * reasoning on demand) is Phase 3's job (`docs/ui-aesthetic-review.md`).
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
 * places the plant at the first free spot near the middle of the plot
 * (`canvas/geometry.ts#firstFreePosition`) and selects it, ready for the
 * canvas's arrow-key nudge to fine-position. See ADR 0026 for why this, and
 * not a custom keyboard-drag interaction, is the answer to "what does a
 * keyboard-initiated drop position mean", and ADR 0031 for why "the first
 * free spot" replaced "the centre" in UI redesign Phase 2.
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
} from '@garden-planner/engine';
import { resolveIcon } from '../icons/index.ts';
import type { PaletteDragData } from '../canvas/drop.ts';
import { firstFreePosition, plantSeparationCm } from '../canvas/geometry.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import { usePlantList } from '../state/use-plant-list.ts';
import { usePlotStore } from '../state/plot-store.ts';
import { filterRanked, type CategoryFilter } from './filters.ts';
import styles from './PlantPalette.module.css';

const CATEGORY_OPTIONS = EdibleCategorySchema.options;

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
    <div className={styles.palette}>
      <h2 className={styles.heading}>Plants</h2>

      {conditions === null ? (
        <p role="alert">
          Fix the growing-conditions form to see ranked suggestions — the palette needs valid
          conditions to score against.
        </p>
      ) : (
        <>
          <p className={styles.intro}>
            Ranked against your plot&rsquo;s current conditions. Most of today&rsquo;s dataset has
            no hardiness, soil or season data, so read the confidence and per-plant reasoning, not
            just the band.
          </p>

          <div className={styles.filters}>
            <div className={styles.field}>
              <label htmlFor="palette-search">Search</label>
              <input
                id="palette-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name…"
              />
            </div>

            <div className={styles.field}>
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

            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={hideUnsuitable}
                onChange={(event) => setHideUnsuitable(event.target.checked)}
              />
              Hide unsuitable crops
            </label>
          </div>

          <p className={styles.count}>
            {visible.length} of {ranked.length} crops shown.
          </p>

          {visible.length === 0 ? (
            <p>No crops match your plot&rsquo;s conditions and current filters.</p>
          ) : (
            <ul className={styles.list}>
              {visible.map((entry) => (
                <PaletteEntry key={entry.plant.id} entry={entry} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
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
 *    directly on the plot and selects it, no drag at all. This is the primary
 *    non-pointer path (see the module doc's "Keyboard alternative" section for
 *    why dnd-kit's keyboard-sensor drag alone isn't enough here).
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

  /**
   * Place this crop somewhere it can actually be seen (UI redesign Phase 2).
   *
   * Until this phase every press landed the crop at the plot's centre, so
   * three presses produced three markers in one spot and the review's live
   * session recorded the first-run impression exactly: "you add plants and the
   * plot appears to eat them". `firstFreePosition` searches outward from that
   * same centre for a spot the crop's own footprint fits in — the pure part is
   * in `canvas/geometry.ts`, unit-tested, precisely so this stays two lines.
   *
   * Both stores are read at click-time (`getState()`) rather than subscribed
   * to, for the reason this component's doc gives about the region: the
   * placements list changes on every drop, and re-rendering up to 144 palette
   * rows each time to keep an argument current that is only read when a button
   * is pressed would be a real cost for no benefit.
   */
  function handleAddToPlot(): void {
    const { region } = usePlotStore.getState();
    const { placements, addPlacement } = usePlacementsStore.getState();
    addPlacement(plant, firstFreePosition(region, placements, plantSeparationCm(plant)));
  }

  return (
    <li className={styles.row}>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        aria-label={`drag ${plant.commonName} onto the plot to place it`}
        className={styles.entry}
        data-band={suitability.band}
        data-dragging={isDragging}
        // The one style that has to stay inline: it changes on every pointer
        // move while dragging, which is not something a stylesheet can carry.
        // `zIndex`/`position` come with it so the dragged card lifts above its
        // neighbours for the duration.
        style={{
          transform: CSS.Translate.toString(transform),
          zIndex: isDragging ? 1 : undefined,
          position: isDragging ? 'relative' : undefined,
        }}
      >
        <img src={icon.url} alt="" className={styles.icon} aria-hidden="true" />
        <div className={styles.body}>
          <h3 className={styles.name}>
            {plant.commonName}{' '}
            <span className={styles.band} data-band={suitability.band}>
              {BAND_LABELS[suitability.band]}
            </span>
          </h3>
          <p className={styles.category}>{plant.category}</p>
          <p className={styles.summary}>{suitability.summary}</p>
          <p className={styles.confidence}>
            Confidence: {Math.round(suitability.confidence * 100)}%
          </p>
          <ul className={styles.reasons}>
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
        className={styles.addButton}
      >
        Add to plot
      </button>
    </li>
  );
}
