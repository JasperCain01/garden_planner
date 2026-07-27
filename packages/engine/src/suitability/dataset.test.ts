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
 *
 * **Stage 6.0** then changed the crop list itself: 24 crops that can't be grown
 * outdoors in Britain were removed (`packages/etl/src/exclusions/`, ADR 0025)
 * and six British staples added through the curated channel (`apple`, `pear`,
 * `raspberry`, `brussels-sprouts`, `swede`, `pumpkin`), taking the dataset from
 * 162 records to **144**. Every figure below moved, and the interesting move is
 * the top of the ranking: eight records now carry hardiness and seasons instead
 * of two, so the sunny-plot list has **six** distinct scores rather than four,
 * and its first eight places are decided by real data rather than by the
 * alphabet. That is still only 8/144 — this stage did not close the
 * hardiness/season gap and was not meant to (see `WORKPLAN.md` Stage 6.0) —
 * but it is the first time the ranking's top is doing something a gardener
 * could not have got from sorting the list by name.
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
    expect(PLANTS).toHaveLength(144);
    expect(PLANTS.filter((plant) => plant.light === 'full-sun')).toHaveLength(133);
    expect(PLANTS.filter((plant) => plant.light === 'partial-shade')).toHaveLength(11);
    // The coverage that makes the missing-data policy the design decision it
    // is — and the eight curated records that now exercise it: two from Stage
    // 1.7, six British staples from Stage 6.0. Every one of them states both
    // hardiness *and* seasons, which is why the two lists are identical.
    expect(PLANTS.filter((plant) => plant.hardiness !== undefined).map((p) => p.id)).toEqual([
      'apple',
      'broad-bean',
      'brussels-sprouts',
      'jerusalem-artichoke',
      'pear',
      'pumpkin',
      'raspberry',
      'swede',
    ]);
    // 72 from the curated moisture table + the 8 curated records that carry a
    // soil block of their own.
    expect(PLANTS.filter((plant) => plant.soil !== undefined)).toHaveLength(80);
    expect(PLANTS.filter((plant) => plant.soil?.moisture !== undefined)).toHaveLength(80);
    expect(PLANTS.filter((plant) => plant.seasons !== undefined)).toHaveLength(8);
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

  it('lifts 72 records to 0.55 confidence, and 8 to full, once the plot names its moisture', () => {
    const byConfidence = new Map<number, number>();
    for (const plant of PLANTS) {
      const { confidence } = scorePlant(plant, DRY_PLOT);
      byConfidence.set(confidence, (byConfidence.get(confidence) ?? 0) + 1);
    }
    // 64 still light-only, 72 gained the soil dimension, and the 8 curated
    // records are now fully assessed on all four. The light-only group shrank
    // from 88 to 64 with Stage 6.0's exclusions: the crops that couldn't be
    // grown here were also, unsurprisingly, the ones nobody had curated data
    // for — pruning them raised the *proportion* of the catalogue the engine
    // can say something about, which is half of why it was worth doing.
    expect([...byConfidence.entries()].sort()).toEqual([
      [0.35, 64],
      [0.55, 72],
      [1, 8],
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
    // Six distinct scores, up from four before Stage 6.0. Two come from light
    // (0.675 full-sun, 0.5525 partial-shade); the other four are the eight
    // curated records separating on hardiness and season — 0.9 for a crop
    // whose sowing window and hardiness both suit a British plot, 0.87 and
    // 0.84 for near misses, and 0.69 for pumpkin, whose H2 tenderness the
    // engine correctly marks down two bands.
    expect([...distinctScores].sort((a, b) => b - a)).toEqual([
      0.9, 0.87, 0.84, 0.69, 0.675, 0.5525,
    ]);
  });

  it('caps no record on a sunny plot — nothing is unsuitable in full sun', () => {
    const bands = new Set(PLANTS.map((plant) => scorePlant(plant, SUNNY_PLOT).band));

    // 'excellent' is the curated records' extra assessed dimensions
    // (hardiness, season) pushing them past the 'good' ceiling every other
    // light-only record is confidence-shrunk down to. Seven of the eight get
    // there; pumpkin does not, because H2 against a plot needing H4 is a real
    // mark-down, which is the model working rather than a gap in the data.
    expect(bands).toEqual(new Set(['good', 'fair', 'excellent']));
  });

  describe('an all-shade plot', () => {
    it('makes every full-sun record unsuitable, with light named as the limiting factor', () => {
      const results = PLANTS.filter((plant) => plant.light === 'full-sun').map((plant) =>
        scorePlant(plant, SHADY_PLOT),
      );

      expect(results).toHaveLength(133);
      for (const result of results) {
        expect(result.band).toBe('unsuitable');
        expect(result.limitedBy).toEqual(['light']);
        expect(result.summary).toContain('too dark');
      }
    });

    it('leaves exactly the eleven shade-tolerant crops once unsuitable ones are excluded', () => {
      // Fourteen before Stage 6.0: ginger, water spinach and pawpaw were all
      // partial-shade records, and all three left with the exclusions.
      const ranked = rankPlants(PLANTS, SHADY_PLOT, { excludeUnsuitable: true });

      expect(ranked).toHaveLength(11);
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

      expect(ranked).toHaveLength(144);
      const firstShadeTolerant = ranked.findIndex((entry) => entry.plant.light === 'partial-shade');
      expect(firstShadeTolerant).toBe(133);
      expect(ranked.slice(133).every((entry) => entry.plant.light === 'partial-shade')).toBe(true);
    });

    it('inverts that order in a shady plot', () => {
      const ranked = rankPlants(PLANTS, SHADY_PLOT);

      expect(ranked.slice(0, 11).every((entry) => entry.plant.light === 'partial-shade')).toBe(
        true,
      );
    });

    it('is alphabetical within a tier, because every tie-break below the score is', () => {
      const ranked = rankPlants(PLANTS, SUNNY_PLOT).slice(0, 11);

      // Stage 6.0 made this test say something it couldn't before. The eight
      // curated records now fill four real tiers ahead of the light-only
      // 0.675 crowd — 0.9 (three of them), 0.87, 0.84 (three), 0.69 — and the
      // alphabetical tie-break shows up *inside* those tiers, not only in the
      // undifferentiated mass below them. Brussels sprouts before Jerusalem
      // artichoke before swede is the alphabet breaking a genuine three-way
      // tie on score; Acorn Squash onwards is the old behaviour, unchanged.
      expect(ranked.map((entry) => entry.plant.commonName)).toEqual([
        'Brussels sprouts',
        'Jerusalem artichoke',
        'Swede',
        'Broad bean',
        'Apple',
        'Pear',
        'Raspberry',
        'Pumpkin',
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
