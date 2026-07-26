import { describe, it, expect } from 'vitest';
import type { Plant, Spacing } from '../schema/plant.ts';
import { validatePlant } from '../schema/plant.ts';
import { lShapeRegion, rectangleRegion, validatePlotRegion } from './region';
import { fitPlant, fitSpacing } from './fit';

/**
 * The stage's **golden worked examples**: scenarios a gardener would recognise,
 * with the arithmetic done in the comments so the model is documented rather
 * than merely asserted (the precedent `suitability/score.test.ts` sets).
 *
 * Spacings used below, all real figures from `data/plants.json`:
 *   onion   10 × 30 cm rows,  9 per 30 cm square
 *   tomato  45 × 60 cm rows,  1 per square
 *   kale    45 × 45 cm rows,  no intensive figure (like 153 of the 162 records)
 */

const ONION_SPACING: Spacing = {
  row: { inRowCm: 10, betweenRowCm: 30 },
  intensive: { plantsPerSquare: 9 },
};

/** A crop with row spacing only — the shape 153 of the 162 shipped records have. */
const KALE_SPACING: Spacing = { row: { inRowCm: 45, betweenRowCm: 45 } };

/** Build a `Plant` around a spacing block, so `fitPlant` has something real to chew on. */
function plantWith(id: string, commonName: string, spacing: Spacing): Plant {
  return validatePlant({
    id,
    commonName,
    scientificName: 'Allium cepa',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing,
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

describe('the headline question: how many onions can I fit?', () => {
  it('counts a 2 m × 1 m bed of onions in rows', () => {
    // 200 × 100 cm at 10 (in-row) × 30 (between rows):
    //   columns = floor(200 / 10) = 20
    //   rows    = floor(100 / 30) = 3      (the spare 10 cm holds no row)
    //   → 60 plants, at 300 cm² each = 30 per m² over a 2 m² bed.
    const result = fitPlant(plantWith('onion', 'Onion', ONION_SPACING), rectangleRegion(200, 100));
    expect(result.count).toBe(60);
    expect(result.plantId).toBe('onion');
    expect(result.method).toBe('row');
    expect(result.spacingSource).toBe('recorded');
    expect(result.packing).toBe('square');
    expect(result.grid).toEqual({
      orientation: 'horizontal',
      inRowCm: 10,
      betweenRowCm: 30,
      rowPitchCm: 30,
      rows: 3,
      areaPerPlantCm2: 300,
    });
    expect(result.regionAreaCm2).toBe(20_000);
    expect(result.regionAreaSquareMetres).toBe(2);
    expect(result.densityPerSquareMetre).toBe(30);
    expect(result.summary).toBe('Onion — 60 plants: 3 rows of 20 at 10 × 30 cm, square packing.');
  });

  it('counts the same bed as an intensive planting', () => {
    // 9 onions to a 30 cm square is one every 10 cm, in both directions:
    //   20 columns × 10 rows = 200 plants, i.e. 100 per m² — the square-foot
    //   figure, and more than three times the row planting.
    const result = fitPlant(plantWith('onion', 'Onion', ONION_SPACING), rectangleRegion(200, 100), {
      method: 'intensive',
    });
    expect(result.count).toBe(200);
    expect(result.method).toBe('intensive');
    expect(result.spacingSource).toBe('recorded');
    expect(result.grid).toMatchObject({ inRowCm: 10, betweenRowCm: 10, rows: 10 });
    expect(result.densityPerSquareMetre).toBe(100);
    expect(result.summary).toBe('Onion — 200 plants: 10 rows of 20 at 10 × 10 cm, square packing.');
  });

  it('returns a position for every plant, in row order', () => {
    // Stage 3.4 draws these; a count without them would force the canvas to
    // invent a layout that disagrees with the number printed beside it.
    const result = fitSpacing(ONION_SPACING, rectangleRegion(200, 100));
    expect(result.positions).toHaveLength(result.count);
    expect(result.positions[0]).toEqual({ x: 5, y: 15, row: 0 });
    expect(result.positions.at(-1)).toEqual({ x: 195, y: 75, row: 2 });
    expect(new Set(result.positions.map((position) => position.row))).toEqual(new Set([0, 1, 2]));
  });

  it('omits the crop name when called with a bare spacing block', () => {
    const result = fitSpacing(ONION_SPACING, rectangleRegion(200, 100));
    expect(result.plantId).toBeNull();
    expect(result.summary).toBe('60 plants: 3 rows of 20 at 10 × 30 cm, square packing.');
  });
});

describe('shape, not just area', () => {
  it('counts strictly fewer plants in an L-shape than in its bounding box', () => {
    // The test that proves the calculator is shape-aware. Both plots have the
    // same 3 m × 3 m bounding box; the L is missing a 1.5 m square of it.
    const bounding = rectangleRegion(300, 300);
    const lShape = lShapeRegion({
      widthCm: 300,
      heightCm: 300,
      notchWidthCm: 150,
      notchHeightCm: 150,
    });
    const inBox = fitSpacing(ONION_SPACING, bounding);
    const inL = fitSpacing(ONION_SPACING, lShape);
    expect(inL.count).toBeLessThan(inBox.count);
    // Three quarters of the ground, and — because this notch falls on cell
    // boundaries — exactly three quarters of the plants.
    expect(inL.count).toBe(225);
    expect(inBox.count).toBe(300);
  });

  it('says "N rows" rather than "N rows of M" when the rows are uneven', () => {
    const lShape = lShapeRegion({
      widthCm: 300,
      heightCm: 300,
      notchWidthCm: 150,
      notchHeightCm: 150,
    });
    expect(fitSpacing(ONION_SPACING, lShape).summary).toBe(
      '225 plants: 10 rows at 10 × 30 cm, square packing.',
    );
  });
});

describe('the presets are the same path as a hand-drawn outline', () => {
  it('gives identical counts and positions for a preset and an equivalent polygon', () => {
    const preset = rectangleRegion(240, 180);
    const handBuilt = validatePlotRegion({
      vertices: [
        { x: 0, y: 0 },
        { x: 240, y: 0 },
        { x: 240, y: 180 },
        { x: 0, y: 180 },
      ],
    });
    const fromPreset = fitSpacing(ONION_SPACING, preset);
    const fromHand = fitSpacing(ONION_SPACING, handBuilt);
    expect(fromHand.count).toBe(fromPreset.count);
    expect(fromHand.positions).toEqual(fromPreset.positions);
    expect(fromHand.summary).toBe(fromPreset.summary);
  });

  it('does not care which way round the outline was drawn', () => {
    const anticlockwise = rectangleRegion(240, 180);
    const clockwise = validatePlotRegion({ vertices: [...anticlockwise.vertices].reverse() });
    // …nor which corner the list starts from.
    const rotated = validatePlotRegion({
      vertices: [...anticlockwise.vertices.slice(2), ...anticlockwise.vertices.slice(0, 2)],
    });
    const expected = fitSpacing(ONION_SPACING, anticlockwise).count;
    expect(fitSpacing(ONION_SPACING, clockwise).count).toBe(expected);
    expect(fitSpacing(ONION_SPACING, rotated).count).toBe(expected);
  });
});

describe('choosing a growing method', () => {
  const onion = plantWith('onion', 'Onion', ONION_SPACING);
  const kale = plantWith('kale', 'Kale', KALE_SPACING);
  const packetCrop = plantWith('user-cress', 'Cress', { intensive: { perSquareMetre: 100 } });
  const bed = rectangleRegion(200, 100);

  it('follows the crop by default: rows when the crop has them', () => {
    // `auto` must not silently switch the user's growing method just because a
    // crop happens to carry a square-foot figure.
    expect(fitPlant(onion, bed).method).toBe('row');
    expect(fitPlant(onion, bed).methodRequested).toBe('auto');
    expect(fitPlant(kale, bed).method).toBe('row');
  });

  it('falls back to intensive when rows are all the crop has… in reverse', () => {
    // A user-defined crop off a seed packet may quote only a density (ADR 0011).
    const result = fitPlant(packetCrop, bed);
    expect(result.method).toBe('intensive');
    expect(result.spacingSource).toBe('recorded');
    // 100 per m² is one every 10 cm → 20 × 10 = 200 plants.
    expect(result.count).toBe(200);
  });

  it('derives an intensive figure from row spacing, conservatively, and says so', () => {
    // Kale has no intensive block — like 153 of the 162 shipped records. Its
    // 45 × 45 cm rectangle re-laid as an equal-area square is √(45 × 45) = 45 cm,
    // so 4 columns × 2 rows = 8 plants: the same ground per plant, minus the
    // paths. A real square-foot figure would be tighter, and the summary
    // admits it rather than pretending the derived number is authoritative.
    const result = fitPlant(kale, bed, { method: 'intensive' });
    expect(result.method).toBe('intensive');
    expect(result.spacingSource).toBe('derived-from-row');
    expect(result.grid).toMatchObject({ inRowCm: 45, betweenRowCm: 45 });
    expect(result.count).toBe(8);
    expect(result.summary).toContain('No intensive spacing is recorded for this crop');
    expect(result.summary).toContain('a real square-foot figure would usually be tighter');
  });

  it('derives row spacing from a density when that is all there is', () => {
    const result = fitPlant(packetCrop, bed, { method: 'row' });
    expect(result.method).toBe('row');
    expect(result.spacingSource).toBe('derived-from-intensive');
    expect(result.grid).toMatchObject({ inRowCm: 10, betweenRowCm: 10 });
    expect(result.summary).toContain('No row spacing is recorded for this crop');
  });

  it('prefers a recorded per-m² density over a rounded plants-per-square', () => {
    // `plantsPerSquare` has already been rounded to whole plants in a 30 cm
    // cell, so the direct figure wins when a record carries both.
    const both = fitSpacing(
      { intensive: { perSquareMetre: 25, plantsPerSquare: 4 } },
      rectangleRegion(100, 100),
      { method: 'intensive' },
    );
    // 25 per m² → one every 20 cm → 5 × 5 = 25. (4 per square would be 15 cm.)
    expect(both.grid.inRowCm).toBe(20);
    expect(both.count).toBe(25);
  });

  it('reports what was asked for as well as what was used', () => {
    const result = fitPlant(kale, bed, { method: 'intensive' });
    expect(result.methodRequested).toBe('intensive');
    expect(result.method).toBe('intensive');
    expect(result.spacingSource).not.toBe('recorded');
  });
});

describe('packing and orientation options', () => {
  it('reports the packing and the pitch it actually used', () => {
    const result = fitSpacing(ONION_SPACING, rectangleRegion(300, 300), {
      method: 'intensive',
      packing: 'offset',
    });
    expect(result.packing).toBe('offset');
    // 10 cm spacing, hexagonal pitch (√3/2) × 10 = 8.66 cm.
    expect(result.grid.betweenRowCm).toBe(10);
    expect(result.grid.rowPitchCm).toBe(8.66);
    expect(result.grid.areaPerPlantCm2).toBe(86.6);
    expect(result.count).toBe(1003);
    expect(result.summary).toContain('offset packing');
  });

  it('honours an explicit orientation, and reports the one `best` chose', () => {
    const plot = lShapeRegion({
      widthCm: 300,
      heightCm: 240,
      notchWidthCm: 100,
      notchHeightCm: 90,
    });
    const horizontal = fitSpacing(KALE_SPACING, plot, { orientation: 'horizontal' });
    const vertical = fitSpacing(KALE_SPACING, plot, { orientation: 'vertical' });
    const best = fitSpacing(KALE_SPACING, plot);
    expect(horizontal.grid.orientation).toBe('horizontal');
    expect(vertical.grid.orientation).toBe('vertical');
    expect(best.count).toBe(Math.max(horizontal.count, vertical.count));
  });

  it('keeps a margin clear when asked', () => {
    const bed = rectangleRegion(100, 100);
    const flush = fitSpacing(ONION_SPACING, bed, { method: 'intensive' });
    const inset = fitSpacing(ONION_SPACING, bed, { method: 'intensive', edgeInsetCm: 10 });
    expect(flush.count).toBe(100);
    expect(inset.count).toBe(64);
  });

  it('rejects an unknown option rather than ignoring it', () => {
    expect(() =>
      fitSpacing(ONION_SPACING, rectangleRegion(100, 100), {
        // @ts-expect-error — the point of the test is the runtime guard.
        packing: 'hexagonal',
      }),
    ).toThrow();
    expect(() =>
      // @ts-expect-error — likewise for a stray key.
      fitSpacing(ONION_SPACING, rectangleRegion(100, 100), { rowSpacingCm: 30 }),
    ).toThrow();
  });

  it('rejects an invalid region at the entry point', () => {
    const folded = {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ],
    };
    expect(() => fitSpacing(ONION_SPACING, folded)).toThrow(/crosses itself/);
  });
});

describe('plots too small to plant', () => {
  it('reports nothing fitting, with an explanation rather than a bare 0', () => {
    // A 30 cm square cannot hold a 45 × 60 cm tomato.
    const tomato = plantWith('tomato', 'Tomato', { row: { inRowCm: 45, betweenRowCm: 60 } });
    const result = fitPlant(tomato, rectangleRegion(30, 30));
    expect(result.count).toBe(0);
    expect(result.positions).toEqual([]);
    expect(result.grid.rows).toBe(0);
    expect(result.densityPerSquareMetre).toBe(0);
    expect(result.summary).toBe(
      'Tomato — nothing fits: the plot has no room for even one plant at 45 × 60 cm.',
    );
  });

  it('handles a plot narrower than one plant in one direction only', () => {
    // 8 cm × 5 m: no orientation helps, because 8 cm is narrower than the
    // 10 cm cell whichever way the rows run.
    expect(fitSpacing(ONION_SPACING, rectangleRegion(8, 500), { method: 'intensive' }).count).toBe(
      0,
    );
    // 12 cm × 5 m does hold a single file of plants, laid the long way.
    const singleFile = fitSpacing(ONION_SPACING, rectangleRegion(12, 500), {
      method: 'intensive',
    });
    expect(singleFile.count).toBe(50);
    expect(singleFile.grid.orientation).toBe('vertical');
    expect(singleFile.summary).toBe('50 plants: 1 row at 10 × 10 cm, square packing.');
  });
});
