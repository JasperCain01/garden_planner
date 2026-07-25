/**
 * `rankPlants` — the palette's entry point (Stage 3.3): score a list of crops
 * against one plot and return them best-first.
 *
 * The interesting parts are the tie-break rules and the fact that the ordering
 * key is `rankingScore` rather than `score`. On today's dataset that matters a
 * lot: every shipped record is scored on light alone, so raw evidence scores
 * take only a handful of distinct values and *something* has to make the order
 * deterministic.
 */

import type { Plant } from '../schema/plant.ts';
import type { PlotConditions } from './conditions.ts';
import type { SuitabilityResult } from './model.ts';
import { scorePlant } from './score.ts';

/** A plant and its score, as the palette consumes them. */
export interface RankedPlant {
  /** The plant record itself, so the caller needn't re-look it up by id. */
  readonly plant: Plant;
  /** Its full suitability result, breakdown and reasoning included. */
  readonly suitability: SuitabilityResult;
}

/** Options for {@link rankPlants}. All optional; the default is "everything, ranked". */
export interface RankPlantsOptions {
  /**
   * Drop crops whose band is `unsuitable` — i.e. those with a hard mismatch on
   * some dimension. This is how the "no matching plants" case arises honestly:
   * an all-shade plot with a full-sun-only dataset returns an **empty list**,
   * and the UI can say so rather than showing a list of things that won't grow.
   */
  readonly excludeUnsuitable?: boolean;
  /**
   * Drop crops whose `rankingScore` is below this threshold (0–1). Compared
   * against `rankingScore` — the same figure the ordering and the band use — so
   * a filter can never disagree with the order it filters.
   */
  readonly minimumScore?: number;
  /** Keep only the first N results, applied after sorting and filtering. */
  readonly limit?: number;
}

/**
 * Score every plant against the plot and return them best-first.
 *
 * Ordering, in priority order:
 *
 * 1. **`rankingScore` descending** — the confidence-adjusted figure (see
 *    `model.ts`), so a well-evidenced good match outranks a barely-known
 *    perfect one.
 * 2. **`confidence` descending** — between two crops the model rates equally,
 *    prefer the one we actually know something about.
 * 3. **`commonName`, then `id`, ascending** — a total, data-independent
 *    tie-break. Ids are unique, so the comparator is a total order and the
 *    result does not depend on the input list's order: ranking the same set
 *    twice, in any order, gives the same list. (Plain `<`/`>` rather than
 *    `localeCompare`, which is locale- and ICU-dependent and would make the
 *    order vary by environment.)
 *
 * @param plants - the crops to rank. Stage 3.1 passes `shipped ∪ user`; there is
 *   deliberately no special-casing of user crops (ADR 0011).
 * @param conditions - the plot's resolved growing conditions.
 * @param options - optional filtering/truncation, see {@link RankPlantsOptions}.
 */
export function rankPlants(
  plants: readonly Plant[],
  conditions: PlotConditions,
  options: RankPlantsOptions = {},
): RankedPlant[] {
  const ranked: RankedPlant[] = plants.map((plant) => ({
    plant,
    suitability: scorePlant(plant, conditions),
  }));

  ranked.sort(compareRanked);

  let result = ranked;
  if (options.excludeUnsuitable === true) {
    result = result.filter((entry) => entry.suitability.band !== 'unsuitable');
  }
  if (options.minimumScore !== undefined) {
    const minimum = options.minimumScore;
    result = result.filter((entry) => entry.suitability.rankingScore >= minimum);
  }
  if (options.limit !== undefined) {
    result = result.slice(0, Math.max(0, options.limit));
  }

  return result;
}

/** The total ordering described on {@link rankPlants}. */
function compareRanked(a: RankedPlant, b: RankedPlant): number {
  if (a.suitability.rankingScore !== b.suitability.rankingScore) {
    return b.suitability.rankingScore - a.suitability.rankingScore;
  }
  if (a.suitability.confidence !== b.suitability.confidence) {
    return b.suitability.confidence - a.suitability.confidence;
  }
  if (a.plant.commonName !== b.plant.commonName) {
    return a.plant.commonName < b.plant.commonName ? -1 : 1;
  }
  if (a.plant.id === b.plant.id) return 0;
  return a.plant.id < b.plant.id ? -1 : 1;
}
