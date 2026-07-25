/**
 * The **light** dimension: how well a plot's light level suits a crop.
 *
 * This is the only requirement dimension with real coverage in today's shipped
 * dataset (160/160 records, but only two distinct values — 146 full-sun and 14
 * partial-shade), and it is required on both `Plant` and `PlotConditions`, so it
 * is the one dimension that is *always* assessed.
 *
 * Both sides speak the same ordered enum on purpose (ADR 0004 §4), so the score
 * is a function of the signed distance between them, measured with
 * `lightRequirementRank` rather than a hard-coded ordering.
 */

import type { LightRequirement, Plant } from '../schema/plant.ts';
import { lightRequirementRank } from '../schema/plant.ts';
import type { PlotConditions } from './conditions.ts';
import type { DimensionScore } from './model.ts';
import { DIMENSION_WEIGHTS, findingForScore } from './model.ts';

/** How each light level reads in a sentence. */
const LIGHT_PHRASES: Readonly<Record<LightRequirement, string>> = {
  'full-sun': 'full sun',
  'partial-shade': 'partial shade',
  'full-shade': 'full shade',
};

/**
 * Scores for a plot **shadier** than the crop wants, indexed by how many steps
 * short it falls (1 = wants full sun, gets partial shade).
 *
 * Two steps scores **0**, the only value that means `unsuitable` — a full-sun
 * crop in deep shade will not crop, and no amount of good soil compensates. One
 * step is a real but partial penalty: light is the input that sets yield, so a
 * sun-lover in partial shade grows, but thinly.
 */
const SHADE_DEFICIT_SCORES: readonly number[] = [1, 0.45, 0];

/**
 * Scores for a plot **sunnier** than the crop wants, indexed by how many steps
 * over it is.
 *
 * Deliberately gentler than the deficit side, and never 0. The asymmetry is a
 * gardener's fact, not a modelling convenience: **you cannot add sun to a shaded
 * bed, but you can shade, mulch and water a sunny one.** Too much sun on a
 * shade-tolerant leaf crop means bolting and scorch — a poorer crop and more
 * work, not an impossibility.
 */
const SUN_SURPLUS_SCORES: readonly number[] = [1, 0.65, 0.15];

/**
 * Score how a plot's light level suits a plant's light requirement.
 *
 * @param plant - the crop being scored; `light` is a required field.
 * @param conditions - the plot; `light` is likewise required.
 * @returns a scored dimension with a reason the palette can show verbatim.
 */
export function scoreLight(plant: Plant, conditions: PlotConditions): DimensionScore {
  const wanted = lightRequirementRank(plant.light);
  const offered = lightRequirementRank(conditions.light);
  // Positive = the plot is shadier than the crop wants; negative = sunnier.
  const steps = offered - wanted;

  const score = steps >= 0 ? SHADE_DEFICIT_SCORES[steps] : SUN_SURPLUS_SCORES[-steps];

  return {
    dimension: 'light',
    finding: findingForScore(score),
    score,
    weight: DIMENSION_WEIGHTS.light,
    reason: lightReason(plant.light, conditions.light, steps),
  };
}

/** The human-readable half of {@link scoreLight}. */
function lightReason(wanted: LightRequirement, offered: LightRequirement, steps: number): string {
  const wants = LIGHT_PHRASES[wanted];
  const plot = LIGHT_PHRASES[offered];

  switch (steps) {
    case 0:
      return `Wants ${wants}, and the plot is in ${plot}.`;
    case 1:
      return `Wants ${wants} but the plot is in ${plot} — it will grow, more slowly and with a lighter crop.`;
    case 2:
      return `Needs ${wants} and the plot is in ${plot} — too dark for it to crop, and light is the one thing a shaded bed can't be given.`;
    case -1:
      return `Suited to ${wants}; the plot is in ${plot} — brighter than it prefers, so expect to water more and watch for bolting.`;
    default:
      return `Suited to ${wants}; the plot is in ${plot} — far more sun than it wants, so it is likely to scorch or bolt unless it is shaded.`;
  }
}
