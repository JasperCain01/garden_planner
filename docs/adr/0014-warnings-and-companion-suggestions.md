# 0014 — Warnings & companion suggestions: adjacency on a polygon, the overcrowding test, the missing-data floor, and how evidence is surfaced

- **Status:** Accepted
- **Date:** 2026-07-25
- **Workplan stage:** 2.3 — warnings & companion-suggestion engine

## Context

`DESIGN.md` §1 step 4 ("Validate continuously") is the last piece of the app's
core loop: raise warnings when something won't thrive — wrong light, too
closely spaced, wrong season to sow, a known antagonist planted nearby, an
incompatible climate — and suggest companion plants for what's already placed.
Stage 2.1 (suitability scoring, ADR 0012) and Stage 2.2 (spacing/density, ADR 0013) already built the two calculations this stage turns into rules; Stage 1.4
(companion data, ADR 0008) already built the evidence-tagged relationship
dataset. This stage is deliberately "well-scoped rules work over two stable
contracts" (the Stage 2.3 brief) — the scoring and the packing are done, and
the genuinely open questions are named below.

### Where this module lives, and why `warnings/` not `advice/`

`packages/engine/src/warnings/`, beside `schema/`, `climate/`, `suitability/`
and `spacing/`, exported from `src/index.ts` the same way. The brief left the
name open (`warnings/` or `advice/`). **`warnings/`** was chosen because:

- It matches `WORKPLAN.md`'s own name for the stage ("Warnings &
  companion-suggestion engine") and the five things it explicitly asks for are
  all called warnings.
- The module's one closed, machine-readable result type is `Warning`; companion
  suggestions are a second, clearly-named export (`CompanionSuggestion`) rather
  than a second sense of the module's own name. `advice/` would have to stretch
  to cover both without being vaguer about either.
- It stays consistent with the precedent the sibling modules set
  (`suitability/`, `spacing/`) of naming a module after its primary output.

### What this stage builds on, in one paragraph each

**Stage 2.1** splits every dimension's verdict into a closed-vocabulary
`finding` (`match` / `marginal` / `mismatch` / `unsuitable` / `unknown-plant` /
`unknown-plot`) and a human `reason`, precisely so this stage keys off the
former and never parses the latter. Three of the five warning kinds
(`wrong-light`, `wrong-sowing-season`, `climate-mismatch`) are mostly a matter
of mapping `(dimension, finding)` pairs onto warnings — see §1.

**Stage 2.2** hands over `fitPlant(plant, region, options)` → a
`SpacingCalculation` with `count`, `densityPerSquareMetre`,
`grid.areaPerPlantCm2`, every plant's `position`, and `spacingSource`
(`recorded` / `derived-from-row` / `derived-from-intensive`). What it
deliberately did **not** decide: `fitPlant` counts **one** crop into **one**
region and has no notion of two different crops placed near each other. This
stage has to invent that notion — see §2.

**Stage 1.4** shipped an honestly thin relationship dataset: of 160 records,
56 carry `companions` (85 links: 3 `well-supported`, 82 `traditional`) and only
6 carry `antagonists` (6 links — three reciprocal pairs: garlic ↔ green-bean
and onion ↔ pea, both `traditional`; potato ↔ tomato, `well-supported`). Every
link carries a mandatory `evidence` tag (ADR 0004 §4, ADR 0008). This stage's
job is to surface that tag honestly, not average it away — see §4.

## Decision

### 1. The warning shape: a closed `kind`, a `severity`, `subjects`, and a sentence

Every `Warning` carries **machine-readable fields from a closed vocabulary**
(`WARNING_KINDS`: `wrong-light`, `overcrowded`, `wrong-sowing-season`,
`antagonist-adjacency`, `climate-mismatch`) **and** a human-readable `reason`
sentence, following Stage 2.1's `finding`/`reason` precedent exactly so Stage
3.5 never has to parse prose to know what kind of warning it is.

`Warning` is a **discriminated union on `kind`**, not one wide interface with
optional fields for every rule's own data (a `finding` for the three
suitability-derived kinds, a `distanceCm`/`thresholdCm`/`evidence` for
antagonist adjacency, a `maxCount`/`spacingSource` for overcrowding). A
consumer narrows on `kind` and gets exactly the right fields typed, rather than
guessing which of a dozen optional fields apply to which warning. `subjects`
(`{ placementId, plantId }[]`) names which placement(s) it's about — one for
four of the five kinds, two for `antagonist-adjacency` — using the caller's own
placement id so Stage 3.4/3.5 can locate the warning on the canvas without
re-deriving which bed produced it.

**Severity** is a closed three-value vocabulary (`info` / `warning` /
`severe`). `info` is not used by the five rules today — kept in the vocabulary
so a future rule (or a softened version of an existing one) doesn't need a
breaking type change. `warning`/`severe` map from the underlying data as
described per rule below.

**What each `unknown-*` finding produces: nothing.** Zero of the 160 shipped
records carry hardiness, soil or seasons (ADR 0012), so a rule that fired on
"anything that isn't `match`" would warn on nearly every crop for reasons that
are gaps in the data, not problems with the plot — exactly the failure mode the
brief warns against. `isWarningFinding` is the single predicate
(`mismatch` or `unsuitable`, nothing else) both `unknown-plant` and
`unknown-plot` fail, so the two kinds of unknown degrade identically here: no
warning, no note, nothing. (The palette, Stage 3.3, is the place a
`confidence`/`unknown-*` caveat belongs — it already shows one, per ADR 0012 —
this stage would only be repeating it as a nag.)

**What `marginal` produces: also nothing.** This was the one missing-data
question the brief didn't ask outright, but the same reasoning applies:
`marginal` means "workable with care", not "wrong". Warning on it would fire on
one-step-off placements that are, by the model's own definition, fine — a false
"something needs attention" for a crop that will grow a little more slowly.
Only `mismatch` and `unsuitable` are warning-worthy
(`FINDING_SEVERITY`: `mismatch → 'warning'`, `unsuitable → 'severe'`, nothing
else has an entry). One consequence worth naming explicitly because it isn't
obvious from the dimension name alone: `scoreLight`'s asymmetry (ADR 0012 §5)
means a **one-step shade deficit** scores 0.45 (`mismatch` — warns) while a
**one-step sun surplus** scores 0.65 (`marginal` — silent). That's not an
inconsistency in this stage; it's this stage faithfully inheriting Stage 2.1's
own asymmetric judgement that you can shade a sunny bed but can't light a
shaded one.

**Soil is not one of the five kinds.** `SUITABILITY_DIMENSIONS` has four
entries (light, hardiness, soil, season); the Workplan names exactly five
warning kinds, and `soil` isn't one of them. A soil mismatch is the condition a
gardener _changes_ (ADR 0012 §2) — amend it, raise a bed — not something a
placement warning should nag about every time the plot's state is re-evaluated.
`DIMENSION_TO_WARNING_KIND` in `suitability-rules.ts` simply has no entry for
`soil`, so it's silently skipped rather than special-cased.

### 2. "Planted nearby": real polygon distance, spacing-derived threshold

Two questions, both genuinely open before this stage:

**How far apart are two beds?** `regionDistanceCm(a, b)` — real
polygon-to-polygon distance in centimetres, `0` if either overlaps or touches
the other. **Not** a bounding-box approximation: Stage 2.2 already established
(ADR 0013 §3) that bounding boxes are the wrong tool for exactly this kind of
shape question (an L-shaped bed's notch can bring its outline much closer to a
neighbour than its bounding box suggests), and repeating that mistake here for
adjacency would undo the lesson 2.2 just taught. The implementation is cheap:
two point-in-polygon containment checks catch overlap, then an O(n·m) scan over
edge pairs (point-to-segment and segment-to-segment distance, both standard
projection-and-clamp arithmetic) finds the closest approach for the common
case of two beds that don't overlap. Plot beds have tens of corners, not
thousands, so this is the same cost profile Stage 2.2 accepted for its own
O(n²) self-intersection check.

**What shape does a "placed crop" take, ahead of Stage 3.4 committing to one?**
A full `PlotRegion` — the same arbitrary-polygon shape Stage 2.2 already models
a bed as — rather than a point. A bare point cannot answer "how many fit" (that
needs an area), and Stage 2.2 already solved "how many fit in this shape" via
`fitPlant`; reusing that region as the placement's own bed means this stage
needs no second placement geometry, and the overcrowding rule (§3) gets `count`
for free by calling `fitPlant` on exactly the same region. **Region overlap
or proximity**, not a fixed point-radius, was therefore the natural choice
once the placement itself is a region — a point-based placement was considered
and rejected because it would have needed its own, separate "how many fit
around this point" answer that Stage 2.2 doesn't provide and this stage has no
business inventing.

**How close is too close?** `adjacencyThresholdCm(a, b)` — the **larger** of
the two crops' own resolved between-row distances (via
`resolveLatticeSpacing`'s `auto` rule, the same one `fitPlant` itself uses), not
a fixed constant and not the mean. Spacing-derived because it reuses data the
record already carries and scales with the crops involved — two sprawling
crops naturally get a wider berth than two crops grown at 10 cm — rather than
inventing a new figure with no basis in the dataset. **The larger of the two**,
not the mean, because antagonist pairings are about shared disease and pest
risk (potato/tomato blight, ADR 0008 §3): the cost of an unwarranted warning
(an extra note the user can dismiss) is far smaller than the cost of a missed
one (a real risk goes unflagged), so the more generous distance is also the
more conservative — i.e. more often correct — choice.

Antagonist severity is itself evidence-derived (`ANTAGONIST_SEVERITY_BY_EVIDENCE`):
`well-supported` (today, only potato/tomato) escalates to `severe` — a
documented disease-epidemiology risk; `traditional` (garlic/green-bean,
onion/pea) stays at `warning` — a plausible-but-unconfirmed folklore claim.
This is the "carry the tag through, don't average it away" principle (§4)
applied to a warning rather than a suggestion.

### 3. Overcrowding: "placed more than fits" and "placed closer than spacing" are the same test

Stage 2.2's counts are already conservative and whole-cell-based (ADR 0013 §3:
"a plant that half-fits doesn't"), so `fitPlant`'s `count` for a bed is already
the _maximum_ consistent with the crop's own spacing. That collapses the
brief's two phrasings for this rule into one: if a bed's actual planted
`count` exceeds `fitPlant`'s count for that identical region, the extra plants
can only have been fitted by standing closer together than the spacing allows
— there is no independent "are they too close" check to write on top, and
writing one anyway would just be re-deriving the same arithmetic a second way.

`overcrowdingWarning` calls `fitPlant(placement.plant, placement.region,
placement.options)` itself — the same call Stage 3.4's canvas would make — so
the two can never disagree about what a bed holds. Severity escalates to
`severe` when nothing fits at all (`maxCount === 0`, since any planted count is
then infinitely over capacity) or when the planted count reaches
`OVERCROWDING_SEVERE_RATIO` (1.5×) capacity; otherwise `warning`.

**`spacingSource !== 'recorded'`** softens the wording, not the severity: the
`reason` sentence adds an explicit "this figure was derived, not recorded"
caveat (mirroring `spacing/fit.ts`'s own `derivationNote`), because a bed
capacity derived from the crop's _other_ growing method (ADR 0013 §6 — 151 of
160 shipped crops have only row spacing, so an intensive-mode capacity is
almost always derived) is a softer basis for telling someone to thin out their
bed than a figure the record states directly. Severity is left alone, though:
a derived figure is still conservative by construction (ADR 0013's own
Consequences), so a real overcrowding signal on top of it is not weakened by
being derived — only the confidence behind the _number_, not the fact of the
overcrowding, is in question.

### 4. Evidence tags: carried through, not averaged, phrased per level

Both companion suggestions and antagonist warnings carry the shipped
`EvidenceLevel` straight through as a typed field (`CompanionSuggestion.evidence`,
`AntagonistAdjacencyWarning.evidence`) — never averaged, never dropped. Given
82 of the 85 shipped companion links are `traditional`, **hiding `traditional`
suggestions entirely was rejected**: it would leave almost nothing to suggest,
defeating the feature for the dataset that actually ships. Instead, the
`reason` sentence is phrased differently per level:

- `well-supported`: assertive — _"Onion is well-supported to grow well
  alongside carrot — worth planting nearby."_
- `traditional`: hedged — _"Gardeners traditionally say onion grows well
  alongside pea, though this is folklore rather than a tested effect."_

This is the "softer 'gardeners often say…'" framing the brief invites, applied
as a sentence-level distinction rather than an exclusion — the suggestion still
exists (so the feature has content against today's data), but a user reading it
cannot mistake folklore for a tested effect, which is the entire point of the
evidence tag existing (ADR 0008).

**`suggestedPlantId` is a bare id, not a resolved `Plant`.** The engine never
sees the whole plant catalogue in this call — only the crops actually placed on
this plot (`evaluatePlot`'s `placements` argument) — so it has no name to
resolve for a companion that isn't among them. This mirrors `PlantLink` itself,
which is also just an id (ADR 0004), and `SuitabilityResult.plantId` (ADR
0012), which is likewise a bare id the palette resolves against the runtime
list it already holds. Every shipped id doubles as a legible word or
hyphenated phrase ("carrot", "green-bean"), so the sentence stays readable even
before Stage 3.5 resolves it to a display name; passing a plant catalogue into
`evaluatePlot` as a sixth argument just to spell a name correctly was
considered and rejected as unwarranted plumbing for a cosmetic gain the UI
already has the means to provide.

**Companion suggestions are for what _isn't_ placed yet.** `DESIGN.md`'s own
wording — "suggests companion plants for what's already placed" — is a prompt
to plant something new near what's there, not a badge confirming an existing
pairing is a good one. A candidate already among the placements is therefore
skipped. Suggestions are not deduplicated across different source placements
that both recommend the same candidate: merging them would either drop a
distinct citation or average two evidence levels together, exactly what the
evidence tag exists to prevent.

**User-defined crops degrade to silence, structurally, with no special-casing
anywhere in this module.** A user crop's `companions`/`antagonists` are always
absent (ADR 0011 §4 — the form doesn't collect them, and there'd be nothing to
cite), and no _shipped_ record's links can ever name a `user-` id (those ids
don't exist at dataset-build time). So a user crop can neither produce nor
receive a suggestion, and can never appear in an antagonist pairing, purely
because `plant.companions ?? []` and `plant.antagonists ?? []` are empty for
it — no `isUserPlant` check anywhere in `companions.ts` or `antagonists.ts`.
This is deliberate: a defensive check here would suggest the silence is
incidental rather than guaranteed by the data shape, and — per the brief's own
warning — the rules must degrade to silence, "not to a crash or a claim about
the crop". Suitability-derived warnings (`wrong-light`, `wrong-sowing-season`,
`climate-mismatch`) are **not** silenced for a user crop, because those rules
have nothing to do with companion/antagonist data at all — a user crop still
gets scored like any other `Plant` (ADR 0011: no origin-awareness anywhere in
the engine), and a test pins exactly this (a user crop gets a `wrong-light`
warning but never a suggestion or an antagonist warning in the same evaluation).

### 5. The entry point, and what it deliberately doesn't take

`evaluatePlot(conditions: PlotConditions, placements: readonly CropPlacement[]):
PlotEvaluation` — one call, all five rules and the companion pass, per the
brief's own requirement ("Stage 3.5 wants one call per state change, not
five"). `conditions` is assumed already resolved and valid, exactly as
`scorePlant` itself assumes (ADR 0012 §7) — re-validating it on every call
across every placement would cost real time and buy nothing `resolvePlotConditions`
hasn't already checked. Each `CropPlacement`'s `plant` and `region` are
likewise not re-validated here: `plant` arrives already valid (`validatePlant`
or `createUserPlant`, ADR 0011), and `region` is validated by `fitPlant` itself
when this module calls it internally (ADR 0013 §7's own trust-boundary split).
`count` **is** validated (`PlacementCountSchema`, a non-negative integer) —
it's the one genuinely new value this stage introduces that crosses a trust
boundary (arbitrary UI state), so it gets the zod treatment the rest of the
placement's already-validated fields don't need repeated.

**No separate "overall plot outline" parameter.** The brief's phrase "a plot
(region + conditions)" was weighed against adding a top-level `PlotRegion`
alongside `conditions`, distinct from each placement's own bed region. It was
rejected: none of the five rules or the companion pass needs the plot's outer
boundary — overcrowding and adjacency operate entirely on each placement's own
region, and suitability scoring needs only `conditions`. Each `CropPlacement`
already carries the region that matters to every rule (its own bed); an unused
top-level region would be a parameter nothing reads, which is worse than
omitting it. If Stage 3.2/3.4 later need "does this bed actually fit inside the
plot's outline" as its own check, that is a containment question for the
canvas/placement UI to enforce when a bed is dropped, not a question this
stage's rules need answered to do their job.

## Alternatives considered

- **A fixed adjacency threshold (e.g. "within 50 cm").** Rejected: arbitrary,
  and it doesn't scale between a 10 cm intensive bed and a 90 cm squash
  planting — the same crop pair could be "too close" at one scale and
  comfortably distant at another with one constant.
- **Mean of the two crops' between-row distances, rather than the max.**
  Considered seriously (the brief names it as an option) — rejected in favour
  of the max for the asymmetric-cost reason in §2: a missed antagonist warning
  is worse than an extra one.
- **A discriminated union keyed only on region overlap** (i.e. warn only when
  beds actually touch/overlap, skip the spacing-derived margin entirely).
  Rejected: two antagonist crops planted a few centimetres apart but not
  technically overlapping is exactly the case a gardener would want flagged,
  and "touching" alone would miss it.
- **One wide `Warning` interface with every field optional**, mirroring how
  `DimensionScore`/`SuitabilityResult` are single flat interfaces. Rejected:
  those types describe one homogeneous computation (four dimensions, always
  the same shape); this stage's five kinds carry genuinely different
  machine-readable data, and a sparse object would force every consumer to
  guess which optional fields apply to which `kind`. The discriminated union
  costs a little more type ceremony for real safety.
- **Hiding `traditional`-evidence companion suggestions entirely**, showing
  only the three `well-supported` links. Rejected: it would leave the feature
  almost content-free against the shipped dataset (82 of 85 links are
  `traditional`), and the brief's own framing ("consider whether a traditional
  link should be presented as a suggestion at all _or only_ a softer
  '...'") offered the softer phrasing as the live alternative, not exclusion.
- **Passing a full plant catalogue into `evaluatePlot`** so companion
  suggestions could carry a resolved display name instead of a bare id.
  Rejected: it would be a sixth argument serving a purely cosmetic need Stage
  3.5 can already meet from the runtime list it holds (Stage 3.1), and it would
  make the engine's entry point depend on "the whole plant catalogue" as a
  concept the rest of the engine (`scorePlant`, `fitPlant`) deliberately never
  needs.
- **A top-level `Plot { region, conditions }` type**, taking the overall
  plot outline as well as each placement's own bed. Rejected per §5 — nothing
  in this stage's rules would read it.
- **Warning on `marginal` findings at `info` severity**, to surface every
  imperfection. Rejected: `marginal` means "workable with care" by the
  suitability model's own definition (ADR 0012 §6); warning on it would nag
  about placements that are, by design, fine.
- **Individual plant positions inside a placement** (rather than a `count`
  against a bed region), to detect local clustering even when the total count
  is within capacity. Rejected: as shown in §3, a whole-bed `count` vs.
  `fitPlant`'s count already implies the "closer than spacing" case for a
  uniform placement, and Stage 3.4 (which would produce per-plant positions,
  if it ever does) doesn't exist yet — inventing a richer placement shape ahead
  of that stage committing to one would risk disagreeing with what it actually
  produces.

## Consequences

- **Stage 3.4 and 3.5 have a stable contract**: `CropPlacement` (id, plant,
  region, count, options) is what a placed bed looks like to the engine, and
  `evaluatePlot(conditions, placements)` is the one call per state change the
  brief asks for. Neither has to parse a `reason` string to render anything —
  `kind`, `severity` and `subjects`/`evidence`/`distanceCm`/etc. carry
  everything a UI needs.
- **The adjacency threshold and severity ratios are one-line changes**
  (`model.ts`'s `OVERCROWDING_SEVERE_RATIO`, `ANTAGONIST_SEVERITY_BY_EVIDENCE`,
  `FINDING_SEVERITY`), the same "tunable numbers in one file" discipline
  `suitability/model.ts` and `spacing/model.ts` already follow.
- **This stage adds no new geometry primitive to `spacing/`** — `adjacency.ts`
  builds its point/segment distance helpers locally rather than growing
  `spacing/geometry.ts`'s public surface, since "distance between two regions"
  is a warnings-engine concept, not a packing concept the spacing calculator
  itself needs.
- **The companion/antagonist rules are correct by data shape, not by
  vigilance.** No code path anywhere in `companions.ts` or `antagonists.ts`
  checks `isUserPlant` or any other origin flag; the silence for user crops
  falls out of `plant.companions`/`plant.antagonists` being absent. That is
  more robust than a defensive check, because there is no `if` to forget to
  add when a new rule is written later.
- **Re-tuning is cheap; the shape is not**, exactly as ADR 0012/0013's own
  Consequences say of their models — the discriminated `Warning` union and the
  `CropPlacement` input are the parts a later stage builds against and would
  be the expensive thing to change.
- **The engine still touches nothing external**: no network, no clock, no DOM.
  `evaluatePlot` is deterministic — the same conditions and placements always
  produce the same warnings and suggestions — which is what lets the dataset
  test in `warnings/dataset.test.ts` pin exact figures against the real
  160-record artifact.
