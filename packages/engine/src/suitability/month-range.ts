/**
 * Wrap-around-aware helpers for the schema's {@link MonthRange}.
 *
 * `MonthRangeSchema` (ADR 0004) deliberately allows `end < start` to mean "this
 * range spans the new year" — `{ start: 11, end: 2 }` is November–February, not
 * an error. Every consumer therefore has to handle two cases, and the Stage 2.1
 * brief is explicit that the engine is where that helper belongs: expanding a
 * range into concrete months is engine logic, not schema logic.
 *
 * These live in `suitability/` because the season scorer is their first
 * consumer; they are exported from the engine's public surface so Stages 2.2/2.3
 * and the UI reuse them rather than re-deriving the wrap arithmetic (which is
 * exactly how off-by-one calendar bugs get in).
 */

import type { MonthNumber, MonthRange } from '../schema/plant.ts';
import { joinWords } from './text.ts';

/** Month names, January = index 1, for reason strings. Index 0 is unused. */
const MONTH_NAMES: readonly string[] = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Wrap any month arithmetic result back into 1–12. */
function wrapMonth(month: number): MonthNumber {
  return ((month - 1 + 12) % 12) + 1;
}

/** The month after `month`, wrapping December → January. */
export function nextMonth(month: MonthNumber): MonthNumber {
  return wrapMonth(month + 1);
}

/** The month before `month`, wrapping January → December. */
export function previousMonth(month: MonthNumber): MonthNumber {
  return wrapMonth(month - 1);
}

/**
 * Is `month` inside `range`? Handles the wrap-around case, which is the whole
 * reason this function exists: for `{ start: 11, end: 2 }`, January is inside
 * even though `1 < 11`.
 */
export function monthRangeIncludes(range: MonthRange, month: MonthNumber): boolean {
  return range.start <= range.end
    ? month >= range.start && month <= range.end
    : month >= range.start || month <= range.end;
}

/** Is `month` inside any of `ranges`? */
export function anyMonthRangeIncludes(ranges: readonly MonthRange[], month: MonthNumber): boolean {
  return ranges.some((range) => monthRangeIncludes(range, month));
}

/**
 * The concrete months a range covers, in calendar order from `start`.
 * `{ start: 11, end: 2 }` → `[11, 12, 1, 2]`.
 */
export function expandMonthRange(range: MonthRange): MonthNumber[] {
  const months: MonthNumber[] = [];
  let month: MonthNumber = range.start;
  for (;;) {
    months.push(month);
    if (month === range.end) break;
    month = nextMonth(month);
    // Safety net: a malformed range can't loop forever. Unreachable for any
    // value that passed MonthRangeSchema, since both ends are 1–12.
    if (months.length > 12) break;
  }
  return months;
}

/** How many months a range covers, inclusive of both ends (1–12). */
export function monthRangeLength(range: MonthRange): number {
  return expandMonthRange(range).length;
}

/**
 * Widen a range by `months` at each end, saturating at a full year.
 *
 * The season scorer uses this to turn a region's frost-free growing season into
 * a *workable* window: a gardener sows early under cloches or on a windowsill,
 * and lifts roots and brassicas well after the first frost. See `season.ts` for
 * how much latitude it allows and why.
 */
export function widenMonthRange(range: MonthRange, months: number): MonthRange {
  if (months <= 0) return range;
  if (monthRangeLength(range) + 2 * months >= 12) return { start: 1, end: 12 };
  return { start: wrapMonth(range.start - months), end: wrapMonth(range.end + months) };
}

/** A month's English name, e.g. `3` → `"March"`. */
export function monthName(month: MonthNumber): string {
  return MONTH_NAMES[month] ?? String(month);
}

/**
 * A range as human-readable text for a reason string: `"March"` for a
 * single month, `"March–April"` otherwise (en dash, matching the docs' style).
 */
export function describeMonthRange(range: MonthRange): string {
  return range.start === range.end
    ? monthName(range.start)
    : `${monthName(range.start)}–${monthName(range.end)}`;
}

/** Several ranges as text, e.g. `"March–April and August"`. */
export function describeMonthRanges(ranges: readonly MonthRange[]): string {
  return joinWords(ranges.map(describeMonthRange));
}
