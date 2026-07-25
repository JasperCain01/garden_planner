/**
 * The warnings & companion-suggestion engine's **model**: the closed
 * vocabularies, the placement/result shapes, and the tunable numbers.
 *
 * This file exists for the same reason `suitability/model.ts` and
 * `spacing/model.ts` do — the numbers that encode a judgement live in one
 * place, and the whole model can be read off one screen. The reasoning behind
 * each decision is in `docs/adr/0014-warnings-and-companion-suggestions.md`.
 *
 * The shape this stage follows, set by Stage 2.1 (ADR 0012 §6): every warning
 * carries **machine-readable fields from a closed vocabulary** (a `kind`, a
 * `severity`, and which placements/plants it concerns) **and** a
 * human-readable `reason` sentence — so Stage 3.5 never has to parse prose to
 * know what kind of warning it is or how urgent it is.
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import { z } from 'zod';
import type { EvidenceLevel, Plant } from '../schema/plant.ts';
import type { SuitabilityFinding } from '../suitability/model.ts';
import type { SpacingSource } from '../spacing/model.ts';
import type { SpacingOptions } from '../spacing/fit.ts';
import type { PlotRegion } from '../spacing/region.ts';

// ---------------------------------------------------------------------------
// The five rules, as a closed vocabulary
// ---------------------------------------------------------------------------

/**
 * The five warning kinds `WORKPLAN.md`'s Stage 2.3 entry names, in the order
 * it names them. Three (`wrong-light`, `wrong-sowing-season`,
 * `climate-mismatch`) are thin wrappers over Stage 2.1's `SuitabilityFinding`
 * per dimension; two (`overcrowded`, `antagonist-adjacency`) are new work over
 * Stage 2.2's geometry. `soil` is a fifth suitability dimension but is
 * deliberately **not** one of these five — the Workplan names exactly these
 * five, and a soil mismatch is a gap a gardener fixes (amend, raise a bed),
 * not something a placement warning should nag about.
 */
export const WARNING_KINDS = [
  'wrong-light',
  'overcrowded',
  'wrong-sowing-season',
  'antagonist-adjacency',
  'climate-mismatch',
] as const;
/** One of the five warning kinds. See {@link WARNING_KINDS}. */
export type WarningKind = (typeof WARNING_KINDS)[number];

/**
 * How urgent a warning is. Three levels, closed:
 *
 * - `info` — worth a quiet note, nothing is actually wrong (not used by the
 *   five rules today, since a `marginal` suitability finding produces no
 *   warning at all — see `docs/adr/0014` §"what marginal produces" — but kept
 *   in the vocabulary so a future rule doesn't need a breaking type change).
 * - `warning` — a real, fixable problem: thin it out, sow later, expect a
 *   lighter crop.
 * - `severe` — a hard problem: the plant is unsuitable, wildly overcrowded, or
 *   the antagonist pairing is the well-supported (not folklore) kind.
 */
export const WARNING_SEVERITIES = ['info', 'warning', 'severe'] as const;
/** A warning's urgency. See {@link WARNING_SEVERITIES}. */
export type WarningSeverity = (typeof WARNING_SEVERITIES)[number];

/**
 * Which placement(s) a warning is about. `placementId` is the caller's own
 * identifier for the bed (see {@link CropPlacement}), so Stage 3.4/3.5 can
 * locate it on the canvas without re-deriving which bed produced the warning;
 * `plantId` travels alongside it purely for convenience (the same information
 * Stage 2.1's `SuitabilityResult.plantId` already carries).
 *
 * Most warnings name one placement; `antagonist-adjacency` names two.
 */
export interface WarningSubject {
  readonly placementId: string;
  readonly plantId: string;
}

interface WarningBase {
  readonly severity: WarningSeverity;
  readonly subjects: readonly WarningSubject[];
  /**
   * A deliverable, not a debug aid (Stage 2.1's precedent): the sentence Stage
   * 3.5 shows as-is. Machine-readable fields carry everything a rule needs, so
   * nothing has to parse this prose.
   */
  readonly reason: string;
}

/** `wrong-light` / `wrong-sowing-season` / `climate-mismatch` — thin wrappers over a `SuitabilityFinding`. */
export interface SuitabilityWarning extends WarningBase {
  readonly kind: 'wrong-light' | 'wrong-sowing-season' | 'climate-mismatch';
  /** The dimension's verdict that triggered this warning (`mismatch` or `unsuitable` — see the ADR). */
  readonly finding: SuitabilityFinding;
}

/** `overcrowded` — the user has placed more of a crop in a bed than it fits. */
export interface OvercrowdingWarning extends WarningBase {
  readonly kind: 'overcrowded';
  /** How many the user actually placed in this bed. */
  readonly plantedCount: number;
  /** How many `fitPlant` says the bed can hold at this spacing. */
  readonly maxCount: number;
  /** Whether the spacing figure behind `maxCount` was recorded or derived (ADR 0013 §6). */
  readonly spacingSource: SpacingSource;
}

/** `antagonist-adjacency` — two placed crops with a known antagonist link are planted too close. */
export interface AntagonistAdjacencyWarning extends WarningBase {
  readonly kind: 'antagonist-adjacency';
  /** The antagonist link's evidence tag (ADR 0008) — carried through, not averaged away. */
  readonly evidence: EvidenceLevel;
  /** How far apart the two beds actually are, centimetres (see `adjacency.ts`). */
  readonly distanceCm: number;
  /** The distance below which this pairing is flagged (see `adjacency.ts`). */
  readonly thresholdCm: number;
  /** The antagonist link's own citation-bearing note, if the dataset recorded one. */
  readonly note?: string;
}

/**
 * One warning. A discriminated union on `kind` rather than one wide interface
 * with optional fields everywhere: the five rules genuinely carry different
 * machine-readable data (a suitability `finding` vs. an adjacency `distanceCm`
 * vs. an overcrowding `maxCount`), and a union lets a consumer narrow on
 * `kind` and get the right fields typed, rather than guessing which optional
 * fields apply to which kind.
 */
export type Warning = SuitabilityWarning | OvercrowdingWarning | AntagonistAdjacencyWarning;

// ---------------------------------------------------------------------------
// Companion suggestions
// ---------------------------------------------------------------------------

/**
 * A suggestion to plant `suggestedPlantId` near an already-placed crop.
 *
 * Carries the {@link EvidenceLevel} through unaveraged (ADR 0008, ADR 0014):
 * 82 of the 85 shipped companion links are `traditional`, so hiding them would
 * leave almost nothing to suggest, but the `reason` sentence is phrased
 * differently per evidence level so the user is never misled into thinking
 * folklore is a tested effect (see `companions.ts`).
 *
 * `suggestedPlantId` is a bare id, not a resolved `Plant` — the same choice
 * `PlantLink` itself makes (ADR 0004 §"Companion / antagonist links"): the
 * engine never sees the whole plant catalogue, only the crops actually placed
 * on this plot, so it cannot resolve a name for a crop that isn't one of them.
 * Stage 3.5 resolves it against the runtime `shipped ∪ user` list it already
 * holds (Stage 3.1).
 */
export interface CompanionSuggestion {
  /** The placement this suggestion is attached to (the crop already in the ground). */
  readonly forPlacementId: string;
  /** That placement's crop id. */
  readonly forPlantId: string;
  /** The candidate to plant nearby. */
  readonly suggestedPlantId: string;
  /** Well-supported science or traditional folklore — carried through unaveraged. */
  readonly evidence: EvidenceLevel;
  /** The link's own citation-bearing note, if the dataset recorded one. */
  readonly note?: string;
  /** A deliverable sentence, phrased per evidence level (see `companions.ts`). */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Placements — what the UI passes in for "what's on the plot right now"
// ---------------------------------------------------------------------------

/**
 * One crop as the user has actually placed it: a plant, the sub-area (bed) of
 * the plot it occupies, and how many the user has put there.
 *
 * `region` is a full {@link PlotRegion} — the same arbitrary-polygon shape
 * Stage 2.2 already models a bed as — rather than a point, because a single
 * point cannot answer "how many fit" (that question needs an area) and
 * Stage 2.2 already solved "how many fit in this shape" via `fitPlant`. This
 * stage reuses that answer rather than inventing a second placement geometry;
 * see `docs/adr/0014-warnings-and-companion-suggestions.md` for the
 * alternatives weighed (in particular, why no separate point-in-plot model was
 * introduced ahead of Stage 3.4 committing to one).
 *
 * `plant` and `region` are **not re-validated here**. `plant` arrives already
 * valid (`validatePlant` for a shipped crop, `createUserPlant` for a
 * user-defined one — ADR 0011), matching how `fitPlant` treats its own `plant`
 * argument; `region` is validated by `fitPlant` itself when this module calls
 * it internally (ADR 0013 §7's trust-boundary split), so validating it again
 * here would be ceremony without a guarantee. `count` is validated
 * ({@link PlacementCountSchema}) because it is new to this stage and
 * genuinely crosses a trust boundary (arbitrary UI state).
 */
export interface CropPlacement {
  /**
   * The caller's own identifier for this placement (e.g. a canvas element id).
   * Must be unique within one `evaluatePlot` call — it is how a `Warning` or
   * `CompanionSuggestion` tells the UI *which* bed it is about.
   */
  readonly id: string;
  /** The crop placed here, shipped or user-defined — no origin-awareness (ADR 0011). */
  readonly plant: Plant;
  /** The bed this crop occupies, in the plot's own centimetre frame (ADR 0013). */
  readonly region: PlotRegion;
  /** How many of this crop the user has actually put in `region`. */
  readonly count: number;
  /** Growing method / packing choice for this bed; same defaults as `fitPlant`. */
  readonly options?: SpacingOptions;
}

/**
 * Validates {@link CropPlacement.count}: a non-negative integer. Exported so
 * `evaluate.ts` and its tests share one rule rather than restating "must be a
 * non-negative integer" independently.
 */
export const PlacementCountSchema = z.number().int().nonnegative();

// ---------------------------------------------------------------------------
// The entry point's result
// ---------------------------------------------------------------------------

/** Everything `evaluatePlot` returns for one plot state: all warnings, all suggestions, at once. */
export interface PlotEvaluation {
  readonly warnings: readonly Warning[];
  readonly suggestions: readonly CompanionSuggestion[];
}

// ---------------------------------------------------------------------------
// Tunable numbers
// ---------------------------------------------------------------------------

/**
 * How far over a bed's `fitPlant` capacity the user must have planted before
 * an overcrowding warning escalates from `warning` to `severe`. `1.5` means
 * "half again as many as the bed can hold" — noticeably more than a rounding
 * slip, and a bed with `maxCount === 0` (nothing fits at all) is always
 * `severe` regardless of this ratio (see `overcrowding.ts`).
 */
export const OVERCROWDING_SEVERE_RATIO = 1.5;

/**
 * Severity for an `antagonist-adjacency` warning, keyed by the link's evidence
 * level. A `well-supported` pairing (today, only potato/tomato blight-sharing)
 * is a documented disease-epidemiology risk and escalates to `severe`; a
 * `traditional` pairing (garlic/green-bean, onion/pea) is folklore with a
 * plausible-but-unconfirmed mechanism (ADR 0008 §3) and stays at `warning`.
 * This is the same "carry the tag through, don't average it away" principle
 * applied to warnings rather than suggestions.
 */
export const ANTAGONIST_SEVERITY_BY_EVIDENCE: Readonly<Record<EvidenceLevel, WarningSeverity>> = {
  'well-supported': 'severe',
  traditional: 'warning',
};

/**
 * Maps a {@link SuitabilityFinding} to a warning severity for the three
 * suitability-derived rules. **Deliberately has no entries for `match`,
 * `marginal`, `unknown-plant` or `unknown-plot`** — those findings produce no
 * warning at all (see `docs/adr/0014` for why `marginal` doesn't, and ADR
 * 0012's own reasoning for why the two `unknown-*` findings must not be
 * treated as a problem with the plot). Looking a finding up in this map is
 * therefore also the "is this even a warning?" test — see `isWarningFinding`.
 */
export const FINDING_SEVERITY: Partial<Record<SuitabilityFinding, WarningSeverity>> = {
  mismatch: 'warning',
  unsuitable: 'severe',
};

/** Whether a {@link SuitabilityFinding} is severe/warning-worthy (i.e. has an entry in {@link FINDING_SEVERITY}). */
export function isWarningFinding(
  finding: SuitabilityFinding,
): finding is 'mismatch' | 'unsuitable' {
  return finding === 'mismatch' || finding === 'unsuitable';
}

/** Format a centimetre distance for prose: whole numbers stay whole, others get one decimal place. */
export function formatCm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
