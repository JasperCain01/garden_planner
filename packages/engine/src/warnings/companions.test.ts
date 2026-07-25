import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant, type PlantLink } from '../schema/plant';
import { createUserPlant } from '../schema/user-plant';
import { rectangleRegion } from '../spacing/region';
import type { CropPlacement } from './model';
import { companionSuggestions } from './companions';

function plantWith(id: string, companions?: PlantLink[]): Plant {
  return validatePlant({
    id,
    commonName: id,
    scientificName: `${id} scientificus`,
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    ...(companions === undefined ? {} : { companions }),
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

const BED = rectangleRegion(100, 100);

function placement(id: string, plant: Plant): CropPlacement {
  return { id, plant, region: BED, count: 1 };
}

describe('companionSuggestions', () => {
  it('suggests an unplaced companion, carrying its evidence tag and note through', () => {
    const onion = plantWith('onion', [
      { plantId: 'carrot', evidence: 'well-supported', note: 'Uvah & Coaker 1984' },
    ]);
    const suggestions = companionSuggestions([placement('bed-1', onion)]);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      forPlacementId: 'bed-1',
      forPlantId: 'onion',
      suggestedPlantId: 'carrot',
      evidence: 'well-supported',
      note: 'Uvah & Coaker 1984',
    });
    expect(suggestions[0].reason).toContain('well-supported');
  });

  it('phrases a traditional link more softly than a well-supported one', () => {
    const carrot = plantWith('carrot', [{ plantId: 'radish', evidence: 'traditional' }]);
    const suggestions = companionSuggestions([placement('bed-1', carrot)]);

    expect(suggestions[0].evidence).toBe('traditional');
    expect(suggestions[0].reason).toContain('traditionally');
    expect(suggestions[0].reason).toContain('folklore');
  });

  it('does not suggest a companion that is already placed on the plot', () => {
    const onion = plantWith('onion', [{ plantId: 'carrot', evidence: 'well-supported' }]);
    const carrot = plantWith('carrot');
    const suggestions = companionSuggestions([
      placement('bed-1', onion),
      placement('bed-2', carrot),
    ]);

    expect(suggestions).toHaveLength(0);
  });

  it('is silent for a plant with no companions at all', () => {
    const potato = plantWith('potato');
    expect(companionSuggestions([placement('bed-1', potato)])).toHaveLength(0);
  });

  it('never suggests anything for, or from, a user-defined crop', () => {
    const userCrop = createUserPlant({
      commonName: 'Cherry Belle',
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 3, betweenRowCm: 15 } },
    });
    const onion = plantWith('onion', [{ plantId: 'carrot', evidence: 'well-supported' }]);

    // The user crop itself has no `companions` of its own...
    expect(companionSuggestions([placement('bed-1', userCrop)])).toHaveLength(0);
    // ...and no shipped crop's companions list can name a `user-` id, so it
    // never appears as a suggested companion either.
    const suggestions = companionSuggestions([
      placement('bed-1', onion),
      placement('bed-2', userCrop),
    ]);
    expect(suggestions.map((s) => s.suggestedPlantId)).not.toContain(userCrop.id);
  });
});
