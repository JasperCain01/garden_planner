# Stage 3.4 brief — drag-and-drop plot canvas ⭐ signature feature

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1 "What the app does", step 3 — planning the layout, and "The two
calculations that make it useful") and [`WORKPLAN.md`](../WORKPLAN.md) (§0
ground rules and the Stage 3.4 entry) first; this brief concentrates the
requirements and the shape of the app/engine surfaces Stage 3.4 builds
against, so you don't have to reconstruct it from the diff.

Stages 0.1–1.6, 0.3, all of Phase 2 (2.1, 2.2, 2.3), **Stage 3.1**, **Stage
3.2**, and **Stage 3.3** are merged into `main` — **branch from `main`**.

## Goal

Let the user drag plants from the palette (Stage 3.3) onto a canvas
representation of their plot, see live density/count feedback as they place
each one, and select/move/remove what they've placed. This is
`DESIGN.md`'s "the user drags plants onto a canvas representation of the
plot... computes how many fit" — the app's signature interaction. Warnings
(wrong light, overcrowding, antagonist adjacency, ...) beyond the raw count
are **Stage 3.5's job, not this one** — this stage's whole output is "plants
can be placed, moved, removed, and the count/space feedback is honest",
nothing about _validating_ the arrangement.

## Where it lives

`app/` — sibling to `app/src/plot/` and `app/src/palette/`, e.g.
`app/src/canvas/`. `packages/engine` is a dependency, not editable
(ADR 0003) — everything this stage needs from it already exists (below).

## What Stage 3.3 leaves you

- `app/src/palette/PlantPalette.tsx` renders **on the same page** as the plot
  form (`app/src/plot/PlotDefinitionPage.tsx`), directly below the
  growing-conditions form — a layout call made explicitly this stage and
  recorded in `docs/architecture.md` (no ADR; the reasoning was
  straightforward once `DESIGN.md`'s core-loop framing and this stage's own
  needs were both on the table). **This is exactly what that decision was
  for:** the palette is already visible on the page the canvas needs to live
  on, so Stage 3.4 does not need to solve "how does the user see the palette
  and the canvas at once" — it only needs to add the canvas to the same page
  (or a layout that keeps both visible; a two-column layout is a reasonable
  next step, not mandated).
- `app/src/palette/filters.ts` — pure search/category predicates; not
  something this stage needs to touch or extend for its own filtering, but
  a pattern (pure logic separated from the component) worth following again
  if the canvas grows its own pure geometry/placement helpers.
- **The palette has no drag affordance today.** Stage 3.3's brief left
  "visually draggable-looking" as optional and it was not built — every
  palette entry today is a plain, static `<li>`. Wiring an actual drag
  source (dnd-kit, per `WORKPLAN.md` §0.5 — ratified for exactly this
  "drag a discrete item between drop zones" interaction, as opposed to
  ADR 0016's vertex-dragging, which is why that stage didn't reach for it)
  onto palette entries is part of this stage's job, not something to assume
  already exists.
- `app/src/state/plot-store.ts` — `usePlotStore`: `region: PlotRegion` and
  `conditionsInput: PlotConditionsInput`. The canvas needs `region` (to draw
  the outline and know its bounds) and, for `fitPlant`'s spacing math, does
  **not** need the resolved `PlotConditions` — spacing/packing is
  independent of light/soil/climate (only the suitability engine reads
  those). Read `region` via `usePlotStore((s) => s.region)`.
- `app/src/state/use-plant-list.ts`'s `usePlantList()` — the plant list a
  dragged palette entry's `Plant` comes from. Same rule as always: no
  origin-awareness (shipped vs. user), the canvas treats every `Plant`
  alike.
- **A new store this stage almost certainly needs to add:** something like
  `app/src/state/placements-store.ts` holding "what's currently placed on
  the canvas" — a list of `{ plant: Plant; x: number; y: number; ... }` (or
  similar; the exact shape is this stage's call) plus add/move/remove
  actions. Follow ADR 0015's convention: one small, focused Zustand store per
  concern. Nothing today holds this state — Stage 3.1–3.3 never needed a
  "what's placed" concept.

## What Stage 3.2 leaves you (still relevant)

- `app/src/plot/PlotOutlineEditor.tsx` renders `PlotRegion` as an SVG
  `<polygon>`, scaled by a hard-coded `PX_PER_CM = 0.3` constant (exported
  from that file) via the SVG's own `width`/`height`/`viewBox` relationship —
  no `getBoundingClientRect`/`getScreenCTM`, which don't behave under jsdom
  (ADR 0016). The canvas needs its own outline rendering (of the same
  `PlotRegion`) and can reuse this exact trick for coordinate conversion; it
  does **not** have to reuse `PX_PER_CM`'s literal value or import it from a
  sibling feature's component file — a canvas with plant icons at a legible
  minimum size may well want a different scale, and picking one independently
  is fine. If jsdom's pointer-event gotchas resurface (no global
  `PointerEvent`, `movementX`/`movementY` unpopulated), `PlotOutlineEditor`'s
  `clientX`/`clientY`-delta pattern and its test's `dispatchEvent(new
MouseEvent(...))` technique are the worked examples to copy.

## What the engine offers you for this stage

`packages/engine/src/spacing/` (re-exported at the package root):

- **`fitPlant(plant: Plant, region: PlotRegion, options?: SpacingOptions):
SpacingCalculation`** — "how many of this plant fit in this region", the
  live feedback this stage needs as a plant is placed or the region changes.
  Returns `count` (the headline number), `method`/`methodRequested`/
  `spacingSource` (whether the figure was recorded or derived — say so if
  derived, per `fit.ts`'s own reasoning), `packing` (square/offset),
  `grid` (`EffectiveGrid` — orientation, in-row/between-row distances
  actually used), `regionAreaCm2`, and (see `model.ts`) a `positions:
PlantPosition[]` array — `{ x, y, row }` in centimetres, the actual lattice
  the canvas can draw plant icons at, plus a `summary` sentence
  (`"Onion — 60 plants: ..."`) that is a **deliverable, not a debug aid**
  (same rule as `SuitabilityResult.summary`, Stage 2.1) — show it verbatim
  rather than re-deriving your own text from the numbers.
- **`fitSpacing(spacing: Spacing, region: PlotRegion, options?):
SpacingCalculation`** — same calculation without a `Plant` record, if ever
  useful; `fitPlant` is almost certainly what this stage actually calls.
- **`SpacingOptions`** — `method` (`'auto' | 'row' | 'intensive'`, default
  `auto`), `packing` (`'square' | 'offset'`, default `square`), `orientation`
  (`'best' | 'rows' | 'columns'`, default `best`), `edgeInsetCm` (default 0).
  Every field defaults sensibly, so `fitPlant(plant, region)` alone is a
  reasonable first call; whether/how to expose these as UI controls
  (row vs. intensive toggle, square vs. offset packing) is this stage's UX
  call — not required by the brief, but `DESIGN.md` explicitly asks for
  offset/hexagonal packing as an option, so consider surfacing at least that
  one.
- **`PlotRegion` / `rectangleRegion` / `regionAreaCm2` / point-in-polygon
  helpers** (`spacing/region.ts`, `spacing/geometry.ts`) — already used by
  Stage 3.2's outline editor; the canvas reads the same `PlotRegion` shape,
  no conversion needed.

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.** Confusing `tsc` errors otherwise (every prior
  brief hits the same thing).
- **This is genuinely the first react-konva work in the codebase.**
  ADR 0016 deferred it here on purpose — there are no existing Konva
  conventions to follow, and no `<Stage>`/`<Layer>` pattern established
  anywhere yet. `react-konva` (and its `konva` peer) and `dnd-kit` are
  ratified in `WORKPLAN.md` §0.5 but **not yet installed** — neither
  `app/package.json` nor any workspace `package.json` lists them as of this
  brief. Adding them (and confirming the install actually reaches the npm
  registry through this environment's egress proxy — the proxy blocks
  arbitrary external sources, but package installs have worked for every
  prior stage's `npm install`) is part of this stage's setup, not assumed
  infrastructure.
- **dnd-kit vs. react-konva play different roles.** dnd-kit is for the
  palette→canvas drag _handoff_ (a discrete item crossing into a drop zone —
  the DOM-level palette list is a normal drop source/target pair). Once a
  plant is placed, react-konva owns the _scene_ (rendering the outline,
  every placed plant's icon, redrawing on move/remove/density recalculation)
  — the thing ADR 0016 explicitly said the outline editor's handful of SVG
  points didn't need, but "dozens of plant icons, placed, dragged, layered,
  redrawn on every density recalculation" (that ADR's own description of
  Stage 3.4's job) does. Don't reach for one library to do the other's job.
- **jsdom has no global `PointerEvent`/`DragEvent` semantics, and Konva
  renders to `<canvas>`, which has no DOM structure to query.** Component
  tests for the Konva scene will need either a different assertion strategy
  (asserting on the _data_ driving the render — the placements store's
  state, and `fitPlant`'s returned `count`/`positions` — rather than pixel
  output) or an accepted, documented gap covered instead by Playwright E2E
  (`WORKPLAN.md` §1.3 already anticipates an E2E drag-drop journey for this
  stage). Decide and record which, rather than discovering it mid-stage —
  ADR 0016's own note ("a Konva `<Stage>` renders to an HTML5 `<canvas>`,
  which has no DOM structure to query or click at all") is the exact
  precedent to build on.
- **No icons yet.** Stage 4.1 (SVG crop icon set) hasn't run. Placed plants
  need _some_ visual representation before then — a coloured shape, initial
  letter, or generic placeholder icon is fine and expected; wiring the real
  icon set is Stage 4.2's job, not this one's.
- **The network is blocked** at the egress proxy for external sources beyond
  package installs — nothing in this stage's actual feature work needs the
  network at runtime (spacing/packing is entirely in-memory).
- **There is no `.claude/` skills directory**, so `/verify` and
  `/code-review` don't exist. Review your own diff.
- **No CI workflow — don't add one** (`WORKPLAN.md` §1.4). Run checks
  locally.
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` from the repo root, plus `npm run format:check`. If canvas
  interaction depends on real pointer/drag behaviour beyond what jsdom can
  drive, that's what the Playwright E2E suite (`app/e2e/`, `npm run e2e -w
app`) is for — check whether it's wired up to run headless in this
  environment before relying on it as the only coverage for the drag
  gesture.

## Deliverables

1. A canvas component rendering the current `PlotRegion` (outline) via
   react-konva.
2. Plants draggable from the palette onto the canvas (dnd-kit), landing at
   the drop position (or a reasonable snapped position — this stage's call).
3. Live density/count feedback from `fitPlant` as plants are placed — at
   minimum, showing how many of the just-placed crop the plot/remaining
   space can hold; more (e.g. a running per-crop tally) is welcome but not
   required.
4. Select, move (drag within the canvas), and remove a placed plant.
5. A placements store (or equivalent state) that is the single source of
   truth for "what's on the canvas", separate from `plot-store.ts` and
   `use-plant-list.ts`, following ADR 0015's per-concern convention.
6. Component tests for the placements logic (add/move/remove, and the
   `fitPlant` feedback given a known region+plant), plus a documented
   decision on how (or whether) the Konva scene itself gets test coverage
   beyond that. An ADR if the react-konva integration or the test-strategy
   call is non-obvious (mirroring ADR 0016's own precedent); otherwise a
   `docs/architecture.md` note suffices per `WORKPLAN.md` §0.2.
7. `docs/architecture.md` updated; `WORKPLAN.md`'s Progress table updated;
   the brief for Stage 3.5 (warnings overlay & companion suggestions UI)
   written to `docs/stage-3.5-brief.md`.

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
new code commented per §0.2; an ADR for any non-obvious call this stage makes
(react-konva integration shape, test strategy for the canvas), added to
`docs/adr/README.md`'s index if one is written; docs and the Progress table
updated; and the Stage 3.5 brief written.

## Model

**Opus or Sonnet**, per `WORKPLAN.md` §0.4's own note on this stage: start
**Sonnet**, and escalate to Opus if the canvas interaction and geometry (real
drag-and-drop onto a scaled, polygon-bounded scene, kept in sync with a
separate placements store, with live recalculation) prove fiddlier than
expected. `fitPlant` already does the hard packing math — if this stage ends
up being mostly wiring against it, Sonnet should be sufficient.
