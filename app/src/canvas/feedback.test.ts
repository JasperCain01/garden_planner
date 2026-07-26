import { describe, expect, it } from 'vitest';
import {
  rectangleRegion,
  validatePlant,
  type Plant,
  type PlotRegion,
} from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import { computePlacementTally } from './feedback.ts';

// Same golden onion figure `fit.test.ts` uses: a 200 x 100 cm bed at
// 10 (in-row) x 30 (between-row) cm holds 20 columns x 3 rows = 60 onions.
const REGION: PlotRegion = rectangleRegion(200, 100);

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

function placed(plant: Plant, x: number, y: number): PlacedPlant {
  return { id: `${plant.id}-${x}-${y}`, plant, x, y };
}

describe('computePlacementTally', () => {
  it('returns nothing for an empty canvas', () => {
    expect(computePlacementTally([], REGION)).toEqual([]);
  });

  it('counts how many of a placed crop fit the plot, alongside how many are placed', () => {
    const rows = computePlacementTally([placed(ONION, 10, 10), placed(ONION, 50, 10)], REGION);

    expect(rows).toHaveLength(1);
    expect(rows[0].plant).toBe(ONION);
    expect(rows[0].placedCount).toBe(2);
    expect(rows[0].fit.count).toBe(60);
    expect(rows[0].fit.plantId).toBe('onion');
    // The first-placed instance's own id, not a synthesised group key — see
    // `PlacementTallyRow.representativePlacementId`'s doc comment.
    expect(rows[0].representativePlacementId).toBe('onion-10-10');
  });

  it('keeps distinct crops as separate rows, in first-placed order', () => {
    const rows = computePlacementTally(
      [placed(KALE, 0, 0), placed(ONION, 10, 10), placed(KALE, 20, 20)],
      REGION,
    );

    expect(rows.map((row) => row.plant.id)).toEqual(['kale', 'onion']);
    expect(rows[0].placedCount).toBe(2);
    expect(rows[1].placedCount).toBe(1);
  });
});
