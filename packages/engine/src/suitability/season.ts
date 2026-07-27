/**
 * The **season** dimension: does this crop's timing fit the plot?
 *
 * It answers one of two questions, depending on what the plot description says:
 *
 * - **With a `plantingMonth`** — "can I sow this now?" Scored against the crop's
 *   own sowing windows.
 * - **Without one** — "does this crop's window fit this region's season at all?"
 *   Scored against the region's growing season, widened by two months either
 *   side into a *workable* window. The widening is not padding for its own sake:
 *   `growingSeason` is the **frost-free** window (May–October for the UK
 *   default), whereas British gardeners sow from March under cloches or on a
 *   windowsill and lift roots, leeks and brassicas well into winter. Scoring
 *   sowing dates directly against the frost-free window would mark ordinary
 *   March sowings as out of season. Two months is a rule of thumb, not a
 *   citation — `growingSeason` is itself a coarse, month-granularity derivation
 *   (ADR 0010 §3).
 *
 * **Season never returns 0**, so it can never make a crop `unsuitable`: sowing
 * at the wrong time is answered by waiting until March, not by choosing a
 * different crop. It is the model's lightest-weighted dimension for the same
 * reason.
 *
 * Almost no shipped record carries `seasons` (8/144 — the curated crops, and
 * only those), so this dimension reports `unknown-plant` across nearly the
 * whole current dataset.
 */

import type { MonthNumber, MonthRange, Plant } from '../schema/plant.ts';
import type { PlotConditions } from './conditions.ts';
import type { DimensionScore } from './model.ts';
import { DIMENSION_WEIGHTS, findingForScore } from './model.ts';
import {
  anyMonthRangeIncludes,
  describeMonthRange,
  describeMonthRanges,
  expandMonthRange,
  monthName,
  monthRangeIncludes,
  nextMonth,
  previousMonth,
  widenMonthRange,
} from './month-range.ts';

/** Score when the chosen planting month falls inside a stated sowing window. */
const IN_WINDOW_SCORE = 1;
/** Score when it is one month either side of a window — worth a try under cover. */
const ADJACENT_WINDOW_SCORE = 0.6;
/** Score when it is well outside every window. Low, but never 0: waiting fixes it. */
const OUT_OF_WINDOW_SCORE = 0.2;
/** Floor for the region-fit rule, so a poor overlap still can't disqualify a crop. */
const SEASON_FIT_FLOOR = 0.25;
/** Months of latitude added to each end of the growing season (cloches, late lifting). */
const WORKABLE_WINDOW_SLACK_MONTHS = 2;

/**
 * Score a crop's sowing/harvest timing against the plot's month and climate.
 *
 * @param plant - the crop; `seasons` is optional and often absent.
 * @param conditions - the plot, whose `climate.growingSeason` and optional
 *   `plantingMonth` decide which of the two rules above applies.
 */
export function scoreSeason(plant: Plant, conditions: PlotConditions): DimensionScore {
  const dimension = 'season' as const;
  const weight = DIMENSION_WEIGHTS.season;

  const sow = plant.seasons?.sow;
  const harvest = plant.seasons?.harvest;

  if (sow === undefined && harvest === undefined) {
    return {
      dimension,
      finding: 'unknown-plant',
      score: null,
      weight,
      reason: 'No sowing or harvest data for this crop, so its timing is unassessed.',
    };
  }

  if (conditions.plantingMonth !== undefined && sow !== undefined) {
    return scoreSowingMonth(sow, conditions.plantingMonth, weight);
  }

  // Either no planting month was chosen, or the crop states only a harvest
  // window (nothing to judge a sowing date against) — fall back to the broader
  // "does this crop's calendar fit this region's?" question.
  return scoreRegionFit(sow ?? harvest ?? [], sow !== undefined, conditions, weight);
}

/** "Can I sow this now?" — the crop's sowing windows vs. the chosen month. */
function scoreSowingMonth(
  sow: readonly MonthRange[],
  plantingMonth: MonthNumber,
  weight: number,
): DimensionScore {
  const windows = describeMonthRanges(sow);
  const month = monthName(plantingMonth);

  let score = OUT_OF_WINDOW_SCORE;
  let reason = `Sown ${windows}; ${month} is outside that window, so this is one to plan for rather than plant now.`;

  if (anyMonthRangeIncludes(sow, plantingMonth)) {
    score = IN_WINDOW_SCORE;
    reason = `${month} falls inside its ${windows} sowing window.`;
  } else if (isAdjacentToAny(sow, plantingMonth)) {
    score = ADJACENT_WINDOW_SCORE;
    reason = `Sown ${windows}; ${month} is just outside — close enough to be worth a try, under cover if it's early.`;
  }

  return { dimension: 'season', finding: findingForScore(score), score, weight, reason };
}

/** "Does this crop's calendar fit this region's season?" — the no-planting-month rule. */
function scoreRegionFit(
  windows: readonly MonthRange[],
  isSowing: boolean,
  conditions: PlotConditions,
  weight: number,
): DimensionScore {
  const workable = widenMonthRange(conditions.climate.growingSeason, WORKABLE_WINDOW_SLACK_MONTHS);
  const months = windows.flatMap(expandMonthRange);
  const inside = months.filter((month) => monthRangeIncludes(workable, month)).length;
  const fraction = months.length === 0 ? 0 : inside / months.length;
  const score = Math.max(SEASON_FIT_FLOOR, fraction);

  const activity = isSowing ? 'Sown' : 'Harvested';
  const described = describeMonthRanges(windows);
  const workableText = describeMonthRange(workable);

  const reason =
    inside === months.length
      ? `${activity} ${described}, comfortably inside ${conditions.climate.name}'s workable window (${workableText}).`
      : inside === 0
        ? `${activity} ${described}, which falls outside ${conditions.climate.name}'s workable window (${workableText}) — it would need protection or a different timing here.`
        : `${activity} ${described}; only ${inside} of those ${months.length} months fall inside ${conditions.climate.name}'s workable window (${workableText}).`;

  return { dimension: 'season', finding: findingForScore(score), score, weight, reason };
}

/** Is `month` immediately before or after any of these windows? */
function isAdjacentToAny(ranges: readonly MonthRange[], month: MonthNumber): boolean {
  return (
    anyMonthRangeIncludes(ranges, nextMonth(month)) ||
    anyMonthRangeIncludes(ranges, previousMonth(month))
  );
}
