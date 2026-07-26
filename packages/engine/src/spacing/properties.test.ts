import { describe, it, expect } from 'vitest';
import type { Spacing } from '../schema/plant.ts';
import type { Vertex } from './region';
import { circleRegion, lShapeRegion, rectangleRegion, validatePlotRegion } from './region';
import { regionAreaCm2 } from './region';
import { offsetRowPitchCm } from './packing';
import { resolveLatticeSpacing } from './method';
import { fitSpacing } from './fit';
import type { PackingPattern } from './model';
import { PACKING_PATTERNS } from './model';

/**
 * The Workplan's **property-based tests**: statements that must hold for every
 * input, not just the hand-worked ones.
 *
 * Two of the three are theorems about the algorithm rather than empirical
 * observations, and it is worth saying which is which:
 *
 * - **The area upper bound is a theorem.** Every plant owns a disjoint
 *   rectangle that lies wholly inside the outline, so the rectangles' total
 *   area cannot exceed the plot's. This test could only fail if the containment
 *   logic were wrong — which is exactly what it is here to catch.
 * - **Monotonicity in spacing** (wider spacing never fits more) is asserted
 *   over a sweep rather than proved; on a sufficiently strange polygon a
 *   lattice-phase effect could in principle break it.
 * - **Monotonicity in region size** (a bigger plot never fits fewer) holds
 *   whenever the growth leaves the bounding box's minimum corner alone, because
 *   that corner is what the lattice is anchored to. Growing a plot the *other*
 *   way shifts the lattice, and the last test in this file demonstrates that
 *   the exception is real rather than theoretical — a deliberate trade for
 *   translation invariance, recorded in `docs/adr/0013`.
 */

/** A deterministic PRNG (mulberry32), so a failing case is always reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * A random **star-shaped** polygon: vertices at increasing angles around a
 * centre, at random radii. Star-shaped rings are always simple, so this
 * generates awkward, spiky, deeply non-convex plots without ever generating an
 * invalid one.
 */
function randomPolygon(random: () => number, corners: number, maxRadiusCm: number) {
  const vertices: Vertex[] = [];
  for (let i = 0; i < corners; i += 1) {
    const angle = (2 * Math.PI * i) / corners;
    const radius = maxRadiusCm * (0.25 + 0.75 * random());
    vertices.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  }
  return validatePlotRegion({ vertices });
}

/**
 * Spacings spanning the range the shipped dataset actually uses, plus one
 * intensive-only block.
 *
 * The intensive entry is here to keep `upperBound` honest: it is the shape
 * (no `row` block) that the old bound silently turned into a divide-by-zero,
 * and a user-defined crop quoting only "N per square" off a seed packet
 * produces exactly it (ADR 0011). Every property below therefore runs against
 * both spacing shapes, not just the row-shaped majority.
 */
const SPACINGS: readonly Spacing[] = [
  { row: { inRowCm: 3, betweenRowCm: 15 } }, // radish, the tightest shipped
  { row: { inRowCm: 10, betweenRowCm: 30 } }, // onion
  { row: { inRowCm: 15, betweenRowCm: 45 } }, // green bean
  { row: { inRowCm: 45, betweenRowCm: 60 } }, // tomato
  { row: { inRowCm: 100, betweenRowCm: 100 } }, // a courgette-sized sprawler
  { intensive: { plantsPerSquare: 9 } }, // an intensive-only crop: a 10 cm grid
];

describe('the area upper bound', () => {
  /**
   * Each plant is allotted `inRow × rowPitch` cm² of ground, and those patches
   * are disjoint and inside the outline — so the count can never exceed the
   * plot's area divided by that figure. Computed here from the inputs rather
   * than read off the result, so the test is an independent check.
   */
  function upperBound(spacing: Spacing, packing: PackingPattern, areaCm2: number): number {
    // Resolved the same way `fitSpacing` resolves it, rather than reaching for
    // `spacing.row` directly, so an intensive-only spacing gets a real bound.
    //
    // The `??`-a-zero shape this replaced was a quiet trap: a spacing with no
    // `row` block gave a divisor of 0, an upper bound of `Infinity`, and a
    // `toBeLessThanOrEqual` that passed for *any* count. The strongest test in
    // the engine would have gone vacuous the first time someone added an
    // intensive crop to `SPACINGS`, with nothing going red to say so.
    const { inRowCm, betweenRowCm } = resolveLatticeSpacing(spacing, 'auto');
    const pitch = packing === 'offset' ? offsetRowPitchCm(inRowCm, betweenRowCm) : betweenRowCm;
    const areaPerPlant = inRowCm * pitch;
    if (!Number.isFinite(areaPerPlant) || areaPerPlant <= 0) {
      throw new Error(
        `upperBound got a non-positive area per plant (${areaPerPlant}) — the bound would be ` +
          'meaningless and the assertion would pass vacuously',
      );
    }
    return areaCm2 / areaPerPlant;
  }

  it('holds for the presets, at every spacing and both packings', () => {
    const regions = [
      rectangleRegion(200, 100),
      rectangleRegion(37, 812),
      lShapeRegion({ widthCm: 400, heightCm: 300, notchWidthCm: 130, notchHeightCm: 170 }),
      circleRegion(250),
    ];
    for (const region of regions) {
      for (const spacing of SPACINGS) {
        for (const packing of PACKING_PATTERNS) {
          const result = fitSpacing(spacing, region, { packing });
          expect(result.count).toBeLessThanOrEqual(
            upperBound(spacing, packing, regionAreaCm2(region)),
          );
        }
      }
    }
  });

  it('holds for 60 awkward random polygons', () => {
    const random = makeRandom(20_260_722);
    for (let trial = 0; trial < 60; trial += 1) {
      const region = randomPolygon(random, 3 + (trial % 10), 100 + trial * 10);
      const spacing = SPACINGS[trial % SPACINGS.length];
      const packing = PACKING_PATTERNS[trial % PACKING_PATTERNS.length];
      const result = fitSpacing(spacing, region, { packing });
      expect(result.count).toBeLessThanOrEqual(upperBound(spacing, packing, regionAreaCm2(region)));
    }
  });

  it('holds for an intensive planting too', () => {
    // 9 per 30 cm square is 100 per m². A 3 m × 3 m bed is 9 m², so no more
    // than 900 plants — and square packing reaches it exactly, because the
    // spacing divides the bed with nothing left over.
    const result = fitSpacing({ intensive: { plantsPerSquare: 9 } }, rectangleRegion(300, 300));
    expect(result.count).toBe(900);
    expect(result.densityPerSquareMetre).toBe(100);
  });
});

describe('monotonicity: a bigger plot never fits fewer plants', () => {
  it('holds as a rectangle grows', () => {
    for (const spacing of SPACINGS) {
      let previous = 0;
      for (let side = 20; side <= 600; side += 20) {
        const count = fitSpacing(spacing, rectangleRegion(side, side)).count;
        expect(count).toBeGreaterThanOrEqual(previous);
        previous = count;
      }
    }
  });

  it('holds as an L-shape’s notch is filled in', () => {
    // Shrinking the bite grows the plot while leaving the bounding box — and so
    // the lattice — exactly where it was.
    for (const spacing of SPACINGS) {
      let previous = 0;
      for (let notch = 290; notch >= 10; notch -= 20) {
        const plot = lShapeRegion({
          widthCm: 300,
          heightCm: 300,
          notchWidthCm: notch,
          notchHeightCm: notch,
        });
        const count = fitSpacing(spacing, plot).count;
        expect(count).toBeGreaterThanOrEqual(previous);
        previous = count;
      }
    }
  });

  it('holds when a plot grows up and to the right from a fixed corner', () => {
    const random = makeRandom(1_066);
    for (let trial = 0; trial < 20; trial += 1) {
      const width = 100 + Math.floor(random() * 400);
      const height = 100 + Math.floor(random() * 400);
      const spacing = SPACINGS[trial % SPACINGS.length];
      const smaller = fitSpacing(spacing, rectangleRegion(width, height)).count;
      const bigger = fitSpacing(spacing, rectangleRegion(width + 37, height + 23)).count;
      expect(bigger).toBeGreaterThanOrEqual(smaller);
    }
  });
});

describe('monotonicity: wider spacing never fits more plants', () => {
  it('holds across a sweep of spacings on several plots', () => {
    const regions = [
      rectangleRegion(300, 200),
      lShapeRegion({ widthCm: 400, heightCm: 400, notchWidthCm: 175, notchHeightCm: 125 }),
      circleRegion(400),
    ];
    for (const region of regions) {
      for (const packing of PACKING_PATTERNS) {
        let previous = Infinity;
        for (let spacing = 5; spacing <= 120; spacing += 5) {
          const count = fitSpacing({ row: { inRowCm: spacing, betweenRowCm: spacing } }, region, {
            packing,
          }).count;
          expect(count).toBeLessThanOrEqual(previous);
          previous = count;
        }
      }
    }
  });

  it('holds when only one of the two distances widens', () => {
    const region = rectangleRegion(300, 200);
    let previous = Infinity;
    for (let betweenRowCm = 10; betweenRowCm <= 100; betweenRowCm += 5) {
      const count = fitSpacing({ row: { inRowCm: 10, betweenRowCm } }, region).count;
      expect(count).toBeLessThanOrEqual(previous);
      previous = count;
    }
  });
});

describe('zero and degenerate plots', () => {
  it('refuses a plot with no area at the schema, not at the calculator', () => {
    expect(() => rectangleRegion(0, 100)).toThrow(/positive number/);
    expect(() =>
      validatePlotRegion({
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 0 },
        ],
      }),
    ).toThrow();
  });

  it('returns an explained zero for a plot too small to hold anything', () => {
    for (const spacing of SPACINGS.slice(1)) {
      const result = fitSpacing(spacing, rectangleRegion(2, 2));
      expect(result.count).toBe(0);
      expect(result.positions).toEqual([]);
      expect(result.densityPerSquareMetre).toBe(0);
      expect(result.summary).toContain('nothing fits');
    }
  });

  it('returns an explained zero for a plot narrower than one plant', () => {
    // 5 cm × 10 m: 0.5 m² of ground, and not one onion, because the shape is
    // wrong rather than the area. An area-based calculator would say 16.
    const sliver = rectangleRegion(5, 1000);
    expect(regionAreaCm2(sliver)).toBe(5000);
    expect(fitSpacing({ row: { inRowCm: 10, betweenRowCm: 30 } }, sliver).count).toBe(0);
  });
});

describe('the known limitation: growing a plot leftwards moves the lattice', () => {
  /**
   * A comb-shaped plot: a full-width base bar with three teeth standing on it.
   *
   * ```
   *      ┌──┐    ┌──┐    ┌──┐        teeth: x 0–12, 22–34, 44–56 (y 10–30)
   *      │  │    │  │    │  │
   *   ┌──┴──┴────┴──┴────┴──┴──┐     base:  x 0–56 (y 0–10)
   *   └────────────────────────┘
   * ```
   *
   * The lattice is anchored to the bounding box's minimum corner, so a plot
   * that grows to the *left* is re-phased, and a tooth that used to catch a
   * column can stop catching one. This is the documented price of translation
   * invariance — the alternative, anchoring to a fixed global origin, would
   * mean sliding the same plot three centimetres sideways changed its answer.
   */
  const COMB: Vertex[] = [
    { x: 0, y: 0 },
    { x: 56, y: 0 },
    { x: 56, y: 30 },
    { x: 44, y: 30 },
    { x: 44, y: 10 },
    { x: 34, y: 10 },
    { x: 34, y: 30 },
    { x: 22, y: 30 },
    { x: 22, y: 10 },
    { x: 12, y: 10 },
    { x: 12, y: 30 },
    { x: 0, y: 30 },
  ];

  it('can cost a plant, and this is the case that proves it', () => {
    const comb = validatePlotRegion({ vertices: COMB });
    // The same comb with 3 cm added to the left-hand end of its base bar.
    const wider = validatePlotRegion({
      vertices: [{ x: -3, y: 0 }, ...COMB.slice(1), { x: 0, y: 10 }, { x: -3, y: 10 }],
    });
    expect(regionAreaCm2(wider)).toBeGreaterThan(regionAreaCm2(comb));

    const spacing: Spacing = { row: { inRowCm: 10, betweenRowCm: 10 } };
    const options = { orientation: 'horizontal' } as const;
    // Comb: 5 plants along the base + 1 in the left-hand tooth on each of the
    // two upper rows = 7. Widened: the extra 3 cm shifts every column 3 cm
    // left, which keeps the 5 base plants but leaves no tooth able to hold a
    // whole cell = 5.
    expect(fitSpacing(spacing, comb, options).count).toBe(7);
    expect(fitSpacing(spacing, wider, options).count).toBe(5);
  });
});
