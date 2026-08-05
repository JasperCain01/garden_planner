/**
 * The named-designs library and the persistence behind it (UI redesign Phase 5,
 * ADR 0034 §1, §4, §6): what is saved, which one is open, and the read on
 * startup that makes "refresh the page and your garden is still there" true.
 *
 * ## This phase reverses a recorded decision, rather than extending one
 *
 * The review says "the user-crops store may already have persistence patterns
 * to copy". It has not: before this phase `grep -rn "localStorage" app/src`
 * returned nothing outside comments, and what existed instead was a decision
 * *against* persistence, stated in `docs/stage-3.1-brief.md`, `WORKPLAN.md`
 * Stage 3.1 and `user-plants-store.ts`'s own doc. So there is no pattern to
 * copy and the three statements have to be answered rather than ignored — ADR
 * 0034 §2 does that. What survives of them: `user-plants-store` is **still**
 * session-scoped and still writes nothing; a user crop outlives the tab only by
 * travelling inside a design that uses it (`design-codec.ts`).
 *
 * ## There is no "Save" button, and that is the design
 *
 * The active design autosaves on every edit. The review's switcher lists
 * "save/load/duplicate/delete"; a save *command* only earns its place when
 * there is such a thing as unsaved work, and the acceptance criterion this
 * phase is measured against — build a design, reload, get the same design — is
 * a promise that there never is. What the switcher keeps is everything that
 * genuinely branches: New, Load, Duplicate, Rename, Delete.
 *
 * ## Startup is synchronous, and offline by construction
 *
 * {@link restoreDesigns} runs from `main.tsx` *before* `createRoot().render()`,
 * so the first paint is already the user's garden rather than the default 3×2m
 * bed replaced a frame later. It can be synchronous because everything it needs
 * is local: `localStorage` is a synchronous API and the plant list it resolves
 * against is a bundled import (`dataset/shipped-plants.ts`). The service worker
 * means a reload frequently has no network at all (`e2e/offline.spec.ts`), and
 * nothing here would notice.
 *
 * ## Writes are debounced, and flushed before the page goes away
 *
 * Dragging a corner writes the region on every pointer move, so an unbuffered
 * save would serialise the library at frame rate. A short debounce collapses a
 * gesture into one write — and a `pagehide`/`visibilitychange` flush is what
 * makes that safe, because the reload the criterion turns on is exactly the
 * event that would otherwise arrive mid-debounce.
 */

import { create } from 'zustand';
import type { Plant } from '@garden-planner/engine';
import { SHIPPED_PLANTS } from '../dataset/shipped-plants.ts';
import { DEFAULT_CONDITIONS_INPUT, DEFAULT_REGION, usePlotStore } from './plot-store.ts';
import { usePlacementsStore } from './placements-store.ts';
import { applyDesign, isSameDesign, readDesign, type Design } from './design.ts';
import { resetHistory, withoutHistory } from './design-history.ts';
import {
  DESIGNS_STORAGE_KEY,
  DESIGNS_STORAGE_VERSION,
  parseLibrary,
  toStoredDesign,
  type StoredDesign,
} from './design-codec.ts';
import { useUserPlantsStore } from './user-plants-store.ts';

/** How long a burst of edits is collected before being written. Long enough to swallow a drag, short enough to be invisible. */
const SAVE_DEBOUNCE_MS = 200;

/** The name a first-run design gets. Renameable; it exists so the switcher never has to show an unnamed row. */
export const FIRST_DESIGN_NAME = 'My garden';

/** What the switcher shows for one design. The design's *content* lives in the stores while it is open and in `storage` otherwise. */
export interface DesignSummary {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly placementCount: number;
}

interface DesignsState {
  /** Every saved design, most recently updated first. */
  readonly designs: readonly DesignSummary[];
  /** The design currently open in the stores, or `null` before {@link restoreDesigns} has run (which is only ever true under a component test that renders without it). */
  readonly activeId: string | null;
  /** What did not survive the last load — a crop deleted from the dataset, a damaged record. `null` on a clean load; cleared by {@link dismissRestoreNotice}. */
  readonly restoreNotice: string | null;

  /** Start a fresh, empty design and open it. The one that was open is already saved. */
  readonly newDesign: () => void;
  /** Open a saved design. Clears the undo history — see `design-history.ts`. */
  readonly loadDesign: (id: string) => void;
  /** Copy a design under a new name and open the copy. */
  readonly duplicateDesign: (id: string) => void;
  readonly renameDesign: (id: string, name: string) => void;
  /** Delete a design. Deleting the open one opens the next, or a fresh design if it was the last. */
  readonly deleteDesign: (id: string) => void;
  readonly dismissRestoreNotice: () => void;
}

/**
 * Every saved design's stored form, keyed by id — the library's actual
 * contents, held outside the store because nothing renders from it.
 *
 * The store exposes {@link DesignSummary}s, which is what the switcher draws;
 * keeping the full records in React state would re-render the header on every
 * pointer move of a corner drag, to display a name that has not changed.
 */
const records = new Map<string, StoredDesign>();

/** The shipped plant list by id, built once — the resolution table `parseLibrary` needs. */
const shippedById: ReadonlyMap<string, Plant> = new Map(
  SHIPPED_PLANTS.map((plant) => [plant.id, plant]),
);

export const useDesignsStore = create<DesignsState>((set, get) => ({
  designs: [],
  activeId: null,
  restoreNotice: null,

  newDesign: () => {
    // Post-review fix A3: an edit inside the 200ms debounce window is still
    // only *scheduled*, not written — switching away without flushing first
    // loses it from both the outgoing design (whose record stays stale) and
    // the incoming one (whose autosave then reschedules against the new
    // active id). See `flushPendingSave`'s doc for why this is safe to call
    // unconditionally: a no-op when nothing is pending.
    flushPendingSave();
    const design: Design = {
      region: DEFAULT_REGION,
      conditionsInput: DEFAULT_CONDITIONS_INPUT,
      placements: [],
    };
    openDesign(
      { id: newId(), name: nextUntitledName(get().designs), updatedAt: new Date().toISOString() },
      design,
      [],
    );
  },

  loadDesign: (id) => {
    // Post-review fix A3 — see `newDesign`.
    flushPendingSave();
    const record = records.get(id);
    if (record === undefined || id === get().activeId) return;
    // Re-parsed rather than cached as a live `Design`: the record is the thing
    // that was written down, and running it back through the same validators a
    // page load uses means "load a design" and "reload the page" cannot take
    // different paths and disagree.
    const parsed = parseLibrary(
      JSON.stringify({ version: DESIGNS_STORAGE_VERSION, activeId: id, designs: [record] }),
      shippedById,
    );
    const restored = parsed.designs[0];
    if (restored === undefined) return;
    openDesign(
      { id: restored.id, name: restored.name, updatedAt: restored.updatedAt },
      restored.design,
      restored.customPlants,
    );
    if (parsed.problems.length > 0) set({ restoreNotice: parsed.problems.join(' ') });
  },

  duplicateDesign: (id) => {
    // Post-review fix A3 — flushed *before* reading `records.get(id)` (unlike
    // the other three actions) so a duplicate of the currently-open design is
    // made from the freshened record, not a stale one still missing an edit
    // made inside the debounce window.
    flushPendingSave();
    const record = records.get(id);
    if (record === undefined) return;
    const copy: StoredDesign = {
      ...record,
      id: newId(),
      name: `${record.name} copy`,
      updatedAt: new Date().toISOString(),
    };
    records.set(copy.id, copy);
    set({ designs: summarise(get().designs, copy) });
    get().loadDesign(copy.id);
  },

  renameDesign: (id, name) => {
    const record = records.get(id);
    if (record === undefined) return;
    const trimmed = name.trim();
    if (trimmed === '') return;
    const renamed: StoredDesign = { ...record, name: trimmed, updatedAt: new Date().toISOString() };
    records.set(id, renamed);
    set({ designs: summarise(get().designs, renamed) });
    persist();
  },

  deleteDesign: (id) => {
    // Post-review fix A3 — see `newDesign`.
    flushPendingSave();
    if (!records.delete(id)) return;
    const remaining = get().designs.filter((design) => design.id !== id);
    set({ designs: remaining });
    if (get().activeId !== id) {
      persist();
      return;
    }
    // The open design was the one deleted. Opening the next is better than
    // leaving the canvas showing a design that no longer exists; with none
    // left, a fresh one is what "New design" would have given anyway.
    const next = remaining[0];
    if (next === undefined) {
      get().newDesign();
    } else {
      set({ activeId: null });
      get().loadDesign(next.id);
    }
  },

  dismissRestoreNotice: () => set({ restoreNotice: null }),
}));

/**
 * Make `design` the open one: write it to the stores, put its crops back in the
 * session's overlay, forget the undo history, and save.
 *
 * The store writes are wrapped in `withoutHistory` because opening a design is
 * not an edit to the design that was open — and then the history is cleared
 * outright, because an undo that stepped across the switch would splice two
 * gardens together.
 */
function openDesign(
  meta: { readonly id: string; readonly name: string; readonly updatedAt: string },
  design: Design,
  customPlants: readonly unknown[],
): void {
  // The crops first, so nothing renders a placement whose plant the palette
  // does not yet know about. `addUserPlant` is the same validating path the
  // add-crop form uses — see `design-codec.ts` on why a design carries these.
  const { addUserPlant } = useUserPlantsStore.getState();
  for (const input of customPlants) {
    try {
      addUserPlant(input);
    } catch {
      // Already filtered by `parseLibrary`; a survivor here would be a bug in
      // this file rather than bad data, and losing one crop beats a blank app.
    }
  }

  withoutHistory(() => applyDesign(design));
  resetHistory();

  const record = toStoredDesign(meta, design);
  records.set(meta.id, record);
  // Opening a design is not a change to it, so the next write must not stamp a
  // new `updatedAt` — see `writeLibrary`, and the switcher's "edited" column,
  // which would otherwise say "just now" for every design you merely looked at.
  lastSavedDesign = design;
  useDesignsStore.setState((state) => ({
    activeId: meta.id,
    designs: summarise(state.designs, record),
  }));
  persist();
}

/** The summary list with `record` inserted or updated, most recently changed first. */
function summarise(
  designs: readonly DesignSummary[],
  record: StoredDesign,
): readonly DesignSummary[] {
  const summary: DesignSummary = {
    id: record.id,
    name: record.name,
    updatedAt: record.updatedAt,
    placementCount: record.placements.length,
  };
  return [summary, ...designs.filter((design) => design.id !== record.id)];
}

/** A design id. `crypto.randomUUID` is the same source `addPlacement` uses, and is available in every browser this app supports and in jsdom. */
function newId(): string {
  return `design-${crypto.randomUUID()}`;
}

/** "Untitled design", "Untitled design 2", … — a name that is never a duplicate, without asking for one up front. */
function nextUntitledName(designs: readonly DesignSummary[]): string {
  const base = 'Untitled design';
  if (!designs.some((design) => design.name === base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!designs.some((design) => design.name === candidate)) return candidate;
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** The design as last written down, so a save can tell an edit from a mere re-save. `null` until the first design is opened. */
let lastSavedDesign: Design | null = null;

/**
 * Write the whole library, with `activeId`'s record refreshed from the live
 * stores first.
 *
 * The whole library rather than one design because `localStorage` holds
 * strings, not documents: there is no partial write, and one key that is always
 * internally consistent beats several that can disagree about which design is
 * open.
 *
 * A failure here is swallowed on purpose. Storage can be full or disabled
 * (Safari's private mode throws on `setItem`), and an app that stopped working
 * because it could not save would be a worse answer than one that keeps
 * working and does not.
 */
function writeLibrary(activeId: string | null): void {
  if (activeId !== null) {
    const record = records.get(activeId);
    if (record !== undefined) {
      const live = readDesign();
      const edited = lastSavedDesign === null || !isSameDesign(lastSavedDesign, live);
      lastSavedDesign = live;
      const refreshed = toStoredDesign(
        {
          id: record.id,
          name: record.name,
          updatedAt: edited ? new Date().toISOString() : record.updatedAt,
        },
        live,
      );
      records.set(activeId, refreshed);
      if (edited) {
        useDesignsStore.setState((state) => ({ designs: summarise(state.designs, refreshed) }));
      }
    }
  }

  const payload = {
    version: DESIGNS_STORAGE_VERSION,
    activeId,
    designs: [...records.values()],
  };
  try {
    localStorage.setItem(DESIGNS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // See above.
  }
}

/**
 * Schedule a write, collapsing a burst of edits into one.
 *
 * Which design is active is read when the timer *fires*, not when it is set:
 * an edit and a design switch in the same 200ms would otherwise write the new
 * design's content under the old one's id.
 */
function persist(): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeLibrary(useDesignsStore.getState().activeId);
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Write now, if anything is pending.
 *
 * Bound to `pagehide` and to `visibilitychange`, which between them cover every
 * way a page stops being looked at — including the reload this phase's
 * acceptance criterion turns on, and the tab switch on mobile where `pagehide`
 * may never fire at all. `beforeunload` is deliberately not used: it is the one
 * that disqualifies a page from the back/forward cache.
 */
export function flushPendingSave(): void {
  if (saveTimer === null) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  writeLibrary(useDesignsStore.getState().activeId);
}

/**
 * Read the library, open the active design, and start saving.
 *
 * Called once, from `main.tsx`, before the first render — see the module doc.
 * Safe to call again (a test does, between cases): it replaces the library
 * rather than merging into it.
 */
export function restoreDesigns(): void {
  records.clear();
  useDesignsStore.setState({ designs: [], activeId: null, restoreNotice: null });

  const parsed = parseLibrary(readStorage(), shippedById);
  for (const restored of parsed.designs) {
    records.set(
      restored.id,
      toStoredDesign(
        { id: restored.id, name: restored.name, updatedAt: restored.updatedAt },
        restored.design,
      ),
    );
  }
  useDesignsStore.setState({
    designs: [...records.values()]
      .map((record) => ({
        id: record.id,
        name: record.name,
        updatedAt: record.updatedAt,
        placementCount: record.placements.length,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    restoreNotice: parsed.problems.length > 0 ? parsed.problems.join(' ') : null,
  });

  const active = parsed.designs.find((design) => design.id === parsed.activeId);
  if (active === undefined) {
    // Nothing to restore: a first visit, or a library that did not survive
    // validation. Either way the app opens on a design rather than on nothing,
    // so that every later save has somewhere to go.
    openDesign(
      { id: newId(), name: FIRST_DESIGN_NAME, updatedAt: new Date().toISOString() },
      { region: DEFAULT_REGION, conditionsInput: DEFAULT_CONDITIONS_INPUT, placements: [] },
      [],
    );
  } else {
    openDesign(
      { id: active.id, name: active.name, updatedAt: active.updatedAt },
      active.design,
      active.customPlants,
    );
    if (parsed.problems.length > 0) {
      useDesignsStore.setState({ restoreNotice: parsed.problems.join(' ') });
    }
  }

  startAutosave();
}

function readStorage(): string | null {
  try {
    return localStorage.getItem(DESIGNS_STORAGE_KEY);
  } catch {
    return null;
  }
}

let autosaveStarted = false;

/**
 * Subscribe the active design to every edit.
 *
 * Guarded because `restoreDesigns` can run more than once and a second set of
 * subscriptions would write twice per keystroke. The subscriptions themselves
 * are never torn down: they live as long as the module, which lives as long as
 * the tab.
 */
function startAutosave(): void {
  if (autosaveStarted) return;
  autosaveStarted = true;

  usePlotStore.subscribe(persist);
  usePlacementsStore.subscribe(persist);

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPendingSave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPendingSave();
    });
  }
}
