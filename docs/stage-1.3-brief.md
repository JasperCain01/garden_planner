# Stage 1.3 brief — hand-verified spacing table

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
and [`WORKPLAN.md`](../WORKPLAN.md) first (especially §0 ground rules and the
Stage 1.3 entry); this brief concentrates the requirements so you don't have
to reconstruct them. Stages 0.2 (the plant-record schema) and 1.1 (ETL shell +
GBIF resolver) are done and on this branch — build on them, don't redefine
them. Stage 1.2 (source adapters) is **partially** done: one real adapter
(OpenFarm, `packages/etl/src/sources/openfarm/`) exists; PFAF and Permapeople
are documented, credential/paywall-blocked follow-up work (see
`docs/adr/0006-openfarm-source-adapter.md`'s addendum) — **not this stage's
problem**, and not a blocker for it. Stage 1.3 depends only on 0.2.

## Goal

Produce the **authoritative, method-aware spacing figures** for a starter set
of common British edibles — the numbers Stage 2.2's density calculator will
live or die by. This is explicitly a **data-critical** stage (WORKPLAN.md
marks it ⭐): every figure must be cross-checked against **at least two
authoritative sources** (RHS, the square-foot-gardening reference charts,
agricultural extension guides), with the sources recorded per row, not just
transcribed from a single chart.

## Why this is its own stage, not folded into a source adapter

`DESIGN.md`'s "A note on what 'spacing data' actually is" section is required
reading before writing a single number. Spacing isn't one figure — it depends
on the growing method:

- **Row growing**: two numbers, in-row and between-row distance.
- **Intensive / square-foot growing**: a density figure (plants per m², or the
  classic "N per square" from the square-foot-gardening system).

The Stage 0.2 schema already encodes this (`SpacingSchema` in
`packages/engine/src/schema/plant.ts` — `row: { inRowCm, betweenRowCm }` and/or
`intensive: { perSquareMetre, plantsPerSquare }`, at least one required). What
Stage 1.2's OpenFarm adapter deliberately did **not** do is invent an
intensive figure from a source's row-only numbers (see
`docs/adr/0006`'s decision §2) — that's exactly the kind of unstated inference
this stage exists to do properly and honestly, by actually looking the number
up against real authoritative charts rather than deriving it.

## What to build

1. **A curated, committed data file** with in-row / between-row / intensive
   spacing for each starter crop. Where it lives is your call — a natural fit
   is something like `packages/etl/src/spacing/` or a committed
   `packages/etl/data/hand-verified-spacing.json`, but there's no existing
   pattern to mirror here (unlike Stage 1.2's `SourceAdapter`s) since this
   isn't ingesting an external source — it's original curation work. Decide
   the shape, document the decision.
2. **Per-row provenance.** Every row needs **≥2 source citations** — matching
   `ProvenanceSchema`/`SourceRefSchema` from `packages/engine/src/schema/plant.ts`
   (`source`, `url`, `retrievedAt`, etc.). "I looked at two sources and they
   agreed" needs to be a reviewable fact, not an assertion — see WORKPLAN.md
   §1.1's exact wording: "This is human verification, but the _record_ of it
   is committed and reviewable."
3. **A starter crop list.** WORKPLAN.md doesn't pin an exact count or list.
   Reasonable starting points: the Stage 1.1 demo five (onion, lettuce,
   carrot, potato, tomato — already GBIF-resolvable, see
   `packages/etl/cache/gbif-name-cache.json`), and/or the ~161 crops the
   OpenFarm adapter already maps (`packages/etl/src/sources/openfarm/categories.ts`)
   — reusing that list isn't required (1.3 doesn't depend on 1.2), but it
   maximizes future overlap for Stage 1.5's merge. Keep the set bounded and
   real-world common (per `DESIGN.md`'s "the set is small and bounded" framing
   for edibles) rather than trying to cover hundreds in one sitting.
4. **Sanity bounds.** WORKPLAN.md §1.1 calls for automated checks on
   implausible values (negative spacing, spacing that doesn't make sense at
   plot scale, etc.) — these likely belong as `zod` refinements or a small
   validation script, reusing `SpacingSchema`'s existing positivity
   constraints as the floor, not the whole check.

## Constraints & gotchas

- **Network access for real sources is not guaranteed.** This session
  (2026-07-18) found `pfaf.org`, `permapeople.org`, `plants.usda.gov`,
  `gbif.org`, and even `github.com` (via plain `curl`, though
  `raw.githubusercontent.com` worked) blocked by this sandbox's egress
  policy — see `docs/adr/0005`'s and `0006`'s Consequences sections. If RHS
  (`rhs.org.uk`), extension sites, or square-foot-gardening references are
  similarly blocked in your session, **do not fabricate a citation you never
  actually fetched.** Two honest paths: (a) cite well-established
  horticultural facts from general knowledge honestly labeled as such rather
  than inventing a specific URL/page you never saw, or (b) stop and tell the
  user network access is needed for the source cross-checking this stage
  requires, the same way Stage 1.1/1.2 documented GBIF/PFAF/Permapeople
  blockers rather than working around them. Check network reachability
  early, before committing to an approach.
- **Don't guess a method-aware figure from a single-method source.** If a
  source only gives row spacing, that is not license to compute an intensive
  figure from it (see `docs/adr/0006`'s rejected-alternatives entry on this
  exact temptation) — either find a second source with the intensive number,
  or leave that block absent (the schema allows either `row` or `intensive`
  alone).
- **This is not a `SourceAdapter`.** Don't force this into
  `packages/etl/src/pipeline/source.ts`'s interface — that's for adapting an
  _external, ingested_ source's raw records. This stage's output is original,
  hand-verified curation, closer in spirit to Stage 1.1's `starter-source.ts`
  demo than to `sources/openfarm/`.
- **Toolchain quirks already solved (don't re-discover):** single pinned Vite
  6 / Vitest 3; Node ≥ 20; ESM (`"type": "module"`); strict TS with
  `verbatimModuleSyntax` (use `import type` for type-only imports); the etl
  `start` script runs TS directly via `node --experimental-strip-types`,
  which needs explicit `.ts` extensions on relative imports
  (`allowImportingTsExtensions` is set repo-wide in `tsconfig.base.json`, not
  per-package — see that file's comment if you're wiring up a new package).

## Deliverables

1. The curated, provenance-tagged spacing data file(s) for the starter crop
   set, each row schema-valid against `SpacingSchema`/`ProvenanceSchema`.
2. **Unit tests (Vitest):** every row validates against the schema; every row
   has ≥2 sources; sanity-bound checks reject an intentionally-bad row (e.g.
   negative spacing) in a test, not just in code you eyeballed.
3. **ADR** `docs/adr/0007-*.md`: the data-file shape, the sourcing/
   cross-checking method, the sanity-bounds design, and which crop list was
   chosen and why. Add it to `docs/adr/README.md`'s index.
4. Update `packages/etl/README.md` and/or `docs/architecture.md` to reflect
   where the spacing table lives and how to extend it.

## Definition of done (WORKPLAN §0.3)

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all green
from the repo root; new code clearly commented (WORKPLAN §0.2); ADR written;
docs updated. Run `/code-review` and `/verify` before finishing. Commit and
push.

## Model

**Sonnet** (per WORKPLAN §4) — needs care and source cross-referencing, not
just transcription. WORKPLAN.md explicitly notes a human contributor may
prefer to own this stage directly, with the model assisting and structuring
rather than being the sole source of horticultural judgment.
