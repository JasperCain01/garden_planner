import { describe, expect, it } from 'vitest';
import {
  rectangleRegion,
  validatePlant,
  type Plant,
  type PlotRegion,
} from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import {
  deriveOvercrowdingPlacements,
  derivePerInstancePlacements,
} from './placement-derivation.ts';

const REGION: PlotRegion = rectangleRegion(300, 200);

function plantWith(id: string, spacing: Plant['spacing']): Plant {
  return validatePlant({
    id,
    commonName: id,
    scientificName: 'Testus fixturus',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing,
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

// 10 x 30 cm rows — matches `feedback.test.ts`'s onion figure.
const ONION = plantWith('onion', { row: { inRowCm: 10, betweenRowCm: 30 } });
const KALE = plantWith('kale', { row: { inRowCm: 45, betweenRowCm: 45 } });

function placed(id: string, plant: Plant, x: number, y: number): PlacedPlant {
  return { id, plant, x, y };
}

describe('deriveOvercrowdingPlacements', () => {
  it('produces nothing for an empty canvas', () => {
    expect(deriveOvercrowdingPlacements([], REGION)).toEqual([]);
  });

  it('groups instances of the same crop into one whole-plot CropPlacement', () => {
    const placements = [
      placed('a', ONION, 10, 10),
      placed('b', ONION, 50, 10),
      placed('c', ONION, 90, 10),
    ];

    const derived = deriveOvercrowdingPlacements(placements, REGION);

    expect(derived).toHaveLength(1);
    expect(derived[0].plant).toBe(ONION);
    expect(derived[0].count).toBe(3);
    // The whole plot, not a footprint around any one instance — this is the
    // "coarse" derivation `overcrowdingWarning` needs (see the module doc).
    expect(derived[0].region).toBe(REGION);
    // The first-placed instance's own id, not a synthesised group key.
    expect(derived[0].id).toBe('a');
  });

  it('keeps distinct crops as separate placements', () => {
    const derived = deriveOvercrowdingPlacements(
      [placed('a', ONION, 10, 10), placed('b', KALE, 50, 50)],
      REGION,
    );

    expect(derived.map((placement) => placement.plant.id)).toEqual(['onion', 'kale']);
    expect(derived.every((placement) => placement.count === 1)).toBe(true);
  });
});

describe('derivePerInstancePlacements', () => {
  it('produces nothing for an empty canvas', () => {
    expect(derivePerInstancePlacements([])).toEqual([]);
  });

  it('gives every instance its own CropPlacement, count 1, keeping its real placement id', () => {
    const placements = [placed('a', ONION, 10, 10), placed('b', ONION, 50, 10)];

    const derived = derivePerInstancePlacements(placements);

    expect(derived).toHaveLength(2);
    expect(derived.map((placement) => placement.id)).toEqual(['a', 'b']);
    expect(derived.every((placement) => placement.count === 1)).toBe(true);
  });

  it('sizes the footprint from the plant’s own spacing, larger crops getting a larger footprint', () => {
    const [onionPlacement] = derivePerInstancePlacements([placed('a', ONION, 100, 100)]);
    const [kalePlacement] = derivePerInstancePlacements([placed('b', KALE, 100, 100)]);

    const onionSide = onionPlacement.region.vertices[1].x - onionPlacement.region.vertices[0].x;
    const kaleSide = kalePlacement.region.vertices[1].x - kalePlacement.region.vertices[0].x;

    // Onion: max(10, 30) = 30 cm side. Kale: max(45, 45) = 45 cm side.
    expect(onionSide).toBeCloseTo(30);
    expect(kaleSide).toBeCloseTo(45);
    expect(kaleSide).toBeGreaterThan(onionSide);
  });

  it('centres the footprint on the instance’s own position', () => {
    const [placement] = derivePerInstancePlacements([placed('a', ONION, 100, 100)]);

    const xs = placement.region.vertices.map((vertex) => vertex.x);
    const ys = placement.region.vertices.map((vertex) => vertex.y);
    const centreX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centreY = (Math.min(...ys) + Math.max(...ys)) / 2;

    expect(centreX).toBeCloseTo(100);
    expect(centreY).toBeCloseTo(100);
  });
});
