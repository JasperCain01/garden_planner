import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant } from '../schema/plant.ts';
import { resolvePlotConditions } from './conditions';
import { DIMENSION_WEIGHTS } from './model';
import { rankPlants } from './rank';
import { scorePlant } from './score';

/**
 * Scoring the **real shipped dataset**, not hand-built fixtures.
 *
 * The risk this suite exists for is the Stage 2.1 brief's central warning: a
 * four-dimension scorer that, on real data, returns the same number for every
 * record, or ranks in a way a gardener could have got by sorting the list by
 * name. The tests here are written as properties of whatever data ships, so a
 * data refresh doesn't break them; the record counts themselves are pinned once,
 * in `packages/etl/src/merge/shipped-dataset.test.ts`.
 *
 * Coverage is uneven by design (most records carry light and spacing only, a
 * curated few carry hardiness and seasons, and the moisture table adds soil
 * moisture to many). The missing-data policy turns that into confidence, and
 * several tests below check that the extra data actually moves the scores.
 */

const DATASET_PATH = fileURLToPath(new URL('../../../../data/plants.json', import.meta.url));

interface DatasetArtifact {
  readonly plantCount: number;
  readonly plants: readonly unknown[];
}

/** Load and validate every shipped record, so these tests score real `Plant`s. */
function loadShippedPlants(): Plant[] {
  const artifact = JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as DatasetArtifact;
  return artifact.plants.map((record) => validatePlant(record));
}

const PLANTS = loadShippedPlants();
const FULL_SUN = PLANTS.filter((plant) => plant.light === 'full-sun');
const SHADE_TOLERANT = PLANTS.filter((plant) => plant.light !== 'full-sun');

const SUNNY_PLOT = resolvePlotConditions({ light: 'full-sun' });
const SHADY_PLOT = resolvePlotConditions({ light: 'full-shade' });
const PARTIAL_PLOT = resolvePlotConditions({ light: 'partial-shade' });
/** A plot that actually describes its soil — what the moisture table exists for. */
const DRY_PLOT = resolvePlotConditions({ light: 'full-sun', soil: { moisture: 'dry' } });

/** Confidence a record should get from its own data on a plot that names no soil. */
function expectedConfidenceWithoutSoil(plant: Plant): number {
  let confidence = DIMENSION_WEIGHTS.light;
  if (plant.hardiness !== undefined) confidence += DIMENSION_WEIGHTS.hardiness;
  if (plant.seasons !== undefined) confidence += DIMENSION_WEIGHTS.season;
  return confidence;
}

describe('the shipped dataset', () => {
  it('has both kinds of light requirement and some records with extra data, or these tests prove nothing', () => {
    expect(FULL_SUN.length).toBeGreaterThan(0);
    expect(SHADE_TOLERANT.length).toBeGreaterThan(0);
    expect(PLANTS.some((plant) => plant.hardiness !== undefined)).toBe(true);
    expect(PLANTS.some((plant) => plant.soil?.moisture !== undefined)).toBe(true);
  });

  it('scores every record without throwing, on every shipped light level', () => {
    for (const plot of [SUNNY_PLOT, PARTIAL_PLOT, SHADY_PLOT]) {
      for (const plant of PLANTS) {
        const result = scorePlant(plant, plot);
        expect(result.plantId).toBe(plant.id);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    }
  });

  it("bases confidence on the crop's own data when the plot's soil is undescribed", () => {
    // The small print: moisture data on the *crop* buys nothing until the
    // *plot* describes its soil. What changes for an enriched crop is only the
    // wording — the gap is now the plot's, not the crop's.
    for (const plant of PLANTS) {
      const result = scorePlant(plant, SUNNY_PLOT);
      expect(result.confidence, plant.id).toBeCloseTo(expectedConfidenceWithoutSoil(plant), 9);
      if (plant.soil !== undefined) {
        expect(result.summary).toContain("the plot's soil wasn't described");
        expect(result.summary).not.toContain('no soil data for this crop');
      }
    }
  });

  it('adds the soil dimension to exactly the crops that state a moisture, once the plot names its own', () => {
    for (const plant of PLANTS) {
      const gained = scorePlant(plant, DRY_PLOT).confidence - expectedConfidenceWithoutSoil(plant);
      const expected = plant.soil?.moisture !== undefined ? DIMENSION_WEIGHTS.soil : 0;
      expect(gained, plant.id).toBeCloseTo(expected, 9);
    }
  });

  it('re-orders the palette on a dry plot — the axis actually does work', () => {
    // On dry ground a drought-tolerant crop must outrank a thirsty one; before
    // the moisture data every full-sun crop tied at exactly one score.
    const score = (id: string) =>
      scorePlant(PLANTS.find((plant) => plant.id === id) as Plant, DRY_PLOT).rankingScore;

    expect(score('rosemary')).toBeGreaterThan(score('pea'));
    expect(score('carrot')).toBeGreaterThan(score('celery'));
    expect(score('rosemary')).toBe(score('carrot')); // both tolerate dry
    expect(score('watercress')).toBeLessThan(score('carrot'));

    // And it says why, in words a gardener can act on.
    const pea = scorePlant(PLANTS.find((plant) => plant.id === 'pea') as Plant, DRY_PLOT);
    expect(pea.summary).toContain('Prefers moist conditions, not dry');
    expect(pea.summary).toContain('Scored on light and soil');
  });

  it('does not collapse to a single number, and the extra data moves records off the light-only score', () => {
    const lightOnly = FULL_SUN.find(
      (plant) => plant.hardiness === undefined && plant.seasons === undefined,
    ) as Plant;
    const baseline = scorePlant(lightOnly, SUNNY_PLOT).rankingScore;
    const scores = PLANTS.map((plant) => scorePlant(plant, SUNNY_PLOT).rankingScore);

    expect(new Set(scores).size).toBeGreaterThan(2);
    for (const plant of FULL_SUN.filter((p) => p.hardiness !== undefined)) {
      expect(scorePlant(plant, SUNNY_PLOT).rankingScore, plant.id).not.toBe(baseline);
    }
  });

  it('caps no record on a sunny plot — nothing is unsuitable in full sun', () => {
    for (const plant of PLANTS) {
      expect(scorePlant(plant, SUNNY_PLOT).band, plant.id).not.toBe('unsuitable');
    }
  });

  describe('an all-shade plot', () => {
    it('makes every full-sun record unsuitable, with light named as the limiting factor', () => {
      for (const plant of FULL_SUN) {
        const result = scorePlant(plant, SHADY_PLOT);
        expect(result.band, plant.id).toBe('unsuitable');
        expect(result.limitedBy).toEqual(['light']);
        expect(result.summary).toContain('too dark');
      }
    });

    it('leaves exactly the shade-tolerant records once unsuitable ones are excluded', () => {
      const ranked = rankPlants(PLANTS, SHADY_PLOT, { excludeUnsuitable: true });
      expect(ranked.map((entry) => entry.plant.id).sort()).toEqual(
        SHADE_TOLERANT.map((plant) => plant.id).sort(),
      );
    });
  });

  describe('ranking the whole dataset', () => {
    it('puts every full-sun crop above every shade-tolerant one in a sunny plot', () => {
      const ranked = rankPlants(PLANTS, SUNNY_PLOT);
      expect(ranked).toHaveLength(PLANTS.length);
      const tail = ranked.slice(FULL_SUN.length);
      expect(tail.every((entry) => entry.plant.light !== 'full-sun')).toBe(true);
    });

    it('inverts that order in a shady plot', () => {
      const ranked = rankPlants(PLANTS, SHADY_PLOT);
      const head = ranked.slice(0, SHADE_TOLERANT.length);
      expect(head.every((entry) => entry.plant.light !== 'full-sun')).toBe(true);
    });

    it('breaks ties on confidence, then alphabetically by name', () => {
      // rank.test.ts proves the comparator on fixtures; this checks it holds
      // across real data, where most of the list ties on score.
      const ranked = rankPlants(PLANTS, SUNNY_PLOT);
      for (let i = 1; i < ranked.length; i += 1) {
        const [a, b] = [ranked[i - 1], ranked[i]];
        if (a.suitability.rankingScore !== b.suitability.rankingScore) continue;
        if (a.suitability.confidence !== b.suitability.confidence) {
          expect(a.suitability.confidence).toBeGreaterThan(b.suitability.confidence);
        } else {
          expect(a.plant.commonName <= b.plant.commonName, `${a.plant.id} / ${b.plant.id}`).toBe(
            true,
          );
        }
      }
    });
  });

  it('scores a real record as a documented worked example', () => {
    // Lettuce is a partial-shade record with a moisture preference from the
    // curated table but no hardiness or seasons, like most of the catalogue.
    const lettuce = PLANTS.find((plant) => plant.id === 'lettuce');
    expect(lettuce).toBeDefined();

    const result = scorePlant(lettuce as Plant, PARTIAL_PLOT);

    expect(result).toMatchObject({
      plantId: 'lettuce',
      score: 1,
      confidence: 0.35,
      rankingScore: 0.675,
      band: 'good',
    });
    // Soil is `unknown-plot`, not `unknown-plant`: lettuce states its
    // moisture, but this plot doesn't state its own, so the missing half is
    // the plot's. That distinction is why the finding vocabulary has two
    // "unknown" values rather than one.
    expect(result.dimensions.map((dimension) => dimension.finding)).toEqual([
      'match',
      'unknown-plant',
      'unknown-plot',
      'unknown-plant',
    ]);
    expect(result.summary).toBe(
      'Good match — Wants partial shade, and the plot is in partial shade. ' +
        "Scored on light alone — no hardiness or season data for this crop and the plot's " +
        "soil wasn't described (confidence 35%).",
    );
  });

  it('describing the plot more fully cannot raise a light-only record above light alone', () => {
    // A user who fills in soil and a planting month gets no extra confidence for
    // records that say nothing about either — the gap is in our data, and the
    // reasoning says so rather than rewarding the extra input.
    const lightOnly = PLANTS.find(
      (plant) =>
        plant.hardiness === undefined && plant.seasons === undefined && plant.soil === undefined,
    ) as Plant;
    const richPlot = resolvePlotConditions({
      light: 'full-sun',
      soil: { texture: 'loam', ph: 'neutral', moisture: 'moist' },
      plantingMonth: 4,
    });

    const result = scorePlant(lightOnly, richPlot);

    expect(result.confidence).toBe(DIMENSION_WEIGHTS.light);
    expect(result.dimensions[2]).toMatchObject({ dimension: 'soil', finding: 'unknown-plant' });
  });
});
