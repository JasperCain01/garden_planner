# Stage 3.3 brief — plant palette (filtered & ranked)

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1 "What the app does", step 2 — discovering suitable plants) and
[`WORKPLAN.md`](../WORKPLAN.md) (§0 ground rules and the Stage 3.3 entry)
first; this brief concentrates the requirements and the shape of the engine
and app surfaces Stage 3.3 builds against, so you don't have to reconstruct
it from the diff.

Stages 0.1–1.6, 0.3, all of Phase 2 (2.1, 2.2, 2.3), **Stage 3.1**, and
**Stage 3.2** are merged into `main` — **branch from `main`**. Stage 3.2
(brief: `docs/stage-3.2-brief.md`, ADR
[0016](./adr/0016-outline-editor-svg-not-konva.md)) left the plot-definition
page live at the app's index route (`app/src/plot/PlotDefinitionPage.tsx`,
rendered by `routes/Home.tsx`) and a plot store
(`app/src/state/plot-store.ts`) holding the user's current outline and
growing-conditions input. This stage is the _next_ step of `DESIGN.md`'s core
loop: turn that plot into a ranked, filterable list of suitable crops.

## Goal

Show the user which of the app's plants suit their plot, ranked best-first,
each with a visible reason — `DESIGN.md`'s "edibles that thrive in a shady,
damp British plot" — and let them search/filter the list. This stage does
**not** place anything on a canvas (Stage 3.4) or show warnings beyond a
plant's own suitability reasoning (Stage 3.5); it is purely "look at the list
and understand it."

## Where it lives

`app/` — same workspace as Stages 3.1–3.2. `packages/engine` is a dependency,
not editable (ADR 0003) — everything this stage needs from it already exists
and is described below. Put the new components under a sibling directory to
`app/src/plot/`, e.g. `app/src/palette/` (Stage 3.2 established that
`routes/` holds route components and feature code lives in its own sibling
folder — no components-folder convention beyond that was prescribed).

**A call this stage should make, not inherit unexamined:** whether the
palette becomes a second route (e.g. `/palette`, reachable via a nav link
`AppShell.tsx` grows) or renders on the same page as the plot form, below or
beside it, as one continuous "step 1 → step 2" scroll. `DESIGN.md`'s "core
loop" framing (describe → discover → arrange → validate) reads as a single
flow rather than four separate pages, and Stage 3.4's canvas will want the
palette visible _alongside_ it (drag a plant from the palette onto the
canvas) rather than navigated away from — which argues for keeping palette
and plot on one page (or at least not hiding the palette behind a nav click
once it exists), but this stage should make the call explicitly and record it
(an ADR if the reasoning is non-obvious, per `WORKPLAN.md` §0.2).

## What Stage 3.2 leaves you

- `app/src/state/plot-store.ts` — `usePlotStore` (Zustand, ADR 0015's
  per-concern convention): `region: PlotRegion` and
  `conditionsInput: PlotConditionsInput`, plus `setRegion`/`setConditionsInput`.
  Both start from sensible defaults (a 3m×2m rectangle, full sun), so the
  store is never in an unusable state — there is always a plot to rank
  against, even before the user has touched the form. Read the region/
  conditions with `usePlotStore((s) => s.region)` etc.; **do not** read
  `conditionsInput` and treat it as ready for `rankPlants` — it needs
  resolving first (next point).
- **Resolving conditions is your job at the point you need them**, not the
  store's: call `resolvePlotConditions(usePlotStore.getState().conditionsInput)`
  (or via a selector + `useMemo`) to get the `PlotConditions` `rankPlants`
  actually takes. `resolvePlotConditions` throws if the input is malformed,
  but the store's own defaults and `PlotConditionsForm`'s controlled inputs
  mean this should not normally happen in practice; still, don't let a thrown
  `ZodError` crash the palette — a `try`/`catch` (or deriving the resolved
  value once per render defensively) that falls back to "no ranking yet" is
  cheap insurance, mirroring what `PlotConditionsForm.tsx` already does to
  show its own inline validity.
- `app/src/plot/PlotOutlineEditor.tsx`, `ShapePicker.tsx`,
  `PlotConditionsForm.tsx`, `PlotDefinitionPage.tsx` — the plot-definition UI
  itself. Nothing here needs touching; the palette is a new, separate
  consumer of the same store.
- **Nothing about placement is this stage's concern.** Dragging a plant onto
  a canvas, live density/count feedback, and warnings are Stages 3.4/3.5.
  This stage's whole output is "the user can see and search a ranked list" —
  no canvas, no drag source wiring beyond perhaps making a palette entry
  visually draggable-looking if you want to get ahead of 3.4 (optional, not
  required).

## What Stage 3.1 leaves you (still true, restated because this stage is the first to actually need it)

- `app/src/state/use-plant-list.ts`'s `usePlantList()` — the **one** hook for
  "the current plant list" (shipped ∪ session's user-defined crops, ADR
  0015). Call this, not `SHIPPED_PLANTS` directly, so a crop a user adds in a
  later stage (3.6, not built yet) is ranked identically to a shipped one —
  `rankPlants` has no origin-awareness by design (ADR 0011), and the palette
  shouldn't invent any either.

## What the engine offers you for this stage

`packages/engine/src/suitability/rank.ts` (re-exported at the package root):

- **`rankPlants(plants: readonly Plant[], conditions: PlotConditions, options?: RankPlantsOptions): RankedPlant[]`**
  — the palette's entry point. Scores every plant, sorts best-first
  (`rankingScore` desc, then `confidence` desc, then `commonName`/`id` as a
  deterministic tie-break — _don't_ re-sort its output by anything else
  without understanding why that order was chosen), and returns
  `{ plant, suitability }` pairs.
  - `options.excludeUnsuitable` — drop crops with a hard mismatch on any
    dimension (band `unsuitable`). Consider exposing this as a palette
    toggle ("show unsuitable crops") rather than hard-coding it either way —
    `DESIGN.md` wants the palette to be honest about _why_ something isn't
    recommended, which argues for showing them (dimmed, reasoned) by
    default, but that's a UX call this stage should make and could go either
    way.
  - `options.minimumScore` / `options.limit` — available if useful; not
    required.
- **`RankedPlant`** — `{ plant: Plant; suitability: SuitabilityResult }`.
  `SuitabilityResult` (`suitability/model.ts`) carries `score`, `confidence`,
  `rankingScore`, `band` (`'excellent' | 'good' | ... | 'unsuitable'` — check
  `model.ts`'s `bandForScore` for the exact labels), a `summary` sentence, and
  a `dimensions: DimensionScore[]` breakdown (`light`/`hardiness`/`soil`/
  `season`, each with its own `score | null`, `finding`
  (`match`/`marginal`/`mismatch`/`unsuitable`/`unknown-plant`/`unknown-plot`),
  and `reason` sentence). **The `summary` and per-dimension `reason` strings
  are the "why" `DESIGN.md` step 2 asks for** — surface them directly rather
  than re-deriving your own explanation from the raw scores.
- **`scorePlant(plant, conditions)`** (`suitability/score.ts`) — what
  `rankPlants` calls per-plant; you probably don't need to call this
  directly, but it's there if the palette wants to score one plant on demand
  (e.g. a detail view) without ranking the whole list.
- **Confidence matters for display, not just ranking.** With today's shipped
  dataset (0 of 160 records carry hardiness/soil/season data — `model.ts`'s
  own doc comment says so), most `rankingScore`s are shrunk toward a neutral
  prior and most `dimensions` entries read `unknown-plant`. A palette that
  only shows a bare "87% match" number without also surfacing `confidence`
  or the `unknown-*` reasoning will read as more certain than the data
  actually is — show the reasoning, not just the number.

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.** Confusing `tsc` errors otherwise (both prior
  briefs hit the same thing).
- **Toolchain, unchanged:** single pinned Vite 6 / Vitest 3; Node ≥ 20; ESM;
  strict TS with `verbatimModuleSyntax` (`import type`). `app` consumes
  `@garden-planner/engine` via its `exports` map — no relative-path reaching
  into the package.
- **jsdom has no global `PointerEvent`, and its `MouseEvent`/`Event` don't
  populate `movementX`/`movementY`.** Only relevant if this stage's palette
  ends up with any drag-ish or pointer-driven interaction (e.g. a slider
  filter); `PlotOutlineEditor.tsx`/`.test.tsx` (Stage 3.2, ADR 0016) already
  worked out a `clientX`/`clientY`-delta-based pattern and a
  `dispatchEvent(new MouseEvent(...))` test technique if you need it again.
  A plain search box and checkbox/select filters don't need any of this.
- **The network is blocked** at the egress proxy for external sources —
  nothing in this stage needs the network; ranking is entirely in-memory
  over the bundled dataset.
- **There is no `.claude/` skills directory**, so `/verify` and
  `/code-review` don't exist. Review your own diff.
- **No CI workflow — don't add one** (`WORKPLAN.md` §1.4). Run checks
  locally.
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` from the repo root, plus `npm run format:check`. If the
  palette becomes a new route (see the open call above), re-verify against a
  **built** preview (`vite preview`) the way Stages 3.1/3.2's briefs
  describe — `vite dev` won't catch a base-path regression.

## Deliverables

1. A palette component listing every plant `usePlantList()` returns, ranked
   via `rankPlants` against the plot store's resolved conditions, each entry
   showing at least: name, the suitability `band`/`summary`, and enough of
   the per-dimension breakdown that "why is this/isn't this recommended" is
   answerable without opening dev tools.
2. Search (by name) and at least one filter beyond search (category, or a
   suitability-band/minimum-score cutoff, or both) — `DESIGN.md` calls the
   palette "searchable, filterable".
3. The palette re-ranks live as the plot store changes (changing light level
   or region in the Stage 3.2 form should visibly reorder/re-score the list
   without a page reload) — this is the point of building it against the
   store rather than a one-off snapshot.
4. Component tests, including: an E2E-adjacent check that a shady plot
   (`light: 'full-shade'`) demotes full-sun crops relative to shade-tolerant
   ones (or excludes them, if `excludeUnsuitable`/a filter is on) — the
   `WORKPLAN.md` Stage 3.3 verification's own wording — and that search/filter
   actually narrows the rendered list.
5. The routing/layout decision from "A call this stage should make" above,
   recorded (an ADR if it's non-obvious, otherwise a note in
   `docs/architecture.md` suffices per `WORKPLAN.md` §0.2's "record a
   decision a newcomer might question").

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
new code commented per §0.2; an ADR for the routing/layout decision (or any
other non-obvious call this stage makes), added to `docs/adr/README.md`'s
index if one is written; `docs/architecture.md` updated; the Progress table
in `WORKPLAN.md` updated; and — per §0.6 — the brief for Stage 3.4 (the
drag-and-drop plot canvas) written to `docs/stage-3.4-brief.md`.

## Model

**Sonnet.** Well-scoped UI + filtering work against an engine surface
(`rankPlants`) that is already settled and tested; the one real design call
(palette layout/routing relative to the plot form) is a UX judgement bounded
by `DESIGN.md`'s existing "core loop" framing, not an open architecture
question.
