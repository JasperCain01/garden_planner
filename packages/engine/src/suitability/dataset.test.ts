import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant } from '../schema/plant.ts';
import { resolvePlotConditions } from './conditions';
import { rankPlants } from './rank';
import { scorePlant } from './score';

/**
 * Scoring the **real shipped dataset**, not hand-built fixtures.
 *
 * The point of this suite is the Stage 2.1 brief's central warning: it is easy
 * to build a beautiful four-dimension scorer that returns the same number for
 * all 160 records. These tests pin what the model actually does on the data that
 * ships today — including the fact that its confidence is 0.35 across the board,
 * which is the honest consequence of a dataset with no hardiness, soil or season
 * coverage rather than a bug to paper over.
 *
 * If Stage 1.7's curated records add those fields, several expectations here
 * will change. That is intended: they are a coverage tripwire as much as a test.
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

const SUNNY_PLOT = resolvePlotConditions({ light: 'full-sun' });
const SHADY_PLOT = resolvePlotConditions({ light: 'full-shade' });
const PARTIAL_PLOT = resolvePlotConditions({ light: 'partial-shade' });

describe('the shipped dataset', () => {
  it('is the dataset these expectations were written against', () => {
    expect(PLANTS).toHaveLength(160);
    expect(PLANTS.filter((plant) => plant.light === 'full-sun')).toHaveLength(146);
    expect(PLANTS.filter((plant) => plant.light === 'partial-shade')).toHaveLength(14);
    // The coverage that makes the missing-data policy the design decision it is.
    expect(PLANTS.filter((plant) => plant.hardiness !== undefined)).toHaveLength(0);
    expect(PLANTS.filter((plant) => plant.soil !== undefined)).toHaveLength(0);
    expect(PLANTS.filter((plant) => plant.seasons !== undefined)).toHaveLength(0);
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

  it('reports 0.35 confidence for every record, and says why in the summary', () => {
    for (const plant of PLANTS) {
      const result = scorePlant(plant, SUNNY_PLOT);
      expect(result.confidence).toBe(0.35);
      expect(result.summary).toContain('Scored on light alone');
      expect(result.summary).toContain('no hardiness, soil or season data for this crop');
    }
  });

  it('does not collapse to a single number — it discriminates exactly as far as the data allows', () => {
    const distinctScores = new Set(
      PLANTS.map((plant) => scorePlant(plant, SUNNY_PLOT).rankingScore),
    );
    const distinctLightValues = new Set(PLANTS.map((plant) => plant.light));

    expect(distinctScores.size).toBeGreaterThan(1);
    // Light is the only dimension with data, so two light values is the ceiling
    // on how far the model can separate today's records. It reaches that ceiling.
    expect(distinctScores.size).toBe(distinctLightValues.size);
    expect([...distinctScores].sort((a, b) => b - a)).toEqual([0.675, 0.5525]);
  });

  it('caps no record on a sunny plot — nothing is unsuitable in full sun', () => {
    const bands = new Set(PLANTS.map((plant) => scorePlant(plant, SUNNY_PLOT).band));

    expect(bands).toEqual(new Set(['good', 'fair']));
  });

  describe('an all-shade plot', () => {
    it('makes every full-sun record unsuitable, with light named as the limiting factor', () => {
      const results = PLANTS.filter((plant) => plant.light === 'full-sun').map((plant) =>
        scorePlant(plant, SHADY_PLOT),
      );

      expect(results).toHaveLength(146);
      for (const result of results) {
        expect(result.band).toBe('unsuitable');
        expect(result.limitedBy).toEqual(['light']);
        expect(result.summary).toContain('too dark');
      }
    });

    it('leaves exactly the fourteen shade-tolerant crops once unsuitable ones are excluded', () => {
      const ranked = rankPlants(PLANTS, SHADY_PLOT, { excludeUnsuitable: true });

      expect(ranked).toHaveLength(14);
      expect(ranked.map((entry) => entry.plant.id)).toContain('lettuce');
      expect(ranked.map((entry) => entry.plant.id)).toContain('mint');
      for (const entry of ranked) {
        expect(entry.plant.light).toBe('partial-shade');
      }
    });

    it('returns nothing at all when the list is full-sun crops only (the "no matching plants" case)', () => {
      const fullSunOnly = PLANTS.filter((plant) => plant.light === 'full-sun');

      expect(rankPlants(fullSunOnly, SHADY_PLOT, { excludeUnsuitable: true })).toEqual([]);
    });
  });

  describe('ranking the whole dataset', () => {
    it('puts every full-sun crop above every shade-tolerant one in a sunny plot', () => {
      const ranked = rankPlants(PLANTS, SUNNY_PLOT);

      expect(ranked).toHaveLength(160);
      const firstShadeTolerant = ranked.findIndex((entry) => entry.plant.light === 'partial-shade');
      expect(firstShadeTolerant).toBe(146);
      expect(ranked.slice(146).every((entry) => entry.plant.light === 'partial-shade')).toBe(true);
    });

    it('inverts that order in a shady plot', () => {
      const ranked = rankPlants(PLANTS, SHADY_PLOT);

      expect(ranked.slice(0, 14).every((entry) => entry.plant.light === 'partial-shade')).toBe(
        true,
      );
    });

    it('is alphabetical within a tier, because every tie-break below the score is', () => {
      const ranked = rankPlants(PLANTS, SUNNY_PLOT).slice(0, 5);

      expect(ranked.map((entry) => entry.plant.commonName)).toEqual([
        'Acorn Squash',
        'Amaranth',
        'Anaheim Pepper',
        'Apricot',
        'Artichoke',
      ]);
    });

    it('ranks the same set identically however the input is ordered', () => {
      const forwards = rankPlants(PLANTS, PARTIAL_PLOT).map((entry) => entry.plant.id);
      const backwards = rankPlants([...PLANTS].reverse(), PARTIAL_PLOT).map(
        (entry) => entry.plant.id,
      );

      expect(backwards).toEqual(forwards);
    });
  });

  it('scores a real record as a documented worked example', () => {
    // Lettuce is one of the fourteen partial-shade records, and carries nothing
    // beyond identity, category, light and spacing — like every shipped record.
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
    expect(result.dimensions.map((dimension) => dimension.finding)).toEqual([
      'match',
      'unknown-plant',
      'unknown-plant',
      'unknown-plant',
    ]);
    expect(result.summary).toBe(
      'Good match — Wants partial shade, and the plot is in partial shade. ' +
        'Scored on light alone — no hardiness, soil or season data for this crop (confidence 35%).',
    );
  });

  it('describing the plot more fully cannot raise a shipped record above light alone', () => {
    // A user who fills in soil and a planting month gets no extra confidence for
    // records that say nothing about either — the gap is in our data, and the
    // reasoning says so rather than rewarding the extra input.
    const richPlot = resolvePlotConditions({
      light: 'full-sun',
      soil: { texture: 'loam', ph: 'neutral', moisture: 'moist' },
      plantingMonth: 4,
    });

    const result = scorePlant(PLANTS[0], richPlot);

    expect(result.confidence).toBe(0.35);
    expect(result.dimensions[2]).toMatchObject({ dimension: 'soil', finding: 'unknown-plant' });
  });
});
