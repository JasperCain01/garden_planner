import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant } from '../schema/plant.ts';
import { rectangleRegion } from './region';
import { intensiveSquareSideCm, resolveLatticeSpacing } from './method';
import { fitPlant } from './fit';

/**
 * Counting the **real shipped dataset**, not hand-built fixtures.
 *
 * `suitability/dataset.test.ts` sets the precedent, and the argument is the
 * same: hand-built fixtures prove the arithmetic, but only the real records
 * prove the model fits the data that actually ships. The coverage assertions
 * here are a **tripwire** as much as a test. Stage 1.7's two curated records
 * (`broad-bean`, `jerusalem-artichoke`) are both row-only — like the great
 * majority of the dataset — so they only moved the total plant count, not the
 * intensive-coverage counts; a future curated record with a real intensive
 * figure would trip those too, and that is intended.
 */

const DATASET_PATH = fileURLToPath(new URL('../../../../data/plants.json', import.meta.url));

interface DatasetArtifact {
  readonly plantCount: number;
  readonly plants: readonly unknown[];
}

/** Load and validate every shipped record, so these tests count real `Plant`s. */
function loadShippedPlants(): Plant[] {
  const artifact = JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as DatasetArtifact;
  return artifact.plants.map((record) => validatePlant(record));
}

const PLANTS = loadShippedPlants();
const WITH_INTENSIVE = PLANTS.filter((plant) => plant.spacing.intensive !== undefined);

/** One square metre — the bed every figure in this file is counted into. */
const ONE_SQUARE_METRE = rectangleRegion(100, 100);

describe('the shipped spacing data', () => {
  it('is the dataset these expectations were written against', () => {
    expect(PLANTS).toHaveLength(162);
    // Every record has *some* spacing: ADR 0004 §2 makes that a schema rule, so
    // the calculator never has a "this crop has no spacing" case to handle.
    expect(PLANTS.filter((plant) => plant.spacing.row !== undefined)).toHaveLength(162);
    // Stage 1.7's two curated records (`broad-bean`, `jerusalem-artichoke`) are
    // both row-only, same as the great majority of the dataset, so this stays 9.
    expect(WITH_INTENSIVE).toHaveLength(9);
    // No record is intensive-only — that shape is reachable only through a
    // user-defined crop (ADR 0011), which is why `derived-from-intensive` has
    // no shipped record to test against and is covered by a fixture instead.
    expect(PLANTS.filter((plant) => plant.spacing.row === undefined)).toHaveLength(0);
  });

  it('quotes every intensive figure as plants-per-square, never per-m²', () => {
    // Which is why `intensiveDensityPerSquareMetre`'s conversion, not its
    // pass-through, is the branch that runs in practice.
    for (const plant of WITH_INTENSIVE) {
      expect(plant.spacing.intensive?.plantsPerSquare).toBeGreaterThan(0);
      expect(plant.spacing.intensive?.perSquareMetre).toBeUndefined();
    }
  });

  it('is denser intensive than in rows for eight of the nine — radish is not', () => {
    // The horticultural claim `DESIGN.md` §2 makes about onions (a bed trades
    // the paths for plants) holds for every crop that quotes both figures
    // except radish, whose recorded row spacing of 3 × 15 cm is *already*
    // tighter than 16 to a square: 222 per m² against 178.
    //
    // Worth pinning, because it is the counter-example to the tempting
    // assumption that intensive always beats rows — and part of why the
    // fallback in `method.ts` derives a *conservative* density rather than
    // inventing a tighter one.
    for (const plant of WITH_INTENSIVE) {
      const rows = fitPlant(plant, ONE_SQUARE_METRE, { method: 'row' }).count;
      const intensive = fitPlant(plant, ONE_SQUARE_METRE, { method: 'intensive' }).count;
      if (plant.id === 'radish') {
        expect(intensive).toBeLessThan(rows);
      } else {
        expect(intensive).toBeGreaterThan(rows);
      }
    }
  });
});

describe('the nine crops with a real intensive figure', () => {
  /**
   * Hand-worked, one row per record. A crop quoted at *n* plants per 30 cm
   * square sits on a square lattice of side `30 / √n`, and a 1 m² bed holds
   * `floor(100 / side)²` of them.
   *
   *   9  per square → 30/3     = 10    cm → 10 × 10 = 100
   *   16 per square → 30/4     =  7.5  cm → 13 × 13 = 169
   *   4  per square → 30/2     = 15    cm →  6 ×  6 =  36
   *   8  per square → 30/√8    = 10.61 cm →  9 ×  9 =  81
   *   1  per square → 30/1     = 30    cm →  3 ×  3 =   9
   *
   * The counts fall short of `plantsPerSquare × 11.11` wherever the side does
   * not divide the metre — 169 against a nominal 177.8 for radish — because the
   * part-cells at the far edge hold nothing.
   */
  const EXPECTED: ReadonlyArray<readonly [id: string, sideCm: number, inOneSquareMetre: number]> = [
    ['beet', 10, 100],
    ['carrot', 7.5, 169],
    ['garlic', 10, 100],
    ['green-bean', 10, 100],
    ['lettuce', 15, 36],
    ['onion', 10, 100],
    ['pea', 10.6066, 81],
    ['radish', 7.5, 169],
    ['tomato', 30, 9],
  ];

  it('covers exactly the crops the Stage 1.3 curation hand-verified', () => {
    expect(WITH_INTENSIVE.map((plant) => plant.id).sort()).toEqual(
      EXPECTED.map(([id]) => id)
        .slice()
        .sort(),
    );
  });

  for (const [id, sideCm, inOneSquareMetre] of EXPECTED) {
    it(`plants ${id} at ${sideCm} cm and fits ${inOneSquareMetre} in a square metre`, () => {
      const plant = WITH_INTENSIVE.find((candidate) => candidate.id === id);
      expect(plant).toBeDefined();
      if (plant === undefined) return;

      const intensive = plant.spacing.intensive;
      expect(intensive).toBeDefined();
      if (intensive === undefined) return;
      expect(intensiveSquareSideCm(intensive)).toBeCloseTo(sideCm, 4);

      const result = fitPlant(plant, ONE_SQUARE_METRE, { method: 'intensive' });
      expect(result.count).toBe(inOneSquareMetre);
      expect(result.method).toBe('intensive');
      expect(result.spacingSource).toBe('recorded');
      expect(result.densityPerSquareMetre).toBe(inOneSquareMetre);
    });
  }

  it('uses the recorded row spacing by default, not the intensive figure', () => {
    // `auto` must follow the gardener's method, not the crop's richest field.
    const onion = WITH_INTENSIVE.find((plant) => plant.id === 'onion');
    expect(onion).toBeDefined();
    if (onion === undefined) return;
    const result = fitPlant(onion, ONE_SQUARE_METRE);
    expect(result.method).toBe('row');
    // 10 × 30 cm rows: 10 columns × 3 rows = 30 onions in a square metre,
    // against 100 in an intensive bed.
    expect(result.count).toBe(30);
  });
});

describe('the other 153 records', () => {
  it('all fall back to a derived square when asked for an intensive count', () => {
    const rowOnly = PLANTS.filter((plant) => plant.spacing.intensive === undefined);
    expect(rowOnly).toHaveLength(153);
    for (const plant of rowOnly) {
      const lattice = resolveLatticeSpacing(plant.spacing, 'intensive');
      expect(lattice.method).toBe('intensive');
      expect(lattice.source).toBe('derived-from-row');
      // The derived square keeps the ground per plant exactly as recorded.
      const row = plant.spacing.row;
      expect(row).toBeDefined();
      if (row === undefined) continue;
      expect(lattice.inRowCm * lattice.betweenRowCm).toBeCloseTo(row.inRowCm * row.betweenRowCm, 6);
    }
  });
});

describe('every shipped record', () => {
  it('is counted without throwing, in both methods and both packings', () => {
    const bed = rectangleRegion(400, 250); // 10 m², a generous allotment bed
    for (const plant of PLANTS) {
      for (const method of ['auto', 'row', 'intensive'] as const) {
        for (const packing of ['square', 'offset'] as const) {
          const result = fitPlant(plant, bed, { method, packing });
          expect(Number.isInteger(result.count)).toBe(true);
          expect(result.count).toBeGreaterThanOrEqual(0);
          expect(result.positions).toHaveLength(result.count);
          expect(result.summary.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('names the crop in its summary, so the UI can print it unedited', () => {
    const bed = rectangleRegion(400, 250);
    for (const plant of PLANTS.slice(0, 20)) {
      expect(fitPlant(plant, bed).summary.startsWith(`${plant.commonName} — `)).toBe(true);
    }
  });
});
