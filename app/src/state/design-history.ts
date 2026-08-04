/**
 * Undo and redo for the design (UI redesign Phase 5, ADR 0034 §3) — the header's
 * two buttons, Ctrl+Z / Ctrl+Shift+Z, and the reason "Clear all" no longer asks
 * whether you meant it.
 *
 * ## Why this is one history over two stores, and not middleware on each
 *
 * The review offers "Zustand temporal middleware or a simple history stack in
 * the stores". Per-store history is the thing that cannot work here: an edit
 * loop that reshapes the plot and then moves a plant crosses `plot-store` and
 * `placements-store`, so a per-store stack gives a Ctrl+Z that sometimes undoes
 * a shape change and sometimes a placement depending on which store the user
 * last touched — and no way at all to undo "Clear all" if the pointer has since
 * been near the shape form.
 *
 * That does not contradict ADR 0015. Its thesis is that each store *owns* one
 * concern; this file owns none. It reads whole {@link Design} values through
 * `design.ts` and writes them back the same way, so the stores stay exactly as
 * independent as they were and nothing here appears in their types.
 *
 * ## How an edit is noticed
 *
 * By subscription, not by call site. Every action in both stores would
 * otherwise have to remember to record, and the one that forgot would be a
 * silent hole in undo — for a feature whose whole promise is that it covers
 * everything. Zustand's `subscribe` fires synchronously after each `set`, so
 * the previous design is still in hand when the new one arrives.
 *
 * `isSameDesign` is three identity checks (see `design.ts`), which is what
 * makes this cheap enough to run on every store write and exact enough to
 * ignore `selectPlacement` — selecting a marker is not an edit and must not
 * cost an undo step.
 *
 * ## What is deliberately not undoable
 *
 * - **Zoom, panning, edit-shape mode, "Show me"** — `canvas-view-store` is not
 *   part of a design, so none of it is here. Scrolling the plot is not an edit.
 * - **Adding or removing a crop from the palette** — `user-plants-store` is a
 *   library, not a plot. Undoing a plot edit should not take a crop away, least
 *   of all while a placement still points at it.
 * - **Switching designs.** Loading, duplicating or deleting a design clears
 *   both stacks (`designs-store.ts` calls {@link resetHistory}): an undo that
 *   spanned a design switch would splice two gardens together, which is not a
 *   state the user was ever in.
 * - **Reloading.** The stacks are memory. The design survives a reload; the
 *   route it took to get there does not, which is what every editor does.
 */

import { create } from 'zustand';
import {
  applyDesign,
  describeEdit,
  isContinuation,
  isSameDesign,
  readDesign,
  EDIT_COALESCE_MS,
  type Design,
} from './design.ts';
import { usePlacementsStore } from './placements-store.ts';
import { usePlotStore } from './plot-store.ts';

/**
 * How many steps back the history goes.
 *
 * A whole design is small — the placements array is shared structurally with
 * the store, so an entry costs one object and a couple of references, not a
 * copy of the garden — but the stack is unbounded work otherwise, and fifty
 * steps is far past the point where a user would rather load a saved design
 * than keep pressing.
 */
const HISTORY_LIMIT = 50;

/** One step: the design as it was *before* an edit, and a phrase naming that edit. */
interface HistoryEntry {
  readonly design: Design;
  /** Reads as "Undo _planting Tomato_" / "Redo _planting Tomato_" — see `design.ts`'s `describeEdit`. */
  readonly label: string;
  /**
   * Which placement was selected at that moment, restored alongside the design.
   *
   * A selection is not *part* of a design — `design.ts` says why, and selecting
   * a marker still costs no history step — but it is the context an edit
   * happened in, and dropping it makes undo feel broken in a way the keyboard
   * walkthrough caught: the canvas's arrow keys act on the selected placement,
   * so a redo that put a plant back without selecting it left the user pressing
   * arrows at nothing. Carried per step rather than recorded as its own,
   * which is the distinction that keeps `selectPlacement` off the stack.
   */
  readonly selectedId: string | null;
}

interface DesignHistoryState {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
  /** What Ctrl+Z would undo, phrased for a button's accessible name, or `null` when there is nothing to undo. */
  readonly undoLabel: string | null;
  readonly redoLabel: string | null;
  readonly undo: () => void;
  readonly redo: () => void;
}

/**
 * Depth of "we are applying a design ourselves, so the change that is about to
 * arrive is not a user edit".
 *
 * A counter rather than a boolean because `applyDesign` writes three fields
 * across two stores and a caller may nest (loading a design applies one inside
 * a reset). Zustand notifies synchronously, so this is never observed by
 * anything asynchronous.
 */
let applying = 0;

/** The design as the subscriber last saw it — the "before" of the next edit. */
let lastSeen: Design = readDesign();

/** The selection as it stood before the edit currently arriving — see {@link HistoryEntry}'s `selectedId`. */
let lastSeenSelection: string | null = usePlacementsStore.getState().selectedId;

/** When the last recorded edit happened, for {@link EDIT_COALESCE_MS}. */
let lastEditAt = 0;

/**
 * Whether the last recorded edit was itself a continuous one (a movement).
 *
 * Without this, "place a crop and immediately nudge it" would merge the nudge
 * into the placement — `isContinuation` is true of that pair, because the
 * placements list is unchanged between the two — and one Ctrl+Z would remove
 * the plant instead of undoing the movement. A gesture can only continue
 * another gesture.
 */
let lastEditWasMovement = false;

/**
 * Run `write` without recording it.
 *
 * Exported because `designs-store.ts` needs it for the same reason this file
 * does: restoring a saved design is not an edit to the design that was open.
 */
export function withoutHistory(write: () => void): void {
  applying += 1;
  try {
    write();
  } finally {
    applying -= 1;
    lastSeen = readDesign();
    lastSeenSelection = usePlacementsStore.getState().selectedId;
  }
}

/** Re-select `id` if it still names a placement, and deselect otherwise. */
function restoreSelection(id: string | null): void {
  const { placements, selectPlacement } = usePlacementsStore.getState();
  selectPlacement(id !== null && placements.some((placement) => placement.id === id) ? id : null);
}

/**
 * Run a compound change as **one** history step, under a name you supply.
 *
 * Two problems, one answer. A change that writes several fields — loading the
 * example bed replaces the outline *and* plants five crops — arrives at the
 * subscription as several separate writes and would otherwise cost several
 * presses of Ctrl+Z to undo, none of which corresponds to anything the user
 * did. And no diff of the two designs would name it better than "that change to
 * the planting", where "Undo starting from the example bed" says exactly what
 * will happen.
 *
 * So the writes run with recording suppressed and the whole transition is
 * recorded once, afterwards, against the design as it was before any of them.
 */
export function recordAs(label: string, write: () => void): void {
  const before = readDesign();
  const beforeSelection = lastSeenSelection;
  applying += 1;
  try {
    write();
  } finally {
    applying -= 1;
  }
  const after = readDesign();
  lastSeen = after;
  lastSeenSelection = usePlacementsStore.getState().selectedId;
  if (isSameDesign(before, after)) return;
  lastEditAt = Date.now();
  // Never a movement, whatever the shapes happen to look like: a named action
  // is a discrete thing, and the next drag must start its own step rather than
  // swallowing this one.
  lastEditWasMovement = false;
  pushStep({ design: before, label, selectedId: beforeSelection });
}

/** Forget both stacks — a design switch, for the reason in the module doc. */
export function resetHistory(): void {
  lastSeen = readDesign();
  lastSeenSelection = usePlacementsStore.getState().selectedId;
  lastEditAt = 0;
  lastEditWasMovement = false;
  useDesignHistory.setState({ past: [], future: [], undoLabel: null, redoLabel: null });
}

export const useDesignHistory = create<DesignHistoryState>((set, get) => ({
  past: [],
  future: [],
  undoLabel: null,
  redoLabel: null,

  undo: () => {
    const { past, future } = get();
    const step = past[past.length - 1];
    if (step === undefined) return;
    // The design being left behind is what redo will restore, and it is
    // labelled with the *same* phrase: the step "planting Tomato" is the thing
    // undo removes and redo puts back, so both buttons name it identically.
    const redoEntry: HistoryEntry = {
      design: readDesign(),
      label: step.label,
      selectedId: usePlacementsStore.getState().selectedId,
    };
    const nextPast = past.slice(0, -1);
    const nextFuture = [...future, redoEntry];
    withoutHistory(() => {
      applyDesign(step.design);
      restoreSelection(step.selectedId);
    });
    set({
      past: nextPast,
      future: nextFuture,
      undoLabel: nextPast[nextPast.length - 1]?.label ?? null,
      redoLabel: step.label,
    });
  },

  redo: () => {
    const { past, future } = get();
    const step = future[future.length - 1];
    if (step === undefined) return;
    const undoEntry: HistoryEntry = {
      design: readDesign(),
      label: step.label,
      selectedId: usePlacementsStore.getState().selectedId,
    };
    const nextPast = [...past, undoEntry];
    const nextFuture = future.slice(0, -1);
    withoutHistory(() => {
      applyDesign(step.design);
      restoreSelection(step.selectedId);
    });
    set({
      past: nextPast,
      future: nextFuture,
      undoLabel: step.label,
      redoLabel: nextFuture[nextFuture.length - 1]?.label ?? null,
    });
  },
}));

/**
 * Record the transition from `lastSeen` to whatever the stores now hold.
 *
 * Called by the subscriptions below on every write to either store, so it has
 * to be cheap and has to ignore everything that isn't an edit.
 */
function recordEdit(): void {
  if (applying > 0) return;
  const next = readDesign();
  const prev = lastSeen;
  // The selection as it stood *before* this write, captured before it is
  // overwritten: `addPlacement` changes the placements and the selection in one
  // `set`, so by now the store already holds the new one.
  const prevSelection = lastSeenSelection;
  lastSeenSelection = usePlacementsStore.getState().selectedId;
  if (isSameDesign(prev, next)) return;
  lastSeen = next;

  const now = Date.now();
  const { past } = useDesignHistory.getState();
  // One gesture, one step: a corner drag or a held arrow key arrives as dozens
  // of writes, and merging them is what makes Ctrl+Z undo the movement rather
  // than one frame of it.
  const isMovement = isContinuation(prev, next);
  const merges =
    past.length > 0 && now - lastEditAt < EDIT_COALESCE_MS && isMovement && lastEditWasMovement;
  lastEditAt = now;
  lastEditWasMovement = isMovement;
  if (merges) {
    // The step already on the stack holds the design from *before* the gesture
    // started, which is exactly where undo should land, so there is nothing to
    // push — only the redo branch to discard, which a new edit always does.
    useDesignHistory.setState({ future: [], redoLabel: null });
    return;
  }

  pushStep({ design: prev, label: describeEdit(prev, next), selectedId: prevSelection });
}

/** Put one step on the undo stack, discard the redo branch, and trim to {@link HISTORY_LIMIT}. */
function pushStep(entry: HistoryEntry): void {
  const grown = [...useDesignHistory.getState().past, entry];
  const trimmed = grown.length > HISTORY_LIMIT ? grown.slice(grown.length - HISTORY_LIMIT) : grown;
  useDesignHistory.setState({
    past: trimmed,
    future: [],
    undoLabel: entry.label,
    redoLabel: null,
  });
}

usePlotStore.subscribe(recordEdit);
usePlacementsStore.subscribe(recordEdit);
