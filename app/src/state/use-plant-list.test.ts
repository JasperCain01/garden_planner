import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SHIPPED_PLANTS } from '../dataset/shipped-plants.ts';
import { useUserPlantsStore } from './user-plants-store.ts';
import { usePlantList } from './use-plant-list.ts';

const cherryBelleInput = {
  commonName: "Radish 'Cherry Belle'",
  category: 'vegetable',
  light: 'full-sun',
  spacing: { row: { inRowCm: 3, betweenRowCm: 20 } },
};

describe('usePlantList', () => {
  beforeEach(() => {
    useUserPlantsStore.setState({ userPlants: {} });
  });

  it('returns exactly the shipped list when no user crops have been added', () => {
    const { result } = renderHook(() => usePlantList());
    expect(result.current).toEqual(SHIPPED_PLANTS);
  });

  it('returns the shipped ∪ user concatenation once a user crop is added', () => {
    const { result } = renderHook(() => usePlantList());

    act(() => {
      useUserPlantsStore.getState().addUserPlant(cherryBelleInput);
    });

    expect(result.current).toHaveLength(SHIPPED_PLANTS.length + 1);
    expect(result.current.at(-1)?.id).toBe('user-radish-cherry-belle');
  });
});
