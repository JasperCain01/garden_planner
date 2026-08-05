import { beforeEach, describe, expect, it } from 'vitest';
import { rectangleRegion, validatePlant, type Plant } from '@garden-planner/engine';
import { applyDesign, describeEdit, isContinuation, readDesign, type Design } from './design.ts';
import { usePlacementsStore } from './placements-store.ts';
import { usePlotStore } from './plot-store.ts';

/**
 * What a design is, and the two pure questions the history asks about one (UI
 * redesign Phase 5).
 *
 * `isContinuation` and `describeEdit` are the whole of the coalescing and
 * labelling behaviour, and they are pure functions of two designs precisely so
 * they can be pinned here rather than inferred from a stack of Ctrl+Z presses.
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

const CARROT: Plant = validatePlant({
  ...ONION,
  id: 'carrot',
  commonName: 'Carrot',
  scientificName: 'Daucus carota',
});

const BASE: Design = {
  region: rectangleRegion(300, 200),
  conditionsInput: { light: 'full-sun' },
  placements: [{ id: 'a', plant: ONION, x: 10, y: 10 }],
};

function withPlacements(design: Design, placements: Design['placements']): Design {
  return { ...design, placements };
}

describe('readDesign / applyDesign', () => {
  beforeEach(() => {
    usePlotStore.setState({
      region: rectangleRegion(100, 100),
      conditionsInput: { light: 'full-shade' },
    });
    usePlacementsStore.setState({ placements: [], selectedId: null });
  });

  it('round-trips the design through the two stores it spans', () => {
    applyDesign(BASE);
    expect(readDesign()).toEqual(BASE);
  });

  it('keeps a selection that survives the change', () => {
    applyDesign(BASE);
    usePlacementsStore.getState().selectPlacement('a');

    applyDesign(withPlacements(BASE, [{ id: 'a', plant: ONION, x: 99, y: 99 }]));
    expect(usePlacementsStore.getState().selectedId).toBe('a');
  });

  it('drops a selection that does not, rather than pointing at a plant that is gone', () => {
    applyDesign(BASE);
    usePlacementsStore.getState().selectPlacement('a');

    applyDesign(withPlacements(BASE, []));
    expect(usePlacementsStore.getState().selectedId).toBeNull();
  });
});

describe('isContinuation', () => {
  it('is true when only coordinates moved — one drag, one undo step', () => {
    const moved = withPlacements(BASE, [{ id: 'a', plant: ONION, x: 40, y: 10 }]);
    expect(isContinuation(BASE, moved)).toBe(true);
  });

  it('is true when a corner moved, at the same corner count', () => {
    expect(isContinuation(BASE, { ...BASE, region: rectangleRegion(320, 200) })).toBe(true);
  });

  it('is false when a placement appears — two quick placements are two edits', () => {
    const planted = withPlacements(BASE, [
      ...BASE.placements,
      { id: 'b', plant: CARROT, x: 80, y: 80 },
    ]);
    expect(isContinuation(BASE, planted)).toBe(false);
  });

  it('is false when a corner is added or removed mid-drag', () => {
    const triangle = {
      ...BASE,
      region: {
        vertices: [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
          { x: 0, y: 200 },
        ],
      },
    };
    expect(isContinuation(BASE, triangle)).toBe(false);
  });

  it('is false for a conditions change, which is always a discrete decision', () => {
    expect(isContinuation(BASE, { ...BASE, conditionsInput: { light: 'partial-shade' } })).toBe(
      false,
    );
  });
});

describe('describeEdit', () => {
  it('names the crop that was planted', () => {
    const planted = withPlacements(BASE, [
      ...BASE.placements,
      { id: 'b', plant: CARROT, x: 80, y: 80 },
    ]);
    expect(describeEdit(BASE, planted)).toBe('planting Carrot');
  });

  it('names the crop that was removed', () => {
    expect(describeEdit(BASE, withPlacements(BASE, []))).toBe('removing Onion');
  });

  it('calls emptying a full plot what it is', () => {
    const full = withPlacements(BASE, [
      { id: 'a', plant: ONION, x: 10, y: 10 },
      { id: 'b', plant: CARROT, x: 80, y: 80 },
    ]);
    expect(describeEdit(full, withPlacements(full, []))).toBe('clearing the plot');
  });

  it('names the crop that moved', () => {
    const moved = withPlacements(BASE, [{ id: 'a', plant: ONION, x: 40, y: 10 }]);
    expect(describeEdit(BASE, moved)).toBe('moving Onion');
  });

  it('describes shape and conditions changes without naming a crop', () => {
    expect(describeEdit(BASE, { ...BASE, region: rectangleRegion(400, 200) })).toBe(
      'that change to the plot shape',
    );
    expect(describeEdit(BASE, { ...BASE, conditionsInput: { light: 'full-shade' } })).toBe(
      'that change to the growing conditions',
    );
  });
});
