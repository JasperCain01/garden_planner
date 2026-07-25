/**
 * The **soil** dimension: texture, pH and moisture.
 *
 * Scored as a simple membership test per facet — a crop's `soil` block lists the
 * values it tolerates, a plot has exactly one of each (see `conditions.ts` for
 * why the shapes are asymmetric) — averaged over the facets both sides describe.
 *
 * Two deliberate restraints:
 *
 * 1. **Soil never returns 0**, so it can never make a crop `unsuitable`. Soil is
 *    the one condition a gardener changes: grit and organic matter move texture,
 *    lime and sulphur move pH, drainage and irrigation move moisture. A wrong
 *    soil is a warning to raise (Stage 2.3) and a job to do, not a veto.
 * 2. **pH bands are treated as unordered.** `acid`/`neutral`/`alkaline` *looks*
 *    ordinal, but ADR 0004 only promises a meaningful ordering for `light` and
 *    `rhsRating` — those are the enums with rank helpers. Inferring an order from
 *    the declaration order of another enum would silently couple this scorer to
 *    the array literal in `plant.ts`. With only three bands, adjacency would buy
 *    little anyway.
 *
 * No shipped record carries soil today (0/160), so this dimension reports
 * `unknown-plant` across the current dataset — visibly, in the reasoning.
 */

import type { Plant } from '../schema/plant.ts';
import type { PlotConditions, PlotSoil } from './conditions.ts';
import type { DimensionScore } from './model.ts';
import { DIMENSION_WEIGHTS, findingForScore } from './model.ts';
import { capitalise, joinWords } from './text.ts';

/**
 * The score for a facet the plot has and the crop does *not* accept. Well above
 * 0 because it is amendable (see the module doc), but low enough that a crop
 * mismatched on all three facets lands firmly in `mismatch`.
 */
const FACET_MISMATCH_SCORE = 0.3;

/** One comparable facet: what the plot has, and whether the crop accepts it. */
interface FacetComparison {
  /**
   * How the facet reads in a sentence — "loam **texture**", "neutral **pH**",
   * "moist **conditions**". Not always the field's name: "moist moisture" is
   * not a sentence anyone would write.
   */
  readonly noun: string;
  /** The plot's value, e.g. "clay". */
  readonly plotValue: string;
  /** The values the crop accepts, for the mismatch explanation. */
  readonly accepted: readonly string[];
  readonly matches: boolean;
}

/**
 * Score a plot's soil against a crop's stated preferences.
 *
 * Only facets **both** sides describe are compared; a crop that says nothing
 * about pH is not judged on the plot's pH. If nothing is comparable, the
 * dimension is unknown and drops out of the aggregate entirely.
 */
export function scoreSoil(plant: Plant, conditions: PlotConditions): DimensionScore {
  const dimension = 'soil' as const;
  const weight = DIMENSION_WEIGHTS.soil;
  const plotSoil = conditions.soil;

  if (plant.soil === undefined) {
    return {
      dimension,
      finding: 'unknown-plant',
      score: null,
      weight,
      reason: 'No soil data for this crop, so its soil preferences are unassessed.',
    };
  }

  if (plotSoil === undefined) {
    return {
      dimension,
      finding: 'unknown-plot',
      score: null,
      weight,
      reason:
        "The plot's soil wasn't described, so soil wasn't scored — add it to sharpen the ranking.",
    };
  }

  const comparisons = compareFacets(plant.soil, plotSoil);

  if (comparisons.length === 0) {
    return {
      dimension,
      finding: 'unknown-plant',
      score: null,
      weight,
      reason: `This crop's soil data doesn't cover what's known about the plot (${describeFacetNames(plotSoil)}), so soil wasn't scored.`,
    };
  }

  const score =
    comparisons.reduce((total, facet) => total + (facet.matches ? 1 : FACET_MISMATCH_SCORE), 0) /
    comparisons.length;

  return {
    dimension,
    finding: findingForScore(score),
    score,
    weight,
    reason: soilReason(comparisons),
  };
}

/** Pair up the facets both sides describe. Order is stable: texture, pH, moisture. */
function compareFacets(
  plantSoil: NonNullable<Plant['soil']>,
  plotSoil: PlotSoil,
): FacetComparison[] {
  const comparisons: FacetComparison[] = [];

  if (plotSoil.texture !== undefined && plantSoil.textures !== undefined) {
    comparisons.push({
      noun: 'texture',
      plotValue: plotSoil.texture,
      accepted: plantSoil.textures,
      matches: plantSoil.textures.includes(plotSoil.texture),
    });
  }
  if (plotSoil.ph !== undefined && plantSoil.ph !== undefined) {
    comparisons.push({
      noun: 'pH',
      plotValue: plotSoil.ph,
      accepted: plantSoil.ph,
      matches: plantSoil.ph.includes(plotSoil.ph),
    });
  }
  if (plotSoil.moisture !== undefined && plantSoil.moisture !== undefined) {
    comparisons.push({
      noun: 'conditions',
      plotValue: plotSoil.moisture,
      accepted: plantSoil.moisture,
      matches: plantSoil.moisture.includes(plotSoil.moisture),
    });
  }

  return comparisons;
}

/** The human-readable half of {@link scoreSoil}. */
function soilReason(comparisons: readonly FacetComparison[]): string {
  const matched = comparisons.filter((facet) => facet.matches);
  const missed = comparisons.filter((facet) => !facet.matches);

  const matchedText =
    matched.length > 0
      ? `Suits the plot's ${joinWords(matched.map((facet) => `${facet.plotValue} ${facet.noun}`))}`
      : '';
  const missedText =
    missed.length > 0
      ? joinWords(
          missed.map(
            (facet) =>
              `prefers ${joinWords([...facet.accepted], 'or')} ${facet.noun}, not ${facet.plotValue}`,
          ),
        )
      : '';

  if (missedText === '') return `${matchedText}.`;
  if (matchedText === '')
    return `${capitalise(missedText)} — soil is amendable, so treat this as a job rather than a barrier.`;
  return `${matchedText}, but ${missedText} — amendable with time and organic matter.`;
}

/** Which facets the user described, for the "nothing comparable" explanation. */
function describeFacetNames(plotSoil: PlotSoil): string {
  const names: string[] = [];
  if (plotSoil.texture !== undefined) names.push('texture');
  if (plotSoil.ph !== undefined) names.push('pH');
  if (plotSoil.moisture !== undefined) names.push('moisture');
  return joinWords(names);
}
