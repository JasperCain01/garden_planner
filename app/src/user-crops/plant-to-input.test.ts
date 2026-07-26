import { describe, expect, it } from 'vitest';
import { createUserPlant } from '@garden-planner/engine';
import { plantToUserPlantInput } from './plant-to-input.ts';

describe('plantToUserPlantInput', () => {
  it('projects a created user plant back into a resubmittable UserPlantInput', () => {
    const plant = createUserPlant({
      commonName: "Radish 'Cherry Belle'",
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 3, betweenRowCm: 20 } },
      hardiness: { rhsRating: 'H4' },
    });

    const input = plantToUserPlantInput(plant);

    expect(input).toEqual({
      id: 'user-radish-cherry-belle',
      commonName: "Radish 'Cherry Belle'",
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 3, betweenRowCm: 20 } },
      hardiness: { rhsRating: 'H4' },
    });
  });

  it('re-creates an equivalent plant when the projection is round-tripped through createUserPlant', () => {
    const original = createUserPlant({
      commonName: 'Cherry Belle',
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 3, betweenRowCm: 20 } },
    });

    const roundTripped = createUserPlant(plantToUserPlantInput(original));

    expect(roundTripped).toEqual(original);
  });
});
