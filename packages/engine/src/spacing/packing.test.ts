import { describe, it, expect } from 'vitest';
import { lShapeRegion, rectangleRegion, validatePlotRegion } from './region';
import type { PackingRequest } from './packing';
import {
  RegionTooLargeError,
  layOutPlants,
  layOutPlantsBestOrientation,
  offsetRowPitchCm,
} from './packing';

/**
 * The packing routine, checked against hand-worked lattices. Every expected
 * number below is derived in its comment — that is the point of a golden case
 * (`suitability/score.test.ts` sets the same precedent).
 */

/** A request with the boring fields filled in, so each test states only what it varies. */
function request(overrides: Partial<PackingRequest> = {}): PackingRequest {
  return {
    inRowCm: 10,
    betweenRowCm: 10,
    packing: 'square',
    orientation: 'horizontal',
    edgeInsetCm: 0,
    ...overrides,
  };
}

describe('offsetRowPitchCm', () => {
  it('is the hexagonal √3/2 when the spacing is equal in both directions', () => {
    // The classic case: s = b = 10 cm → p = √(100 − 25) = √75 = 8.6603 cm,
    // which is (√3/2)·10. Rows 13.4% closer, so ~15% more plants in a big bed.
    expect(offsetRowPitchCm(10, 10)).toBeCloseTo((Math.sqrt(3) / 2) * 10, 12);
    expect(offsetRowPitchCm(10, 10)).toBeCloseTo(8.6603, 4);
  });

  it('buys almost nothing when the rows are already far apart', () => {
    // Tomatoes at 45 × 60 cm: p = √(3600 − 22.5²) = √3093.75 = 55.6215 cm.
    // A 7% gain, correctly reflecting that a half-step of 22.5 cm barely
    // matters against a 60 cm clearance.
    expect(offsetRowPitchCm(45, 60)).toBeCloseTo(55.6215, 4);
  });

  it('gives up when the half-step already exceeds the clearance', () => {
    // s/2 = 100 ≥ b = 30: staggering cannot pull the rows any closer, so the
    // pitch stays at the crop's between-row figure.
    expect(offsetRowPitchCm(200, 30)).toBe(30);
  });

  it('never drops below half the clearance, so two rows apart stays legal', () => {
    // s = 90, b = 50 → √(2500 − 2025) = 21.8 cm, but plants two rows apart sit
    // 2p apart with no stagger between them, so p is floored at b/2 = 25.
    expect(offsetRowPitchCm(90, 50)).toBe(25);
  });
});

describe('square packing on a rectangle', () => {
  it('is floor(width / inRow) × floor(height / pitch)', () => {
    // 200 × 100 cm bed at 10 (in-row) × 30 (between rows):
    //   columns = floor(200 / 10) = 20, rows = floor(100 / 30) = 3 → 60 plants.
    // The leftover 10 cm strip across the top holds no row: a plant that
    // half-fits doesn't.
    const layout = layOutPlants(
      rectangleRegion(200, 100),
      request({ inRowCm: 10, betweenRowCm: 30 }),
    );
    expect(layout.positions).toHaveLength(60);
    expect(layout.rows).toBe(3);
    expect(layout.rowPitchCm).toBe(30);
  });

  it('puts the first plant half a spacing in from the corner', () => {
    // Cells are anchored at the bounding box's minimum corner, so the first
    // cell spans [0, 10] × [0, 30] and its plant sits at its centre.
    const layout = layOutPlants(
      rectangleRegion(200, 100),
      request({ inRowCm: 10, betweenRowCm: 30 }),
    );
    expect(layout.positions[0]).toEqual({ x: 5, y: 15, row: 0 });
    expect(layout.positions[19]).toEqual({ x: 195, y: 15, row: 0 });
    expect(layout.positions[20]).toEqual({ x: 5, y: 45, row: 1 });
  });

  it('does not count a plant whose cell hangs over the edge', () => {
    // 106 cm at 10 cm spacing holds ten, not eleven: an eleventh plant's cell
    // would run from 100 to 110 and only 6 cm of that is bed.
    expect(layOutPlants(rectangleRegion(106, 10), request()).positions).toHaveLength(10);
    // …and 110 cm holds the eleventh, exactly.
    expect(layOutPlants(rectangleRegion(110, 10), request()).positions).toHaveLength(11);
  });

  it('counts an exact fit without losing the last column to float dust', () => {
    // 200 / 10 = 20 exactly. Written in floats this is the case that silently
    // returns 19 if the step count has no epsilon slack.
    expect(
      layOutPlants(rectangleRegion(200, 7.5), request({ betweenRowCm: 7.5 })).positions,
    ).toHaveLength(20);
  });

  it('is translation-invariant — the lattice follows the plot, not the origin', () => {
    const moved = validatePlotRegion({
      vertices: rectangleRegion(200, 100).vertices.map((vertex) => ({
        x: vertex.x - 1234.5,
        y: vertex.y + 987.25,
      })),
    });
    const here = layOutPlants(rectangleRegion(200, 100), request({ betweenRowCm: 30 }));
    const there = layOutPlants(moved, request({ betweenRowCm: 30 }));
    expect(there.positions).toHaveLength(here.positions.length);
  });

  it('finds nothing in a plot narrower than one plant', () => {
    // 8 cm of bed cannot hold a 10 cm cell, however long it is.
    const sliver = layOutPlants(rectangleRegion(8, 500), request());
    expect(sliver.positions).toEqual([]);
    expect(sliver.rows).toBe(0);
  });
});

describe('offset packing', () => {
  it('shifts alternate rows half a step and pulls the rows closer', () => {
    // 300 × 300 cm at 10 cm in both directions.
    //   square: 30 columns × 30 rows                                  =  900
    //   offset: pitch 8.6603 → floor(300 / 8.6603) = 34 rows.
    //           even rows (17 of them) hold floor(300 / 10)      = 30 → 510
    //           odd rows  (17 of them) hold floor(295 / 10)      = 29 → 493
    //                                                              = 1003
    const bed = rectangleRegion(300, 300);
    const square = layOutPlants(bed, request());
    const offset = layOutPlants(bed, request({ packing: 'offset' }));
    expect(square.positions).toHaveLength(900);
    expect(offset.positions).toHaveLength(1003);
    expect(offset.rows).toBe(34);
    expect(offset.positions[0]).toEqual({ x: 5, y: 4.330127018922194, row: 0 });
    // The half-step that defines the pattern: row 1 starts 5 cm along from row 0.
    expect(offset.positions[30]).toMatchObject({ x: 10, row: 1 });
  });

  it('approaches the textbook ~15% gain as the bed grows', () => {
    // The gain is asymptotic: the stagger costs half a column on every other
    // row, and edge losses are proportionally larger on a small bed.
    const gainAt = (side: number): number => {
      const bed = rectangleRegion(side, side);
      return (
        layOutPlants(bed, request({ packing: 'offset' })).positions.length /
        layOutPlants(bed, request()).positions.length
      );
    };
    expect(gainAt(100)).toBeCloseTo(1.05, 2);
    expect(gainAt(300)).toBeCloseTo(1.11, 2);
    expect(gainAt(2000)).toBeGreaterThan(1.14);
    expect(gainAt(2000)).toBeLessThan(2 / Math.sqrt(3));
  });

  it('can lose to square packing on a small bed, which is why it is opt-in', () => {
    // 200 × 100 at 10 × 30: the shortened pitch (29.58) still only fits three
    // rows, and the stagger costs the middle row a column. 59 < 60.
    const bed = rectangleRegion(200, 100);
    const spacing = { inRowCm: 10, betweenRowCm: 30 } as const;
    expect(layOutPlants(bed, request({ ...spacing, packing: 'offset' })).positions).toHaveLength(
      59,
    );
    expect(layOutPlants(bed, request({ ...spacing })).positions).toHaveLength(60);
  });
});

describe('shape awareness', () => {
  it('drops the cells that straddle a re-entrant corner', () => {
    // A 300 × 300 plot with a 150 × 150 bite is three quarters of its bounding
    // box, and at 10 × 30 cm the notch happens to fall on cell boundaries, so
    // the count is exactly three quarters too: 5 full rows of 30 below the
    // notch + 5 rows of 15 beside it = 225, against 300 for the bounding box.
    const plot = lShapeRegion({
      widthCm: 300,
      heightCm: 300,
      notchWidthCm: 150,
      notchHeightCm: 150,
    });
    const spacing = request({ inRowCm: 10, betweenRowCm: 30 });
    expect(layOutPlants(plot, spacing).positions).toHaveLength(225);
    expect(layOutPlants(rectangleRegion(300, 300), spacing).positions).toHaveLength(300);
  });

  it('loses part-cells to a notch that does not fall on the lattice', () => {
    // Now the bite is 140 × 140, so the cells straddling it are lost as well:
    // strictly fewer than the 225 the clean notch left, and strictly fewer than
    // area alone would suggest (area says 300 × (1 − 140²/300²) ≈ 235).
    const plot = lShapeRegion({
      widthCm: 300,
      heightCm: 300,
      notchWidthCm: 140,
      notchHeightCm: 140,
    });
    const count = layOutPlants(plot, request({ inRowCm: 10, betweenRowCm: 30 })).positions.length;
    expect(count).toBeGreaterThan(225);
    expect(count).toBeLessThan(235);
  });
});

describe('orientation', () => {
  it('gives genuinely different counts on an L-shape, and best picks the winner', () => {
    const plot = lShapeRegion({
      widthCm: 300,
      heightCm: 240,
      notchWidthCm: 100,
      notchHeightCm: 90,
    });
    const spacing = { inRowCm: 15, betweenRowCm: 45 } as const;
    const horizontal = layOutPlants(plot, request({ ...spacing, orientation: 'horizontal' }));
    const vertical = layOutPlants(plot, request({ ...spacing, orientation: 'vertical' }));
    const best = layOutPlantsBestOrientation(plot, { ...request(spacing) });
    expect(horizontal.positions.length).not.toBe(vertical.positions.length);
    expect(best.positions).toHaveLength(
      Math.max(horizontal.positions.length, vertical.positions.length),
    );
    expect(best.orientation).toBe(
      horizontal.positions.length >= vertical.positions.length ? 'horizontal' : 'vertical',
    );
  });

  it('breaks a tie towards horizontal, so the answer is deterministic', () => {
    const best = layOutPlantsBestOrientation(rectangleRegion(100, 100), { ...request() });
    expect(best.orientation).toBe('horizontal');
  });
});

describe('edgeInsetCm', () => {
  it('erodes the usable plot on every side', () => {
    // 100 × 100 at 10 cm holds 100 plants against the boundary. With a 10 cm
    // margin each plant's cell must clear the outline by 10 cm, which rules out
    // the outermost column and row on each side: 8 × 8 = 64.
    const bed = rectangleRegion(100, 100);
    expect(layOutPlants(bed, request()).positions).toHaveLength(100);
    expect(layOutPlants(bed, request({ edgeInsetCm: 10 })).positions).toHaveLength(64);
  });

  it('can empty a small plot entirely', () => {
    expect(layOutPlants(rectangleRegion(40, 40), request({ edgeInsetCm: 20 })).positions).toEqual(
      [],
    );
  });
});

describe('the candidate-count guard', () => {
  it('refuses a plot that is implausibly large for the spacing', () => {
    // 1 km square at 10 cm spacing: 100 million candidate cells. Almost always
    // metres typed as centimetres, and worth a message rather than a hung tab.
    expect(() => layOutPlants(rectangleRegion(100_000, 100_000), request())).toThrow(
      RegionTooLargeError,
    );
    expect(() => layOutPlants(rectangleRegion(100_000, 100_000), request())).toThrow(
      /check the plot's dimensions are in centimetres/,
    );
  });

  it('allows a large but realistic allotment', () => {
    // 20 m × 12 m at radish spacing (3 × 15 cm) — 240 m², a big allotment plot:
    // floor(2000 / 3) = 666 columns × floor(1200 / 15) = 80 rows = 53,280.
    expect(
      layOutPlants(rectangleRegion(2000, 1200), request({ inRowCm: 3, betweenRowCm: 15 }))
        .positions,
    ).toHaveLength(53_280);
  });
});
