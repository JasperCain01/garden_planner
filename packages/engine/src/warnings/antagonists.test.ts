import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant, type PlantLink } from '../schema/plant';
import { createUserPlant } from '../schema/user-plant';
import { rectangleRegion } from '../spacing/region';
import type { CropPlacement } from './model';
import { antagonistWarnings } from './antagonists';

function plantWith(id: string, antagonists?: PlantLink[]): Plant {
  return validatePlant({
    id,
    commonName: id,
    scientificName: `${id} scientificus`,
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    ...(antagonists === undefined ? {} : { antagonists }),
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

// Two 1 m x 1 m beds, right next to each other (0 cm gap).
const bedA = rectangleRegion(100, 100);
const bedB = {
  vertices: [
    { x: 100, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 100, y: 100 },
  ],
};

describe('antagonistWarnings', () => {
  it('warns at severity "severe" for a well-supported antagonist pair planted adjacent', () => {
    const potato = plantWith('potato', [
      { plantId: 'tomato', evidence: 'well-supported', note: 'shared blight' },
    ]);
    const tomato = plantWith('tomato');
    const placements: CropPlacement[] = [
      { id: 'bed-a', plant: potato, region: bedA, count: 1 },
      { id: 'bed-b', plant: tomato, region: bedB, count: 1 },
    ];

    const warnings = antagonistWarnings(placements);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      kind: 'antagonist-adjacency',
      severity: 'severe',
      evidence: 'well-supported',
      distanceCm: 0,
      note: 'shared blight',
    });
    expect(warnings[0].subjects).toEqual([
      { placementId: 'bed-a', plantId: 'potato' },
      { placementId: 'bed-b', plantId: 'tomato' },
    ]);
    expect(warnings[0].reason).toContain('potato and tomato');
  });

  it('warns at severity "warning" for a traditional antagonist pair', () => {
    const onion = plantWith('onion', [{ plantId: 'pea', evidence: 'traditional' }]);
    const pea = plantWith('pea');
    const placements: CropPlacement[] = [
      { id: 'bed-a', plant: onion, region: bedA, count: 1 },
      { id: 'bed-b', plant: pea, region: bedB, count: 1 },
    ];

    expect(antagonistWarnings(placements)).toMatchObject([
      { severity: 'warning', evidence: 'traditional' },
    ]);
  });

  it('is silent when the antagonist pair is planted far enough apart', () => {
    const potato = plantWith('potato', [{ plantId: 'tomato', evidence: 'well-supported' }]);
    const tomato = plantWith('tomato');
    const farBedB = {
      vertices: [
        { x: 10_000, y: 0 },
        { x: 10_100, y: 0 },
        { x: 10_100, y: 100 },
        { x: 10_000, y: 100 },
      ],
    };
    const placements: CropPlacement[] = [
      { id: 'bed-a', plant: potato, region: bedA, count: 1 },
      { id: 'bed-b', plant: tomato, region: farBedB, count: 1 },
    ];
    expect(antagonistWarnings(placements)).toHaveLength(0);
  });

  it('is silent for crops with no antagonist relationship at all', () => {
    const carrot = plantWith('carrot');
    const lettuce = plantWith('lettuce');
    const placements: CropPlacement[] = [
      { id: 'bed-a', plant: carrot, region: bedA, count: 1 },
      { id: 'bed-b', plant: lettuce, region: bedB, count: 1 },
    ];
    expect(antagonistWarnings(placements)).toHaveLength(0);
  });

  it('never flags a user-defined crop, which carries no antagonists at all', () => {
    const potato = plantWith('potato', [{ plantId: 'tomato', evidence: 'well-supported' }]);
    const userTomato = createUserPlant({
      commonName: 'Tomato',
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 45, betweenRowCm: 60 } },
    });
    // Even though the user named their crop "Tomato", it has a `user-` id and
    // no antagonists of its own, and no shipped crop's antagonists array can
    // ever name a `user-` id (ADR 0011 §4) -- so no pairing is ever found.
    const placements: CropPlacement[] = [
      { id: 'bed-a', plant: potato, region: bedA, count: 1 },
      { id: 'bed-b', plant: userTomato, region: bedB, count: 1 },
    ];
    expect(antagonistWarnings(placements)).toHaveLength(0);
  });
});
