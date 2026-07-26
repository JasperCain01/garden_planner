# 0021 — Curated full-plant input: shape, join-order placement, and the "curated wins" conflict rule

- **Status:** Accepted
- **Date:** 2026-07-26
- **Workplan stage:** 1.7 — curated full-plant input (maintainer-authored crops)

## Context

`WORKPLAN.md`'s Progress table listed Stage 1.7 as the one remaining ⬜ row through
Phase 4. Today the shipped dataset (`data/plants.json`) is assembled from three
inputs (`packages/etl/src/merge/merge.ts`): OpenFarm plants, the hand-verified
spacing table (Stage 1.3, ADR 0007), and the companion/antagonist relationships
(Stage 1.4, ADR 0008). There is no channel for a **maintainer** to add a crop to
the shipped dataset permanently by hand.

This is deliberately not the same problem Stage 3.6 solved. Stage 3.6's
user-defined crops (ADR 0011) are session-only and use a **relaxed** input
schema (`UserPlantInputSchema` — no scientific name, no citation required)
precisely because a person typing from a seed packet has neither. A
maintainer-curated crop is different: it is going into the **shipped**
artifact, so it must clear the same bar as every OpenFarm-sourced record — full
identity, full provenance, the unrelaxed `validatePlant`. ADR 0011 anticipated
this stage explicitly in its Consequences: "Stage 1.7's maintainer-curated
crops are unaffected — they are full `Plant`s going through the ordinary
shipped gate, which is exactly the distinction this design preserves."

## Decision

### 1. Shape: a plain hand-authored `Plant[]`, schema-proven by a test

`packages/etl/src/curated/plants.ts` exports `CURATED_PLANTS: readonly Plant[]`
— plain object literals, not wrapped in `validatePlant()` at authoring time.
`curated/plants.test.ts` validates every entry through the real
`validatePlant`, checks id uniqueness, checks none uses the reserved `user-`
namespace (ADR 0011), and checks each is link-free (see §3). This matches
`spacing/table.ts`'s convention (Stage 1.3, ADR 0007) rather than
`companions/curated.ts`'s "no test needed, the type covers it" style, because
a `Plant` is a big, easy-to-typo record where a schema-validating test earns
its keep. There is no `SourceAdapter` for this input — like the spacing table
and companion data, it is original curation with no external source to fetch,
so it isn't wired into `pipeline/run.ts`.

Two crops ship today, both real and independently sourced (RHS grow guides,
`www.almanac.com`, NC State Extension, and one permaculture growing guide —
full citations in `plants.ts`), proving the pipeline end to end rather than
exercising it with placeholder data:

- **`broad-bean`** (_Vicia faba_) — closes a documented gap. ADR 0009's
  Consequences record that OpenFarm has no mappable _Vicia faba_, so the
  Stage 1.3 spacing row and the Stage 1.4 `leek`↔`broad-bean` antagonist link
  have never had a plant to attach to. Adding it here, with no OpenFarm plant
  to collide with, lets both attach through the ordinary join machinery for
  the first time — no special-casing, proven in `merge.test.ts`.
- **`jerusalem-artichoke`** (_Helianthus tuberosus_) — a plain new addition,
  with no spacing/companion data referencing it, proving the "just add a crop
  OpenFarm's dump never had" path on its own.

Both are link-free (§3) and neither sets `icon` — the existing generic-icon
fallback (Stage 4.1/4.2) already covers a crop with no bespoke icon.

### 2. Join-order placement and the conflict rule: curated wins, wholesale

`curatedPlants` becomes `MergeInputs`'s fourth field
(`openFarmPlants`/`curatedPlants`/`spacingRecords`/`linksById`), and
`mergeDataset` folds it in as a new **step 0**, ahead of the existing
`unifyPlantsByIdentity` step:

1. For each curated plant, resolve its `id` against the OpenFarm id universe
   through `canonicalPlantId` (`join.ts`) — the same function the companion
   remap step already uses, so an identity collision can be a direct slug
   match _or_ a `SLUG_ALIASES` entry, not a new lookup.
2. **No collision:** the curated plant is added as a new, independent `Plant`.
3. **Collision:** the curated record **replaces the OpenFarm one wholesale**
   — every field, not a merge — but **keeps the surviving canonical id**, not
   necessarily the curated record's own `id`. If a curated plant is authored
   with an id that only resolves to an existing plant through an alias (e.g.
   a hypothetical curated `beetroot` aliasing to OpenFarm's `beet`), the
   shipped record ends up at `beet`, carrying the curated content — so any
   spacing row or companion link elsewhere in the dataset already authored
   against `beet` keeps resolving. Only the (rare, currently unexercised)
   case where the curated author's own id differs from the surviving one
   needs this rename; the common case (curated `id` equals the OpenFarm
   slug outright) is a no-op rename, i.e. the ordinary "curated wins"
   read.

This mirrors the "hand-verified spacing wins" precedent (ADR 0009 §2) one
level up: there, a hand-verified row's _spacing field_ replaces OpenFarm's
scraped one; here, a curated record's _whole content_ replaces OpenFarm's,
because the input is a full record, not a thin slice. Once folded in, a
curated plant is an **ordinary `Plant`** for every later step — spacing
attach, companion-link remap, the tree-tolerant sanity check, and the final
`validatePlant` re-validation all apply to it identically. No special-casing
exists past step 0, which is what makes `broad-bean`'s spacing/companion
attachment work with zero new code beyond the fold-in itself.

The merge report gains `curatedOverrides: { curatedId, overriddenId }[]`,
alongside the existing `identityUnifications`/`spacingAttached`/
`companionLinksDropped` tallies, logged by `build-dataset.ts` the same way.

### 3. Curated plants are link-free by construction

`CURATED_PLANTS` entries carry no `companions`/`antagonists` of their own —
enforced by a test, not just documented. This sidesteps the one referential-
integrity question a curated record could otherwise raise (a link to an id
that isn't known to ship) without weakening the existing gate
(`merge/validate.ts`) at all: a plant with no links cannot dangle. This
doesn't prevent a curated plant from **receiving** links — `broad-bean` gains
its antagonist pairing with `leek` because Stage 1.4's existing companion
data already names `broad-bean` as a target; that's the ordinary companion-
remap step doing its job, not an exception carved out for curated data. A
future curated crop that wants to declare its _own_ companion relationships
should add them to `companions/curated.ts` (Stage 1.4's channel), which is
already checked against the plant-id universe and the merge's referential-
integrity gate — not invent a second, parallel path for the same fact.

### 4. gbifId-based collision: deferred, not designed around

The join-key policy (ADR 0009 §1) ranks gbifId first as the exact,
canonical cross-source key. This stage's fold-in step does **not** implement
a gbifId-based collision check for curated plants, deliberately: every
`gbifId` in the dataset is `null` today (GBIF unreachable, per ADR 0009), so
— exactly as `unifyPlantsByIdentity` already notes for OpenFarm-to-OpenFarm
merging — there is no live case to exercise, and inventing untested
resolution rules (which id survives, whose fields win) for a case with zero
real data would be exactly the kind of speculative generality this project's
conventions warn against. The slug/alias path is sufficient for what this
stage ships and is what a maintainer will actually use (choosing an id that
either is, or deliberately is not, an existing OpenFarm slug). If a future
session needs gbifId-based curated collision — once gbifId resolution is
live and a real case appears — it is a small, well-scoped follow-on: extend
step 0's resolution order to check gbifId first, exactly as `join.ts`'s
module doc already describes for the wider policy.

## Alternatives considered

- **Merge field-by-field on collision (like spacing), rather than replacing
  the whole record.** Rejected: a curated input is a full `Plant`, not a
  thin slice with one authoritative field. Field-by-field merging would need
  its own per-field precedence table (which wins on `light`? `hardiness`?)
  with no real case motivating the complexity. Wholesale replacement is the
  simpler, more honest reading of "curated wins" for a full record, and it's
  what a maintainer adding/correcting a crop by hand actually wants.
- **Keep the curated record's own id on an alias collision, dropping the
  OpenFarm one under its old id.** Rejected: it would orphan any spacing row
  or companion link already authored against the OpenFarm slug (a real
  referential-integrity risk the existing gate would then have to catch as a
  build failure, rather than the fold-in step simply not creating it). Keeping
  the surviving canonical id is what makes "curated wins" compose safely with
  everything already authored against the old id.
- **Wrap every `CURATED_PLANTS` entry in `validatePlant()` at authoring time**
  (like `merge.test.ts`'s fixture helpers do), instead of a plain array plus a
  validating test. Rejected in favour of matching `spacing/table.ts`'s
  established convention for exactly this package — consistency with the
  sibling curated-data module outweighs the marginal benefit of an
  authoring-time throw over a test-time one, and the test-time check is
  exercised on every `npm test` run regardless.
- **Give curated plants their own referential-integrity allowance (e.g. let
  them link only to other curated plants).** Rejected as unnecessary
  complexity: link-free is simpler, sufficient for what this stage needs to
  prove, and doesn't require a new category of "sort-of-checked" link.
- **Implement gbifId-based collision detection now, for symmetry with the
  documented join policy.** Rejected for this stage (see §4) — no real data
  exercises it, and untested resolution rules for a case that can't currently
  occur would be speculative, not defensive.

## Consequences

- **`data/plants.json` gains two crops**, closing the `broad-bean` gap ADR
  0009 documented as a known limitation: its hand-verified spacing and its
  `leek` antagonist link now ship for the first time, with zero changes to
  `spacing/table.ts` or `companions/curated.ts` — they simply had no plant to
  attach to before.
- **The merge's join order is now**: fold in curated overrides/additions →
  reconcile OpenFarm by gbifId → attach spacing → attach companions → sanity
  filter → final schema re-validation. `MergeInputs` has a fourth required
  field (`curatedPlants`); every existing test fixture that builds one now
  passes `curatedPlants: []` explicitly, matching how `spacingRecords`/
  `linksById` are already always supplied by the caller (`build-dataset.ts`
  owns the real default, `CURATED_PLANTS`, exactly like
  `HAND_VERIFIED_SPACING`/`toPlantLinksById()`).
- **No relaxation anywhere.** `PlantSchema`/`validatePlant` are untouched by
  this stage. A curated record with a typo'd enum or missing required field
  fails the same hard-fail gate any other record does — proven in
  `build-dataset.test.ts` by feeding the build a deliberately invalid curated
  record and asserting it throws.
- **Growing the curated list is now mechanical**, per `WORKPLAN.md`'s own
  model-tier note for this stage: add an entry to `CURATED_PLANTS`, run
  `npm test -w @garden-planner/etl` (which re-validates it) and
  `npm run build:data -w @garden-planner/etl`. No new code path is needed
  unless a future crop's identity collides via gbifId (see §4).
