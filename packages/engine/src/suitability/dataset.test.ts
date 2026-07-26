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
 * every record. These tests pin what the model actually does on the data that
 * ships today.
 *
 * Stage 1.7 added two curated records (`broad-bean`, `jerusalem-artichoke`)
 * that carry hardiness and season data no OpenFarm-sourced record does, which
 * is exactly the coverage tripwire this suite's original module doc predicted:
 * those two now score with 0.8 confidence (light + hardiness + season
 * assessed) against the other 160's 0.35 (light alone) — the honest
 * consequence of genuinely uneven coverage, not a bug to paper over.
 *
 * The **curated moisture table** (`packages/etl/src/moisture/`) then gave 72
 * records a `soil.moisture` preference, and its arrival is the clearest thing
 * this suite has ever demonstrated: **it changes nothing on a plot whose soil
 * the user hasn't described.** Soil then scores `unknown-plot`, not
 * `unknown-plant` — the gap moved from the crop to the plot, confidence stays
 * at 0.35, and the ranking is unmoved. The data only pays off once the user
 * fills in the plot form's moisture dropdown, at which point 72 crops jump to
 * 0.55 confidence and the list genuinely re-orders. Both halves are pinned
 * below, because the second is the feature and the first is the honest
 * small print.
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
/** A plot that actually describes its soil — what the moisture table exists for. */
const DRY_PLOT = resolvePlotConditions({ light: 'full-sun', soil: { moisture: 'dry' } });

describe('the shipped dataset', () => {
  it('is the dataset these expectations were written against', () => {
    expect(PLANTS).toHaveLength(162);
    expect(PLANTS.filter((plant) => plant.light === 'full-sun')).toHaveLength(148);
    expect(PLANTS.filter((plant) => plant.light === 'partial-shade')).toHaveLength(14);
    // The coverage that makes the missing-data policy the design decision it
    // is — and the two Stage 1.7 curated records that now exercise it.
    expect(PLANTS.filter((plant) => plant.hardiness !== undefined).map((p) => p.id)).toEqual([
      'broad-bean',
      'jerusalem-artichoke',
    ]);
    // 72 from the curated moisture table + the 2 Stage 1.7 records that carry
    // a full soil block of their own.
    expect(PLANTS.filter((plant) => plant.soil !== undefined)).toHaveLength(74);
    expect(PLANTS.filter((plant) => plant.soil?.moisture !== undefined)).toHaveLength(74);
    expect(PLANTS.filter((plant) => plant.seasons !== undefined)).toHaveLength(2);
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

  it('reports 0.35 confidence on a plot whose soil is undescribed, however good the crop data is', () => {
    // The small print: moisture data on the *crop* buys nothing until the
    // *plot* describes its soil. What changes for an enriched crop is only the
    // wording — the gap is now the plot's, not the crop's.
    for (const plant of PLANTS) {
      const result = scorePlant(plant, SUNNY_PLOT);
      if (plant.hardiness !== undefined) {
        expect(result.confidence).toBe(0.8);
        expect(result.summary).toContain('Scored on light, hardiness and season');
      } else {
        expect(result.confidence).toBe(0.35);
        expect(result.summary).toContain('Scored on light alone');
      }
      if (plant.soil !== undefined) {
        expect(result.summary).toContain("the plot's soil wasn't described");
        expect(result.summary).not.toContain('no soil data for this crop');
      }
    }
  });

  it('lifts 72 records to 0.55 confidence once the plot names its moisture', () => {
    const byConfidence = new Map<number, number>();
    for (const plant of PLANTS) {
      const { confidence } = scorePlant(plant, DRY_PLOT);
      byConfidence.set(confidence, (byConfidence.get(confidence) ?? 0) + 1);
    }
    // 88 still light-only, 72 gained the soil dimension, and the 2 curated
    // records are now fully assessed on all four.
    expect([...byConfidence.entries()].sort()).toEqual([
      [0.35, 88],
      [0.55, 72],
      [1, 2],
    ]);
  });

  it('re-orders the palette on a dry plot — the axis actually does work', () => {
    // The whole point of the moisture table. On dry ground a drought-tolerant
    // crop must outrank a thirsty one; before this data every full-sun crop
    // tied at exactly one score.
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

  it('does not collapse to a single number — it discriminates exactly as far as the data allows', () => {
    const distinctScores = new Set(
      PLANTS.map((plant) => scorePlant(plant, SUNNY_PLOT).rankingScore),
    );

    expect(distinctScores.size).toBeGreaterThan(1);
    // Two light values plus the two Stage 1.7 curated records' extra assessed
    // dimensions (hardiness, season) is what actually separates today's
    // records — no longer light alone, now that real coverage exists.
    expect([...distinctScores].sort((a, b) => b - a)).toEqual([0.9, 0.87, 0.675, 0.5525]);
  });

  it('caps no record on a sunny plot — nothing is unsuitable in full sun', () => {
    const bands = new Set(PLANTS.map((plant) => scorePlant(plant, SUNNY_PLOT).band));

    // 'excellent' is new: the two curated records' extra assessed dimensions
    // (hardiness, season) push them past the 'good' ceiling every other
    // light-only record is confidence-shrunk down to.
    expect(bands).toEqual(new Set(['good', 'fair', 'excellent']));
  });

  describe('an all-shade plot', () => {
    it('makes every full-sun record unsuitable, with light named as the limiting factor', () => {
      const results = PLANTS.filter((plant) => plant.light === 'full-sun').map((plant) =>
        scorePlant(plant, SHADY_PLOT),
      );

      expect(results).toHaveLength(148);
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

      expect(ranked).toHaveLength(162);
      const firstShadeTolerant = ranked.findIndex((entry) => entry.plant.light === 'partial-shade');
      expect(firstShadeTolerant).toBe(148);
      expect(ranked.slice(148).every((entry) => entry.plant.light === 'partial-shade')).toBe(true);
    });

    it('inverts that order in a shady plot', () => {
      const ranked = rankPlants(PLANTS, SHADY_PLOT);

      expect(ranked.slice(0, 14).every((entry) => entry.plant.light === 'partial-shade')).toBe(
        true,
      );
    });

    it('is alphabetical within a tier, because every tie-break below the score is', () => {
      const ranked = rankPlants(PLANTS, SUNNY_PLOT).slice(0, 5);

      // The two Stage 1.7 curated records each sit in their own singleton
      // tier (0.9, 0.87 — no other record's extra assessed dimensions match),
      // ahead of the light-only 0.675 tier every other full-sun record shares
      // — which is where the alphabetical tie-break actually shows up, for
      // the next three.
      expect(ranked.map((entry) => entry.plant.commonName)).toEqual([
        'Jerusalem artichoke',
        'Broad bean',
        'Acorn Squash',
        'Amaranth',
        'Anaheim Pepper',
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
    // Lettuce is one of the fourteen partial-shade records. It now also carries
    // a moisture preference from the curated table, but nothing else — no
    // hardiness, no seasons — like most of the catalogue.
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
    // Soil is `unknown-plot`, not `unknown-plant`: lettuce now states its
    // moisture, but this plot doesn't state its own, so the missing half is
    // the plot's. That distinction is the whole reason the finding vocabulary
    // has two "unknown" values rather than one.
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
