# Stage 3.2 brief — plot definition UI

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1 "What the app does", step 1 — defining the plot) and
[`WORKPLAN.md`](../WORKPLAN.md) (§0 ground rules and the Stage 3.2 entry)
first; this brief concentrates the requirements and the shape of the engine
surfaces Stage 3.2 builds against, so you don't have to reconstruct it from
the diff.

Stages 0.1–1.6, 0.3, all of Phase 2 (2.1, 2.2, 2.3), and **Stage 3.1** are
merged into `main` — **branch from `main`**. Stage 3.1 (brief:
`docs/stage-3.1-brief.md`, ADR
[0015](./adr/0015-app-state-management.md)) left the app shell, routing
(`react-router-dom`, GitHub Pages basename wired), a Zustand state convention
(one focused store per concern), and the dataset-loading layer
(`app/src/dataset/shipped-plants.ts`, `app/src/state/use-plant-list.ts`) all
green. This stage doesn't touch the plant list at all — that's Stage 3.3's
job — it produces the _other_ input every engine call needs: the plot itself.

## Goal

Let the user describe their plot, per `DESIGN.md` §1 step 1: a **preset shape**
(rectangle, L-shape, …) sized by dimensions, then **freely adjusted** — drag,
add and remove corners — plus an overall light level, soil if known, and a
location (defaulting to Britain). The output is a validated `PlotRegion`
(the outline) and `PlotConditions` (light/soil/climate/planting month) —
exactly what `fitPlant`, `rankPlants` and `evaluatePlot` all consume.

## Where it lives

`app/` — same workspace as Stage 3.1. `packages/engine` is a dependency, not
editable (ADR 0003) — everything this stage needs from it already exists and
is described below.

**A call this stage should make, not one to inherit unexamined:** Stage 3.1
left `routes/Home.tsx` as a placeholder index route showing the engine-status
smoke content. The plot form is `DESIGN.md`'s actual step 1 of the core loop —
the natural thing is for it to **become** the index route (replace `Home`'s
content, or rename it), rather than living behind a second nav link with the
placeholder still at `/`. `routes/router.tsx` (Stage 3.1) is a plain
`RouteObject[]` kept separate from `createBrowserRouter` specifically so this
kind of change is a small, local edit.

## What Stage 3.1 leaves you

- `app/src/state/` — the Zustand convention: one small store per concern,
  plain data in and out, selectors via `useStore((s) => s.slice)`. Follow the
  same shape for a new plot store (e.g. `state/plot-store.ts`) rather than
  bolting plot state onto the user-plants store — they're unrelated concerns.
- `app/src/routes/` — `AppShell` (nav chrome + `<Outlet />`), the route tree in
  `router.tsx`. Add whatever new components this stage needs under
  `app/src/routes/` or a sibling directory (e.g. `app/src/plot/`) — Stage 3.1
  didn't prescribe a components folder structure beyond `routes/`.
- **Nothing about the plant list is this stage's concern.** `usePlantList()`
  exists and is settled (ADR 0011, ADR 0015) but Stage 3.3's palette is what
  calls it. Don't wire it in here just because it's available.

## What the engine offers you for this stage

Two schemas/APIs, both zod-first, both already used by their own test suites —
read the doc comments in the files named below before designing your own
shapes; they explain the _why_ behind constraints you'll otherwise rediscover
by trial and error.

### 1. The plot region — `packages/engine/src/spacing/region.ts`

A region is `{ vertices: Vertex[] }`, an **arbitrary simple polygon in
centimetres** (`Vertex` is `{ x: number; y: number }`). Key facts:

- **Presets are factory functions, not a discriminated union**:
  `rectangleRegion(widthCm, heightCm)`, `lShapeRegion({ widthCm, heightCm,
notchWidthCm, notchHeightCm })`, `circleRegion(diameterCm, segments?)` (an
  inscribed 32-gon by default). All three return the same `PlotRegion` type —
  there is no "rectangle" variant to special-case once the user starts
  dragging corners. Nothing remembers which preset a region started as; if
  your form wants to keep showing "width: 3m, height: 2m" fields after a
  preset is chosen, that's UI-side form state, not something to read back off
  the polygon.
- **Validation, and how to show it:** `validatePlotRegion(input)` throws;
  `safeValidatePlotRegion(input)` returns zod's `{ success, data | error }`
  with **field-addressable paths** (`vertices[3].x`) — exactly what you need
  to highlight _which_ corner a drag broke. Three rules fire: too few/many
  vertices (3–1,000), two consecutive corners coinciding (catches an
  explicitly-closed ring or a corner dragged onto its neighbour), and
  self-intersection/zero area (`findSelfIntersection` names the two offending
  edges). Wire the free-form editor's every corner-move through
  `safeValidatePlotRegion` and surface the message inline — don't let an
  invalid polygon reach the engine at all.
- **Units:** centimetres, matching `Plant.spacing`. Presenting metres in the
  form and converting at the boundary is the UI's job; don't push a unit
  toggle into the engine.
- **Winding and origin don't matter** — a test in `region.test.ts` pins this,
  so don't add normalization logic on the way in.

### 2. Plot conditions — `packages/engine/src/suitability/conditions.ts` and `packages/engine/src/climate/`

- `PlotConditionsInputSchema` is what your form actually collects: `{ light,
soil?, location?, plantingMonth? }`. `light` is required (the one condition
  every plot has); `soil` and `location` are optional blocks (`PlotSoilSchema`
  needs at least one of texture/pH/moisture if present at all — don't let a
  user submit an empty soil object).
- `location` is a `LocationInputSchema` discriminated union: `{ kind: 'default'
}` (UK national profile), `{ kind: 'region', regionId }` (pick from
  `CLIMATE_REGIONS`, exported from `packages/engine/src/climate/regions.ts` —
  each a hand-curated, cited `ClimateProfile`), or `{ kind: 'coordinates', lat,
lng }`. **Online geocoding is deferred** (ADR 0010) — don't build a
  place-name search; a region dropdown plus "use the default" is the whole of
  this stage's location UI. Coordinates are supported by the schema for a
  later stage; you don't have to build a picker for them now.
- `resolvePlotConditions(input: unknown): PlotConditions` is the one boundary
  function: validates the input shape _and_ resolves `location` into a full
  `ClimateProfile` via `resolveClimate` in one call, entirely offline, never
  failing for a default or region location. This is what your form's submit
  handler should call — don't call `resolveClimate` yourself and assemble
  `PlotConditions` by hand.
- `PlotConditions` (the resolved output) is what `rankPlants` and
  `evaluatePlot` take. Store the _input_ shape in your plot store (so the form
  stays editable) and call `resolvePlotConditions` at the point something
  downstream needs the resolved value — or resolve once and keep both, your
  call, but don't design a state shape that's already lost the user's original
  soil/location choices by the time they want to edit them again.

Neither `rankPlants`, `fitPlant`, nor `evaluatePlot` needs to be called by this
stage — that's 3.3/3.4/3.5's job. This stage only needs to produce values of
the right shape.

## Constraints & gotchas already solved — don't rediscover them

- **The free-form outline editor is real interaction work**, not just a
  schema-validated form. `DESIGN.md` and `WORKPLAN.md` §0.5 already pin
  **react-konva** as the project's 2D canvas library and **dnd-kit** for
  drag-and-drop (ratified choices, not this stage's to re-litigate) — Stage
  3.4's plot canvas is going to need react-konva regardless. Whether to pull it
  in now for the outline editor, or ship a simpler drag-corners interaction
  (plain SVG + pointer events) and let 3.4 be the first real react-konva work,
  is this stage's one open design call. Either is defensible; if you pick the
  simpler SVG approach, say so in an ADR so 3.4 doesn't have to guess why the
  canvas library wasn't adopted a stage earlier than it had to be.
- **`npm install` first.** Confusing `tsc` errors otherwise (Stage 3.1's brief
  hit the same thing).
- **Toolchain, unchanged:** single pinned Vite 6 / Vitest 3; Node ≥ 20; ESM;
  strict TS with `verbatimModuleSyntax` (`import type`). `app` consumes
  `@garden-planner/engine` via its `exports` map — no relative-path reaching
  into the package, no `.ts` extensions needed on `app`'s own relative
  imports (unlike `packages/engine`).
- **The network is blocked** at the egress proxy for external sources — but
  nothing in this stage needs the network. Online geocoding stays deferred
  (above); the region list is static, hand-curated data already in the
  package.
- **There is no `.claude/` skills directory**, so `/verify` and `/code-review`
  don't exist. Review your own diff.
- **No CI workflow — don't add one** (`WORKPLAN.md` §1.4). Run checks locally.
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` from the repo root, plus `npm run format:check`. If the
  outline editor touches routing or the base path at all, re-verify against a
  **built** preview (`vite preview`) the way Stage 3.1's brief describes —
  `vite dev` won't catch a base-path regression.

## Deliverables

1. A shape picker offering the three presets (rectangle, L-shape, circle),
   sized by dimensions the user enters (in metres, converted to centimetres at
   the boundary), producing a `PlotRegion` via the factory functions above.
2. Free-form adjustment of that outline — drag existing corners, add/remove
   corners — re-validated on every change via `safeValidatePlotRegion`, with
   an invalid result (self-intersecting, too few corners, a collapsed edge)
   shown inline rather than silently accepted or passed to the engine.
3. Light level input (required), soil input (optional, all-or-nothing per
   `PlotSoilSchema`'s "at least one facet" rule), and a location input
   (default UK, or pick a `CLIMATE_REGIONS` entry) — assembled into a
   `PlotConditionsInput` and resolved via `resolvePlotConditions`.
4. A plot state store (Zustand, following Stage 3.1's per-concern-store
   pattern) holding the current region + conditions input, so Stage 3.3
   onward can read "the current plot" without re-deriving it.
5. Component tests: an outline dragged into a self-intersecting shape is
   rejected with a message rather than reaching the engine; a completed form
   produces a `PlotRegion`/`PlotConditions` pair the engine actually accepts
   (assert this by round-tripping through `validatePlotRegion` /
   `resolvePlotConditions` in the test, not just checking your own state
   shape).

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
new code commented per §0.2; an ADR for the outline-editor-timing decision (or
any other non-obvious call this stage makes), added to `docs/adr/README.md`'s
index; `docs/architecture.md` updated; the Progress table in `WORKPLAN.md`
updated; and — per §0.6 — the brief for Stage 3.3 (plant palette) written to
`docs/stage-3.3-brief.md`.

## Model

**Sonnet.** `WORKPLAN.md` Stage 3.2. Well-scoped UI + form-validation work
against engine surfaces that are already settled and tested; the one real
design call (outline-editor interaction approach) is bounded by ratified
library choices (react-konva/dnd-kit), not an open architecture question.
