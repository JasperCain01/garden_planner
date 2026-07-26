import { describe, expect, it } from 'vitest';
import {
  fitPlant,
  rectangleRegion,
  resolvePlotConditions,
  validatePlant,
  type Plant,
  type PlotRegion,
} from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import { evaluateCanvasWarnings } from './evaluate-canvas.ts';

const CONDITIONS = resolvePlotConditions({ light: 'full-sun' });

function plantWith(overrides: Partial<Plant> & Pick<Plant, 'id' | 'spacing'>): Plant {
  return validatePlant({
    commonName: overrides.id,
    scientificName: 'Testus fixturus',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
    ...overrides,
  });
}

// Real shipped figures (`data/plants.json`) for a real, well-supported
// antagonist pair — same crops the E2E journey uses.
const POTATO = plantWith({
  id: 'potato',
  spacing: { row: { inRowCm: 37, betweenRowCm: 75 } },
  antagonists: [{ plantId: 'tomato', evidence: 'well-supported' }],
});
const TOMATO = plantWith({
  id: 'tomato',
  spacing: { row: { inRowCm: 45, betweenRowCm: 60 } },
  antagonists: [{ plantId: 'potato', evidence: 'well-supported' }],
});

const SHADE_LOVER = plantWith({
  id: 'shade-lover',
  spacing: { row: { inRowCm: 10, betweenRowCm: 10 } },
  light: 'full-shade',
});

const ONION_WITH_COMPANION = plantWith({
  id: 'onion',
  spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
  companions: [{ plantId: 'garlic', evidence: 'traditional' }],
});

const REGION: PlotRegion = rectangleRegion(300, 200);

function placed(id: string, plant: Plant, x: number, y: number): PlacedPlant {
  return { id, plant, x, y };
}

describe('evaluateCanvasWarnings — antagonist-adjacency (per-instance derivation)', () => {
  it('warns when two antagonist crops are placed close together', () => {
    const placements = [placed('a', POTATO, 10, 10), placed('b', TOMATO, 20, 10)];

    const result = evaluateCanvasWarnings(placements, REGION, CONDITIONS);

    const antagonistWarning = result.warnings.find(
      (warning) => warning.kind === 'antagonist-adjacency',
    );
    expect(antagonistWarning).toBeDefined();
    expect(antagonistWarning?.severity).toBe('severe'); // well-supported link
    expect(result.severityByPlacementId.get('a')).toBe('severe');
    expect(result.severityByPlacementId.get('b')).toBe('severe');
  });

  it('does not warn once the antagonist pair is moved far enough apart', () => {
    const placements = [placed('a', POTATO, 10, 10), placed('b', TOMATO, 280, 180)];

    const result = evaluateCanvasWarnings(placements, REGION, CONDITIONS);

    expect(result.warnings.some((warning) => warning.kind === 'antagonist-adjacency')).toBe(false);
    expect(result.severityByPlacementId.has('a')).toBe(false);
    expect(result.severityByPlacementId.has('b')).toBe(false);
  });

  it('never flags two instances of the same crop as antagonists of themselves', () => {
    const placements = [placed('a', POTATO, 10, 10), placed('b', POTATO, 15, 10)];

    const result = evaluateCanvasWarnings(placements, REGION, CONDITIONS);

    expect(result.warnings.some((warning) => warning.kind === 'antagonist-adjacency')).toBe(false);
  });
});

describe('evaluateCanvasWarnings — overcrowded (grouped derivation, broadened to every instance)', () => {
  it('warns when more of a crop are placed than the whole plot can hold, and flags every instance of it', () => {
    const tinyRegion = rectangleRegion(5, 5);
    // Confirm the fixture actually is overcrowded before asserting on it, so
    // this test fails loudly if `fitPlant`'s own behaviour ever changes
    // rather than silently asserting on a wrong premise.
    const capacity = fitPlant(POTATO, tinyRegion).count;
    const placements = Array.from({ length: capacity + 3 }, (_unused, index) =>
      placed(`potato-${index}`, POTATO, index, index),
    );

    const result = evaluateCanvasWarnings(placements, tinyRegion, CONDITIONS);

    const overcrowding = result.warnings.find((warning) => warning.kind === 'overcrowded');
    expect(overcrowding).toBeDefined();
    // Broadened to every instance of the crop, not just the CropPlacement's
    // one representative subject — this is the point of the broadening logic.
    for (const placement of placements) {
      expect(result.severityByPlacementId.get(placement.id)).toBeDefined();
    }
  });

  it('does not warn when what fits is respected', () => {
    const placements = [placed('a', POTATO, 10, 10)];
    const result = evaluateCanvasWarnings(placements, REGION, CONDITIONS);
    expect(result.warnings.some((warning) => warning.kind === 'overcrowded')).toBe(false);
  });
});

describe('evaluateCanvasWarnings — suitability (per-instance derivation)', () => {
  it('warns on the exact placement whose plant does not suit the plot light, and no other', () => {
    const placements = [placed('a', SHADE_LOVER, 10, 10), placed('b', POTATO, 100, 100)];

    const result = evaluateCanvasWarnings(placements, REGION, CONDITIONS);

    const lightWarning = result.warnings.find((warning) => warning.kind === 'wrong-light');
    expect(lightWarning).toBeDefined();
    expect(lightWarning?.subjects).toEqual([{ placementId: 'a', plantId: 'shade-lover' }]);
    expect(result.severityByPlacementId.has('a')).toBe(true);
    expect(result.severityByPlacementId.has('b')).toBe(false);
  });
});

describe('evaluateCanvasWarnings — companion suggestions (grouped derivation)', () => {
  it('suggests a companion once per distinct crop, not once per placed instance', () => {
    const placements = [
      placed('a', ONION_WITH_COMPANION, 10, 10),
      placed('b', ONION_WITH_COMPANION, 50, 10),
      placed('c', ONION_WITH_COMPANION, 90, 10),
    ];

    const result = evaluateCanvasWarnings(placements, REGION, CONDITIONS);

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].suggestedPlantId).toBe('garlic');
    // Attached to a real placement id (the group's representative), not a synthesised one.
    expect(result.suggestions[0].forPlacementId).toBe('a');
  });
});
