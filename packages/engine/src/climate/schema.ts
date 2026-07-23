/**
 * Climate-profile schema (Workplan Stage 1.6; design in
 * `docs/adr/0010-location-climate-static-data.md`).
 *
 * This is the shape the suitability engine (Stage 2.1) and the plot-definition
 * UI (Stage 3.2) consume to turn "a location" into real horticultural context:
 * an RHS hardiness band, average frost dates, and a growing-season window.
 *
 * **zod is the single source of truth**, exactly as `schema/plant.ts` is for
 * plant records — every type here is `z.infer`-derived. This module does not
 * restate the Stage 0.2 vocabulary; it imports and reuses it directly:
 * - {@link RhsHardinessRatingSchema} / {@link HardinessSchema} — the ordered RHS
 *   band vocabulary, plus the "band + optional portable °C figure" pattern a
 *   location's hardiness uses exactly like a plant's does.
 * - {@link MonthSchema} — the calendar-month bound a frost date's month uses.
 * - {@link MonthRangeSchema} — the wrap-around-aware month range a growing
 *   season is expressed as (see that schema's docs for the wrap semantics).
 * - {@link SourceRefSchema} — the citation shape every hand-curated figure below
 *   is attributed with, identical to a plant record's provenance.
 * - {@link SlugSchema} — the same id rule a region id uses, so region ids and
 *   plant ids can never collide on shape.
 */

import { z } from 'zod';
import {
  HardinessSchema,
  MonthRangeSchema,
  MonthSchema,
  SlugSchema,
  SourceRefSchema,
} from '../schema/plant.ts';

// ---------------------------------------------------------------------------
// Approximate calendar dates (frost averages)
// ---------------------------------------------------------------------------

/** Days in each calendar month, non-leap-year, 1-indexed (index 0 unused). */
const DAYS_IN_MONTH: readonly number[] = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * An approximate calendar date used for average frost dates: a month plus a
 * day-of-month. Deliberately **not** a full `Date` — these are long-run
 * averages (e.g. "last spring frost around 20 April"), not a specific year, and
 * a `Date` would imply precision the underlying figures don't have. Month+day
 * is the granularity the brief asks for ("as months, or month+approximate day
 * — decide and document"): day-level beats month-only because it lets regions
 * with the same last-frost *month* still be ordered correctly (see
 * `regions.ts`), and it is what the cited sources actually report.
 */
export const CalendarDayOfYearSchema = z
  .object({
    month: MonthSchema,
    /** Day of month, 1–31. Validated against the month below (Feb 30 is invalid). */
    day: z.number().int().min(1),
  })
  .strict()
  .refine((date) => date.day <= DAYS_IN_MONTH[date.month], {
    message: 'day is out of range for the given month',
    path: ['day'],
  });
export type CalendarDayOfYear = z.infer<typeof CalendarDayOfYearSchema>;

/**
 * A region's average frost window: the last spring frost a gardener should
 * expect, and the first autumn frost that ends the growing season. Both are
 * hand-curated per region with citations (`regions.ts`) — the engine (2.1) and
 * a future planting-calendar feature are the consumers.
 */
export const FrostWindowSchema = z
  .object({
    lastSpringFrost: CalendarDayOfYearSchema,
    firstAutumnFrost: CalendarDayOfYearSchema,
  })
  .strict();
export type FrostWindow = z.infer<typeof FrostWindowSchema>;

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * Citations for a climate profile's two hand-curated fact categories:
 * `hardiness` (the RHS band / °C figure) and `frost` (the frost window).
 * `growingSeason` deliberately has no citation slot here — it is *derived*
 * from `frost` by {@link deriveGrowingSeason} (see `season.ts`), not an
 * independently sourced fact, so citing it separately would imply a source
 * that doesn't exist.
 *
 * Simpler than the plant record's `ProvenanceSchema` (which supports optional,
 * variable per-field attribution because plant data is patchy and assembled
 * from several sources): a climate profile always has exactly these two
 * citable categories, and both are mandatory — "don't guess figures" (the
 * Stage 1.6 brief) means every profile must show its sources for both.
 */
export const ClimateProvenanceSchema = z
  .object({
    hardiness: z.array(SourceRefSchema).nonempty(),
    frost: z.array(SourceRefSchema).nonempty(),
  })
  .strict();
export type ClimateProvenance = z.infer<typeof ClimateProvenanceSchema>;

// ---------------------------------------------------------------------------
// The climate profile
// ---------------------------------------------------------------------------

/**
 * A region's climate context: everything the suitability engine needs to
 * answer "is it too cold here for this plant?" and "is it in season to sow X
 * now?" for one location.
 *
 * `hardiness` reuses {@link HardinessSchema} verbatim — the same `rhsRating` +
 * optional `minTempC` pair a `Plant.hardiness` carries, so the engine compares
 * like with like via {@link rhsHardinessRank} without a conversion step.
 */
export const ClimateProfileSchema = z
  .object({
    /** Stable slug id, e.g. `"uk-default"`, `"scotland-highlands"`. */
    id: SlugSchema,
    /** Human-readable region name, e.g. "United Kingdom (national default)". */
    name: z.string().min(1),
    /** The RHS hardiness band (+ optional °C figure) typical of this region. */
    hardiness: HardinessSchema,
    /** Average last spring / first autumn frost, hand-curated with citations. */
    frost: FrostWindowSchema,
    /**
     * The frost-free growing season, as a month range (reuses
     * {@link MonthRangeSchema}, including its wrap-around-the-new-year
     * semantics for any future southern-hemisphere region). **Derived**, not
     * independently sourced — see {@link deriveGrowingSeason} in `season.ts`.
     */
    growingSeason: MonthRangeSchema,
    /** Citations for `hardiness` and `frost` (see {@link ClimateProvenanceSchema}). */
    provenance: ClimateProvenanceSchema,
  })
  .strict();
export type ClimateProfile = z.infer<typeof ClimateProfileSchema>;

// ---------------------------------------------------------------------------
// Location input — how a caller specifies "where" to resolveClimate()
// ---------------------------------------------------------------------------

/**
 * How a caller may specify a location to `resolveClimate()` (`resolve.ts`).
 * Kept as a zod schema, not a hand-written union type, for the same reason
 * everything else in this module is zod-first: a future stage (3.2's location
 * picker) will round-trip a chosen location through storage/URL state, and
 * that's exactly the boundary where a plain TypeScript type gives no runtime
 * protection — a malformed `lat`/`lng` from, say, a corrupted `localStorage`
 * value should fail loudly rather than silently propagate into the nearest-
 * region distance calculation.
 */
export const LocationInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('default') }).strict(),
  z.object({ kind: z.literal('region'), regionId: SlugSchema }).strict(),
  z
    .object({
      kind: z.literal('coordinates'),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .strict(),
]);
export type LocationInput = z.infer<typeof LocationInputSchema>;
