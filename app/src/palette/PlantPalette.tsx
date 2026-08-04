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
 * away). UI redesign Phase 1 delivered on the second half of that: the palette
 * is the workspace's left sidebar, permanently on screen beside the canvas, so
 * "drag a plant onto the plot" is a short gesture instead of a ~1,500px
 * journey down the page.
 *
 * ## What UI redesign Phase 3 changed, and why (ADR 0032)
 *
 * Every row rendered the engine's whole answer at once — icon, name, band,
 * category, summary sentence, confidence, and a four-bullet per-dimension
 * reasoning list. Measured in the sidebar at 1440×900 that was a **median
 * 631px per row** and ~93,900px of list in a **394px** box: the shortest row
 * was taller than the box, so the number of crops you could see without
 * scrolling was **zero**. The reasoning is good content; it was at the wrong
 * altitude.
 *
 * So the row is a compact card (icon, name, band, category — {@link
 * PaletteEntry}) and everything else opens on demand. Three consequences worth
 * knowing before editing this file:
 *
 * 1. **The sidebar's chrome had to shrink too**, not just the rows. Eight
 *    64px cards need ~530px and the sidebar is ~836px tall, so the heading,
 *    the intro paragraph, the two-row filter grid, the count line and the
 *    add-crop trigger between them had a budget of ~300px. The intro is not
 *    deleted — it says something honest about the dataset that a confidence
 *    figure alone doesn't — it is a closed disclosure above the list, one line
 *    instead of three.
 * 2. **The filters are chips**, and the category chips double as the legend
 *    mapping category colours to the canvas's markers: a chip carrying a
 *    category's own colour *and* its name is that mapping, and a separate
 *    legend line would restate it for ~24px of the budget the list needs.
 * 3. **Nothing here is sticky**, because nothing needs to be: Phase 1 made the
 *    sidebar a flex column in which only the crop list scrolls, so the filters
 *    stay put by construction.
 *
 * Ranking itself is entirely `rankPlants`' job (`@garden-planner/engine`) —
 * this component adds only **display-only** narrowing on top (search,
 * category, band, and an unsuitable-hiding toggle that maps onto `rankPlants`'
 * own `excludeUnsuitable` option), and never re-derives a score or reason
 * the engine already computed. `rankPlants`' own note applies here too: most
 * of today's shipped dataset has no hardiness/soil/season data, so a bare
 * score would overstate certainty — which is exactly what the disclosure above
 * the list says, and why the per-dimension reasoning is one press away rather
 * than gone.
 *
 * **Drag affordance (Workplan Stage 3.4).** Every entry is a dnd-kit
 * `useDraggable` source (`PaletteEntry` below), carrying its `Plant` as drag
 * data (`{ plant }`, the shape `canvas/drop.ts`'s `resolveDrop` expects) —
 * the palette→canvas handoff half of the plot canvas's drag-and-drop. See
 * `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md` for why dnd-kit owns this
 * handoff and react-konva owns everything after the plant lands. Phase 3 gave
 * the sensors an activation constraint so that a *click* on that same element
 * is no longer a one-pixel drag — see `plot/PlotDefinitionPage.tsx`, which
 * owns the `DndContext`, and ADR 0032 §2.
 *
 * **Keyboard alternative (Workplan Stage 6.2, ADR 0026).** dnd-kit's
 * `KeyboardSensor` lets a focused entry be picked up (Space) and nudged (arrow
 * keys) — `canvas/drop.ts#resolveDrop` reads the dragged element's own
 * translated rect regardless of *how* the drag started, so that "just works".
 * But it's impractical as the *primary* keyboard path: it moves the card in
 * raw screen pixels, and the canvas can be a long way off. So every entry also
 * renders a `＋` `<button>` — places the plant at the first free spot near the
 * middle of the plot (`canvas/geometry.ts#firstFreePosition`) and selects it,
 * ready for the canvas's arrow-key nudge to fine-position. See ADR 0026 for
 * why this, and not a custom keyboard-drag interaction, is the answer to "what
 * does a keyboard-initiated drop position mean", and ADR 0031 for why "the
 * first free spot" replaced "the centre" in UI redesign Phase 2.
 *
 * The button is a **sibling** of the draggable region, not nested inside it —
 * dnd-kit's `attributes` already put `role="button"` on the draggable
 * element, and a real `<button>` nested inside another `role="button"`
 * element is exactly what axe's `nested-interactive` check flags (a screen
 * reader can't sensibly navigate into an interactive control that lives
 * inside another one). `PaletteEntry` below keeps the draggable inner `<div>`
 * (the drag surface, the keyboard-drag target and now the disclosure) and the
 * button as its sibling. **Two focusable controls per row, and no more** —
 * 144 crops means 288 tab stops, and a third control per row would make it
 * 432 (`docs/accessibility.md` §8).
 */

import { useMemo, useState, type KeyboardEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  BAND_LABELS,
  EdibleCategorySchema,
  rankPlants,
  resolvePlotConditions,
  type EdibleCategory,
  type Plant,
  type RankedPlant,
  type SuitabilityBand,
} from '@garden-planner/engine';
import { resolveIcon } from '../icons/index.ts';
import type { PaletteDragData } from '../canvas/drop.ts';
import { firstFreePosition, plantSeparationCm } from '../canvas/geometry.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import { usePlantList } from '../state/use-plant-list.ts';
import { usePlotStore } from '../state/plot-store.ts';
import { filterRanked, type BandFilter, type CategoryFilter } from './filters.ts';
import { paletteAddLabel, paletteDragLabel } from './labels.ts';
import styles from './PlantPalette.module.css';

const CATEGORY_OPTIONS = EdibleCategorySchema.options;

/**
 * The category chips, in one list so the filter and the legend can't disagree
 * about what a colour means. `'all'` leads and draws no swatch — it is the
 * "filter off" state, not a fourth category.
 */
const CATEGORY_CHIPS: readonly { readonly value: CategoryFilter; readonly label: string }[] = [
  { value: 'all', label: 'All' },
  ...CATEGORY_OPTIONS.map((option: EdibleCategory) => ({
    value: option,
    // The data's own word, capitalised — "vegetable" on a card and "Vegetable"
    // on the chip that filters to it should obviously be the same thing.
    label: option.charAt(0).toUpperCase() + option.slice(1),
  })),
];

export function PlantPalette() {
  const plants = usePlantList();
  const conditionsInput = usePlotStore((state) => state.conditionsInput);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [band, setBand] = useState<BandFilter>('all');
  const [hideUnsuitable, setHideUnsuitable] = useState(false);

  /**
   * Which crop's reasoning is open — **at most one** (UI redesign Phase 3).
   *
   * An accordion rather than independent per-row toggles: an expanded row
   * measures ~470px against the compact card's 62px — it is the wall of text
   * this phase moved out of the default view, and several of them open at once
   * rebuilds it. Holding the id here rather than
   * inside each row is also what makes "at most one" expressible at all.
   */
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const visible = useMemo(
    () => filterRanked(ranked, search, category, band),
    [ranked, search, category, band],
  );

  return (
    <div className={styles.palette}>
      {/*
       * The heading and the count share a line. Two lines is the obvious
       * markup and costs ~25px of a sidebar in which eight crop cards need
       * ~530px of ~836px — the count is four words about the list, so it sits
       * beside the list's title rather than on a row of its own.
       */}
      <div className={styles.header}>
        <h2 className={styles.heading}>Plants</h2>
        {conditions !== null && (
          <p className={styles.count}>
            {visible.length} of {ranked.length} crops
          </p>
        )}
      </div>

      {conditions === null ? (
        <p role="alert">
          Fix the growing-conditions form to see ranked suggestions — the palette needs valid
          conditions to score against.
        </p>
      ) : (
        <>
          <div className={styles.filters}>
            {/*
             * The label is hidden, not removed: `e2e/drag.ts` and the keyboard
             * walkthrough both find this field by the accessible name
             * "Search", and a placeholder is not an accessible name.
             */}
            <label className="visually-hidden" htmlFor="palette-search">
              Search
            </label>
            <input
              id="palette-search"
              type="search"
              className={styles.search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search crops by name…"
            />

            {/*
             * Category as a radio group, not four toggle buttons: a native
             * radio group is **one** tab stop with arrow keys inside it, which
             * is the behaviour a roving-tabindex widget would have to be
             * hand-written to imitate — and this palette counts its tab stops
             * (see the module doc). The inputs are visually hidden but still
             * focusable, so the chip a user sees is styled from
             * `:checked`/`:focus-visible` on the real control.
             */}
            <fieldset className={styles.chipGroup}>
              <legend className="visually-hidden">Category</legend>
              {CATEGORY_CHIPS.map((chip) => (
                <label key={chip.value} className={styles.chip} data-category={chip.value}>
                  <input
                    type="radio"
                    name="palette-category"
                    className={styles.chipInput}
                    value={chip.value}
                    checked={category === chip.value}
                    onChange={() => setCategory(chip.value)}
                  />
                  <span className={styles.chipBody}>
                    {chip.value !== 'all' && <span className={styles.chipDot} aria-hidden="true" />}
                    {chip.label}
                  </span>
                </label>
              ))}
            </fieldset>

            <div className={styles.chipGroup}>
              <label className={styles.chip}>
                <input
                  type="checkbox"
                  className={styles.chipInput}
                  checked={band === 'great'}
                  onChange={(event) => setBand(event.target.checked ? 'great' : 'all')}
                />
                <span className={styles.chipBody}>Great fits</span>
              </label>

              <label className={styles.chip}>
                <input
                  type="checkbox"
                  className={styles.chipInput}
                  checked={hideUnsuitable}
                  onChange={(event) => setHideUnsuitable(event.target.checked)}
                />
                <span className={styles.chipBody}>Hide unsuitable</span>
              </label>
            </div>
          </div>

          {/*
           * The honest note about the dataset, kept but re-altituded.
           *
           * It used to be a three-line paragraph under the heading — real
           * content, saying something a confidence percentage on its own
           * doesn't, which is why it isn't simply deleted. Three lines at this
           * sidebar width is ~60px of the vertical budget the crop list needs,
           * for a sentence you read once and then scroll past forever. As a
           * closed disclosure directly above the list it costs one line and
           * one tab stop, and it sits where it is relevant: immediately before
           * the ranking it is describing.
           */}
          <details className={styles.about}>
            <summary>How these ranks are worked out</summary>
            <p>
              Ranked against your plot&rsquo;s current conditions. Most of today&rsquo;s dataset has
              no hardiness, soil or season data, so read the confidence and per-plant reasoning, not
              just the band.
            </p>
          </details>

          {visible.length === 0 ? (
            <p>No crops match your plot&rsquo;s conditions and current filters.</p>
          ) : (
            <ul className={styles.list}>
              {visible.map((entry) => (
                <PaletteEntry
                  key={entry.plant.id}
                  entry={entry}
                  expanded={expandedId === entry.plant.id}
                  onToggle={() =>
                    setExpandedId((current) => (current === entry.plant.id ? null : entry.plant.id))
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One palette row: a compact card, and the engine's reasoning behind it.
 *
 * Three ways in, all on two focusable controls (see the module doc's tab-stop
 * budget):
 *
 * 1. **Pointer/keyboard drag** — `useDraggable` carries the row's `Plant` as
 *    drag data, and since UI redesign Phase 5 the thing that follows the
 *    pointer is a `<DragOverlay>` ghost ({@link PaletteDragGhost}) rather than
 *    this card: the card stays put and dims. That is what un-clips the drag at
 *    the sidebar's edge, and it is why the inline `transform` this element used
 *    to carry is gone. `canvas/drop.ts`'s `resolveDrop` is unaffected — it
 *    prefers the real pointer for a pointer drag, and its keyboard-drag
 *    fallback reads dnd-kit's own `active.rect.current.translated`, which
 *    dnd-kit computes from the measured rect and the drag transform whether or
 *    not anything renders that transform. Applied to the inner `<div>`, not the
 *    `<li>` — see below.
 * 2. **"Add to plot" (Workplan Stage 6.2, ADR 0026)** — the `＋` button places
 *    `plant` directly on the plot and selects it, no drag at all. This is the
 *    primary non-pointer path (see the module doc's "Keyboard alternative").
 * 3. **Press the card to see why it ranks here (UI redesign Phase 3)** — the
 *    summary, confidence and per-dimension reasoning that used to be inlined
 *    on every row, in one click.
 *
 * **The same element is the drag surface and the disclosure, which takes
 * three deliberate pieces to be true** (ADR 0032 §2):
 *
 * - `PlotDefinitionPage`'s `PointerSensor` has an `activationConstraint`, so a
 *   press that never travels 4px is a click and not a one-pixel drag. Without
 *   it these two gestures are the same `pointerdown` and the drag wins every
 *   time. When a drag *does* start, dnd-kit suppresses the trailing `click`
 *   itself (a capture-phase listener on the document), so `onClick` below
 *   fires only for a press that stayed put.
 * - Its `KeyboardSensor` starts a drag on **Space only**, where dnd-kit's
 *   default is Space *or* Enter. That frees Enter for the disclosure, so a
 *   keyboard user reaches the reasoning by the same key everything else in the
 *   app opens with, and still picks the card up with the key the sensor's own
 *   screen-reader instructions name.
 * - `handleKeyDown` calls dnd-kit's listener **first** and only then considers
 *   Enter. Spreading `{...listeners}` and adding an `onKeyDown` after it would
 *   silently replace the sensor's handler and delete the keyboard drag.
 *
 * `aria-expanded` says which state the card is in; the accessible name
 * (`labels.ts`) says both jobs, because a control announced as "collapsed"
 * whose name only mentions dragging is a control whose name is wrong. There is
 * deliberately no `aria-controls`: the reasoning is not in the DOM while
 * collapsed, and pointing at an id that doesn't exist is an
 * `aria-valid-attr-value` violation — the disclosure sits immediately after
 * its trigger's row instead, which is the pattern that needs no reference.
 *
 * **Why the `<li>` itself isn't the draggable node.** dnd-kit's `attributes`
 * put `role="button"` and `tabIndex={0}` on whatever `setNodeRef` attaches
 * to. Putting the "Add to plot" `<button>` *inside* that element would nest
 * a real interactive control inside another one wearing an interactive
 * role — axe's `nested-interactive` check exists precisely because a screen
 * reader has no sane way to navigate into a control nested inside another
 * control. So the draggable surface is an inner `<div>` (still carrying the
 * drag `aria-label`, still keyboard-focusable), and the button is its sibling.
 *
 * **The crop's name is not an `<h3>` any more**, and that is a fix rather than
 * a loss. `role="button"` makes its subtree presentational in ARIA, so the
 * heading inside the drag surface was never reliably announced as a heading;
 * what it did do was put 144 entries into the document outline, ahead of the
 * six headings that actually structure the app. The list itself is the
 * structure a screen reader navigates by ("list, 144 items"), and
 * `PlantPalette.test.tsx` reads ranking order off the drag surfaces' own names.
 *
 * **The region is read at click-time (`usePlotStore.getState()`), not
 * subscribed to** — `handleAddToPlot` only ever needs it at the moment the
 * button is actually pressed, so there's no reason for every one of up to
 * 144 rows to re-render on every outline edit just to keep an unused prop
 * current.
 */
/**
 * What a compact card looks like: the icon on its category disc, the crop's
 * name, its suitability band and its category.
 *
 * Split out in UI redesign Phase 5 so the **drag ghost** can be the same card
 * rather than a lookalike ({@link PaletteDragGhost}). It carries no
 * interaction and no accessible name of its own — the element around it does,
 * and in the ghost's case there is deliberately nothing to announce at all.
 */
function PaletteCardFace({
  plant,
  band,
}: {
  readonly plant: Plant;
  readonly band: SuitabilityBand;
}) {
  const icon = resolveIcon(plant);
  return (
    <>
      <span className={styles.iconWrap} data-category={plant.category}>
        <img src={icon.url} alt="" className={styles.icon} aria-hidden="true" />
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{plant.commonName}</span>
        <span className={styles.meta}>
          <span className={styles.band} data-band={band}>
            {BAND_LABELS[band]}
          </span>
          {/*
           * The category, in words, next to the chip whose colour also says
           * it. The icon disc behind this card is tinted by category (and the
           * filter chips above map those tints to names), so without this word
           * the tint would be meaning carried by colour alone — WCAG 1.4.1,
           * the same reason the band is a labelled chip rather than a coloured
           * dot.
           */}
          <span className={styles.category}>{plant.category}</span>
        </span>
      </span>
    </>
  );
}

/**
 * The card that follows the pointer during a drag (UI redesign Phase 5) —
 * rendered by `plot/PlotDefinitionPage.tsx` inside dnd-kit's `<DragOverlay>`,
 * which is why it lives here but is not used here.
 *
 * **This is the fix three ADRs deferred to this phase.** The crop list scrolls,
 * which makes it a clipping box on both axes, so a card that followed the
 * pointer *in place* was cut off at the sidebar's edge the moment the drag
 * started towards the canvas (ADR 0030 §consequences, and the note at the
 * clipping rule in this component's stylesheet). An overlay is rendered outside
 * that box entirely, so the ghost crosses the workspace intact — and it is the
 * review's "drag ghost slightly enlarged with shadow" at the same time.
 *
 * **It is `aria-hidden`, and that is not an oversight.** dnd-kit announces
 * drags through its own live region, the card the user picked up keeps its
 * accessible name and its focus, and a second copy of "Drag Onion onto the
 * plot" appearing in the accessibility tree mid-drag would be one crop
 * announced twice.
 */
export function PaletteDragGhost({
  plant,
  band,
}: {
  readonly plant: Plant;
  readonly band: SuitabilityBand;
}) {
  return (
    <div className={`${styles.row} ${styles.ghost}`} data-band={band} aria-hidden="true">
      <div className={styles.head}>
        <div className={styles.entry}>
          <PaletteCardFace plant={plant} band={band} />
        </div>
      </div>
    </div>
  );
}

function PaletteEntry({
  entry,
  expanded,
  onToggle,
}: {
  readonly entry: RankedPlant;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const { plant, suitability } = entry;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: plant.id,
    // The band travels with the plant so the overlay can draw this exact card
    // without reaching back into the ranked list — see `canvas/drop.ts`.
    data: { plant, band: suitability.band } satisfies PaletteDragData,
  });

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

  /**
   * dnd-kit's own key handling first (Space picks the card up), then Enter as
   * the disclosure. See the component doc for why the order matters and why
   * Enter is free to mean this.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    listeners?.onKeyDown?.(event);
    if (event.defaultPrevented || isDragging) return;
    if (event.key !== 'Enter') return;
    event.preventDefault();
    onToggle();
  }

  return (
    <li className={styles.row} data-band={suitability.band}>
      <div className={styles.head}>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onKeyDown={handleKeyDown}
          onClick={onToggle}
          aria-label={paletteDragLabel(plant.commonName)}
          aria-expanded={expanded}
          className={styles.entry}
          data-dragging={isDragging}
        >
          <PaletteCardFace plant={plant} band={suitability.band} />
        </div>
        <button
          type="button"
          onClick={handleAddToPlot}
          aria-label={paletteAddLabel(plant.commonName)}
          className={styles.addButton}
        >
          <span aria-hidden="true">＋</span>
        </button>
      </div>

      {expanded && (
        <div className={styles.details}>
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
      )}
    </li>
  );
}
