/**
 * Schema for the **UK-outdoor exclusion list** — the crops the shipped dataset
 * deliberately leaves out because they cannot be grown outdoors in Britain.
 *
 * ## Why this exists as its own slice
 *
 * The shipped dataset's ancestry is OpenFarm, a North-American-leaning growing
 * wiki, so its rescued dump carries a long tail of crops a British gardener
 * cannot plant: tropical fruit (dragon fruit, papaya, pineapple), citrus, and
 * heat-demanding annuals (okra, peanut, cowpea). `DESIGN.md` sets Britain as
 * the app's default and the suitability engine ranks against a British plot, so
 * every one of those records is a crop the palette offers and the plot cannot
 * grow — noise in the one list the whole app is a way of searching.
 *
 * Pruning them is **deletion, not flagging**: an excluded id does not reach
 * `data/plants.json` at all. `docs/adr/0025-uk-outdoor-crop-exclusions.md`
 * records why, and the short version is that a flag would need a new schema
 * field, a new scoring rule and new UI to mean anything, while Stage 3.6's
 * in-app add-crop form already lets a user re-add any crop by hand.
 *
 * What this module keeps is the **reasoning**. A deletion with no record of
 * itself is the thing that is genuinely hard to review or undo: a later
 * maintainer would see only an absence and have to re-derive the judgement.
 * Each row below states which crop, on which of two grounds, and why — so the
 * decision stays reviewable in version control even though the record is gone
 * from the artifact.
 *
 * ## Why the evidence bar is a note, not citations
 *
 * The same argument the curated moisture table makes (`../moisture/schema.ts`).
 * "Pineapple will not fruit outdoors in Britain" is not a contested figure that
 * two sources might disagree on by 5 cm; it is horticultural common ground, and
 * the reviewable artifact is the stated reason. A reader can disagree with
 * "feijoa needs a longer, hotter autumn than Britain gives" on horticultural
 * grounds without a URL to check it against — and disagreement is *expected*
 * near the margin, which is why the marginal keeps are argued in `./table.ts`'s
 * module doc too, not silently omitted.
 */

import { SlugSchema } from '@garden-planner/engine';
import { z } from 'zod';

/**
 * The two ways a crop fails the "can a British gardener grow this outdoors?"
 * test. Kept as a closed enum rather than free text because the distinction is
 * the substance of the judgement, and it is the thing a reviewer should be able
 * to sort the list by.
 *
 * - **`too-tender`** — a British winter (or an ordinary British night) kills
 *   it, and it cannot be grown to a harvest as a summer annual either. Tropical
 *   perennials that need a full year of warmth live here.
 * - **`wont-ripen`** — the plant survives outdoors perfectly well, but a
 *   British season is too short or too cool for it to set and ripen a crop.
 *   This is the honest home for the fruit trees people *do* plant here as
 *   ornamentals and then never pick anything from.
 */
export const EXCLUSION_BASES = ['too-tender', 'wont-ripen'] as const;

export const ExclusionBasisSchema = z.enum(EXCLUSION_BASES);
export type ExclusionBasis = z.infer<typeof ExclusionBasisSchema>;

/**
 * One crop excluded from the shipped dataset.
 *
 * `id` must match a plant id the merge would otherwise ship **exactly** — like
 * the moisture table, this slice joins on nothing else, so a typo would
 * silently exclude nothing. `table.test.ts` checks every id against the
 * pre-merge plant-id universe, which is where a stale or mistyped row fails.
 */
export const ExcludedCropSchema = z
  .object({
    /** The crop this excludes; an exact plant id as the merge would emit it. */
    id: SlugSchema,
    /**
     * The crop's common name, duplicated here on purpose: once the record is
     * gone from `data/plants.json` this file is the only place the id is
     * legible, and `dragon-fruit` is friendlier to review as "Dragon fruit".
     */
    commonName: z.string().min(1),
    /** Which of the two failure modes applies. See {@link EXCLUSION_BASES}. */
    basis: ExclusionBasisSchema,
    /**
     * Why this crop cannot be grown outdoors in Britain — one or two sentences,
     * required. This is the row's reviewable content in place of citations
     * (see the module doc), so a bare "tropical" is not enough.
     */
    note: z.string().min(1),
  })
  .strict();

/** A validated exclusion row. */
export type ExcludedCrop = z.infer<typeof ExcludedCropSchema>;

/**
 * Validate the whole list: every row parses, and no crop appears twice.
 *
 * The duplicate check matters for the same reason it does in the moisture
 * table — two rows for one crop is a sign the list has been edited twice
 * without reading it, and it makes the merge report's tally misleading.
 *
 * @throws {Error} if any row is invalid or a crop id repeats.
 */
export function validateExclusionTable(rows: readonly unknown[]): ExcludedCrop[] {
  const parsed = rows.map((row, index) => {
    const result = ExcludedCropSchema.safeParse(row);
    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new Error(`exclusion row #${index} is invalid — ${detail}`);
    }
    return result.data;
  });

  const seen = new Set<string>();
  for (const row of parsed) {
    if (seen.has(row.id)) throw new Error(`exclusion list names "${row.id}" more than once`);
    seen.add(row.id);
  }
  return parsed;
}
