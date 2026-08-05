import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rectangleRegion } from '@garden-planner/engine';
import { SHIPPED_PLANTS } from '../dataset/shipped-plants.ts';
import { DESIGNS_STORAGE_KEY } from './design-codec.ts';
import { flushPendingSave, restoreDesigns, useDesignsStore } from './designs-store.ts';
import { useDesignHistory } from './design-history.ts';
import { usePlacementsStore } from './placements-store.ts';
import { usePlotStore } from './plot-store.ts';
import { useUserPlantsStore } from './user-plants-store.ts';

/**
 * The designs library and its persistence (UI redesign Phase 5).
 *
 * `restoreDesigns()` is the app's real startup path — `main.tsx` calls exactly
 * this, before the first render — so a test that calls it against jsdom's
 * `localStorage` is exercising the thing itself rather than a stand-in. What it
 * cannot exercise is an actual page reload, which is why
 * `e2e/persistence.spec.ts` does the round trip in a real browser: this file
 * proves the library behaves, that one proves it survives.
 */

const ONION = SHIPPED_PLANTS.find((plant) => plant.id === 'onion');
if (ONION === undefined) throw new Error('the shipped dataset has no onion to test with');

/** A page load: whatever is in storage, read back into the stores. */
function reload(): void {
  usePlotStore.setState({
    region: rectangleRegion(300, 200),
    conditionsInput: { light: 'full-sun' },
  });
  usePlacementsStore.setState({ placements: [], selectedId: null });
  useUserPlantsStore.setState({ userPlants: {} });
  restoreDesigns();
}

describe('the designs library', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    reload();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens on a design, so a first visit already has somewhere to save to', () => {
    expect(useDesignsStore.getState().activeId).not.toBeNull();
    expect(useDesignsStore.getState().designs).toHaveLength(1);
    expect(usePlacementsStore.getState().placements).toEqual([]);
  });

  it('survives a reload with the placements and the plot intact', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 40, y: 60 });
    usePlotStore.getState().setRegion(rectangleRegion(500, 400));
    flushPendingSave();

    reload();

    expect(usePlacementsStore.getState().placements).toHaveLength(1);
    expect(usePlacementsStore.getState().placements[0].plant.id).toBe('onion');
    expect(usePlacementsStore.getState().placements[0].x).toBe(40);
    expect(usePlotStore.getState().region).toEqual(rectangleRegion(500, 400));
  });

  it('debounces writes and flushes them before the page goes away', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 40, y: 60 });

    // Nothing yet: the write is still collecting.
    const midGesture = JSON.parse(localStorage.getItem(DESIGNS_STORAGE_KEY) ?? '{}');
    expect(midGesture.designs?.[0]?.placements ?? []).toHaveLength(0);

    flushPendingSave();
    const flushed = JSON.parse(localStorage.getItem(DESIGNS_STORAGE_KEY) ?? '{}');
    expect(flushed.designs[0].placements).toHaveLength(1);
  });

  it('writes on its own after the debounce, without waiting for the page to close', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 40, y: 60 });
    vi.advanceTimersByTime(500);

    const written = JSON.parse(localStorage.getItem(DESIGNS_STORAGE_KEY) ?? '{}');
    expect(written.designs[0].placements).toHaveLength(1);
  });

  it('carries a session-scoped user crop across a reload, inside the design that uses it', () => {
    const mine = useUserPlantsStore.getState().addUserPlant({
      commonName: 'Aunt Ada’s bean',
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 15, betweenRowCm: 45 } },
    });
    usePlacementsStore.getState().addPlacement(mine, { x: 40, y: 60 });
    flushPendingSave();

    reload();

    expect(usePlacementsStore.getState().placements[0].plant.commonName).toBe('Aunt Ada’s bean');
    // And it is back in the palette's overlay too, not only on the canvas —
    // otherwise the crop could be seen but never planted again.
    expect(Object.keys(useUserPlantsStore.getState().userPlants)).toEqual([mine.id]);
  });

  it('leaves the user-crops store alone for a crop no design references', () => {
    useUserPlantsStore.getState().addUserPlant({
      commonName: 'Unplanted thing',
      category: 'herb',
      light: 'full-sun',
      spacing: { row: { inRowCm: 10, betweenRowCm: 10 } },
    });
    flushPendingSave();

    reload();

    // The store is still session-scoped: only crops a design carries come back.
    expect(useUserPlantsStore.getState().userPlants).toEqual({});
  });

  it('starts a new design empty, and keeps the old one', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 40, y: 60 });
    flushPendingSave();

    useDesignsStore.getState().newDesign();

    expect(usePlacementsStore.getState().placements).toEqual([]);
    expect(useDesignsStore.getState().designs).toHaveLength(2);

    flushPendingSave();
    reload();
    expect(usePlacementsStore.getState().placements).toEqual([]);
  });

  it('loads a saved design back', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 40, y: 60 });
    const plantedId = useDesignsStore.getState().activeId as string;
    flushPendingSave();

    useDesignsStore.getState().newDesign();
    expect(usePlacementsStore.getState().placements).toEqual([]);

    useDesignsStore.getState().loadDesign(plantedId);
    expect(usePlacementsStore.getState().placements).toHaveLength(1);
    expect(useDesignsStore.getState().activeId).toBe(plantedId);
  });

  it('clears the undo history across a design switch, rather than splicing two gardens', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 40, y: 60 });
    expect(useDesignHistory.getState().undoLabel).toBe('planting Onion');

    useDesignsStore.getState().newDesign();

    expect(useDesignHistory.getState().past).toEqual([]);
    expect(useDesignHistory.getState().undoLabel).toBeNull();
  });

  it('duplicates a design, contents and all, and opens the copy', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 40, y: 60 });
    const originalId = useDesignsStore.getState().activeId as string;
    flushPendingSave();

    useDesignsStore.getState().duplicateDesign(originalId);

    expect(useDesignsStore.getState().activeId).not.toBe(originalId);
    expect(usePlacementsStore.getState().placements).toHaveLength(1);
    expect(useDesignsStore.getState().designs.map((design) => design.name)).toContain(
      'My garden copy',
    );
  });

  it('keeps an edit made inside the debounce window when duplicating (post-review fix A3)', () => {
    // Without a flush at the top of `duplicateDesign`, this edit is written to
    // *neither* the original's record nor the copy: the copy is read from
    // whatever `records.get(id)` held at the moment of the call, and the
    // original's autosave then reschedules against the copy's id instead.
    usePlacementsStore.getState().addPlacement(ONION, { x: 40, y: 60 });
    const originalId = useDesignsStore.getState().activeId as string;
    flushPendingSave();

    usePlacementsStore.getState().addPlacement(ONION, { x: 80, y: 90 });
    vi.advanceTimersByTime(50); // well inside SAVE_DEBOUNCE_MS (200ms) — still pending

    useDesignsStore.getState().duplicateDesign(originalId);

    // The copy is open and has both placements.
    expect(usePlacementsStore.getState().placements).toHaveLength(2);

    // And the original, read back, also has both — the edit was not lost.
    useDesignsStore.getState().loadDesign(originalId);
    expect(usePlacementsStore.getState().placements).toHaveLength(2);
  });

  it('keeps an edit made inside the debounce window when switching with loadDesign (post-review fix A3)', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 40, y: 60 });
    const originalId = useDesignsStore.getState().activeId as string;
    flushPendingSave();

    useDesignsStore.getState().newDesign();
    const secondId = useDesignsStore.getState().activeId as string;
    flushPendingSave();

    useDesignsStore.getState().loadDesign(originalId);
    usePlacementsStore.getState().addPlacement(ONION, { x: 80, y: 90 });
    vi.advanceTimersByTime(50); // still inside the debounce window

    // Switch away before the debounce would have fired on its own.
    useDesignsStore.getState().loadDesign(secondId);

    // The outgoing design (the one just left) kept the edit.
    useDesignsStore.getState().loadDesign(originalId);
    expect(usePlacementsStore.getState().placements).toHaveLength(2);
  });

  it('renames the open design, and the name survives a reload', () => {
    const id = useDesignsStore.getState().activeId as string;
    useDesignsStore.getState().renameDesign(id, 'The allotment');
    flushPendingSave();

    reload();

    expect(useDesignsStore.getState().designs[0].name).toBe('The allotment');
  });

  it('deleting the open design opens another rather than leaving nothing on screen', () => {
    const first = useDesignsStore.getState().activeId as string;
    useDesignsStore.getState().newDesign();
    const second = useDesignsStore.getState().activeId as string;

    useDesignsStore.getState().deleteDesign(second);

    expect(useDesignsStore.getState().activeId).toBe(first);
    expect(useDesignsStore.getState().designs).toHaveLength(1);
  });

  it('deleting the last design leaves a fresh one, not an empty app', () => {
    useDesignsStore.getState().deleteDesign(useDesignsStore.getState().activeId as string);

    expect(useDesignsStore.getState().designs).toHaveLength(1);
    expect(useDesignsStore.getState().activeId).not.toBeNull();
  });

  it('reports what a load lost, and keeps going', () => {
    // A design saved when the dataset still had this crop — ADR 0025's 24
    // deletions are precisely this situation.
    localStorage.setItem(
      DESIGNS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        activeId: 'design-1',
        designs: [
          {
            id: 'design-1',
            name: 'Old garden',
            updatedAt: '2026-01-01T00:00:00.000Z',
            region: rectangleRegion(300, 200),
            conditionsInput: { light: 'full-sun' },
            placements: [
              { id: 'p1', plantId: 'onion', x: 10, y: 10 },
              { id: 'p2', plantId: 'a-crop-that-was-deleted', x: 90, y: 10 },
            ],
            customPlants: [],
          },
        ],
      }),
    );

    reload();

    expect(usePlacementsStore.getState().placements).toHaveLength(1);
    expect(useDesignsStore.getState().restoreNotice).toContain('a-crop-that-was-deleted');
  });

  it('starts fresh from unreadable storage rather than failing to load at all', () => {
    localStorage.setItem(DESIGNS_STORAGE_KEY, '{"version":1,"designs":[{{{');

    expect(() => reload()).not.toThrow();
    expect(useDesignsStore.getState().activeId).not.toBeNull();
    expect(useDesignsStore.getState().restoreNotice).not.toBeNull();
  });
});
