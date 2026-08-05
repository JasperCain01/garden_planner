import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rectangleRegion, validatePlant, type Plant } from '@garden-planner/engine';
import { useCanvasViewStore } from './canvas-view-store.ts';
import { readDesign } from './design.ts';
import { recordAs, resetHistory, useDesignHistory } from './design-history.ts';
import { usePlacementsStore } from './placements-store.ts';
import { usePlotStore } from './plot-store.ts';

/**
 * Undo and redo (UI redesign Phase 5, ADR 0034 §3).
 *
 * The three things this file exists to pin, in order of how quietly they would
 * break: that one history spans **two stores**, so Ctrl+Z means the same thing
 * whichever the last edit touched; that a **gesture is one step** rather than
 * sixty; and that everything deliberately outside a design — the canvas view,
 * the crop library, a mere selection — stays outside it.
 *
 * Time is faked, because the coalescing window is a real 600ms and a test that
 * waited for it would be a test that is sometimes slower than it looks.
 */

const ONION: Plant = validatePlant({
  id: 'onion',
  commonName: 'Onion',
  scientificName: 'Allium cepa',
  gbifId: null,
  category: 'vegetable',
  light: 'full-sun',
  spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
  provenance: { sources: [{ source: 'hand-written test fixture' }] },
});

describe('the design history', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePlotStore.setState({
      region: rectangleRegion(300, 200),
      conditionsInput: { light: 'full-sun' },
    });
    usePlacementsStore.setState({ placements: [], selectedId: null });
    resetHistory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('undoes and redoes a placement', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
    expect(useDesignHistory.getState().undoLabel).toBe('planting Onion');

    useDesignHistory.getState().undo();
    expect(usePlacementsStore.getState().placements).toEqual([]);
    expect(useDesignHistory.getState().redoLabel).toBe('planting Onion');

    useDesignHistory.getState().redo();
    expect(usePlacementsStore.getState().placements).toHaveLength(1);
    expect(usePlacementsStore.getState().placements[0].plant.id).toBe('onion');
  });

  it('spans both design stores, so one Ctrl+Z means the last edit whichever store it was in', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
    vi.advanceTimersByTime(1_000);
    usePlotStore.getState().setRegion(rectangleRegion(400, 300));

    // Newest first: the shape change, then the placement. A per-store history
    // could not order these against each other at all.
    useDesignHistory.getState().undo();
    expect(usePlotStore.getState().region).toEqual(rectangleRegion(300, 200));
    expect(usePlacementsStore.getState().placements).toHaveLength(1);

    useDesignHistory.getState().undo();
    expect(usePlacementsStore.getState().placements).toEqual([]);
  });

  it('collapses a drag into one step', () => {
    const id = usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
    vi.advanceTimersByTime(1_000);

    // A drag: many writes, milliseconds apart.
    for (let frame = 1; frame <= 20; frame += 1) {
      usePlacementsStore.getState().movePlacement(id, { x: 10 + frame * 5, y: 10 });
      vi.advanceTimersByTime(16);
    }
    expect(usePlacementsStore.getState().placements[0].x).toBe(110);

    useDesignHistory.getState().undo();
    expect(
      usePlacementsStore.getState().placements[0].x,
      'one press goes back to before the drag, not one frame into it',
    ).toBe(10);
  });

  it('does not collapse two placements made in quick succession', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
    vi.advanceTimersByTime(50);
    usePlacementsStore.getState().addPlacement(ONION, { x: 90, y: 10 });

    useDesignHistory.getState().undo();
    expect(usePlacementsStore.getState().placements).toHaveLength(1);
  });

  it('does not swallow a placement into the nudge that follows it', () => {
    // `isContinuation` is true of this pair — the placements list is unchanged
    // between the two writes — so only the "a gesture can only continue a
    // gesture" rule keeps these apart.
    const id = usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
    vi.advanceTimersByTime(50);
    usePlacementsStore.getState().movePlacement(id, { x: 15, y: 10 });

    useDesignHistory.getState().undo();
    expect(usePlacementsStore.getState().placements[0].x).toBe(10);
  });

  it('starts a new step once the gesture has paused', () => {
    const id = usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
    vi.advanceTimersByTime(1_000);
    usePlacementsStore.getState().movePlacement(id, { x: 50, y: 10 });
    vi.advanceTimersByTime(1_000);
    usePlacementsStore.getState().movePlacement(id, { x: 90, y: 10 });

    useDesignHistory.getState().undo();
    expect(usePlacementsStore.getState().placements[0].x).toBe(50);
  });

  it('restores the selection a step was made in, so the arrow keys still have a target', () => {
    // Found by the keyboard walkthrough rather than by reasoning: the canvas's
    // arrow keys act on the selected placement, so a redo that put a plant back
    // *without* selecting it left a keyboard user pressing arrows at nothing.
    // A selection is still not part of a design and still costs no history
    // step — the step carries it as the context it happened in.
    const id = usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
    expect(usePlacementsStore.getState().selectedId).toBe(id);

    useDesignHistory.getState().undo();
    expect(
      usePlacementsStore.getState().selectedId,
      'nothing is selected when the plant is not there',
    ).toBeNull();

    useDesignHistory.getState().redo();
    expect(usePlacementsStore.getState().selectedId).toBe(id);
  });

  it('ignores selecting a placement — looking at something is not an edit', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
    const stepsAfterPlacing = useDesignHistory.getState().past.length;

    usePlacementsStore.getState().selectPlacement(null);
    usePlacementsStore.getState().selectPlacement('anything');

    expect(useDesignHistory.getState().past).toHaveLength(stepsAfterPlacing);
  });

  it('ignores the canvas view entirely — zoom and panning are not edits', () => {
    useCanvasViewStore.getState().zoomBy(1.25);
    useCanvasViewStore.getState().requestReveal('placement-1');
    useCanvasViewStore.getState().setEditingOutline(true);

    expect(useDesignHistory.getState().past).toEqual([]);
    expect(useDesignHistory.getState().undoLabel).toBeNull();
  });

  it('discards the redo branch when a new edit follows an undo', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
    useDesignHistory.getState().undo();
    expect(useDesignHistory.getState().redoLabel).toBe('planting Onion');

    vi.advanceTimersByTime(1_000);
    usePlacementsStore.getState().addPlacement(ONION, { x: 200, y: 100 });
    expect(useDesignHistory.getState().redoLabel).toBeNull();
  });

  it('records a compound change as one named step', () => {
    const before = readDesign();
    recordAs('starting from the example bed', () => {
      usePlotStore.getState().setRegion(rectangleRegion(400, 300));
      usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 10 });
      usePlacementsStore.getState().addPlacement(ONION, { x: 90, y: 10 });
    });

    expect(useDesignHistory.getState().past).toHaveLength(1);
    expect(useDesignHistory.getState().undoLabel).toBe('starting from the example bed');

    useDesignHistory.getState().undo();
    expect(readDesign()).toEqual(before);
  });

  it('does nothing when there is nothing to undo or redo', () => {
    expect(() => useDesignHistory.getState().undo()).not.toThrow();
    expect(() => useDesignHistory.getState().redo()).not.toThrow();
    expect(useDesignHistory.getState().past).toEqual([]);
  });
});
