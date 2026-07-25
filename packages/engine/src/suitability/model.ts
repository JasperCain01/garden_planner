/**
 * The suitability scoring **model**: the score scale, the per-dimension weights,
 * the missing-data policy, and the result shapes every scorer produces.
 *
 * This file is deliberately the only place the model's *numbers* live, so the
 * design decisions recorded in `docs/adr/0012-suitability-scoring.md` can be read
 * off one screen and changed in one place.
 *
 * The three ideas that make the model work, in brief (the ADR has the reasoning):
 *
 * 1. **Every score is a 0–1 fraction**, per dimension and in aggregate. 1 is
 *    "the plot gives this crop what it asks for", 0 is "this crop cannot work
 *    here".
 * 2. **Missing data is excluded, not defaulted.** A dimension the data can't
 *    speak to scores `null` and takes no part in the weighted mean, so "absent"
 *    never silently reads as a perfect match *or* as a total mismatch. What is
 *    lost shows up instead as {@link SuitabilityResult.confidence} — the share of
 *    the model's weight that could actually be assessed — and is said out loud in
 *    the result's reasoning. This matters enormously on today's dataset, where
 *    **0 of the 160 shipped records carry hardiness, soil or seasons**.
 * 3. **A hard mismatch on one dimension caps the whole result** (Liebig's law of
 *    the minimum: the limiting factor governs). A full-sun crop in a deep-shade
 *    bed must not average its way to a respectable score off three unknowns.
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

// ---------------------------------------------------------------------------
// Dimensions and their weights
// ---------------------------------------------------------------------------

/**
 * The four things a plot is scored on, in the order they appear in a result.
 * `DESIGN.md` §"The two calculations that make it useful" names exactly these:
 * "light match, hardiness vs. the location's climate, soil match, and season".
 */
export const SUITABILITY_DIMENSIONS = ['light', 'hardiness', 'soil', 'season'] as const;

/** One of the four scored dimensions. */
export type SuitabilityDimension = (typeof SUITABILITY_DIMENSIONS)[number];

/**
 * How much each dimension contributes to the aggregate score. They sum to 1, so
 * a weight doubles as "the share of confidence this dimension is worth".
 *
 * The ordering is a horticultural judgement about **what a gardener can and
 * cannot change**, not a statistical fit:
 *
 * - `light` (0.35) — the plot's light level is fixed by walls, fences and
 *   neighbours' trees. It is also the only requirement dimension with real
 *   coverage in the shipped data, and the one the user always supplies.
 * - `hardiness` (0.30) — the region's winter is likewise not negotiable, and
 *   losing a crop to frost is a total loss rather than a poor yield. Slightly
 *   below light because much of Britain's growing is annual: a tender crop can
 *   still be worth sowing for one summer.
 * - `soil` (0.20) — genuinely important, but the one condition a gardener
 *   *changes*: grit, compost, lime, raised beds and irrigation all move it.
 * - `season` (0.15) — the softest, because it is a question of *when* rather
 *   than *whether*. "Sow this in March, not July" is advice you act on by
 *   waiting, so it should nudge a ranking rather than dominate it.
 */
export const DIMENSION_WEIGHTS: Readonly<Record<SuitabilityDimension, number>> = {
  light: 0.35,
  hardiness: 0.3,
  soil: 0.2,
  season: 0.15,
};

/** Total nominal weight (1, by construction — computed so it can't drift). */
export const TOTAL_DIMENSION_WEIGHT = SUITABILITY_DIMENSIONS.reduce(
  (total, dimension) => total + DIMENSION_WEIGHTS[dimension],
  0,
);

// ---------------------------------------------------------------------------
// Findings — the machine-readable verdict behind each reason string
// ---------------------------------------------------------------------------

/**
 * A dimension's verdict, in a single closed vocabulary shared by all four
 * scorers. This exists so Stage 2.3's warnings engine can key off a stable
 * value rather than parsing the prose in {@link DimensionScore.reason}:
 *
 * - `match` — the plot gives the crop what it asks for.
 * - `marginal` — slightly off; workable with care, worth a caveat.
 * - `mismatch` — clearly off, but survivable or fixable (amend the soil, sow
 *   later, water more).
 * - `unsuitable` — a hard mismatch. **Only this value caps the aggregate**
 *   (see {@link LIMITING_FACTOR_CAP}), so a scorer returns it only when the
 *   crop genuinely cannot work in that plot.
 * - `unknown-plant` — the crop record doesn't carry the data (the common case
 *   today: no shipped record has hardiness, soil or seasons).
 * - `unknown-plot` — the *user* didn't supply it (e.g. soil left blank).
 *
 * The two `unknown-*` values are distinguished because the UI's remedy differs:
 * one is a gap in our data, the other is a question the user can still answer.
 */
export const SUITABILITY_FINDINGS = [
  'match',
  'marginal',
  'mismatch',
  'unsuitable',
  'unknown-plant',
  'unknown-plot',
] as const;

/** A dimension's verdict. See {@link SUITABILITY_FINDINGS}. */
export type SuitabilityFinding = (typeof SUITABILITY_FINDINGS)[number];

/** Score at or above which a dimension counts as a clean `match`. */
export const MATCH_THRESHOLD = 0.9;
/** Score at or above which a dimension counts as `marginal` rather than a `mismatch`. */
export const MARGINAL_THRESHOLD = 0.6;

/**
 * Map a dimension's numeric score to its {@link SuitabilityFinding}, so the
 * four scorers can't drift apart on where "marginal" ends and "mismatch"
 * begins.
 *
 * Note the hard rule at the bottom: **a score of exactly 0 means `unsuitable`**,
 * which is what triggers the limiting-factor cap. Dimensions that should never
 * disqualify a crop (soil, season) therefore never return 0 — they floor above
 * it, deliberately and documentedly, in their own modules.
 */
export function findingForScore(score: number): SuitabilityFinding {
  if (score >= MATCH_THRESHOLD) return 'match';
  if (score >= MARGINAL_THRESHOLD) return 'marginal';
  if (score > 0) return 'mismatch';
  return 'unsuitable';
}

/** Whether a finding means "we couldn't assess this", i.e. `score` is `null`. */
export function isUnknownFinding(finding: SuitabilityFinding): boolean {
  return finding === 'unknown-plant' || finding === 'unknown-plot';
}

// ---------------------------------------------------------------------------
// Aggregation constants
// ---------------------------------------------------------------------------

/**
 * The score an unknown dimension is pulled *towards* when ranking — the
 * "we have no opinion" midpoint.
 *
 * This is the numeric expression of the missing-data policy. The aggregate
 * {@link SuitabilityResult.score} is a weighted mean over the dimensions we
 * could assess ("given what we know, how good is this?"), while
 * {@link SuitabilityResult.rankingScore} shrinks that figure towards this prior
 * in proportion to how much we *don't* know. So a crop with one known,
 * perfectly-matching dimension does not outrank a fully-known, equally-perfect
 * crop — but neither is it punished as though the missing data were bad news.
 */
export const NEUTRAL_PRIOR = 0.5;

/**
 * The ceiling applied to a result when any dimension's finding is
 * `unsuitable` — Liebig's law of the minimum, as a cap rather than a veto.
 *
 * A cap, not a veto (score 0 / dropped from the list), because the palette
 * should still be able to *show* the crop and explain why it is greyed out,
 * and because Stage 2.3 turns exactly these results into warnings. The value
 * sits below {@link BAND_THRESHOLDS}'s `poor` floor, so a capped result always
 * bands as `unsuitable` and always sorts beneath every uncapped one.
 */
export const LIMITING_FACTOR_CAP = 0.2;

// ---------------------------------------------------------------------------
// Bands — the coarse verdict the UI shows
// ---------------------------------------------------------------------------

/** Coarse, user-facing verdicts, best first. */
export const SUITABILITY_BANDS = ['excellent', 'good', 'fair', 'poor', 'unsuitable'] as const;

/** A coarse, user-facing verdict for a whole result. */
export type SuitabilityBand = (typeof SUITABILITY_BANDS)[number];

/**
 * Lower bound (inclusive) of each band, applied to
 * {@link SuitabilityResult.rankingScore} — *not* to the raw evidence score.
 *
 * Banding the same figure the list is ordered by is what keeps the palette
 * coherent: an "excellent" crop can never appear below a "good" one. It also
 * means a crop we know almost nothing about cannot be labelled `excellent` off
 * a single matching dimension — with only light known, the best attainable
 * ranking score is 0.675, which reads (honestly) as `good`.
 */
export const BAND_THRESHOLDS: Readonly<Record<Exclude<SuitabilityBand, 'unsuitable'>, number>> = {
  excellent: 0.8,
  good: 0.6,
  fair: 0.4,
  poor: 0.25,
};

/** Human-readable band labels, used to open a result's summary sentence. */
export const BAND_LABELS: Readonly<Record<SuitabilityBand, string>> = {
  excellent: 'Excellent match',
  good: 'Good match',
  fair: 'Fair match',
  poor: 'Poor match',
  unsuitable: 'Unsuitable',
};

/** The band a ranking score falls into. See {@link BAND_THRESHOLDS}. */
export function bandForScore(rankingScore: number): SuitabilityBand {
  if (rankingScore >= BAND_THRESHOLDS.excellent) return 'excellent';
  if (rankingScore >= BAND_THRESHOLDS.good) return 'good';
  if (rankingScore >= BAND_THRESHOLDS.fair) return 'fair';
  if (rankingScore >= BAND_THRESHOLDS.poor) return 'poor';
  return 'unsuitable';
}

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

/**
 * One dimension's contribution to a result.
 *
 * These are plain TypeScript interfaces rather than zod schemas — unlike the
 * *inputs* (`conditions.ts`), which are zod-first because they cross a trust
 * boundary. A result is computed here and consumed here; nothing ever parses one
 * from untrusted input, so a runtime validator would add ceremony without adding
 * a guarantee. (Same reasoning ADR 0010 §6 used for keeping region centroids out
 * of `ClimateProfileSchema`.)
 */
export interface DimensionScore {
  /** Which dimension this is. */
  readonly dimension: SuitabilityDimension;
  /** The machine-readable verdict; drives Stage 2.3's warnings. */
  readonly finding: SuitabilityFinding;
  /**
   * 0–1 score, or `null` when the finding is one of the `unknown-*` values.
   * `null` is deliberate: it cannot be quietly averaged in as though it were a
   * number, which is exactly the failure this model is designed against.
   */
  readonly score: number | null;
  /** This dimension's nominal weight ({@link DIMENSION_WEIGHTS}). */
  readonly weight: number;
  /**
   * A short, human-readable explanation — a **deliverable, not a debug aid**
   * (Stage 2.1 brief): the palette shows it so the user can see *why* a crop
   * ranked where it did.
   */
  readonly reason: string;
}

/** A whole plant's suitability for a plot. */
export interface SuitabilityResult {
  /** The scored plant's `id`, so a result can travel without the record. */
  readonly plantId: string;
  /**
   * The **evidence score**, 0–1: the weighted mean over the dimensions that
   * could actually be assessed, capped by {@link LIMITING_FACTOR_CAP} if any
   * dimension was `unsuitable`. Read it as "given what we know, how well does
   * this crop fit?".
   */
  readonly score: number;
  /**
   * 0–1: the share of the model's total weight that could be assessed. 1 means
   * all four dimensions had data; 0.35 (today's shipped-data reality) means the
   * score rests on light alone.
   */
  readonly confidence: number;
  /**
   * The figure {@link rankPlants} orders by and {@link bandForScore} bands:
   * {@link score} shrunk towards {@link NEUTRAL_PRIOR} in proportion to missing
   * data, then capped like `score`. This is where "absent means neither perfect
   * nor hopeless" becomes an actual number.
   */
  readonly rankingScore: number;
  /** The coarse verdict for the UI. `unsuitable` whenever `limitedBy` is non-empty. */
  readonly band: SuitabilityBand;
  /** Dimensions whose finding was `unsuitable` — the limiting factors. Usually empty. */
  readonly limitedBy: readonly SuitabilityDimension[];
  /** All four dimensions, always, in {@link SUITABILITY_DIMENSIONS} order. */
  readonly dimensions: readonly DimensionScore[];
  /**
   * One-line explanation for the UI: the band, the single most decisive reason,
   * and — when data is missing — an explicit statement of what wasn't known.
   * The per-dimension `reason` strings carry the detail behind it.
   */
  readonly summary: string;
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

/**
 * Round a score to four decimal places.
 *
 * Weighted means of values like 0.35 and 0.65 produce binary-floating-point
 * dust (`0.30000000000000004`). Four places is far finer than any horticultural
 * distinction this model can honestly claim, and it makes results comparable,
 * stable across platforms, and readable in a test expectation.
 */
export function roundScore(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
