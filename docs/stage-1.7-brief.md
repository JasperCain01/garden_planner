# Stage 1.7 brief — curated full-plant input (maintainer-authored crops)

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
and [`WORKPLAN.md`](../WORKPLAN.md) (§0 ground rules and the Stage 1.7 entry)
first; this brief concentrates the requirements so you don't have to
reconstruct them from the diff.

Stages 0.1–1.6, 0.3, all of Phase 2, all of Phase 3 (3.1–3.7), and all of
Phase 4 (4.1–4.2) are merged into `main` — **branch from `main`**.

## Why this stage

`WORKPLAN.md`'s Progress table lists Stage 1.7 as the one remaining ⬜ row —
every other stage through Phase 4 is ✅. Phase 5 (offline/deploy) and Phase 6
(community readiness) are both more naturally tackled once the crop list this
stage grows is settled, and 1.7 has no unmet dependency (it needs only 0.2 and
1.5, both long done) — it's the natural next stage. If you'd rather start
Phase 5 or 6 instead, that's a reasonable alternative; this brief assumes 1.7.

## Goal

A channel for the **maintainer** to permanently add a crop to the shipped
dataset by hand — distinct from Stage 3.6's user-defined crops, which live
only for a browser session and were deliberately relaxed-schema
(`docs/adr/0011-user-defined-crop-schema.md`). A maintainer-added crop should
meet the **full shipped-data bar**: real provenance, full schema validation,
no relaxation. Today there is no input for this at all — the dataset is
assembled from OpenFarm plants plus the hand-verified spacing and companion
slices (`packages/etl/src/merge/merge.ts`); this stage adds a fourth input:
a curated, hand-authored `Plant[]`.

## Where it lives

- `packages/etl/src/curated/plants.ts` (new) — the curated `Plant[]`, each
  entry a full record built with `validatePlant` (or written as plain object
  literals validated by a test, matching `spacing/table.ts`'s convention of a
  plain exported array plus a schema-validating test file).
- `packages/etl/src/merge/merge.ts` and `build-dataset.ts` — wire the curated
  list into the existing merge as a fourth `MergeInputs` field. Read
  `merge.ts`'s own doc comment first: it documents the join-key policy
  (gbifId → scientific name → slug/alias, `join.ts`) and the existing
  "hand-verified wins" precedent for spacing (`docs/adr/0009`) — curated
  crops should follow the **same shape of rule**: decide and document what
  happens when a curated crop's identity collides with an OpenFarm-sourced
  one (curated presumably wins, mirroring spacing, but that's this stage's
  call to make and record, not assume).
- `docs/adr/0021-curated-plant-input.md` (or the next free ADR number — check
  `docs/adr/README.md`) — the input's shape and its place in the join order.
- `packages/etl/README.md` and `data/README.md` — both describe the pipeline's
  inputs today; add curated plants as a fourth.

## What's already built (don't rebuild any of this)

- **The full `Plant` schema** (`packages/engine/src/schema/plant.ts`,
  `validatePlant`) — a curated record is a first-class `Plant`, not a parallel
  shape, exactly as Stage 3.6 treated user crops as first-class `Plant`s
  through the _relaxed_ schema. This stage uses the **unrelaxed** validator.
- **The merge's join-key and conflict machinery** (`packages/etl/src/merge/join.ts`,
  `aliases.ts`) — `unifyPlantsByIdentity`, `canonicalPlantId`,
  `findSpacingTarget` already do identity resolution across sources; a
  curated crop should be joined through the same machinery, not a new
  parallel lookup.
- **The hard-fail validation gate** (`packages/etl/src/merge/validate.ts`,
  Stage 1.5) — already runs over whatever `merge.ts` produces; a curated
  crop failing validation should fail the build the same way a broken
  OpenFarm or spacing record does today. No new gate needed, just make sure
  curated records flow through the existing one.
- **The "curated slice, hand-verified wins" pattern** — `spacing/table.ts`
  (Stage 1.3) and `companions/curated.ts` (Stage 1.4) are both examples of
  "a plain hand-authored array, cross-referenced against the plant universe,
  folded into the merge" — Stage 1.7 is the same pattern one level up (full
  records, not a thin slice), which the brief's own goal says makes it
  _less_ work than the spacing join, not more.

## What to build

1. **The curated-plants module** (`packages/etl/src/curated/plants.ts`): a
   `Plant[]` (or a validated-on-import array) of maintainer-authored crops.
   Start with a small number (even one or two) to prove the pipeline end to
   end — growing the list further is exactly the kind of mechanical,
   settled-pattern work `WORKPLAN.md` §0.4 flags for Haiku/local once this
   stage establishes the shape.
2. **Wiring into the merge** (`packages/etl/src/merge/merge.ts`,
   `build-dataset.ts`): add curated plants as a fourth input, reconciled
   through the existing join machinery. Decide and document the conflict
   rule for a curated crop overlapping an OpenFarm one.
3. **Referential integrity**: keep curated additions link-free (no
   companion/antagonist links of their own), or, if they do link, only to
   ids known to ship — don't let a curated crop introduce a dangling link
   the existing integrity check wouldn't catch.
4. **An ADR** recording the input's shape, its place in the join order, and
   the conflict rule.
5. **Update `packages/etl/README.md` and `data/README.md`** to describe the
   fourth input.

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.**
- **No `.claude/` skills directory** — review your own diff.
- **No CI workflow — don't add one.**
- **The network is blocked** beyond package installs — this stage is entirely
  offline anyway (hand-authored data, no external source to fetch).
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, `npm run format:check` from the repo root.
- **Don't touch the Stage 0.2/0.3 schema** — `validatePlant` and the full
  `Plant` shape already exist and are already right for this; this stage only
  needs to feed them, not change them.
- **Don't relax anything.** The whole point of this stage (per its own
  `WORKPLAN.md` entry) is that maintainer-added crops meet the _full_ shipped
  bar — reaching for `0.3`'s relaxed `UserPlantInputSchema` here would be a
  licence/provenance loophole for shipped data, exactly what ADR 0011 warns
  against.

## Deliverables

1. `packages/etl/src/curated/plants.ts` with at least one hand-authored,
   fully schema-valid curated crop.
2. Curated plants wired into `packages/etl/src/merge/` — appearing in the
   built `data/plants.json` and passing the Stage 1.5 gate.
3. A documented conflict rule for a curated crop overlapping an OpenFarm one,
   exercised by a test.
4. An ADR for the input's shape and join-order placement.
5. `packages/etl/README.md`, `data/README.md`, `docs/architecture.md`, and
   `WORKPLAN.md`'s Progress table updated; the brief for the next stage
   written (check `WORKPLAN.md`'s dependency map — likely Phase 5 or 6, since
   Phase 1–4 will then be complete).

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
a curated crop appears in the built dataset and passes the gate; an
intentionally-broken curated record fails the build loudly (reuses Stage
1.5's gate — write a test for this); a curated crop overlapping an OpenFarm
slug reconciles by the documented rule, not silent duplication; docs and the
Progress table updated; the next stage's brief written.

## Model

**Sonnet** to build the input module and its merge wiring (establishes the
pattern). Adding further individual curated crop rows later, against this
stage's settled shape and the validating schema, is mechanical
**Haiku/local** work.
