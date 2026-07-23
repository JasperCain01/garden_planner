/**
 * Schema and validation for the **hand-verified spacing table** (Workplan
 * Stage 1.3, marked ⭐ data-critical — see `docs/adr/0007-hand-verified-spacing.md`).
 *
 * This is **not** a `SourceAdapter` (`src/pipeline/source.ts`) and deliberately
 * does not reuse that interface: Stage 1.2's adapters *ingest an external
 * source's raw records*, whereas this stage is **original curation** — a small,
 * hand-checked table of spacing figures cross-referenced against authoritative
 * horticultural charts. So it gets its own shape, described here.
 *
 * Two hard rules this module encodes, both straight from the brief:
 *
 * 1. **Reuse, don't redefine, the Stage 0.2 spacing model.** The `spacing` block
 *    of every row is validated by `@garden-planner/engine`'s {@link SpacingSchema}
 *    (row and/or intensive), the single source of truth. We add *provenance and
 *    sanity* constraints on top; we never re-describe what a spacing figure is.
 *
 * 2. **Per-method provenance with ≥2 sources each.** A spacing figure is only
 *    trustworthy if it was checked against more than one authoritative chart, and
 *    that check has to be a *reviewable fact*, not an assertion (WORKPLAN.md §1.1:
 *    "the record of it is committed and reviewable"). So provenance is keyed **by
 *    growing method** (`row`, `intensive`), each requiring **at least two**
 *    citations, and a method's figure may exist **only if** its own ≥2 citations
 *    do. That coupling is what stops the one temptation `docs/adr/0006` §rejected
 *    calls out: inventing an intensive density from a row-only source (or vice
 *    versa). You cannot record an intensive figure here without citing two
 *    sources that actually state an intensive figure.
 *
 * zod stays the single source of truth for these shapes too; the exported types
 * are all `z.infer`-derived. This package is framework-free (no React/DOM).
 */

import { z } from 'zod';
import {
  EdibleCategorySchema,
  SlugSchema,
  SourceRefSchema,
  SpacingSchema,
  type SourceRef,
  type Spacing,
} from '@garden-planner/engine';

// A row's `id` must be a `Plant.id`-shaped slug so it lines up with the same
// crop from other sources during Stage 1.5's merge. We reuse the engine's
// exported `SlugSchema` (the single source of truth for that rule) rather than
// restating the regex, so the two can never drift. (Merge itself joins on the
// GBIF id / scientific name, not the slug, so a British-spelling slug like
// `beetroot` where OpenFarm uses `beet` is harmless — see the ADR.)

// ---------------------------------------------------------------------------
// Sanity bounds
// ---------------------------------------------------------------------------

/**
 * Plausibility limits for a spacing figure, *on top of* the positivity floor
 * that {@link SpacingSchema} already enforces (`.positive()` on every distance
 * and density). WORKPLAN.md §1.1 asks for automated checks on implausible
 * values — "negative spacing, spacing > plot-scale absurdities" — and positivity
 * alone doesn't catch a typo'd `300` that should have been `30`, or a `0.3 cm`
 * in-row spacing that is positive but physically impossible. These bounds are
 * the second half of that check.
 *
 * The numbers are deliberately generous — this is a "reject the absurd" gate,
 * not a horticultural opinion about the *right* spacing. Anything inside these
 * bounds is left to the curated data and its citations.
 */
export const SPACING_SANITY_BOUNDS = {
  /** Smallest believable spacing between two plants at plot scale. */
  minDistanceCm: 1,
  /**
   * Largest believable spacing for the *edibles* this table covers (veg, herbs,
   * bush fruit). Well clear of the widest real figure here (potato maincrop rows,
   * 75 cm) but small enough that a misplaced decimal (`3700` for `37`) trips it.
   */
  maxDistanceCm: 300,
  /**
   * Densest believable "plants per 30 cm × 30 cm square". The square-foot system
   * itself tops out at 16 per square (its 3 in / 7.5 cm class); 36 leaves head-
   * room without admitting nonsense.
   */
  maxPlantsPerSquare: 36,
  /** Densest believable plants-per-m² (e.g. broadcast salad leaves ≈ a few hundred). */
  maxPerSquareMetre: 400,
  /**
   * Sparsest believable density, as a lower plausibility floor symmetric with
   * `minDistanceCm`. Catches a decimal-slip like `0.1` (should be `1`+) that is
   * positive but absurd; generous enough for genuinely sprawling crops (a single
   * pumpkin occupies several squares, i.e. a fraction of a plant per square).
   */
  minDensity: 0.1,
} as const;

/**
 * Return a list of human-readable sanity problems with a spacing block, or an
 * empty list if it is plausible. Split out as a pure function (rather than
 * inlined into the schema) so tests can exercise the bounds directly and so
 * Stage 1.5's dataset build can reuse the exact same check.
 *
 * Note what this does *not* re-check: positivity (owned by {@link SpacingSchema})
 * and "at least one method present" (also owned by it). This layer only adds the
 * ceilings and the one cross-field invariant below.
 */
export function spacingSanityIssues(spacing: Spacing): string[] {
  const issues: string[] = [];
  const { minDistanceCm, maxDistanceCm, maxPlantsPerSquare, maxPerSquareMetre, minDensity } =
    SPACING_SANITY_BOUNDS;

  if (spacing.row) {
    const { inRowCm, betweenRowCm } = spacing.row;
    for (const [label, value] of [
      ['inRowCm', inRowCm],
      ['betweenRowCm', betweenRowCm],
    ] as const) {
      if (value < minDistanceCm) {
        issues.push(
          `row.${label} (${value} cm) is below the ${minDistanceCm} cm plausibility floor`,
        );
      }
      if (value > maxDistanceCm) {
        issues.push(
          `row.${label} (${value} cm) exceeds the ${maxDistanceCm} cm plausibility ceiling`,
        );
      }
    }
    // Rows are never spaced *tighter* than the plants within them — you leave at
    // least as much room to walk/hoe between rows as between neighbours in a row.
    // A record where between-row < in-row is almost always a transposed pair.
    if (betweenRowCm < inRowCm) {
      issues.push(
        `row.betweenRowCm (${betweenRowCm} cm) is less than row.inRowCm (${inRowCm} cm); ` +
          'between-row spacing should be >= in-row spacing (values likely transposed)',
      );
    }
  }

  if (spacing.intensive) {
    const { plantsPerSquare, perSquareMetre } = spacing.intensive;
    for (const [label, value, ceiling] of [
      ['plantsPerSquare', plantsPerSquare, maxPlantsPerSquare],
      ['perSquareMetre', perSquareMetre, maxPerSquareMetre],
    ] as const) {
      if (value === undefined) continue;
      if (value < minDensity) {
        issues.push(
          `intensive.${label} (${value}) is below the ${minDensity} density plausibility floor`,
        );
      }
      if (value > ceiling) {
        issues.push(`intensive.${label} (${value}) exceeds the ${ceiling} plausibility ceiling`);
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Per-method provenance
// ---------------------------------------------------------------------------

/**
 * The minimum number of independent citations required to record a spacing
 * figure. Two is the bar WORKPLAN.md §1.1 / the Stage 1.3 brief set: "each figure
 * cross-checked against ≥2 sources ... recorded per row." Exported so tests and
 * docs reference the one authoritative number.
 */
export const MIN_SOURCES_PER_METHOD = 2;

/**
 * Provenance for a row, keyed by the growing method it justifies. Each present
 * key carries the ≥2 {@link SourceRef} citations backing *that method's* figure.
 * Keyed by method (not lumped at the record level) on purpose: it makes the ≥2-
 * source guarantee hold *per figure*, so an intensive density can never lean on
 * citations that only ever stated a row distance.
 */
export const SpacingMethodProvenanceSchema = z
  .object({
    row: z
      .array(SourceRefSchema)
      .min(
        MIN_SOURCES_PER_METHOD,
        `row spacing needs >= ${MIN_SOURCES_PER_METHOD} source citations`,
      )
      .optional(),
    intensive: z
      .array(SourceRefSchema)
      .min(
        MIN_SOURCES_PER_METHOD,
        `intensive spacing needs >= ${MIN_SOURCES_PER_METHOD} source citations`,
      )
      .optional(),
  })
  .strict();
export type SpacingMethodProvenance = z.infer<typeof SpacingMethodProvenanceSchema>;

// ---------------------------------------------------------------------------
// The spacing record
// ---------------------------------------------------------------------------

/**
 * One hand-verified spacing row: identity + a Stage 0.2 `spacing` block +
 * per-method provenance. This is intentionally a *thin slice* of a full
 * {@link Plant} — only the fields this stage curates — not a whole plant record.
 * The other requirement fields (light, hardiness, soil, seasons) come from the
 * ingested sources; Stage 1.5 merges this spacing slice onto them by GBIF id.
 *
 * `.strict()` everywhere, matching the engine's schema discipline: a misspelled
 * key (`intesive`) is a loud error, never a silently dropped figure.
 *
 * The `superRefine` enforces the two invariants the field types can't express on
 * their own:
 *   - **method ⇔ provenance**: a `spacing.row` figure requires `provenance.row`
 *     (and vice versa), likewise for `intensive`. This is the anti-inference rule.
 *   - **sanity bounds**: via {@link spacingSanityIssues}.
 */
export const SpacingRecordSchema = z
  .object({
    /** Slug id; lines up with `Plant.id` for the Stage 1.5 merge. */
    id: SlugSchema,
    /** Everyday British name, e.g. "Beetroot". */
    commonName: z.string().min(1),
    /** Botanical name — the basis for GBIF resolution and the merge join. */
    scientificName: z.string().min(1),
    /** Which of the three edible categories this crop is (for the merge/UI). */
    category: EdibleCategorySchema,
    /** The method-aware spacing, validated by the engine's own schema. */
    spacing: SpacingSchema,
    /** ≥2 citations per present method (see {@link SpacingMethodProvenanceSchema}). */
    provenance: SpacingMethodProvenanceSchema,
    /** Curator's note: source ranges, variety caveats, why a figure was chosen. */
    note: z.string().optional(),
  })
  .strict()
  .superRefine((record, ctx) => {
    // --- method ⇔ provenance coupling (both directions, both methods) ---
    const couplings = [
      ['row', record.spacing.row !== undefined, record.provenance.row !== undefined],
      [
        'intensive',
        record.spacing.intensive !== undefined,
        record.provenance.intensive !== undefined,
      ],
    ] as const;
    for (const [method, hasFigure, hasProvenance] of couplings) {
      if (hasFigure && !hasProvenance) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['provenance', method],
          message: `spacing.${method} is present but provenance.${method} is missing (every figure needs >= ${MIN_SOURCES_PER_METHOD} citations)`,
        });
      }
      if (!hasFigure && hasProvenance) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['provenance', method],
          message: `provenance.${method} is present but spacing.${method} is not — citations must attach to a real figure`,
        });
      }
    }

    // --- sanity bounds ---
    for (const issue of spacingSanityIssues(record.spacing)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['spacing'], message: issue });
    }
  });
export type SpacingRecord = z.infer<typeof SpacingRecordSchema>;

// ---------------------------------------------------------------------------
// Validators & helpers
// ---------------------------------------------------------------------------

/**
 * Parse and validate one unknown value as a {@link SpacingRecord}, throwing a
 * `ZodError` on the first problem — the hard-fail behaviour Stage 1.5 wants when
 * it pulls this table into the dataset build.
 */
export function validateSpacingRecord(input: unknown): SpacingRecord {
  return SpacingRecordSchema.parse(input);
}

/**
 * Validate a whole table: every row schema-valid, **ids unique**, and
 * **scientific names unique** across the table. Returns the typed rows; throws
 * on the first schema failure or duplicate.
 *
 * Both uniqueness checks live here, not in {@link SpacingRecordSchema}, because a
 * single record can't see its neighbours — the same split the engine uses for
 * companion-link referential integrity (per-record shape in the schema,
 * cross-record checks at build time).
 *
 * Why *scientificName* too, not just `id`: Stage 1.5's merge joins on the GBIF
 * id resolved from the scientific name, **not** the slug. Two rows with distinct
 * slugs but the same species (e.g. `onion` and `spring-onion`, both
 * *Allium cepa*) would each resolve to the same GBIF id and silently attach two
 * conflicting spacing slices to one plant. Catching it here, at the source of
 * the join key, is far cheaper than debugging it in the merge. Comparison is
 * case-insensitive and whitespace-normalised so `Allium cepa` and `allium  cepa`
 * are treated as the collision they are.
 */
export function validateSpacingTable(rows: readonly unknown[]): SpacingRecord[] {
  const validated = rows.map((row) => validateSpacingRecord(row));

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  for (const row of validated) {
    if (seenIds.has(row.id)) {
      throw new Error(`duplicate spacing-table id: "${row.id}"`);
    }
    seenIds.add(row.id);

    const nameKey = row.scientificName.trim().replace(/\s+/g, ' ').toLowerCase();
    if (seenNames.has(nameKey)) {
      throw new Error(
        `duplicate spacing-table scientificName: "${row.scientificName}" ` +
          '(would collide on the GBIF join key during the Stage 1.5 merge)',
      );
    }
    seenNames.add(nameKey);
  }
  return validated;
}

/**
 * Flatten a row's per-method citations into the flat `SourceRef[]` shape the
 * engine's {@link Provenance} `fields.spacing` slot expects, de-duplicating
 * sources cited for both methods (by `source` + `url`). This is the bridge
 * Stage 1.5 uses to attach this table's provenance onto a merged `Plant` without
 * this module needing to know anything about the rest of the record.
 */
export function spacingRecordSources(record: SpacingRecord): SourceRef[] {
  const merged: SourceRef[] = [];
  const seen = new Set<string>();
  for (const ref of [...(record.provenance.row ?? []), ...(record.provenance.intensive ?? [])]) {
    const key = `${ref.source} ${ref.url ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ref);
  }
  return merged;
}
