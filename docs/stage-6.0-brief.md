# Stage 6.0 brief — fill the data gaps that actually matter (the crop-list half)

A tight starting point for a fresh session. Read [`WORKPLAN.md`](../WORKPLAN.md)
(§0 ground rules, and the Stage 6.0 entry in full — it's long, and the
"Why this replaced 'finish the PFAF/Permapeople adapters'" subsection records
reasoning you should not have to re-derive) before starting; this brief
concentrates the remaining, still-to-do half of that stage.

Everything through Phase 5 is merged into `main`, including Stage 5.2
(GitHub Pages deployment — a manual deploy path, `gh-pages`, ADR
[0024](./adr/0024-github-pages-manual-deploy.md)) — **branch from `main`**.

## Why this stage, and why now

`WORKPLAN.md`'s dependency map has Phase 6 (community readiness) as the last
phase before Stage 6.4 (CI, deliberately last). Stage 6.0 is first in that
phase and depends on nothing but Stage 1.5 (the merge and hard-fail gate) —
it has no ordering dependency on 6.1–6.3, and the Progress table already
flags it **half-done**: the soil-moisture enrichment landed (72 crops gained
`soil.moisture`, taking soil coverage from 2/162 to 74/162 and giving the
suitability engine a second genuinely working axis alongside light). The
**crop-list half — what this brief is about — has not started.**

This is also, by the pre-deployment review's own account
([`docs/review-pre-deployment.md`](./review-pre-deployment.md) §3.9),
**the highest-value remaining work in the whole plan**: light is 162/162 but
only two distinct values; hardiness, soil-moisture-only-partially, and season
are each thin. A visitor to the now-deployed site (Stage 5.2) sees a "ranked,
suitability-scored palette" that in practice is close to a two-tier sort on
light — the README already says so plainly (its "caveat worth knowing"
section). Finishing what this stage curates is what makes the ranking mean
more than that, for the specific slice that's actually tractable without a
new data source (the crop list itself, not hardiness/season depth — see
"What this stage is not" below).

## Goal

Two things, both **curation, not ETL/source-adapter work** (that door was
deliberately closed — see the WORKPLAN entry's "why this replaced..."
subsection):

1. **Add the missing British staples** that a British allotmenteer notices
   are absent within the first five minutes: **apple, pear, raspberry,
   Brussels sprouts, swede, pumpkin**.
2. **Prune or de-prioritise the ~32 crops that can't be grown outdoors in
   Britain** (dragon fruit, papaya, pineapple, star fruit, two strawberry
   guavas, olive, grapefruit, lemongrass, okra, peanut, and others — the
   WORKPLAN entry doesn't enumerate the full 32; you'll need to derive the
   list from `data/plants.json`/`app/src/dataset/shipped-plants.ts` against
   UK-outdoor-growability, the same judgement call the entry's author made).

## Where it lives

- **Additions:** `packages/etl/src/curated/plants.ts` — the Stage 1.7 curated
  input (ADR [0021](./adr/0021-curated-plant-input.md)). This is the
  established, settled channel for a maintainer-authored full `Plant` to
  reach the shipped dataset; it already holds two records (`broad-bean`,
  `jerusalem-artichoke`) as a worked pattern to copy. Read that file's module
  doc and `docs/adr/0021-curated-plant-input.md` before writing new records —
  it explains the "curated wins on id collision" merge rule, the
  link-free-by-design choice for referential integrity, and exactly which
  bar (`validatePlant`, full provenance) each entry must clear.
- **Pruning:** decide explicitly whether "prune" means **deleting** a record
  from wherever it currently originates (OpenFarm-sourced, so the removal
  point is more likely a merge/exclusion step than deleting from a source
  dump — check `packages/etl/src/merge/` for the least-invasive place to
  exclude an id) or **flagging** it (e.g. a new schema field marking
  "not viable outdoors in the UK" that the app could one day surface instead
  of hiding). The WORKPLAN entry explicitly leaves this open and gives you
  the safety net: Stage 3.6's in-app add-crop form means a user can always
  re-add anything you remove, which is what makes outright deletion safe to
  choose if you decide flagging is unnecessary complexity for what's
  otherwise a personal-use planner.
- **Icons:** `app/src/icons/` — a test enforces exact correspondence between
  shipped ids and icon files (`app/src/icons/budget.test.ts` and
  `resolveIcon.test.ts`; check both). Adding a crop needs an icon added in
  the same change (`tools/icons/` is the generator, `docs/icon-style-guide.md`
  the style reference); removing a crop needs its icon removed, or the
  correspondence test fails.
- **Tests that will need re-pinning, not loosening:**
  `packages/engine/src/suitability/dataset.test.ts` and
  `packages/engine/src/spacing/dataset.test.ts` pin today's exact coverage
  numbers (162 total, 148 full-sun/14 partial-shade, 74 with `soil`, 2 with
  `hardiness`/`seasons`, and several exact-score/exact-id assertions further
  down `dataset.test.ts` — see lines ~59-72 and ~148, ~218 for the shapes
  that will shift). A failure here is the signal the change actually reached
  the engine, not a bug to route around.

## What's already built (don't rebuild any of this)

- **The curated-input channel and its merge wiring** (Stage 1.7): a plain
  `Plant[]` folded into `packages/etl/src/merge/` with "curated wins" on id
  collision. Adding a staple crop is "write a new array entry, run the
  dataset build" — no new plumbing.
- **The icon-correspondence enforcement** (Stage 4.1/4.2): already fails
  loudly if a shipped id has no icon or vice versa — you don't need to add
  this check, only satisfy it.
- **The hard-fail validation gate** (Stage 1.5): already rejects a malformed
  record at build time. New curated records get this for free.
- **The soil-moisture half of this very stage** (`packages/etl/src/moisture/`)
  — a worked example of "curate a thin slice, fold into merge, re-pin the
  dataset tests" you can pattern-match the crop-list work's _process_ against,
  even though the data shape is different (spacing/hardiness/season for a
  new `Plant`, not one field on an existing one).

## What this stage is NOT

- **Not another source adapter.** PFAF/Permapeople remain unstarted (Stage
  1.2, still ⚠️ partial) and are explicitly out of scope here — see the
  WORKPLAN entry's reasoning for why the join/mapping cost outweighs the
  benefit for this app's actual scope.
- **Not a hardiness/season depth push.** Those dimensions stay thin
  (2/162) after this stage; that is a known, accepted gap this stage does
  not close (see `docs/review-pre-deployment.md` §3.9's recommendation,
  which names Stage 1.2 — not 6.0 — as that gap's real unblocker).
- **Not a CI/deploy change.** Nothing here touches `.github/workflows/`
  (still must not exist, §1.4) or the Stage 5.2 deploy path.

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.**
- **No `.github/workflows/` directory — do not add one.**
- **No `.claude/` skills directory** — review your own diff.
- **Run before finishing:** `npm run verify` from the repo root (lint →
  typecheck → format:check → test → build → e2e). If Playwright can't find a
  browser, set `PW_EXECUTABLE_PATH` (see `README.md`) — this environment has
  a pre-installed Chromium at a path the README documents finding.
- **Full-record curation is a licence/provenance-integrity boundary, not
  just a data-entry task.** Every new curated record needs real provenance
  (source + retrieval date, per ADR 0021/0009) — this is what keeps the CC0
  dataset licence (ADR 0023) honest. Don't invent figures; cite them the way
  `plants.ts`'s existing two entries do.
- **`packages/engine` schema/scoring logic itself should not need changes**
  — this stage is data curation against the existing schema and engine, not
  a schema or algorithm change. If you find yourself wanting to change
  `packages/engine/src/schema/` or the suitability/spacing model to
  accommodate a new crop, stop and reconsider — that would be a much bigger,
  Opus-tier decision this brief doesn't scope for.

## Deliverables

1. New curated `Plant` records for at least apple, pear, raspberry, Brussels
   sprouts, swede, and pumpkin (real spacing/hardiness/light/season/soil data,
   cited provenance, full `validatePlant` bar), wired through
   `packages/etl/src/curated/plants.ts` into the Stage 1.5 merge.
2. The ~32 non-UK-outdoor-viable crops pruned or flagged, per your explicit,
   documented decision on which.
3. Icons added/removed to match exactly (`app/src/icons/`).
4. `suitability/dataset.test.ts` and `spacing/dataset.test.ts` re-pinned to
   the new, real numbers — not loosened or made approximate.
5. `README.md`'s "caveat worth knowing" section, `docs/architecture.md`, and
   `WORKPLAN.md`'s Progress table updated to reflect the new crop count and
   coverage; an ADR if the prune-vs-flag decision (or anything else here)
   turns out non-obvious in practice; the brief for the next stage written.

## Definition of done (WORKPLAN §0.3)

`npm run verify` green from the repo root (including the re-pinned dataset
tests); every shipped id still has exactly one icon and vice versa; new
curated records carry real, cited provenance; the Progress table and README
reflect the real, current crop count and coverage numbers; the next stage's
brief written (Stage 6.1 — documentation pass — is the natural next stage
per the dependency map, `6.0 ─► 6.1, 6.2, 6.3`, unless you judge one of 6.2/
6.3 more valuable to do first; note the alternative if so).

## Model

**Sonnet.** Per `WORKPLAN.md`'s own model-tier table: horticultural judgement
about what a British plot actually grows (which crops are genuinely
UK-outdoor-viable, what real spacing/hardiness figures are for six new
staples) plus mechanical curation against an already-settled schema and
merge pattern — not an architecture-defining decision.
