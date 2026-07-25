import { beforeEach, describe, expect, it } from 'vitest';
import { useUserPlantsStore } from './user-plants-store.ts';

// A minimal, valid packet of input for UserPlantInputSchema (see
// `packages/engine/src/schema/user-plant.ts`) — just enough to exercise the
// store without restating the schema's own validation tests.
const cherryBelleInput = {
  commonName: "Radish 'Cherry Belle'",
  category: 'vegetable',
  light: 'full-sun',
  spacing: { row: { inRowCm: 3, betweenRowCm: 20 } },
};

describe('useUserPlantsStore', () => {
  beforeEach(() => {
    // The store is a module-level singleton, so tests must reset it — otherwise
    // a crop added in one test would leak into the next.
    useUserPlantsStore.setState({ userPlants: {} });
  });

  it('starts with an empty overlay', () => {
    expect(useUserPlantsStore.getState().userPlants).toEqual({});
  });

  it('adds a validated, user-namespaced plant to the overlay', () => {
    const plant = useUserPlantsStore.getState().addUserPlant(cherryBelleInput);

    expect(plant.id).toBe('user-radish-cherry-belle');
    expect(useUserPlantsStore.getState().userPlants[plant.id]).toEqual(plant);
  });

  it('rejects input that does not fit UserPlantInputSchema', () => {
    expect(() =>
      useUserPlantsStore.getState().addUserPlant({ commonName: 'Missing fields' }),
    ).toThrow();
  });

  it('removes a plant from the overlay by id', () => {
    const plant = useUserPlantsStore.getState().addUserPlant(cherryBelleInput);

    useUserPlantsStore.getState().removeUserPlant(plant.id);

    expect(useUserPlantsStore.getState().userPlants).toEqual({});
  });

  it('is a no-op removing an id that is not present', () => {
    useUserPlantsStore.getState().removeUserPlant('user-not-added');

    expect(useUserPlantsStore.getState().userPlants).toEqual({});
  });

  it('replaces an existing entry when a matching id is added again', () => {
    const store = useUserPlantsStore.getState();
    store.addUserPlant(cherryBelleInput);
    store.addUserPlant({ ...cherryBelleInput, spacing: { row: { inRowCm: 5, betweenRowCm: 25 } } });

    const overlay = useUserPlantsStore.getState().userPlants;
    expect(Object.keys(overlay)).toEqual(['user-radish-cherry-belle']);
    expect(overlay['user-radish-cherry-belle'].spacing).toEqual({
      row: { inRowCm: 5, betweenRowCm: 25 },
    });
  });
});
