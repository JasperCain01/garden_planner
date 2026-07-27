/**
 * `scorePlant` — the aggregate suitability scorer, and the place the model's
 * missing-data policy is actually implemented.
 *
 * The four dimension scorers each answer their own question; this module turns
 * their answers into one number the palette can rank by, one confidence figure
 * saying how much of that number is backed by data, and one sentence explaining
 * both. See `model.ts` for the constants and
 * `docs/adr/0012-suitability-scoring.md` for the reasoning.
 */

import type { Plant } from '../schema/plant.ts';
import type { PlotConditions } from './conditions.ts';
import type { DimensionScore, SuitabilityDimension, SuitabilityResult } from './model.ts';
import {
  BAND_LABELS,
  LIMITING_FACTOR_CAP,
  NEUTRAL_PRIOR,
  TOTAL_DIMENSION_WEIGHT,
  bandForScore,
  isUnknownFinding,
  roundScore,
} from './model.ts';
import { scoreLight } from './light.ts';
import { scoreHardiness } from './hardiness.ts';
import { scoreSoil } from './soil.ts';
import { scoreSeason } from './season.ts';
import { joinWords } from './text.ts';

/** How each dimension reads inside a summary sentence. */
const DIMENSION_NOUNS: Readonly<Record<SuitabilityDimension, string>> = {
  light: 'light',
  hardiness: 'hardiness',
  soil: 'soil',
  season: 'season',
};

/** The aggregate figures, separated from the prose so both can be tested directly. */
export interface AggregateScore {
  /** Weighted mean over assessed dimensions, capped if a limiting factor applies. */
  readonly score: number;
  /** Share of the model's total weight that could be assessed (0–1). */
  readonly confidence: number;
  /** The confidence-shrunk, capped figure used for ordering and banding. */
  readonly rankingScore: number;
  /** The coarse verdict. */
  readonly band: SuitabilityResult['band'];
  /** Dimensions whose finding was `unsuitable`. */
  readonly limitedBy: readonly SuitabilityDimension[];
}

/**
 * Score one plant against one plot's conditions.
 *
 * Pure and total: it never throws for a valid `Plant` and valid
 * {@link PlotConditions}, never reads a clock, and never touches the network.
 * Both arguments are assumed already validated — `resolvePlotConditions` (and
 * `validatePlant` upstream) are the boundary; re-validating on every call would
 * cost real time when ranking 144+ records and buy nothing.
 *
 * @param plant - any valid plant record, shipped or user-defined (ADR 0011 —
 *   there is no origin-awareness here, and there should never be).
 * @param conditions - the plot's resolved growing conditions.
 * @returns the aggregate result, carrying the full per-dimension breakdown.
 */
export function scorePlant(plant: Plant, conditions: PlotConditions): SuitabilityResult {
  // Always all four, always in this order, so a consumer can index the
  // breakdown without searching and a missing dimension is visible rather than
  // absent.
  const dimensions: DimensionScore[] = [
    scoreLight(plant, conditions),
    scoreHardiness(plant, conditions),
    scoreSoil(plant, conditions),
    scoreSeason(plant, conditions),
  ];

  const aggregate = aggregateDimensionScores(dimensions);

  return {
    plantId: plant.id,
    ...aggregate,
    dimensions,
    summary: summarise(aggregate, dimensions),
  };
}

/**
 * Combine per-dimension scores into the aggregate figures.
 *
 * The whole missing-data policy lives in these few lines:
 *
 * 1. Dimensions with no data (`score === null`) contribute **nothing** — not a
 *    zero, not a one, not a default. `score` is therefore the weighted mean over
 *    what is actually known: "given what we know, how good a fit is this?".
 * 2. `confidence` is the share of the model's weight that was assessed, so the
 *    information lost in step 1 is reported rather than buried.
 * 3. `rankingScore` shrinks `score` towards {@link NEUTRAL_PRIOR} by that
 *    confidence. This is what stops "absent" reading as either a perfect match
 *    or a total mismatch: a crop known only by its light can neither top the
 *    list on one lucky dimension nor be buried for facts nobody recorded.
 * 4. If any dimension is `unsuitable`, both figures are capped
 *    ({@link LIMITING_FACTOR_CAP}) and the band is forced to `unsuitable` —
 *    the limiting factor governs, whatever the other dimensions say.
 *
 * Exported because it is genuinely reusable (Stage 2.3 may re-aggregate a subset
 * of dimensions) and because it makes the policy directly testable.
 */
export function aggregateDimensionScores(dimensions: readonly DimensionScore[]): AggregateScore {
  const assessed = dimensions.filter(
    (dimension): dimension is DimensionScore & { score: number } => dimension.score !== null,
  );

  const assessedWeight = assessed.reduce((total, dimension) => total + dimension.weight, 0);
  const weightedTotal = assessed.reduce(
    (total, dimension) => total + dimension.score * dimension.weight,
    0,
  );

  // Guard against a division by zero. Unreachable through `scorePlant` — `light`
  // is required on both a plant and a plot, so at least one dimension is always
  // assessed — but `aggregateDimensionScores` is public, and the neutral prior is
  // the honest answer to "we know nothing at all" anyway.
  const evidence = assessedWeight === 0 ? NEUTRAL_PRIOR : weightedTotal / assessedWeight;
  const confidence = assessedWeight / TOTAL_DIMENSION_WEIGHT;
  const shrunk = evidence * confidence + NEUTRAL_PRIOR * (1 - confidence);

  const limitedBy = dimensions
    .filter((dimension) => dimension.finding === 'unsuitable')
    .map((dimension) => dimension.dimension);
  const limited = limitedBy.length > 0;

  const score = limited ? Math.min(evidence, LIMITING_FACTOR_CAP) : evidence;
  const rankingScore = limited ? Math.min(shrunk, LIMITING_FACTOR_CAP) : shrunk;

  return {
    score: roundScore(score),
    confidence: roundScore(confidence),
    rankingScore: roundScore(rankingScore),
    band: limited ? 'unsuitable' : bandForScore(roundScore(rankingScore)),
    limitedBy,
  };
}

/**
 * Build the one-line explanation the palette shows.
 *
 * Structure: the band, then the single most decisive reason (the limiting
 * factor if there is one, otherwise the weakest assessed dimension), then — and
 * this is the part the Stage 2.1 brief insists on — an explicit statement of
 * what could **not** be assessed, so a score resting on one dimension never
 * looks like a fully-informed verdict.
 */
function summarise(aggregate: AggregateScore, dimensions: readonly DimensionScore[]): string {
  const assessed = dimensions.filter((dimension) => !isUnknownFinding(dimension.finding));

  const lead =
    dimensions.find((dimension) => dimension.dimension === aggregate.limitedBy[0]) ??
    weakestOf(assessed);

  const parts = [
    `${BAND_LABELS[aggregate.band]} — ${lead?.reason ?? 'Nothing could be assessed.'}`,
  ];

  const unknownPlant = dimensions
    .filter((dimension) => dimension.finding === 'unknown-plant')
    .map((dimension) => DIMENSION_NOUNS[dimension.dimension]);
  const unknownPlot = dimensions
    .filter((dimension) => dimension.finding === 'unknown-plot')
    .map((dimension) => DIMENSION_NOUNS[dimension.dimension]);

  if (unknownPlant.length > 0 || unknownPlot.length > 0) {
    const gaps: string[] = [];
    if (unknownPlant.length > 0)
      gaps.push(`no ${joinWords(unknownPlant, 'or')} data for this crop`);
    if (unknownPlot.length > 0) gaps.push(`the plot's ${joinWords(unknownPlot)} wasn't described`);

    const assessedNouns = assessed.map((dimension) => DIMENSION_NOUNS[dimension.dimension]);
    // "alone" only reads right for a single dimension; with several, the list
    // itself carries the "and nothing else" sense.
    const scoredOn =
      assessedNouns.length === 0
        ? 'Nothing was scored'
        : assessedNouns.length === 1
          ? `Scored on ${assessedNouns[0]} alone`
          : `Scored on ${joinWords(assessedNouns)}`;

    parts.push(
      `${scoredOn} — ${joinWords(gaps)} (confidence ${Math.round(aggregate.confidence * 100)}%).`,
    );
  }

  return parts.join(' ');
}

/** The lowest-scoring assessed dimension; ties fall to the earliest (heaviest) one. */
function weakestOf(assessed: readonly DimensionScore[]): DimensionScore | undefined {
  return assessed.reduce<DimensionScore | undefined>(
    (weakest, dimension) =>
      weakest === undefined || (dimension.score ?? 1) < (weakest.score ?? 1) ? dimension : weakest,
    undefined,
  );
}
