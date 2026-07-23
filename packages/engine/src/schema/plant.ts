/**
 * Canonical plant-record schema (Workplan Stage 0.2, the keystone schema).
 *
 * **zod is the single source of truth.** Every TypeScript type in this module is
 * derived from a zod schema via `z.infer`, so the runtime validator and the
 * static types can never drift apart. Nothing downstream (ETL adapters, the
 * suitability/spacing engine, the UI) should redeclare these shapes — they should
 * import the inferred types from here.
 *
 * Scope is **edibles only** (see `DESIGN.md` §2); the fields reflect that.
 *
 * Design notes worth reading before editing:
 * - The crux of this schema is **method-aware spacing** — spacing is not a single
 *   number because the number depends on the growing method (row vs. intensive).
 *   See {@link SpacingSchema} and `docs/adr/0004-plant-schema.md`.
 * - Most requirement fields are **optional**, because real horticultural data is
 *   patchy; only identity (and a usable spacing block) is required. This keeps the
 *   ETL's hard-fail gate (Stage 1.5) strict about identity without rejecting a
 *   record just because, say, its soil pH is unknown.
 *
 * This package is deliberately framework-free (no React/DOM imports) so the
 * schema can be reused and unit-tested in isolation.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

/**
 * A URL-and-filename-safe slug: lowercase alphanumerics separated by single
 * hyphens (e.g. `"onion"`, `"climbing-french-bean"`). Used for the plant `id`
 * and for companion/antagonist references, so ids stay stable and legible.
 *
 * Exported so other stages that mint or validate `Plant.id`-shaped ids (e.g.
 * Stage 1.3's hand-verified spacing table) reuse this exact rule rather than
 * restating the regex and risking drift.
 */
export const SlugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'must be a lowercase hyphen-separated slug (e.g. "climbing-french-bean")',
  );

/**
 * A calendar month as an integer, January = 1 … December = 12. Exported (Stage
 * 1.6) so the climate module can reuse this exact bound for a frost date's
 * month component instead of restating "1 to 12" independently.
 */
export const MonthSchema = z
  .number()
  .int()
  .min(1, 'month must be between 1 (January) and 12 (December)')
  .max(12, 'month must be between 1 (January) and 12 (December)');
/** A calendar month number, `z.infer`-derived from {@link MonthSchema}. */
export type MonthNumber = z.infer<typeof MonthSchema>;

// ---------------------------------------------------------------------------
// Ordered enums
//
// Some enums are *ordered* on purpose: the engine needs to measure "how far off"
// a plant is from a plot's conditions, not merely whether they match. We keep the
// canonical order in an exported tuple, derive the zod enum from it, and expose a
// rank helper — so the ordering lives in exactly one place.
// ---------------------------------------------------------------------------

/**
 * Light requirement, ordered from most to least sun. The order matters: the
 * suitability engine (Stage 2.1) scores the *distance* between a plant's need and
 * a plot's light level, so "full sun plant in partial shade" scores better than
 * "full sun plant in full shade". Keep this array in sun→shade order.
 */
export const LIGHT_REQUIREMENTS = ['full-sun', 'partial-shade', 'full-shade'] as const;

export const LightRequirementSchema = z.enum(LIGHT_REQUIREMENTS);
export type LightRequirement = z.infer<typeof LightRequirementSchema>;

/**
 * Rank of a light requirement (0 = full sun). Exposed so the engine can compute
 * the signed/absolute distance between a plant's need and a plot's light level
 * without hard-coding the ordering.
 */
export function lightRequirementRank(value: LightRequirement): number {
  return LIGHT_REQUIREMENTS.indexOf(value);
}

/**
 * RHS hardiness ratings, ordered from most tender (H1a) to fully hardy (H7).
 * This is the natural vocabulary for the Britain-default scope (see `DESIGN.md`
 * §"Climate / location data"). It is ordered for the same reason as light: the
 * engine compares a plant's rating against a location's climate band.
 * See the ADR for why we store *both* this band and an optional `minTempC`.
 */
export const RHS_HARDINESS_RATINGS = [
  'H1a',
  'H1b',
  'H1c',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'H7',
] as const;

export const RhsHardinessRatingSchema = z.enum(RHS_HARDINESS_RATINGS);
export type RhsHardinessRating = z.infer<typeof RhsHardinessRatingSchema>;

/** Rank of an RHS rating (0 = H1a, most tender). See {@link lightRequirementRank}. */
export function rhsHardinessRank(value: RhsHardinessRating): number {
  return RHS_HARDINESS_RATINGS.indexOf(value);
}

// ---------------------------------------------------------------------------
// Unordered (closed) enums
// ---------------------------------------------------------------------------

/** Broad edible category. Kept coarse on purpose; edible *parts* add detail. */
export const EdibleCategorySchema = z.enum(['vegetable', 'herb', 'fruit']);
export type EdibleCategory = z.infer<typeof EdibleCategorySchema>;

/** The parts of the plant that are eaten. Optional detail on top of the category. */
export const EdiblePartSchema = z.enum([
  'leaf',
  'stem',
  'root',
  'tuber',
  'bulb',
  'fruit',
  'seed',
  'pod',
  'flower',
]);
export type EdiblePart = z.infer<typeof EdiblePartSchema>;

/** Soil texture the plant tolerates. Plants often accept several, hence an array. */
export const SoilTextureSchema = z.enum(['sand', 'loam', 'clay', 'chalk', 'silt']);
export type SoilTexture = z.infer<typeof SoilTextureSchema>;

/** Soil pH preference band. */
export const SoilPhSchema = z.enum(['acid', 'neutral', 'alkaline']);
export type SoilPh = z.infer<typeof SoilPhSchema>;

/** Soil moisture preference. */
export const SoilMoistureSchema = z.enum(['dry', 'moist', 'wet']);
export type SoilMoisture = z.infer<typeof SoilMoistureSchema>;

/**
 * Evidence quality for a companion/antagonist relationship. Companion planting
 * mixes real science with folklore (see `DESIGN.md` §"Companion planting data"),
 * so every relationship must declare which it is; the UI can then be honest about
 * it rather than presenting all pairings as equally authoritative.
 */
export const EvidenceLevelSchema = z.enum(['well-supported', 'traditional']);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

// ---------------------------------------------------------------------------
// Method-aware spacing — the crux of this schema
// ---------------------------------------------------------------------------

/**
 * Row-growing spacing: the two distances a traditional row plot needs. Both are
 * required together because a single number can't describe a row (a row is
 * defined by in-row *and* between-row distance). Centimetres, must be positive.
 */
export const RowSpacingSchema = z
  .object({
    /** Distance between plants along a row, in centimetres. */
    inRowCm: z.number().positive(),
    /** Distance between adjacent rows, in centimetres. */
    betweenRowCm: z.number().positive(),
  })
  .strict();
export type RowSpacing = z.infer<typeof RowSpacingSchema>;

/**
 * Intensive / square-foot spacing: a density figure rather than row distances.
 * Two interchangeable ways to express the same thing are allowed because sources
 * differ — RHS/agronomy quotes plants-per-m², the square-foot-gardening system
 * quotes plants-per-square (a "square" = one 30 cm × 30 cm cell). At least one
 * must be present if the intensive block exists.
 */
export const IntensiveSpacingSchema = z
  .object({
    /** Plants per square metre (bed/broadcast density). */
    perSquareMetre: z.number().positive().optional(),
    /**
     * Plants per square-foot-gardening cell (a 30 cm × 30 cm square). This is the
     * classic "N per square" figure from the square-foot method — e.g. onions = 9.
     */
    plantsPerSquare: z.number().positive().optional(),
  })
  .strict()
  .refine(
    (intensive) =>
      intensive.perSquareMetre !== undefined || intensive.plantsPerSquare !== undefined,
    { message: 'intensive spacing needs at least one of perSquareMetre or plantsPerSquare' },
  );
export type IntensiveSpacing = z.infer<typeof IntensiveSpacingSchema>;

/**
 * Method-aware spacing. **This is why the schema exists in the shape it does.**
 *
 * The same crop has different densities depending on the growing method: onions
 * are ~4 cm in-row × 30 cm between rows in a traditional plot, but ~8 cm on all
 * sides (9 per square) in an intensive bed. A record that stored one spacing
 * number would silently pick a method for the user. So we store spacing *per
 * method* and let the density calculator (Stage 2.2) choose which to apply.
 *
 * A plant may populate some but not all methods (a fruit tree has row/tree
 * spacing but no meaningful intensive figure), so both blocks are optional — but
 * at least one must be present, because a plant with no spacing at all cannot be
 * placed on the plot, which is the app's whole point.
 */
export const SpacingSchema = z
  .object({
    /** Traditional row growing (in-row + between-row distances). */
    row: RowSpacingSchema.optional(),
    /** Intensive / square-foot growing (a density figure). */
    intensive: IntensiveSpacingSchema.optional(),
  })
  .strict()
  .refine((spacing) => spacing.row !== undefined || spacing.intensive !== undefined, {
    message: 'spacing must define at least one growing method (row or intensive)',
  });
export type Spacing = z.infer<typeof SpacingSchema>;

// ---------------------------------------------------------------------------
// Hardiness, soil, seasons
// ---------------------------------------------------------------------------

/**
 * Hardiness, stored as two complementary representations (both optional):
 * - `rhsRating` — the RHS band, the natural UK vocabulary the default profile uses.
 * - `minTempC` — the lowest temperature the plant survives, in °C. A portable,
 *   machine-comparable number that also bridges to non-UK climate data (USDA
 *   zones, Köppen) without committing to the RHS vocabulary.
 *
 * See the ADR for why both are kept rather than picking one.
 */
export const HardinessSchema = z
  .object({
    rhsRating: RhsHardinessRatingSchema.optional(),
    /** Minimum survivable temperature in °C (negative for frost-hardy plants). */
    minTempC: z.number().optional(),
  })
  .strict()
  // An empty hardiness object carries no information; if the block is present it
  // must say something.
  .refine((h) => h.rhsRating !== undefined || h.minTempC !== undefined, {
    message: 'hardiness needs at least one of rhsRating or minTempC',
  });
export type Hardiness = z.infer<typeof HardinessSchema>;

/**
 * Soil preferences. Each dimension is an array because a crop usually tolerates a
 * range (e.g. loam *or* clay). All optional — soil data is among the patchiest.
 */
export const SoilSchema = z
  .object({
    textures: z.array(SoilTextureSchema).nonempty().optional(),
    ph: z.array(SoilPhSchema).nonempty().optional(),
    moisture: z.array(SoilMoistureSchema).nonempty().optional(),
  })
  .strict();
export type Soil = z.infer<typeof SoilSchema>;

/**
 * An inclusive range of calendar months, e.g. `{ start: 3, end: 5 }` = March–May.
 *
 * Wrap-around is allowed and meaningful: when `end < start` the range spans the
 * new year (e.g. `{ start: 11, end: 2 }` = November–February). Consumers must not
 * assume `start <= end`; a helper to expand a range into concrete months belongs
 * in the engine, not the schema.
 */
export const MonthRangeSchema = z
  .object({
    start: MonthSchema,
    end: MonthSchema,
  })
  .strict();
export type MonthRange = z.infer<typeof MonthRangeSchema>;

/**
 * Sowing and harvest windows, Britain-oriented for now. Each is a list of ranges
 * because many crops have more than one window (e.g. lettuce sown spring *and*
 * late summer). Both optional.
 */
export const SeasonsSchema = z
  .object({
    sow: z.array(MonthRangeSchema).nonempty().optional(),
    harvest: z.array(MonthRangeSchema).nonempty().optional(),
  })
  .strict();
export type Seasons = z.infer<typeof SeasonsSchema>;

// ---------------------------------------------------------------------------
// Companion / antagonist links
// ---------------------------------------------------------------------------

/**
 * A directed link to another plant by its `id`. Used for both companions and
 * antagonists. Referential integrity (that `plantId` actually exists in the
 * dataset) is **not** enforced here — it is checked at dataset-build time
 * (Stage 1.5), because a single record can't see the whole dataset. Here we only
 * guarantee the shape and the mandatory evidence tag.
 */
export const PlantLinkSchema = z
  .object({
    /** The `id` (slug) of the related plant. */
    plantId: SlugSchema,
    /** Whether the relationship is well-supported or traditional/folklore. */
    evidence: EvidenceLevelSchema,
    /** Optional human-readable reason, e.g. "fixes nitrogen for heavy feeders". */
    note: z.string().optional(),
  })
  .strict();
export type PlantLink = z.infer<typeof PlantLinkSchema>;

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * Which parts of a record can carry their own source attribution. Closed on
 * purpose (enums closed, per the brief) so provenance keys stay disciplined and
 * typo-proof. Extend this list if a new provenance-worthy field is added.
 */
export const ProvenanceFieldSchema = z.enum([
  'identity',
  'edibleCategory',
  'light',
  'spacing',
  'hardiness',
  'soil',
  'seasons',
  'companions',
]);
export type ProvenanceField = z.infer<typeof ProvenanceFieldSchema>;

/**
 * A single source attribution. Needed for the dataset's CC BY-NC-SA obligations
 * and for plain honesty about where a fact came from (PFAF vs. a hand-verified
 * chart vs. a scraped guide). `source` is a free string for now — Stage 1.x will
 * settle a controlled vocabulary once the real sources are wired in.
 */
export const SourceRefSchema = z
  .object({
    /** Human-readable source name, e.g. "PFAF", "RHS", "hand-verified". */
    source: z.string().min(1),
    /** Identifier within that source (a PFAF id, a row number), if any. */
    sourceId: z.string().optional(),
    /** Link to the source record/page, if any. */
    url: z.string().url().optional(),
    /** SPDX-ish licence string for the source, e.g. "CC-BY-NC-SA-4.0". */
    license: z.string().optional(),
    /** ISO-8601 date the fact was retrieved, e.g. "2026-01-15". */
    retrievedAt: z.string().optional(),
    /** Anything a curator wants to flag (a conflict, a caveat). */
    note: z.string().optional(),
  })
  .strict();
export type SourceRef = z.infer<typeof SourceRefSchema>;

/**
 * Provenance for a record: at least one record-level source, plus optional
 * per-field attribution for records assembled from several sources (e.g. identity
 * from GBIF, spacing hand-verified, everything else from PFAF).
 */
export const ProvenanceSchema = z
  .object({
    /** Record-level sources. Required and non-empty: every record must be attributable. */
    sources: z.array(SourceRefSchema).nonempty(),
    /** Optional finer-grained attribution, keyed by the field it applies to. */
    fields: z.record(ProvenanceFieldSchema, z.array(SourceRefSchema).nonempty()).optional(),
  })
  .strict();
export type Provenance = z.infer<typeof ProvenanceSchema>;

// ---------------------------------------------------------------------------
// The plant record
// ---------------------------------------------------------------------------

/**
 * The canonical plant record. Everything downstream builds on this shape.
 *
 * Required: identity (`id`, `commonName`, `scientificName`), `category`, `light`,
 * `spacing` (with at least one method), and `provenance` (with at least one
 * source). Everything else is optional because real data is patchy — a record is
 * still useful with just identity, light, and a spacing figure.
 *
 * The record and every nested object are **strict** (`.strict()`): an unknown or
 * misspelled key is a validation *error*, not silently dropped. This matters
 * because {@link validatePlant} is the ETL's hard-fail gate (Stage 1.5) — a
 * typo'd field name (`hardyness`) must fail loudly rather than ship a record with
 * that fact silently missing.
 */
export const PlantSchema = z
  .object({
    // --- Identity ---
    /** Stable slug id; also the target of companion/antagonist links. */
    id: SlugSchema,
    /** Everyday name, e.g. "Onion". */
    commonName: z.string().min(1),
    /** Botanical name, e.g. "Allium cepa". */
    scientificName: z.string().min(1),
    /**
     * GBIF taxon id — the canonical join key across data sources. Nullable because
     * it is filled in by the name resolver in Stage 1.1; a freshly authored record
     * legitimately has `null` here until resolution runs.
     */
    gbifId: z.number().int().positive().nullable(),
    /** Cultivar name if the record is cultivar-specific, e.g. "Sturon". */
    cultivar: z.string().optional(),
    /** Alternative common names / synonyms, to aid search and de-duplication. */
    synonyms: z.array(z.string().min(1)).nonempty().optional(),

    // --- Classification ---
    category: EdibleCategorySchema,
    edibleParts: z.array(EdiblePartSchema).nonempty().optional(),

    // --- Requirements ---
    light: LightRequirementSchema,
    spacing: SpacingSchema,
    hardiness: HardinessSchema.optional(),
    soil: SoilSchema.optional(),
    seasons: SeasonsSchema.optional(),

    // --- Relationships ---
    companions: z.array(PlantLinkSchema).nonempty().optional(),
    antagonists: z.array(PlantLinkSchema).nonempty().optional(),

    // --- Presentation ---
    /**
     * Key into the SVG icon set (Stage 4.1). Optional because icons are produced
     * later; when absent the UI falls back to a generic icon. Often equal to `id`.
     */
    icon: SlugSchema.optional(),

    // --- Attribution ---
    provenance: ProvenanceSchema,
  })
  .strict();

/** The canonical plant record type — the single shape everything else imports. */
export type Plant = z.infer<typeof PlantSchema>;

// ---------------------------------------------------------------------------
// Public validators
// ---------------------------------------------------------------------------

/**
 * Parse and validate an unknown value as a {@link Plant}, **throwing** a
 * `ZodError` on the first invalid record. This is the hard-fail gate the ETL
 * calls at dataset-build time (Stage 1.5) — invalid data must never ship, so a
 * throw that fails the build is exactly the behaviour we want.
 *
 * @param input - untrusted data (e.g. a mapped record from an ETL adapter).
 * @returns the same data, now typed as `Plant`.
 */
export function validatePlant(input: unknown): Plant {
  return PlantSchema.parse(input);
}

/**
 * Non-throwing counterpart to {@link validatePlant}. Returns zod's
 * discriminated `{ success, data | error }` result so callers that want to
 * collect *all* failures (e.g. a validation report over the whole dataset)
 * can do so without try/catch.
 */
export function safeValidatePlant(input: unknown): z.SafeParseReturnType<unknown, Plant> {
  return PlantSchema.safeParse(input);
}
