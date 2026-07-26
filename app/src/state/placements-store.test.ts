import { beforeEach, describe, expect, it } from 'vitest';
import { validatePlant, type Plant } from '@garden-planner/engine';
import { usePlacementsStore } from './placements-store.ts';

// A minimal, valid `Plant` fixture — just enough to exercise the store, which
// never inspects a plant's fields beyond carrying it around (mirrors
// `fit.test.ts`'s own `plantWith` helper).
function plantWith(id: string, commonName: string): Plant {
  return validatePlant({
    id,
    commonName,
    scientificName: 'Allium cepa',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

const ONION = plantWith('onion', 'Onion');
const KALE = plantWith('kale', 'Kale');

describe('usePlacementsStore', () => {
  beforeEach(() => {
    // The store is a module-level singleton; reset it so one test's edits
    // don't leak into the next (mirrors plot-store.test.ts).
    usePlacementsStore.setState({ placements: [], selectedId: null });
  });

  it('starts empty with nothing selected', () => {
    const state = usePlacementsStore.getState();
    expect(state.placements).toEqual([]);
    expect(state.selectedId).toBeNull();
  });

  it('adds a placement, selecting it and returning its id', () => {
    const id = usePlacementsStore.getState().addPlacement(ONION, { x: 10, y: 20 });

    const state = usePlacementsStore.getState();
    expect(state.placements).toEqual([{ id, plant: ONION, x: 10, y: 20 }]);
    expect(state.selectedId).toBe(id);
  });

  it('gives each placement its own id, even for the same plant placed twice', () => {
    const firstId = usePlacementsStore.getState().addPlacement(ONION, { x: 0, y: 0 });
    const secondId = usePlacementsStore.getState().addPlacement(ONION, { x: 50, y: 0 });

    expect(firstId).not.toBe(secondId);
    expect(usePlacementsStore.getState().placements).toHaveLength(2);
  });

  it('moves a placement to a new position, leaving others untouched', () => {
    const movedId = usePlacementsStore.getState().addPlacement(ONION, { x: 0, y: 0 });
    const otherId = usePlacementsStore.getState().addPlacement(KALE, { x: 100, y: 100 });

    usePlacementsStore.getState().movePlacement(movedId, { x: 30, y: 40 });

    const state = usePlacementsStore.getState();
    expect(state.placements.find((p) => p.id === movedId)).toMatchObject({ x: 30, y: 40 });
    expect(state.placements.find((p) => p.id === otherId)).toMatchObject({ x: 100, y: 100 });
  });

  it('moving an unknown id is a no-op', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 0, y: 0 });
    const before = usePlacementsStore.getState().placements;

    usePlacementsStore.getState().movePlacement('does-not-exist', { x: 99, y: 99 });

    expect(usePlacementsStore.getState().placements).toEqual(before);
  });

  it('removes a placement by id', () => {
    const id = usePlacementsStore.getState().addPlacement(ONION, { x: 0, y: 0 });

    usePlacementsStore.getState().removePlacement(id);

    expect(usePlacementsStore.getState().placements).toEqual([]);
  });

  it('clears the selection when the selected placement is removed', () => {
    const id = usePlacementsStore.getState().addPlacement(ONION, { x: 0, y: 0 });
    expect(usePlacementsStore.getState().selectedId).toBe(id);

    usePlacementsStore.getState().removePlacement(id);

    expect(usePlacementsStore.getState().selectedId).toBeNull();
  });

  it('removing a placement that is not selected leaves the selection alone', () => {
    const keptId = usePlacementsStore.getState().addPlacement(ONION, { x: 0, y: 0 });
    const removedId = usePlacementsStore.getState().addPlacement(KALE, { x: 10, y: 10 });
    usePlacementsStore.getState().selectPlacement(keptId);

    usePlacementsStore.getState().removePlacement(removedId);

    expect(usePlacementsStore.getState().selectedId).toBe(keptId);
  });

  it('removing an unknown id is a no-op', () => {
    usePlacementsStore.getState().addPlacement(ONION, { x: 0, y: 0 });
    const before = usePlacementsStore.getState().placements;

    usePlacementsStore.getState().removePlacement('does-not-exist');

    expect(usePlacementsStore.getState().placements).toEqual(before);
  });

  it('selects and deselects explicitly', () => {
    const id = usePlacementsStore.getState().addPlacement(ONION, { x: 0, y: 0 });
    usePlacementsStore.getState().selectPlacement(null);
    expect(usePlacementsStore.getState().selectedId).toBeNull();

    usePlacementsStore.getState().selectPlacement(id);
    expect(usePlacementsStore.getState().selectedId).toBe(id);
  });
});
