/**
 * **What "a design" is** (UI redesign Phase 5) — the value undo/redo moves
 * through, persistence writes down, and the designs switcher names.
 *
 * Nothing in this phase can be decided before this one is, which is why it is
 * the first file: the history stack stores these, the codec serialises these,
 * and the switcher holds a list of these. It is deliberately a *derived* view
 * over stores that already exist rather than a fifth store — ADR 0015's
 * one-store-per-concern rule is about where state is **owned**, and this owns
 * nothing.
 *
 * ## The three stores it spans, and the two it doesn't
 *
 * A design is `plot-store`'s region and conditions plus `placements-store`'s
 * placements. That is the whole of it, and the two omissions are decisions:
 *
 * - **`canvas-view-store` is not in a design.** Zoom, the outline draft, the
 *   corner selection and Phase 4's `revealRequest` are how the plot is being
 *   *looked at*, not what it is. Scrolling the plot is not an edit, so it must
 *   not land in the undo history; and a saved design that restored someone
 *   else's zoom level would be restoring a window, not a garden.
 * - **`user-plants-store` is not in a design either**, though a design does
 *   carry the user crops it *references* — see `design-codec.ts`, which stores
 *   them with the design rather than persisting the store. Adding a crop to
 *   your palette is a library operation; undoing a plot edit should not take a
 *   crop away from you, and it would be incoherent if it did while a placement
 *   still pointed at it.
 * - **`selectedId` is not in a design.** Which marker is highlighted is where
 *   you are looking. {@link applyDesign} keeps the selection when the selected
 *   placement survives the change and drops it when it doesn't, which is the
 *   behaviour that needs no history of its own.
 *
 * ## Reference equality is the change detector, and that is on purpose
 *
 * Every action in both stores builds a new object for the field it changes and
 * leaves the others alone, so `region`/`conditionsInput`/`placements` change
 * identity exactly when the design changes — and `selectPlacement`, which is
 * not an edit, changes none of them. {@link isSameDesign} is therefore three
 * `===` comparisons rather than a deep diff, and it is *exact* rather than
 * approximate: there is no edit it can miss and no non-edit it can mistake for
 * one.
 */

import type { PlotConditionsInput, PlotRegion } from '@garden-planner/engine';
import { usePlacementsStore, type PlacedPlant } from './placements-store.ts';
import { usePlotStore } from './plot-store.ts';

/** The whole of a garden design: the plot, the conditions it is described by, and what is planted on it. */
export interface Design {
  readonly region: PlotRegion;
  readonly conditionsInput: PlotConditionsInput;
  readonly placements: readonly PlacedPlant[];
}

/** The design as it currently stands in the stores. Reads via `getState()` rather than hooks so history and persistence can call it from a subscription. */
export function readDesign(): Design {
  const { region, conditionsInput } = usePlotStore.getState();
  const { placements } = usePlacementsStore.getState();
  return { region, conditionsInput, placements };
}

/**
 * Make `design` the current one, in both stores.
 *
 * The order matters only in that both writes happen before anything renders;
 * React batches them, and the subscribers in `design-history.ts` and
 * `designs-store.ts` are both written to tolerate seeing the halves separately
 * (each compares whole designs, not fields).
 */
export function applyDesign(design: Design): void {
  usePlotStore.getState().setRegion(design.region);
  usePlotStore.getState().setConditionsInput(design.conditionsInput);
  usePlacementsStore.getState().replacePlacements(design.placements);
}

/** Whether two designs are the same value — three identity checks, for the reason the module doc gives. */
export function isSameDesign(a: Design, b: Design): boolean {
  return (
    a.region === b.region &&
    a.conditionsInput === b.conditionsInput &&
    a.placements === b.placements
  );
}

/**
 * How long two edits can be apart and still be one undo step.
 *
 * Dragging a corner calls `setRegion` on every pointer move and holding an
 * arrow key calls `movePlacement` on every repeat, so without coalescing a
 * single gesture would cost dozens of presses of Ctrl+Z to undo. 600ms is
 * comfortably longer than a key-repeat interval (~30ms) or a frame (~16ms) and
 * comfortably shorter than the pause between two things a user thinks of as
 * separate.
 *
 * The window is only half the rule — see {@link isContinuation}, which is what
 * stops two quick *different* edits from merging.
 */
export const EDIT_COALESCE_MS = 600;

/**
 * Whether `next` continues the same gesture as `prev`, rather than being a new
 * edit.
 *
 * Time alone would be wrong: placing two crops half a second apart is two
 * edits, and merging them would make one Ctrl+Z remove a plant the user never
 * asked to remove. So a continuation is defined by **shape** as well as by the
 * clock — the design has to have the same *structure* and differ only in
 * coordinates:
 *
 * - the same placements, in the same order, by id — so adding, removing or
 *   clearing is never a continuation of anything;
 * - the same number of outline corners — so adding or removing a corner starts
 *   a new step even mid-drag;
 * - identical conditions — a `<select>` change is a discrete decision and
 *   always its own step.
 *
 * What is left is exactly the two continuous gestures the app has: dragging a
 * marker or a corner, and holding an arrow key.
 */
export function isContinuation(prev: Design, next: Design): boolean {
  if (prev.conditionsInput !== next.conditionsInput) return false;
  if (prev.region.vertices.length !== next.region.vertices.length) return false;
  if (prev.placements.length !== next.placements.length) return false;
  return prev.placements.every((placement, index) => placement.id === next.placements[index].id);
}

/**
 * A short phrase naming the edit that turned `prev` into `next`, in the form
 * "Undo _placing Tomato_" reads correctly in.
 *
 * This is not decoration. Removing the "Clear all" confirmation dialog (ADR
 * 0034 §5) rests on undo being *discoverable* at the moment it is needed, and a
 * button whose accessible name is "Undo clearing the plot" is that
 * discoverability — where a bare "Undo" leaves a user who has just emptied
 * their plot to guess whether the button will help.
 *
 * Derived from the two designs rather than reported by each call site, so no
 * store action has to know it is being recorded. Compound edits that a diff
 * cannot name usefully (loading the example bed) pass their own label instead —
 * see `design-history.ts`'s `labelNextEdit`.
 */
export function describeEdit(prev: Design, next: Design): string {
  const before = new Map(prev.placements.map((placement) => [placement.id, placement]));
  const after = new Map(next.placements.map((placement) => [placement.id, placement]));
  const added = next.placements.filter((placement) => !before.has(placement.id));
  const removed = prev.placements.filter((placement) => !after.has(placement.id));

  if (removed.length > 1 && next.placements.length === 0) return 'clearing the plot';
  if (added.length === 1 && removed.length === 0) return `planting ${added[0].plant.commonName}`;
  if (removed.length === 1 && added.length === 0) return `removing ${removed[0].plant.commonName}`;
  if (added.length > 0 || removed.length > 0) return 'that change to the planting';

  const moved = next.placements.find((placement) => {
    const was = before.get(placement.id);
    return was !== undefined && (was.x !== placement.x || was.y !== placement.y);
  });
  if (moved !== undefined) return `moving ${moved.plant.commonName}`;

  if (prev.region !== next.region) return 'that change to the plot shape';
  if (prev.conditionsInput !== next.conditionsInput) return 'that change to the growing conditions';
  return 'that change';
}
