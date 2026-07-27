import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant } from '../schema/plant.ts';
import { resolveClimate } from '../climate/resolve.ts';
import type { PlotConditions } from './conditions';
import { resolvePlotConditions } from './conditions';
import type { DimensionScore } from './model';
import { NEUTRAL_PRIOR } from './model';
import { aggregateDimensionScores, scorePlant } from './score';

/**
 * These are the stage's **golden worked examples**: each one is a scenario a
 * gardener would recognise, scored by hand in the comments so the model's
 * arithmetic is documented rather than merely asserted.
 *
 * Weights: light 0.35, hardiness 0.30, soil 0.20, season 0.15.
 */

/** A crop with every requirement dimension populated — the "rich record" case. */
function fullyDescribedPlant(overrides: Partial<Plant> = {}): Plant {
  return validatePlant({
    id: 'garden-pea',
    commonName: 'Garden Pea',
    scientificName: 'Pisum sativum',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 5, betweenRowCm: 60 } },
    hardiness: { rhsRating: 'H5' },
    soil: { textures: ['loam'], ph: ['neutral'], moisture: ['moist'] },
    seasons: { sow: [{ start: 3, end: 4 }], harvest: [{ start: 6, end: 8 }] },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
    ...overrides,
  });
}

/**
 * A crop shaped like almost every record in the shipped dataset: identity,
 * category, light and spacing, and nothing else (`data/plants.json` — only
 * 8 of 144 carry hardiness or seasons).
 */
function sparsePlant(overrides: Partial<Plant> = {}): Plant {
  return validatePlant({
    id: 'acorn-squash',
    commonName: 'Acorn Squash',
    scientificName: 'Cucurbita pepo',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 150, betweenRowCm: 60 } },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
    ...overrides,
  });
}

/** A fully-described plot: sunny, loamy, neutral, moist, in the UK default region. */
const RICH_PLOT: PlotConditions = resolvePlotConditions({
  light: 'full-sun',
  soil: { texture: 'loam', ph: 'neutral', moisture: 'moist' },
  plantingMonth: 4,
});

/** The plot a first-time user describes: a light level and nothing else. */
const BARE_PLOT: PlotConditions = resolvePlotConditions({ light: 'full-sun' });

describe('scorePlant — golden worked examples', () => {
  it('a perfect match, fully described on both sides, scores 1', () => {
    // light 1 · hardiness 1 · soil 1 · season 1 → weighted mean 1, all four
    // dimensions assessed, so confidence 1 and no shrinkage.
    const result = scorePlant(fullyDescribedPlant(), RICH_PLOT);

    expect(result).toMatchObject({
      plantId: 'garden-pea',
      score: 1,
      confidence: 1,
      rankingScore: 1,
      band: 'excellent',
      limitedBy: [],
    });
    expect(result.dimensions.map((dimension) => dimension.dimension)).toEqual([
      'light',
      'hardiness',
      'soil',
      'season',
    ]);
    expect(result.summary).toContain('Excellent match');
  });

  it('a full-sun crop in a full-shade plot is capped, not averaged, into unsuitability', () => {
    // light 0 (unsuitable) · hardiness 1 · soil 1 · season 1.
    // The plain weighted mean would be 0.65 — a respectable "good". The
    // limiting-factor cap overrides it: the crop will not crop in deep shade,
    // however perfect the soil.
    const shadyPlot = resolvePlotConditions({
      light: 'full-shade',
      soil: { texture: 'loam', ph: 'neutral', moisture: 'moist' },
      plantingMonth: 4,
    });
    const result = scorePlant(fullyDescribedPlant(), shadyPlot);

    expect(result).toMatchObject({
      score: 0.2,
      confidence: 1,
      rankingScore: 0.2,
      band: 'unsuitable',
      limitedBy: ['light'],
    });
    expect(result.summary).toContain('Unsuitable');
    expect(result.summary).toContain('too dark');
  });

  it('a tender crop in a cold region is capped by hardiness', () => {
    // An H2 crop in the Scottish Highlands (H6): four bands short → 0.
    const highlandPlot = resolvePlotConditions({
      light: 'full-sun',
      soil: { texture: 'loam', ph: 'neutral', moisture: 'moist' },
      plantingMonth: 4,
      location: { kind: 'region', regionId: 'scotland-highlands' },
    });
    const result = scorePlant(
      fullyDescribedPlant({ hardiness: { rhsRating: 'H2' } }),
      highlandPlot,
    );

    expect(result).toMatchObject({ band: 'unsuitable', limitedBy: ['hardiness'], score: 0.2 });
    expect(result.summary).toContain('bands short');
  });

  it('a sparse shipped record in a matching plot scores on light alone, and says so', () => {
    // light 1, everything else unknown. Evidence 1 over 0.35 of the model's
    // weight → confidence 0.35; ranking 1 × 0.35 + 0.5 × 0.65 = 0.675.
    const result = scorePlant(sparsePlant(), BARE_PLOT);

    expect(result).toMatchObject({
      score: 1,
      confidence: 0.35,
      rankingScore: 0.675,
      band: 'good',
      limitedBy: [],
    });
    expect(result.summary).toBe(
      'Good match — Wants full sun, and the plot is in full sun. ' +
        'Scored on light alone — no hardiness, soil or season data for this crop (confidence 35%).',
    );
  });

  it('distinguishes a gap in our data from a question the user can still answer', () => {
    // The crop knows its soil; the plot doesn't describe any. That is a
    // `unknown-plot` finding, and the summary asks for it rather than blaming
    // the record.
    const result = scorePlant(sparsePlant({ soil: { textures: ['loam'] } }), BARE_PLOT);

    expect(result.dimensions[2]).toMatchObject({ dimension: 'soil', finding: 'unknown-plot' });
    expect(result.summary).toContain("the plot's soil wasn't described");
    expect(result.summary).toContain('no hardiness or season data for this crop');
  });
});

describe('scorePlant — the missing-data policy', () => {
  it('never lets an absent dimension read as a perfect match', () => {
    const known = scorePlant(fullyDescribedPlant(), RICH_PLOT);
    const unknown = scorePlant(sparsePlant(), BARE_PLOT);

    // Both are a perfect match on everything they state. The fully-described
    // crop still wins, because the other one's three unknowns are not credited.
    expect(unknown.score).toBe(known.score);
    expect(unknown.rankingScore).toBeLessThan(known.rankingScore);
  });

  it('never lets an absent dimension read as a total mismatch either', () => {
    const unknown = scorePlant(sparsePlant(), BARE_PLOT);

    // Pulled *towards* the neutral prior, not down to it and not to zero.
    expect(unknown.rankingScore).toBeGreaterThan(NEUTRAL_PRIOR);
    expect(unknown.rankingScore).toBeLessThan(1);
  });

  it('shrinks a poor score upwards, for the same reason', () => {
    // A full-sun crop in a partly-shaded plot: light 0.45 and nothing else
    // known. The ranking score sits *above* the evidence score, because three
    // unknown dimensions are not evidence against the crop.
    const result = scorePlant(sparsePlant(), resolvePlotConditions({ light: 'partial-shade' }));

    expect(result.score).toBe(0.45);
    expect(result.rankingScore).toBe(0.4825);
    expect(result.rankingScore).toBeGreaterThan(result.score);
    expect(result.band).toBe('fair');
  });

  it('reports confidence as the share of the model actually assessed', () => {
    expect(scorePlant(sparsePlant(), BARE_PLOT).confidence).toBe(0.35);
    // Add hardiness (0.30) and the plot's soil (0.20) becomes comparable too.
    expect(
      scorePlant(
        sparsePlant({ hardiness: { rhsRating: 'H5' }, soil: { textures: ['loam'] } }),
        RICH_PLOT,
      ).confidence,
    ).toBe(0.85);
    expect(scorePlant(fullyDescribedPlant(), RICH_PLOT).confidence).toBe(1);
  });

  it('always assesses light, so confidence is never zero', () => {
    // `light` is required on both a Plant and a PlotConditions, by design.
    for (const plot of [BARE_PLOT, RICH_PLOT]) {
      expect(scorePlant(sparsePlant(), plot).confidence).toBeGreaterThan(0);
    }
  });

  it('carries the full per-dimension breakdown, reasons included', () => {
    const result = scorePlant(sparsePlant(), BARE_PLOT);

    expect(result.dimensions).toHaveLength(4);
    for (const dimension of result.dimensions) {
      expect(dimension.reason.length).toBeGreaterThan(10);
    }
    // Unknown dimensions carry a null score — never a silent default.
    expect(result.dimensions.filter((dimension) => dimension.score === null)).toHaveLength(3);
  });
});

describe('aggregateDimensionScores', () => {
  function dimension(overrides: Partial<DimensionScore>): DimensionScore {
    return {
      dimension: 'light',
      finding: 'match',
      score: 1,
      weight: 0.35,
      reason: 'test',
      ...overrides,
    };
  }

  it('is a weighted mean over the assessed dimensions only', () => {
    const aggregate = aggregateDimensionScores([
      dimension({ dimension: 'light', score: 1, weight: 0.35 }),
      dimension({ dimension: 'hardiness', score: 0.5, weight: 0.3, finding: 'mismatch' }),
      dimension({ dimension: 'soil', score: null, weight: 0.2, finding: 'unknown-plant' }),
      dimension({ dimension: 'season', score: null, weight: 0.15, finding: 'unknown-plant' }),
    ]);

    // (1 × 0.35 + 0.5 × 0.30) / 0.65 = 0.7692…
    expect(aggregate.score).toBe(0.7692);
    expect(aggregate.confidence).toBe(0.65);
    // 0.7692… × 0.65 + 0.5 × 0.35 = 0.675
    expect(aggregate.rankingScore).toBe(0.675);
    expect(aggregate.band).toBe('good');
  });

  it('caps and re-bands as soon as any dimension is unsuitable', () => {
    const aggregate = aggregateDimensionScores([
      dimension({ dimension: 'light', score: 1, weight: 0.35 }),
      dimension({ dimension: 'hardiness', score: 0, weight: 0.3, finding: 'unsuitable' }),
      dimension({ dimension: 'soil', score: 1, weight: 0.2 }),
      dimension({ dimension: 'season', score: 1, weight: 0.15 }),
    ]);

    expect(aggregate).toMatchObject({
      score: 0.2,
      rankingScore: 0.2,
      band: 'unsuitable',
      limitedBy: ['hardiness'],
    });
  });

  it('lists every limiting factor, not just the first', () => {
    const aggregate = aggregateDimensionScores([
      dimension({ dimension: 'light', score: 0, weight: 0.35, finding: 'unsuitable' }),
      dimension({ dimension: 'hardiness', score: 0, weight: 0.3, finding: 'unsuitable' }),
    ]);

    expect(aggregate.limitedBy).toEqual(['light', 'hardiness']);
  });

  it('returns the neutral prior when nothing at all could be assessed', () => {
    // Unreachable via scorePlant (light is always assessed) but the public
    // helper must not divide by zero.
    const aggregate = aggregateDimensionScores([
      dimension({ score: null, finding: 'unknown-plant' }),
    ]);

    expect(aggregate).toMatchObject({
      score: NEUTRAL_PRIOR,
      confidence: 0,
      rankingScore: NEUTRAL_PRIOR,
    });
  });

  it('handles an empty dimension list', () => {
    expect(aggregateDimensionScores([])).toMatchObject({ confidence: 0, rankingScore: 0.5 });
  });
});

describe('scorePlant — purity', () => {
  it('does not mutate its inputs and is deterministic', () => {
    const plant = fullyDescribedPlant();
    const snapshot = structuredClone(plant);
    const conditions = resolvePlotConditions({ light: 'full-sun' });
    const conditionsSnapshot = structuredClone(conditions);

    const first = scorePlant(plant, conditions);
    const second = scorePlant(plant, conditions);

    expect(first).toEqual(second);
    expect(plant).toEqual(snapshot);
    expect(conditions).toEqual(conditionsSnapshot);
  });

  it('scores a user-defined crop exactly like any other plant', () => {
    // ADR 0011: a user crop is upcast to a plain `Plant` at the input boundary,
    // so the engine needs — and has — no origin-awareness.
    const userCrop = validatePlant({
      ...sparsePlant(),
      id: 'user-cherry-belle',
      provenance: { sources: [{ source: 'user-entered' }] },
    });

    expect(scorePlant(userCrop, BARE_PLOT).rankingScore).toBe(
      scorePlant(sparsePlant(), BARE_PLOT).rankingScore,
    );
  });

  it('never touches the network', () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('the engine must not make network calls');
    }) as typeof fetch;
    try {
      expect(scorePlant(fullyDescribedPlant(), resolveClimateBackedPlot())).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

/** A plot built straight from the climate resolver, for the offline assertion. */
function resolveClimateBackedPlot(): PlotConditions {
  return { light: 'full-sun', climate: resolveClimate() };
}
