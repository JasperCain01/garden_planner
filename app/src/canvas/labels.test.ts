import { describe, expect, it } from 'vitest';
import {
  rectangleRegion,
  validatePlant,
  type Plant,
  type PlotRegion,
} from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import { NAME_LABEL_MIN_PX_PER_CM } from './footprint.ts';
import { CANVAS_PADDING_CM } from './geometry.ts';
import { labelBox, visibleLabels } from './labels.ts';

const REGION: PlotRegion = rectangleRegion(300, 200);
const PX_PER_CM = 2; // well above NAME_LABEL_MIN_PX_PER_CM

function plantWith(commonName: string): Plant {
  return validatePlant({
    id: commonName.toLowerCase().replace(/\s+/g, '-'),
    commonName,
    scientificName: 'Fixtura test',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 15, betweenRowCm: 15 } },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

function placementAt(id: string, x: number, y: number, commonName: string): PlacedPlant {
  return { id, x, y, plant: plantWith(commonName) };
}

describe('visibleLabels', () => {
  it('shows both labels when placements are far enough apart not to collide', () => {
    const placements = [placementAt('a', 40, 100, 'Onion'), placementAt('b', 260, 100, 'Kale')];
    const shown = visibleLabels(placements, REGION, PX_PER_CM, null);
    expect(shown).toEqual(new Set(['a', 'b']));
  });

  it('hides the later of two overlapping labels', () => {
    // Two names long enough, and close enough together, that their estimated
    // boxes are guaranteed to intersect — the review's repro ("Brussels
    // sprouts" and "Broad bean" ran together).
    const placements = [
      placementAt('a', 150, 100, 'Brussels sprouts'),
      placementAt('b', 155, 100, 'Broad bean'),
    ];
    const shown = visibleLabels(placements, REGION, PX_PER_CM, null);
    expect(shown.size).toBe(1);
    expect(shown.has('a')).toBe(true);
  });

  it('always keeps the selected placement’s label, even when it would otherwise lose the walk', () => {
    const placements = [
      placementAt('a', 150, 100, 'Brussels sprouts'),
      placementAt('b', 155, 100, 'Broad bean'),
    ];
    // "b" comes second in placement order and would normally lose to "a" —
    // selecting it must flip that.
    const shown = visibleLabels(placements, REGION, PX_PER_CM, 'b');
    expect(shown.has('b')).toBe(true);
    expect(shown.has('a')).toBe(false);
  });

  it('shows every label when none collide, regardless of count', () => {
    const placements = [
      placementAt('a', 20, 20, 'Onion'),
      placementAt('b', 280, 20, 'Kale'),
      placementAt('c', 20, 180, 'Leek'),
      placementAt('d', 280, 180, 'Chard'),
    ];
    const shown = visibleLabels(placements, REGION, PX_PER_CM, null);
    expect(shown).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('is deterministic across repeated calls with the same inputs', () => {
    const placements = [
      placementAt('a', 150, 100, 'Brussels sprouts'),
      placementAt('b', 155, 100, 'Broad bean'),
      placementAt('c', 152, 105, 'Swede'),
      placementAt('d', 148, 95, 'Onion'),
    ];
    const first = visibleLabels(placements, REGION, PX_PER_CM, null);
    const second = visibleLabels(placements, REGION, PX_PER_CM, null);
    expect([...second].sort()).toEqual([...first].sort());
  });

  it('hides everything below the zoomed-out threshold, matching PlotCanvas’s old behaviour', () => {
    const placements = [placementAt('a', 40, 100, 'Onion')];
    const shown = visibleLabels(placements, REGION, NAME_LABEL_MIN_PX_PER_CM - 0.01, null);
    expect(shown.size).toBe(0);
  });

  it('returns nothing for an empty plot', () => {
    expect(visibleLabels([], REGION, PX_PER_CM, null)).toEqual(new Set());
  });
});

describe('labelBox', () => {
  it('centres the box horizontally under the placement and offsets it below the canopy', () => {
    const placement = placementAt('a', 150, 100, 'Onion');
    const box = labelBox(placement, REGION, PX_PER_CM);
    // The label's centre-x should land on the placement's own pixel x —
    // `cmToPx` includes `CANVAS_PADDING_CM`, so the region's own bounding box
    // isn't the whole story (`geometry.ts`).
    expect(box.x + box.width / 2).toBeCloseTo((150 + CANVAS_PADDING_CM) * PX_PER_CM, 5);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  it('gives a longer name a wider box than a shorter one', () => {
    const short = labelBox(placementAt('a', 150, 100, 'Kale'), REGION, PX_PER_CM);
    const long = labelBox(placementAt('b', 150, 100, 'Brussels sprouts'), REGION, PX_PER_CM);
    expect(long.width).toBeGreaterThan(short.width);
  });
});
