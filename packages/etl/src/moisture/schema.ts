/**
 * Schema for the **curated soil-moisture table** — a thin enrichment slice that
 * gives each core crop a soil-moisture preference.
 *
 * ## Why this exists as its own slice
 *
 * The shipped dataset had soil data on 2 of its then-162 records, so the
 * suitability engine's `soil` dimension reported `unknown-plant` for
 * effectively the whole catalogue and the plot form's "Soil moisture" dropdown
 * asked a question nothing could use. Light is no help either — 133 of the 144
 * crops shipped today are `full-sun` — so without this, spacing was the app's
 * only working axis. This slice took soil coverage to 80/144.
 *
 * This slice follows the **hand-verified spacing table's** pattern (Stage 1.3,
 * `../spacing/`): original curation keyed to a crop id, folded into the Stage
 * 1.5 merge, deliberately *not* a `SourceAdapter`. It is not an external
 * source; nothing is scraped or ingested.
 *
 * ## Why the evidence bar is lower than the spacing table's — deliberately
 *
 * `SpacingRecordSchema` requires **≥2 authoritative citations per figure**
 * (ADR 0007). This schema requires none, and that asymmetry is a considered
 * decision rather than a corner cut:
 *
 * - **A spacing figure is contested.** "Peas 7 cm apart" varies by source, by
 *   growing method, and by whether you are planting in rows or a bed. Two
 *   charts genuinely disagree, so cross-checking finds real errors.
 * - **A moisture preference is not.** "Peas suffer in dry soil" and "rosemary
 *   hates wet feet" are universal horticultural consensus, and the vocabulary
 *   is a **three-value enum** (`dry` | `moist` | `wet`). There is no decimal
 *   place to misplace and no method-dependence to get wrong. Citing two charts
 *   for "mint likes damp" would be ceremony, not verification.
 *
 * What this schema requires instead is a **`note` on every row** — the reason
 * for the value, in a sentence. That is the reviewable artifact here: a reader
 * can disagree with "carrots fork in ground that stays wet" on horticultural
 * grounds without needing a URL to check it against.
 *
 * These values are **hand-authored from general horticultural knowledge**, not
 * retrieved from a source. {@link MOISTURE_PROVENANCE} says exactly that in the
 * shipped artifact, so nothing downstream overstates where they came from.
 */

import { SlugSchema, SoilMoistureSchema, type SourceRef } from '@garden-planner/engine';
import { z } from 'zod';

/**
 * One crop's moisture preference.
 *
 * `id` must match a shipped `Plant.id` **exactly** — unlike a spacing row,
 * which may reach its plant via scientific name or an alias, this slice is
 * authored directly against the ids in `data/plants.json` and joins on nothing
 * else. `table.test.ts` asserts every id resolves, so a typo fails a test
 * rather than silently enriching nothing.
 */
export const MoistureRecordSchema = z
  .object({
    /** The crop this applies to; an exact `Plant.id`. */
    id: SlugSchema,
    /**
     * The moisture levels this crop is happy in, as an array because tolerance
     * is usually a range: courgettes are `['moist']`, carrots `['dry','moist']`,
     * watercress `['wet']`. Matches `SoilSchema.moisture` exactly — the engine's
     * vocabulary, not a restatement of it.
     */
    moisture: z.array(SoilMoistureSchema).nonempty(),
    /**
     * Why this value — one sentence, required. This is the row's reviewable
     * content in place of citations (see the module doc).
     */
    note: z.string().min(1),
  })
  .strict();

/** A validated moisture row. */
export type MoistureRecord = z.infer<typeof MoistureRecordSchema>;

/**
 * What the shipped artifact records as the provenance of any `soil.moisture`
 * this slice contributes.
 *
 * Deliberately states the basis plainly rather than naming a source that was
 * never fetched. ADR 0007 set the precedent that retrieval honesty is recorded,
 * not implied; this is the same discipline applied to data that was authored
 * rather than retrieved.
 */
export const MOISTURE_PROVENANCE: SourceRef = {
  source: 'Garden Planner curated moisture table',
  note:
    'Hand-authored from general horticultural consensus for common British ' +
    'garden and allotment crops, not retrieved from a cited source. Each row ' +
    'carries its reasoning in a note; the three-value vocabulary (dry/moist/wet) ' +
    'is coarse by design. Treat as guidance, not authority.',
};

/** Validate one row, throwing on the first problem. */
export function validateMoistureRecord(input: unknown): MoistureRecord {
  return MoistureRecordSchema.parse(input);
}

/**
 * Validate the whole table: every row parses, and no crop appears twice.
 *
 * The duplicate check matters because two rows for one crop would make the
 * merge's result depend on iteration order — the same class of silent
 * ambiguity the spacing table's own uniqueness rule exists to prevent.
 *
 * @throws {Error} if any row is invalid or a crop id repeats.
 */
export function validateMoistureTable(rows: readonly unknown[]): MoistureRecord[] {
  const parsed = rows.map((row, index) => {
    const result = MoistureRecordSchema.safeParse(row);
    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new Error(`moisture row #${index} is invalid — ${detail}`);
    }
    return result.data;
  });

  const seen = new Set<string>();
  for (const row of parsed) {
    if (seen.has(row.id)) throw new Error(`moisture table lists "${row.id}" more than once`);
    seen.add(row.id);
  }
  return parsed;
}
