# Stage 3.1 brief — app shell, state & routing

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1 "What the app does", the core loop) and [`WORKPLAN.md`](../WORKPLAN.md)
(§0 ground rules and the Stage 3.1 entry) first; this brief concentrates the
requirements and the shape of the engine surface Phase 2 leaves behind, so you
don't have to reconstruct it from the diff.

Stages 0.1–1.6, 0.3, and **all of Phase 2 (2.1, 2.2, 2.3)** are merged into
`main` — **branch from `main`**. The plant schema, the climate module, the
suitability engine, the spacing/density calculator, and the warnings &
companion-suggestion engine all exist, are settled, and are green. Phase 3 (the
UI) has not started; this is its first stage, and nothing in `app/` beyond the
Stage 0.1 scaffold exists yet.

## Goal

The static SPA skeleton every later Phase 3 stage hangs off: app shell, state
management, routing configured for a **GitHub Pages base path**, and a
dataset-loading layer that exposes the runtime plant list as **the shipped
dataset plus any user-defined crops** (Stage 3.6) layered on top — an
in-memory, session-scoped overlay, not a rewrite of the shipped artifact.

## Where it lives

`app/` — the React + Vite frontend, the only workspace actually deployed.
`packages/engine` and `packages/etl` are consumed as dependencies, never
edited by this stage; if you find yourself wanting to change either, that's a
sign the boundary is being crossed the wrong way (`docs/adr/0003`).

## What the engine now offers you — three consumable surfaces

Phase 2 is complete, and it leaves exactly three entry points, all exported
from `@garden-planner/engine`'s root (`import { ... } from
'@garden-planner/engine'` — never reach into a package subpath):

1. **`rankPlants(plants, conditions, options?)`** (Stage 2.1,
   `docs/adr/0012-suitability-scoring.md`) — score and sort a plant list against
   a plot's conditions. Returns `RankedPlant[]` (`{ plant, suitability }`),
   best-first. This is what Stage 3.3's palette calls.
2. **`fitPlant(plant, region, options?)`** (Stage 2.2,
   `docs/adr/0013-spacing-density-calculator.md`) — "how many of this crop fit
   in this bed?". Returns a `SpacingCalculation` with `count`, `positions`
   (for the canvas to draw), `spacingSource`, and a summary sentence. This is
   what Stage 3.4's canvas calls as a bed is resized or a crop is dropped in.
3. **`evaluatePlot(conditions, placements)`** (Stage 2.3,
   `docs/adr/0014-warnings-and-companion-suggestions.md`) — the whole
   Stage 3.5 warnings overlay in one call. `placements` is
   `readonly CropPlacement[]`, each `{ id, plant, region, count, options? }` —
   note that **each placed crop carries its own bed `region`** (a `PlotRegion`,
   the same polygon shape `fitPlant` takes), not a point; `id` is your own
   identifier for the bed (e.g. a canvas element id), used to locate which
   placement a returned warning is about. Returns
   `{ warnings, suggestions }` — `warnings` is a closed, discriminated union
   (`kind` is one of `wrong-light` / `overcrowded` / `wrong-sowing-season` /
   `antagonist-adjacency` / `climate-mismatch`) with a ready-to-render `reason`
   sentence on every entry; `suggestions` is companion suggestions for what's
   placed, each carrying an `evidence: 'well-supported' | 'traditional'` tag
   the UI **must** surface honestly (Stage 3.5's job, not this one's — but the
   state layer should not discard the tag while shuttling data around).

None of the three needs anything this stage doesn't already have to build
anyway: a validated `Plant[]`, a `PlotConditions`, and (once 3.2/3.4 exist) a
`PlotRegion` per bed. **This stage does not need to call any of them** — that's
3.3/3.4/3.5's job — but the state shape you choose now is what those calls will
be made against, so it's worth choosing with `CropPlacement`'s shape in mind
(a placement has an id, a plant, a region, and a count — your app state for
"what's on the canvas" will look a lot like an array of these, or something
that's cheap to project into one).

## What `PlotRegionSchema` means for Stage 3.2

Stage 3.2 (plot definition) is the stage that actually produces `PlotRegion`
values, but since it depends on this stage's state shape, it's worth knowing
now: a region is `{ vertices: Vertex[] }`, an arbitrary simple polygon in
**centimetres**, validated by `safeValidatePlotRegion` (returns zod's
`{ success, data | error }`, field-addressable for a form) or
`validatePlotRegion` (throws). Presets (`rectangleRegion`, `lShapeRegion`,
`circleRegion`) are factory functions that build the same polygon type — there
is no separate "rectangle" region variant to model in your state. Whatever
state container you choose for "the current plot" should be able to hold one
`PlotRegion` for the plot's own outline (Stage 3.2) and, once beds exist
(Stage 3.4), one more per placed crop.

## The runtime plant list: shipped ∪ session-scoped user crops

`DESIGN.md` and ADR 0011 already settled this, and it's this stage's job to
implement it: the app's runtime plant list is **the shipped dataset
(`data/plants.json`, loaded once at startup and validated with `validatePlant`)
plus any user-defined crops** (Stage 3.6 builds the form; this stage builds the
place they land) layered on top as an **in-memory, session-scoped overlay** —
never a rewrite of the shipped artifact, never persisted across a reload
(there is no persistence layer, by design — a user crop lives for the tab's
lifetime and no longer).

The engine is **deliberately indifferent to where a plant came from** — every
function in `@garden-planner/engine` takes a `Plant` and does not care whether
it's shipped or user-defined (`isUserPlant(plant)` exists in
`schema/user-plant.ts` purely for UI concerns like "is this crop
removable/editable", never for engine logic). So your dataset-loading layer's
job is just: load and validate the shipped array once, expose a way to add a
session-scoped `Plant` (via `createUserPlant`, once Stage 3.6 builds the form
that calls it) to an overlay list, and expose the **concatenation** of the two
as "the plant list" every other stage consumes. Don't design a richer
provenance-tracking layer than that — Stage 3.6 needs `isUserPlant` for its own
UI (an "edit"/"remove" affordance a shipped crop doesn't get), and that's the
only place origin needs to be visible again after this stage.

## Constraints & gotchas already solved — don't rediscover them

- **The GitHub Pages base path bites early if ignored.** Configure Vite's
  `base` and your router's basename together, and check it against a **built**
  preview (`vite preview`), not just `vite dev` — the dev server doesn't
  reproduce a subpath deployment's routing quirks.
- **`npm install` first.** The container starts with no `node_modules`, and
  typecheck fails confusingly (`Cannot find type definition file for 'node'`)
  until you do.
- **Toolchain, unchanged from Phase 2:** single pinned Vite 6 / Vitest 3; Node
  ≥ 20; ESM; strict TS with `verbatimModuleSyntax` (use `import type`).
  `packages/engine` uses explicit `.ts` extensions on relative imports; `app`
  does not need to (it consumes the package via its `exports` map, not by
  relative path).
- **The engine package is already wired into `app`** (Stage 0.1's scaffold
  smoke test, `app/src/App.test.tsx`, imports `@garden-planner/engine` and
  checks `ENGINE_READY`). You are extending that wiring, not creating it from
  scratch.
- **The network is blocked** at the egress proxy for external sources. You
  need nothing from the network for this stage — the dataset is a static
  bundled JSON file (`data/plants.json`), loaded at build/runtime like any
  other static asset, not fetched from a live API.
- **There is no `.claude/` skills directory in this repo**, so `/verify` and
  `/code-review` do not exist. Review your own diff instead.
- **No CI workflow yet, and don't add one.** GitHub Actions are deliberately
  deferred until the project is complete (`WORKPLAN.md` §1.4). Run the checks
  locally.
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` from the repo root, plus `npm run format:check`.

## Deliverables

1. App shell (routing configured for the Pages base path — a placeholder
   route is fine, Stage 3.2 builds the real plot-definition page).
2. State management, chosen and wired in (this brief deliberately doesn't
   prescribe Redux/Zustand/Context/whatever — pick what fits the team's
   taste; the important shape decision is the plant-list overlay above, not
   the library).
3. The dataset-loading layer: loads and validates `data/plants.json` once,
   exposes the shipped list, exposes a way to add/remove session-scoped user
   crops, and exposes the merged `shipped ∪ user` list every later stage
   consumes.
4. Component test(s) or a smoke test confirming: the app loads the bundled
   dataset without error, renders a placeholder, and builds/serves correctly
   under the configured base path.

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
new code commented per §0.2; any non-obvious decision (state library choice,
how the overlay is represented) gets an ADR if it's the kind of thing a
newcomer might question, added to `docs/adr/README.md`'s index;
`docs/architecture.md` updated; the Progress table in `WORKPLAN.md` updated;
and — per §0.6 — the brief for the next stage (3.2, plot definition UI)
written to `docs/stage-3.2-brief.md`.

## Model

**Sonnet** — `WORKPLAN.md` Stage 3.1. Well-understood app-scaffolding work
with one real design decision (the dataset-overlay shape), already mostly
settled by ADR 0011; not the keystone-schema-risk profile Opus is reserved for.
