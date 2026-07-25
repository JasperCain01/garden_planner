import { describe, expect, it } from 'vitest';
import { isUserPlant } from '@garden-planner/engine';
import { SHIPPED_PLANTS } from './shipped-plants.ts';

// Confirms the Stage 3.1 deliverable directly: the bundled dataset loads
// without throwing (module import already ran `loadShippedPlants` above) and
// every record that comes out is a validated, non-empty, shipped-only Plant
// list — the foundation every later Phase 3 stage builds its plant list on.
describe('SHIPPED_PLANTS', () => {
  it('loads a non-empty, validated plant list from data/plants.json', () => {
    expect(SHIPPED_PLANTS.length).toBeGreaterThan(0);
  });

  it('contains only shipped plants, never anything in the user- id namespace', () => {
    expect(SHIPPED_PLANTS.every((plant) => !isUserPlant(plant))).toBe(true);
  });

  it('has no duplicate ids', () => {
    const ids = SHIPPED_PLANTS.map((plant) => plant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
