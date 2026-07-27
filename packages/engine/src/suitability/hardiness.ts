/**
 * The **hardiness** dimension: will this crop survive the winter here?
 *
 * A plant and a climate profile carry the *same* `HardinessSchema` block —
 * an optional RHS band plus an optional minimum temperature (ADR 0004 §3, ADR
 * 0010 §1) — which is exactly why no conversion step is needed: `rhsHardinessRank`
 * compares like with like.
 *
 * **Almost no shipped record carries hardiness** (8/144 — every curated crop
 * and nothing else: Stage 1.7's `broad-bean` and `jerusalem-artichoke`, plus
 * Stage 6.0's `apple`, `pear`, `raspberry`, `brussels-sprouts`, `swede` and
 * `pumpkin`), so in practice this dimension reports `unknown-plant` for nearly
 * the whole current dataset and drops out of the score. That is the honest
 * answer, and it is visible in the result's confidence and reasoning rather
 * than hidden behind a default. A user-defined crop (ADR 0011) can also supply
 * hardiness — which is why the policy is per-record rather than a blanket "we
 * have no hardiness data", and why those eight crops score on three dimensions
 * where every OpenFarm-sourced record scores on one.
 */

import type { Hardiness, Plant, RhsHardinessRating } from '../schema/plant.ts';
import { rhsHardinessRank } from '../schema/plant.ts';
import type { PlotConditions } from './conditions.ts';
import type { DimensionScore } from './model.ts';
import { DIMENSION_WEIGHTS, findingForScore } from './model.ts';

/**
 * Scores by how many RHS bands **too tender** a crop is for the region, e.g.
 * an H3 crop in an H5 region is two bands short.
 *
 * Being *hardier* than the region needs is never penalised — index 0 covers
 * every crop rated at or above the local band.
 *
 * One band short is genuinely marginal rather than fatal: it typically means
 * "survives an average winter, lost in a hard one, fine under a fleece". Three
 * or more bands is `unsuitable` — a crop needing a heated greenhouse does not
 * belong in a ranked list of things to plant outdoors in a Scottish garden.
 */
const BAND_DEFICIT_SCORES: readonly number[] = [1, 0.6, 0.3, 0];

/**
 * The same idea on the °C scale, used when the two sides don't both carry an
 * RHS band. Thresholds are the margin by which the crop's minimum survivable
 * temperature sits *above* the region's typical winter minimum.
 */
const TEMPERATURE_TIERS: readonly { readonly withinC: number; readonly score: number }[] = [
  { withinC: 2, score: 0.6 },
  { withinC: 6, score: 0.3 },
];

/**
 * Score a plant's hardiness against its plot's climate band.
 *
 * Prefers the RHS-band comparison when both sides have one (no conversion, and
 * it is the vocabulary the UK-default profile is authored in), falling back to
 * the portable °C figures. If the two sides have no representation in common,
 * the dimension is reported unknown rather than guessed at.
 */
export function scoreHardiness(plant: Plant, conditions: PlotConditions): DimensionScore {
  const dimension = 'hardiness' as const;
  const weight = DIMENSION_WEIGHTS.hardiness;
  const region = conditions.climate;
  const plantHardiness: Hardiness | undefined = plant.hardiness;

  if (plantHardiness === undefined) {
    return {
      dimension,
      finding: 'unknown-plant',
      score: null,
      weight,
      reason: `No hardiness data for this crop, so its winter survival in ${region.name} is unassessed.`,
    };
  }

  if (plantHardiness.rhsRating !== undefined && region.hardiness.rhsRating !== undefined) {
    return byBand(plantHardiness.rhsRating, region.hardiness.rhsRating, region.name, weight);
  }

  if (plantHardiness.minTempC !== undefined && region.hardiness.minTempC !== undefined) {
    return byTemperature(plantHardiness.minTempC, region.hardiness.minTempC, region.name, weight);
  }

  // Both sides carry hardiness, but not in a form that can be compared (e.g. the
  // crop quotes only a temperature and the region only a band). Rare — every
  // shipped climate profile carries both — but treated as unknown rather than
  // converted, because a band↔°C conversion would invent precision.
  return {
    dimension,
    finding: 'unknown-plant',
    score: null,
    weight,
    reason: `This crop's hardiness can't be compared with ${region.name}'s — the two use different measures (RHS band vs. minimum temperature).`,
  };
}

/** The RHS-band comparison. Both sides use the same ordered enum (ADR 0004 §4). */
function byBand(
  plantRating: RhsHardinessRating,
  regionRating: RhsHardinessRating,
  regionName: string,
  weight: number,
): DimensionScore {
  // Higher rank = hardier. A crop is short by however many bands it sits below
  // the region's band; at or above it, the deficit is 0.
  const deficit = Math.max(0, rhsHardinessRank(regionRating) - rhsHardinessRank(plantRating));
  const score = BAND_DEFICIT_SCORES[Math.min(deficit, BAND_DEFICIT_SCORES.length - 1)];

  const preamble = `Rated ${plantRating}; ${regionName} needs ${regionRating}`;
  const reason =
    deficit === 0
      ? `Rated ${plantRating}, hardy enough for ${regionName} (${regionRating}).`
      : deficit === 1
        ? `${preamble} — one band short, so it should come through an average winter but not a hard one.`
        : deficit === 2
          ? `${preamble} — two bands short, so it needs a cloche, fleece or a sheltered wall to overwinter.`
          : `${preamble} — ${deficit} bands short, too tender to survive outdoors here.`;

  return { dimension: 'hardiness', finding: findingForScore(score), score, weight, reason };
}

/** The °C fallback, for records that quote a temperature rather than a band. */
function byTemperature(
  plantMinTempC: number,
  regionMinTempC: number,
  regionName: string,
  weight: number,
): DimensionScore {
  // Positive = the crop gives out before the region's winter does.
  const shortfallC = plantMinTempC - regionMinTempC;
  const score =
    shortfallC <= 0
      ? 1
      : (TEMPERATURE_TIERS.find((tier) => shortfallC <= tier.withinC)?.score ?? 0);

  const reason =
    shortfallC <= 0
      ? `Survives to ${plantMinTempC} °C, below ${regionName}'s typical winter minimum of ${regionMinTempC} °C.`
      : `Survives only to ${plantMinTempC} °C, but ${regionName} drops to about ${regionMinTempC} °C — ${roundDegrees(shortfallC)} °C too tender.`;

  return { dimension: 'hardiness', finding: findingForScore(score), score, weight, reason };
}

/** Tidy a °C gap for display; the underlying figures are approximate anyway. */
function roundDegrees(value: number): number {
  return Math.round(value * 10) / 10;
}
