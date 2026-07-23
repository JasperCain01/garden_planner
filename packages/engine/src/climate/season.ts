/**
 * Deriving a growing-season {@link MonthRange} from a region's frost window.
 *
 * The growing season is not an independently cited fact — it is a consequence
 * of the two frost dates that *are* cited (`regions.ts`). Computing it here
 * (rather than hand-typing a third figure per region) means the season can
 * never silently drift out of sync with the frost dates it's derived from.
 */

import type { MonthRange } from '../schema/plant.ts';
import type { CalendarDayOfYear, FrostWindow } from './schema.ts';

/** Wrap a 1–12 month arithmetic result back into the valid range. */
function wrapMonth(month: number): number {
  return ((month - 1 + 12) % 12) + 1;
}

/**
 * A calendar month counts as "in season" if at least half of it is expected to
 * be frost-free. This is the one modelling rule this function applies:
 * - **Season start**: if the last spring frost falls in the first half of its
 *   month (day ≤ 15), that whole month is treated as safe-enough to start; a
 *   frost later in the month pushes the start to the next month.
 * - **Season end**: symmetrically, if the first autumn frost falls in the
 *   second half of its month (day ≥ 15), that month still counts as safe-enough
 *   to end on; an earlier frost pulls the end back to the previous month.
 *
 * This is deliberately a simple, documented rule rather than a precise
 * day-count — `growingSeason` is a coarse, month-granularity convenience for
 * the engine's "is it in season" checks; a feature that needs day-level
 * precision should use the region's `frost` dates directly instead.
 */
export function deriveGrowingSeason(frost: FrostWindow): MonthRange {
  return {
    start: seasonStartMonth(frost.lastSpringFrost),
    end: seasonEndMonth(frost.firstAutumnFrost),
  };
}

function seasonStartMonth(lastSpringFrost: CalendarDayOfYear): number {
  return lastSpringFrost.day <= 15 ? lastSpringFrost.month : wrapMonth(lastSpringFrost.month + 1);
}

function seasonEndMonth(firstAutumnFrost: CalendarDayOfYear): number {
  return firstAutumnFrost.day >= 15
    ? firstAutumnFrost.month
    : wrapMonth(firstAutumnFrost.month - 1);
}
