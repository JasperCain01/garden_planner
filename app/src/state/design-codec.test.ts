import { describe, expect, it } from 'vitest';
import { createUserPlant, rectangleRegion, type Plant } from '@garden-planner/engine';
import { SHIPPED_PLANTS } from '../dataset/shipped-plants.ts';
import { DESIGNS_STORAGE_VERSION, parseLibrary, toStoredDesign } from './design-codec.ts';
import type { Design } from './design.ts';

/**
 * The storage boundary (UI redesign Phase 5, ADR 0034 §1–§2, §4).
 *
 * Two things are being pinned here, and they are different in kind. One is the
 * **round trip** — a design written down and read back is the same design —
 * which is half of the phase's acceptance criterion and is measured properly in
 * a real browser by `e2e/persistence.spec.ts`. The other is what happens to
 * everything that is *not* a clean round trip, which no browser test can
 * enumerate: truncated JSON, an outline that crosses itself, a crop the dataset
 * no longer has. Restored state is untrusted input and this is where that is
 * proved.
 */

const SHIPPED_BY_ID = new Map(SHIPPED_PLANTS.map((plant) => [plant.id, plant]));
const ONION = SHIPPED_BY_ID.get('onion') as Plant;
const CARROT = SHIPPED_BY_ID.get('carrot') as Plant;

const META = { id: 'design-1', name: 'My garden', updatedAt: '2026-08-04T10:00:00.000Z' };

function libraryJson(...designs: unknown[]): string {
  return JSON.stringify({ version: DESIGNS_STORAGE_VERSION, activeId: 'design-1', designs });
}

function designWith(placements: Design['placements']): Design {
  return { region: rectangleRegion(300, 200), conditionsInput: { light: 'full-sun' }, placements };
}

describe('serialising a design', () => {
  it('stores a plant reference, not the plant — the decision the storage budget turns on', () => {
    const stored = toStoredDesign(META, designWith([{ id: 'p1', plant: ONION, x: 10, y: 20 }]));

    expect(stored.placements).toEqual([{ id: 'p1', plantId: 'onion', x: 10, y: 20 }]);
    // The measurement behind that: onion's own record is two orders of
    // magnitude larger than the reference to it.
    expect(JSON.stringify(ONION).length).toBeGreaterThan(3_000);
    expect(JSON.stringify(stored.placements[0]).length).toBeLessThan(70);
  });

  it('carries the user crops its placements reference, once each, and no others', () => {
    const mine = createUserPlant({
      commonName: 'Aunt Ada’s bean',
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 15, betweenRowCm: 45 } },
    });
    const stored = toStoredDesign(
      META,
      designWith([
        { id: 'p1', plant: mine, x: 10, y: 10 },
        { id: 'p2', plant: mine, x: 50, y: 10 },
        { id: 'p3', plant: ONION, x: 90, y: 10 },
      ]),
    );

    expect(stored.customPlants.map((plant) => plant.id)).toEqual([mine.id]);
  });
});

describe('reading a library back', () => {
  it('round-trips a design through storage', () => {
    const stored = toStoredDesign(
      META,
      designWith([
        { id: 'p1', plant: ONION, x: 10, y: 20 },
        { id: 'p2', plant: CARROT, x: 90, y: 40 },
      ]),
    );

    const parsed = parseLibrary(libraryJson(stored), SHIPPED_BY_ID);

    expect(parsed.problems).toEqual([]);
    expect(parsed.activeId).toBe('design-1');
    expect(parsed.designs[0].design.placements).toEqual([
      { id: 'p1', plant: ONION, x: 10, y: 20 },
      { id: 'p2', plant: CARROT, x: 90, y: 40 },
    ]);
    expect(parsed.designs[0].design.region).toEqual(rectangleRegion(300, 200));
  });

  it('restores a user crop from the design that carried it, in a session that has none', () => {
    const mine = createUserPlant({
      commonName: 'Aunt Ada’s bean',
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 15, betweenRowCm: 45 } },
    });
    const stored = toStoredDesign(META, designWith([{ id: 'p1', plant: mine, x: 10, y: 10 }]));

    // `SHIPPED_BY_ID` deliberately does not contain it: this is the case the
    // session-scoped user-crops store cannot answer on its own.
    const parsed = parseLibrary(libraryJson(stored), SHIPPED_BY_ID);

    expect(parsed.problems).toEqual([]);
    expect(parsed.designs[0].design.placements[0].plant.commonName).toBe('Aunt Ada’s bean');
    expect(parsed.designs[0].customPlants).toHaveLength(1);
  });

  it('drops a placement whose crop the dataset no longer has, and says which', () => {
    // ADR 0025 deleted 24 crops from the shipped dataset on purpose; this is
    // that, from the point of view of a design saved before the deploy.
    const stored = toStoredDesign(META, designWith([{ id: 'p1', plant: ONION, x: 10, y: 20 }]));
    const withGhost = {
      ...stored,
      placements: [...stored.placements, { id: 'p2', plantId: 'sea-buckthorn', x: 40, y: 40 }],
    };

    const parsed = parseLibrary(libraryJson(withGhost), SHIPPED_BY_ID);

    expect(parsed.designs[0].design.placements.map((p) => p.id)).toEqual(['p1']);
    expect(parsed.designs[0].missingPlantIds).toEqual(['sea-buckthorn']);
    expect(parsed.problems[0]).toContain('sea-buckthorn');
  });

  it('refuses an outline that is not a valid polygon, keeping the other designs', () => {
    const good = toStoredDesign(META, designWith([]));
    const bad = {
      ...toStoredDesign({ ...META, id: 'design-2' }, designWith([])),
      // Two corners is a line, not a plot — `PlotRegionSchema`'s own rule.
      region: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      },
    };

    const parsed = parseLibrary(libraryJson(good, bad), SHIPPED_BY_ID);

    expect(parsed.designs.map((design) => design.id)).toEqual(['design-1']);
    expect(parsed.problems).toHaveLength(1);
  });

  it('refuses conditions the engine would not accept', () => {
    const bad = {
      ...toStoredDesign(META, designWith([])),
      conditionsInput: { light: 'moonlight' },
    };

    expect(parseLibrary(libraryJson(bad), SHIPPED_BY_ID).designs).toEqual([]);
  });

  it('survives every shape of rubbish, rather than taking the app down on load', () => {
    for (const raw of [null, '', 'not json at all', '[]', '{"version":99,"designs":[]}']) {
      const parsed = parseLibrary(raw, SHIPPED_BY_ID);
      expect(parsed.designs).toEqual([]);
      expect(parsed.activeId).toBeNull();
    }
  });

  it('falls back to the first design when the stored active id names nothing', () => {
    const stored = toStoredDesign(META, designWith([]));
    const raw = JSON.stringify({
      version: DESIGNS_STORAGE_VERSION,
      activeId: 'design-that-was-deleted',
      designs: [stored],
    });

    expect(parseLibrary(raw, SHIPPED_BY_ID).activeId).toBe('design-1');
  });
});
