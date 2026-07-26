# Stage 3.5 brief — warnings overlay & companion suggestions UI

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1 step 4, "Validate continuously") and [`WORKPLAN.md`](../WORKPLAN.md) (§0
ground rules and the Stage 3.5 entry) first; this brief concentrates the
requirements and the shape of the app/engine surfaces Stage 3.5 builds
against, so you don't have to reconstruct it from the diff.

Stages 0.1–1.6, 0.3, all of Phase 2, and Stages 3.1–**3.4** are merged into
`main` — **branch from `main`**.

## Goal

Surface `packages/engine`'s warnings engine (`evaluatePlot`, Stage 2.3) and
companion suggestions in the UI, in context on the canvas Stage 3.4 built:
non-intrusive indicators on placed plants that explain themselves, and a
companion-suggestion affordance that shows the evidence tag (well-supported
vs. traditional, ADR 0008). This is `DESIGN.md`'s last core-loop step —
"validate continuously" — closing the describe → discover → arrange →
validate loop the whole Phase 3 build has been working towards.

## Where it lives

`app/` — sibling to `app/src/canvas/`, e.g. `app/src/warnings/`.
`packages/engine` is a dependency, not editable (ADR 0003) — the rules
engine (`evaluatePlot`) already exists and does not need new logic; this
stage is UI wiring against an existing, tested contract, **except for one
open modelling question below that is genuinely this stage's own call.**

## The one thing to decide before writing any UI: how a placement becomes a `CropPlacement`

This is worth reading before anything else, because it will not be obvious
from `evaluatePlot`'s signature alone and getting it wrong produces warnings
that are technically-computed but practically nonsense (e.g. every pair of
antagonist crops on the same plot flagged regardless of how far apart they
actually are).

**The two placement shapes don't match.** Stage 3.4's
`state/placements-store.ts` models what's on the canvas as individual
**point instances**: `{ id, plant, x, y }`, one entry per dragged-and-dropped
plant, in the plot's centimetre frame. `evaluatePlot`'s `CropPlacement`
(`packages/engine/src/warnings/model.ts`) models a **bed**: `{ id, plant,
region: PlotRegion, count }` — a crop, the sub-area it occupies, and how many
are in it. Nothing coerces one into the other; that coercion is this stage's
own design work.

Why it matters concretely, for the two placement-derived rules:

- **Overcrowding** (`overcrowding.ts`) calls `fitPlant(placement.plant,
placement.region)` and compares `placement.count` against the result — the
  exact computation `canvas/feedback.ts`'s `computePlacementTally` already
  does today for the live feedback panel (Stage 3.4). Grouping Stage 3.4's
  point placements **by plant id**, with `region` = the whole plot and
  `count` = how many of that plant are placed anywhere on it, reproduces
  that tally exactly and is very likely the right mapping for this rule —
  the plumbing already exists, just needs to also flow into `evaluatePlot`
  (or this stage can call `overcrowdingWarning` directly per tally row rather
  than going through `evaluatePlot`'s full loop; either is defensible).
- **Antagonist adjacency** (`adjacency.ts`) calls `regionDistanceCm` — real
  polygon-to-polygon distance between **two** placements' `region`s, `0` if
  they touch or overlap. Using the _whole plot_ as every crop's `region`
  (the mapping that works for overcrowding above) would make every pairing's
  distance `0` — two antagonist crops anywhere on the same plot would always
  warn, regardless of whether they're at opposite corners or right next to
  each other. That defeats the entire point of Stage 3.4 capturing precise
  `x`/`y` positions. This rule needs each **individual placed instance** (or
  at least each per-plant cluster) to carry a small region that actually
  reflects where it is — e.g. a square or circle of some nominal footprint
  size centred on `(x, y)`, plausibly derived from the plant's own spacing
  figure (`resolveLatticeSpacing`, already used internally by `adjacency.ts`
  and re-exported from the engine) so a courgette's footprint isn't the same
  size as a radish's.

**Concrete options, not a mandate — this is the stage's call:**

1. **Two different `CropPlacement[]` derivations for the two purposes**: one
   coarse (grouped-by-plant, whole-plot region) fed to overcrowding, one fine
   (per-instance, small footprint region) fed to antagonist adjacency. Most
   accurate, but means not calling `evaluatePlot` as one black box — either
   call `overcrowdingWarning`/`antagonistWarnings` separately with their own
   inputs, or call `evaluatePlot` twice with different placement lists and
   merge+dedupe the results.
2. **One per-instance derivation used for everything**: every placed plant
   becomes its own `CropPlacement` with `count: 1` and a small footprint
   region. Simpler (one `evaluatePlot` call, matching its own doc comment's
   "one call per state change" framing), but changes what "overcrowded"
   means — a bed's overcrowding would need to be re-derived some other way
   (e.g. still using `canvas/feedback.ts`'s tally _outside_ `evaluatePlot`
   for the count-vs-capacity number, and let `evaluatePlot`'s own
   `overcrowded` warning go mostly unused or trigger only in a degenerate
   single-instance sense). Worth checking whether `overcrowdingWarning` with
   `count: 1` against a tiny footprint region says anything useful at all
   before committing to this.
3. **A hybrid via two calls, one per rule family**, essentially option 1 but
   framed as "call the per-rule functions directly rather than
   `evaluatePlot`'s loop" — `suitabilityWarningsFor`, `overcrowdingWarning`,
   `antagonistWarnings`, `companionSuggestions` are all individually exported
   (`packages/engine/src/warnings/index.ts`), so nothing forces routing
   everything through `evaluatePlot` itself if the two derivations are
   irreconcilable as one list.

Whichever is chosen, **record it** — an ADR if the reasoning is at all
non-obvious once written down (this is exactly the kind of cross-cutting
"wrong call is expensive to unwind" decision `WORKPLAN.md` §0.4 flags), or at
minimum a clear `docs/architecture.md` note per §0.2.

One thing that _is_ simple regardless of which option is chosen:
`WarningSubject.placementId` and `CompanionSuggestion.forPlacementId` should
be Stage 3.4's own placement `id`s (`state/placements-store.ts`) wherever
practical, not a re-derived key — that's what lets the canvas locate exactly
which marker a warning is about without a second lookup table.

## What Stage 3.4 leaves you

- `app/src/state/placements-store.ts` — `usePlacementsStore`: `placements:
readonly PlacedPlant[]` (`{ id, plant, x, y }`), `selectedId`, and
  add/move/remove/select actions. This is "what's on the plot right now" —
  the input every derivation above starts from. Read via
  `usePlacementsStore((s) => s.placements)`.
- `app/src/canvas/PlotCanvas.tsx` — the Konva scene: outline, placed-plant
  markers (coloured circle + initial letter — no icon set yet, Stage 4.1/4.2),
  select/drag-to-move/remove. Warning indicators belong **on** this scene
  (per-marker, e.g. a small badge or ring colour keyed to `WarningSeverity`)
  — see `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md` before touching it:
  it is genuinely the first react-konva code in the repo, and that ADR
  records the coordinate-conversion trick (`canvas/geometry.ts`'s
  `cmToPx`/`pxToCm`, fixed-scale, no DOM measurement) this stage should
  reuse rather than reinvent for placing warning badges.
- `app/src/canvas/PlacementFeedbackPanel.tsx` and `canvas/feedback.ts` — the
  live density/count feedback built in Stage 3.4. `computePlacementTally`
  already does the per-crop placed-vs-fits grouping the overcrowding mapping
  above wants; reuse it rather than re-deriving the same grouping a second
  time in a new module.
- **The test-strategy precedent** (ADR 0017): `PlotCanvas.tsx` has no direct
  component test (jsdom can't back or query a Konva `<canvas>`, and
  `react-konva` is globally mocked in `app/src/test/setup.ts` just so pages
  _containing_ it don't crash on import). Any warning-indicator logic added
  to the Konva scene should live in a pure, separately-tested module (e.g.
  "which severity colour for this warning" or "where does a badge go
  relative to a marker") with the Konva JSX itself left thin and untested,
  the same split `PlotCanvas.tsx` already follows for
  `geometry.ts`/`drop.ts`/`feedback.ts`. The drag-and-drop E2E journey
  (`app/e2e/plot-canvas.spec.ts`) is the model to extend for an E2E warning
  journey (place an antagonist pair → warning appears → resolve it → warning
  clears, the exact case `WORKPLAN.md` §2 names for this stage).
- `app/src/plot/PlotDefinitionPage.tsx` — composes every section on one page
  (`DndContext`, the plot form, the palette, the canvas section). A new
  "4. Check for problems" (or similar) section, or indicators woven directly
  into the existing canvas/feedback sections, both fit the page's existing
  pattern; which is this stage's call.

## What the engine offers you (Stage 2.3, unchanged by Stage 3.4)

`packages/engine/src/warnings/` (re-exported at the package root):

- **`evaluatePlot(conditions: PlotConditions, placements: readonly
CropPlacement[]): PlotEvaluation`** — `{ warnings, suggestions }`, computed
  fresh each call (no internal state). `conditions` is `resolvePlotConditions`'s
  output, exactly like Stage 3.3's palette already resolves from
  `usePlotStore`'s `conditionsInput`.
- **`Warning`** — a discriminated union on `kind`: `wrong-light` /
  `wrong-sowing-season` / `climate-mismatch` (thin wrappers over a Stage 2.1
  `SuitabilityFinding`), `overcrowded` (`plantedCount`, `maxCount`,
  `spacingSource`), `antagonist-adjacency` (`evidence`, `distanceCm`,
  `thresholdCm`, optional `note`). Every variant carries `severity`
  (`'info' | 'warning' | 'severe'`), `subjects: WarningSubject[]`
  (`{ placementId, plantId }`), and a **deliverable** `reason` sentence —
  show it verbatim, same rule as `SuitabilityResult.summary` and
  `SpacingCalculation.summary` before it.
- **`CompanionSuggestion`** — `{ forPlacementId, forPlantId,
suggestedPlantId, evidence, note?, reason }`. `suggestedPlantId` is a bare
  id (the engine never sees the whole catalogue, only what's placed) —
  resolve it against `usePlantList()` for a display name/category, the same
  pattern `PlantPalette.tsx` already follows for every other plant lookup.
- **`CropPlacement`** — see the modelling section above; the shape this
  stage must produce from `usePlacementsStore`'s state.
- Individually exported per-rule functions if `evaluatePlot` itself doesn't
  fit the chosen derivation strategy: `suitabilityWarningsFor`,
  `overcrowdingWarning`, `antagonistWarnings`, `companionSuggestions`.

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.**
- **The placement-shape mismatch above is the stage's real work.** Don't
  treat this as "just call `evaluatePlot` and render the array" — read that
  section before writing the derivation.
- **`evaluatePlot` throws on an invalid `count`** (`PlacementCountSchema`,
  a non-negative integer) — never a concern if counts come from
  `usePlacementsStore`'s own placement list length, but worth knowing if a
  derivation computes counts some other way.
- **Warnings and suggestions are recomputed, not diffed or cached.** Call
  `evaluatePlot` (or the per-rule functions) fresh whenever `placements`,
  `conditionsInput`, or `region` changes — the same "no event wiring beyond
  the shared store subscription" pattern `PlantPalette.tsx` already
  established for `rankPlants`.
- **No icons yet** (Stage 4.1/4.2) — a warning badge is a coloured
  shape/symbol on the Konva scene, same "placeholder is fine and expected"
  rule Stage 3.4 used for plant markers themselves.
- **The network is blocked** at the egress proxy beyond package installs —
  nothing here needs it; everything is in-memory.
- **No `.claude/` skills directory** — review your own diff.
- **No CI workflow — don't add one.**
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, `npm run format:check` from the repo root. Extend
  `app/e2e/plot-canvas.spec.ts` (or add a sibling spec) for the
  place-antagonist-pair-see-warning-clear-it journey `WORKPLAN.md` §2 names
  for this stage; confirm the executable-path workaround this environment
  needs for Playwright (`PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-*/chrome-linux/chrome`,
  since the pinned `@playwright/test` version and the pre-installed browser
  revision don't always match) still applies, or has changed, before relying
  on a bare `npm run e2e -w app`.

## Deliverables

1. A derivation from `usePlacementsStore`'s point placements to
   `evaluatePlot`'s `CropPlacement[]` (or direct per-rule calls) — the
   modelling decision above, recorded.
2. Non-intrusive warning indicators on the canvas, on the affected
   marker(s), showing severity and (on inspection — hover, click, or a
   listed panel, this stage's call) the `reason` sentence.
3. A companion-suggestion affordance showing `suggestedPlantId` (resolved to
   a name via `usePlantList()`), the evidence tag, and the `reason` sentence.
4. Warnings/suggestions recompute live as placements, conditions, or the
   region change.
5. Component tests for the derivation logic (a known set of placements
   produces the `CropPlacement[]` — or per-rule inputs — the modelling
   decision says it should) and for any new pure logic (e.g. severity→colour
   mapping). Follow ADR 0017's precedent for what does and doesn't get a
   Konva-adjacent component test.
6. An E2E journey: place an antagonist pair → warning appears; resolve it
   (move one away, or remove it) → warning clears.
7. `docs/architecture.md` updated; `WORKPLAN.md`'s Progress table updated;
   the brief for Stage 3.6 (user-defined crops) written to
   `docs/stage-3.6-brief.md` — `WORKPLAN.md`'s dependency map already names
   3.6 as the natural next stage (needs 0.3, 3.1, 3.3, 3.4, and 4.1's icon
   set; check whether 4.1 has landed by the time this stage finishes, and if
   not, say so plainly in the handoff rather than assuming it has).

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
new code commented per §0.2; an ADR for the placement-derivation decision if
its reasoning is non-obvious once written down; docs and the Progress table
updated; the Stage 3.6 brief written.

## Model

**Sonnet**, per `WORKPLAN.md`'s own table for this stage — `evaluatePlot`
already does the rule logic, so most of this stage is UI wiring against an
existing, tested contract. The one piece worth real care is the
placement-derivation decision above; if it turns out to have knock-on
consequences that feel architecture-defining once you're in it (not
expected, but possible), that specific decision is the one worth an Opus
second look before committing, per `WORKPLAN.md` §0.4's own "wrong call is
expensive to unwind" test — not the stage as a whole.
