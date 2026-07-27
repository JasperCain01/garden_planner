# Architecture overview

This is a short map of how the pieces fit together. For the _why_, read
[`DESIGN.md`](../DESIGN.md) and the ADRs in [`adr/`](./adr/); for the build
sequence read [`WORKPLAN.md`](../WORKPLAN.md).

## How to read this file

This file is two things at once: an architecture overview and a stage-by-stage
build log, and it grows by accretion — each stage appends its section rather
than the file being rewritten. That's deliberate (§0.2's "update docs as part
of the stage" applies here too), but it means reading it start to finish is
not the fastest way to understand the system. Three ways to use it instead:

- **New here and want the shape of the system, not its history?** Read "The
  one big constraint" and "Why a monorepo with these boundaries" below, then
  skip straight to ["Where to look next"](#where-to-look-next) at the bottom —
  a topic → file table that covers the whole codebase as it stands today,
  with no stage history to wade through.
- **Picking up a specific area (the engine, the ETL, one app feature)?** Find
  its row in "Where to look next" and follow the file path — most modules'
  own doc comments carry more of the "why" than this file restates.
- **Want the reasoning behind one decision?** Check [`docs/adr/`](./adr/)
  first — an ADR is scoped to one decision, which is usually faster to read
  than finding the same reasoning embedded in a stage section below.

The stage-by-stage sections that follow are the project's build log: useful
for _why_ a design landed the way it did and in what order, not required
reading to use or extend the app. [`docs/README.md`](./README.md) is the
general docs index if you're looking for something other than architecture
(how-to guides, data provenance, the build plan).

## The one big constraint

The app must run as a **fully static site** (GitHub Pages) and **work offline**.
Everything below follows from that.

```
  BUILD TIME (developer machine, online)      RUN TIME (browser, offline-capable)
  ┌────────────────────────────┐             ┌────────────────────────────┐
  │ packages/etl                │   emits     │ app/ (deployed to Pages)    │
  │  ingest external sources    │ ──────────► │  loads /data artifact       │
  │  normalize → validate       │  committed  │  runs packages/engine       │
  │  → write /data artifact     │  to /data   │  renders React UI + icons   │
  └────────────────────────────┘             │  service worker → offline   │
                                              └────────────────────────────┘
```

- **`packages/etl`** runs only on a contributor's machine. It pulls from PFAF,
  Permapeople, the OpenFarm crops rescue dataset, GBIF, etc., and writes the
  static dataset. The deployed app never calls those sources — which is what
  makes it offline-safe. As of Stage 1.1
  (`packages/etl/README.md`, [`adr/0005`](./adr/0005-gbif-name-resolver.md))
  it has a runnable pipeline shell, a documented `SourceAdapter` extension
  point, and a GBIF scientific-name resolver that fills the schema's
  `gbifId` — the join key the eventual merge step (Stage 1.5) reconciles
  records by. The resolver is offline-first: its answers are cached to a
  committed JSON file (`packages/etl/cache/`), so a second run — and CI, and
  an offline contributor — needs no network for a name it has already
  resolved. Stage 1.2 ([`adr/0006`](./adr/0006-openfarm-source-adapter.md))
  adds the first real `SourceAdapter` — OpenFarm, via a community-rescued
  dump since no official one was ever published — establishing the
  raw-shape/cache/mapper/adapter pattern PFAF and Permapeople follow next.
  Stage 1.3 ([`adr/0007`](./adr/0007-hand-verified-spacing.md)) adds the one
  part of the pipeline that is **original curation, not ingestion**: a
  hand-verified, method-aware spacing table (`packages/etl/src/spacing/`) for a
  starter set of common British edibles, each figure cross-checked against ≥2
  authoritative sources with the citations recorded per growing method. It is
  deliberately _not_ a `SourceAdapter`; Stage 1.5 imports it directly to merge
  spacing onto records (hand-verified figures winning over scraped ones).
  Stage 1.4 ([`adr/0008`](./adr/0008-companion-planting-data.md)) adds the
  evidence-tagged companion/antagonist relationship dataset
  (`packages/etl/src/companions/`): a small hand-curated, individually-cited
  set (the only source of `well-supported` links) plus a larger set
  mechanically derived from OpenFarm's own scraped `companions` field
  (always `traditional` — an uncited scrape can't earn more). Every
  relationship's `from`/`to` is checked against the union of the Stage 1.3
  spacing ids and Stage 1.2's mapped OpenFarm ids, so links aren't dangling by
  construction ahead of Stage 1.5's real referential-integrity gate. Also
  deliberately _not_ a `SourceAdapter` — see the ADR for why.
  Stage 1.5 ([`adr/0009`](./adr/0009-dataset-merge-and-licensing.md)) is the
  ⭐ keystone that ties it all together (`packages/etl/src/merge/`): it gathers
  the OpenFarm plants, **joins** the spacing and companion slices onto them
  (GBIF id when present, then unambiguous scientific name, then shared slug /
  a small curated alias table — GBIF being unreachable, the fallback carries the
  load today and upgrades to GBIF-id joins for free when the block lifts),
  applies the conflict rules (hand-verified spacing wins), remaps companion-link
  ids so referential integrity holds by construction, runs the **hard-fail
  validation gate** (schema + referential integrity + sanity bounds), and emits
  the artifact. Run it with `npm run build:data -w @garden-planner/etl`.
- **`/data`** is that committed static artifact (`data/plants.json`): the plant
  "database" as a plain-JSON file the browser loads directly. No database server
  exists at runtime. As of Stage 6.0 it holds 144 validated, merged plants; see
  [`data/README.md`](../data/README.md) for its shape and current caveats.
- **`packages/engine`** is pure, framework-free logic (suitability scoring,
  spacing/density, warnings). It runs in the browser but has no UI dependency, so
  it is unit-testable in isolation. It also hosts the **canonical plant-record
  schema** (`packages/engine/src/schema/`, Stage 0.2): zod is the single source of
  truth and the TypeScript types are `z.infer`-derived from it, so the ETL, the
  engine, and the UI all validate and type against one shape. See
  [`adr/0004`](./adr/0004-plant-schema.md), especially the method-aware spacing.
  Stage 0.3 ([`adr/0011`](./adr/0011-user-defined-crop-schema.md)) adds
  `schema/user-plant.ts`: a permissive **input** schema for a crop typed off a seed
  packet (no scientific name, no citation) plus an **upcast** that turns it into a
  fully-valid `Plant` — synthesising `user-entered` provenance and a `user-`
  namespaced id. `PlantSchema`/`validatePlant` are deliberately unchanged, so the
  ETL's hard-fail gate for _shipped_ data keeps requiring full identity and
  attribution; the relaxation exists only at that input boundary.
  Stage 1.6 ([`adr/0010`](./adr/0010-location-climate-static-data.md)) adds
  **location/climate static data** (`packages/engine/src/climate/`): a
  climate-profile zod schema (reusing the schema's `RhsHardinessRatingSchema`,
  `HardinessSchema`, `MonthRangeSchema`, and `SourceRefSchema` rather than
  restating them), a hand-curated UK-default profile plus a small extensible
  region set (each frost date and hardiness band individually cited, in the
  same style as the Stage 1.3 spacing table), and a fully-offline
  `resolveClimate(location)` the suitability engine (Stage 2.1) and the
  plot-definition UI (Stage 3.2) will consume. Online geocoding is deferred
  (interface-ready — see the ADR); the offline path never touches the network.
  Stage 1.7 ([`adr/0021`](./adr/0021-curated-plant-input.md)) adds the fourth
  and final Stage 1.5 merge input: **maintainer-curated plants**
  (`packages/etl/src/curated/plants.ts`), a plain hand-authored `Plant[]` held
  to the same unrelaxed `validatePlant` bar as every OpenFarm-sourced record —
  distinct from Stage 3.6's session-only, relaxed-schema user crops. `merge.ts`
  folds curated plants in as a new first step: a curated plant whose id
  collides with an OpenFarm plant's (directly, or via the existing
  `SLUG_ALIASES` table) **replaces it outright**, mirroring "hand-verified
  spacing wins" one level up; a non-colliding curated plant is simply added.
  Past that fold-in, a curated plant is an ordinary `Plant` for every later
  step (spacing attach, companion-link remap, the sanity filter, the final
  schema re-validation) — no special-casing, which is what lets the two
  crops shipped this stage (`broad-bean`, `jerusalem-artichoke`) prove the
  pipeline end to end. `broad-bean` closes a gap ADR 0009 documented: OpenFarm
  has no mappable _Vicia faba_, so the Stage 1.3 spacing row and the Stage 1.4
  `leek` antagonist link had nothing to attach to until this stage gave them a
  plant. The dataset shipped 162 plants at the end of this stage; Stage 6.0
  (below) re-curated the list to 144.
  Stage 2.1 ([`adr/0012`](./adr/0012-suitability-scoring.md)) adds the engine's
  first real brain — **suitability scoring**
  (`packages/engine/src/suitability/`): a zod-first plot/growing-conditions
  schema (light, soil, a resolved `ClimateProfile`, an optional planting month —
  reusing the Stage 0.2 enums so a plot's light level and a plant's light
  requirement are literally the same enum), four per-dimension scorers (light,
  hardiness, soil, season) that each return a score **and** a human-readable
  reason, an aggregate `scorePlant` carrying the full breakdown, and
  `rankPlants` — the palette's entry point (Stage 3.3). The design decision worth
  reading the ADR for is the **missing-data policy**: no shipped record carries
  hardiness, soil or seasons today, so an unassessable dimension is _excluded_
  from the weighted mean rather than defaulted, the gap is reported as a
  `confidence` figure and stated in the result's own reasoning, and the ranking
  score is shrunk towards a neutral prior in proportion to it — so "absent" reads
  as neither a perfect match nor a total mismatch. A hard mismatch on any one
  dimension caps the whole result (a full-sun crop in deep shade cannot average
  its way to a good score). The machine-readable `finding` on each dimension is
  the contract Stage 2.3's warnings engine builds on.
  Stage 2.2 ([`adr/0013`](./adr/0013-spacing-density-calculator.md)) adds the
  engine's second calculation — the **spacing / density calculator**
  (`packages/engine/src/spacing/`), which answers "how many onions can I fit?".
  A plot region is an **arbitrary simple polygon** in centimetres (zod-first,
  with the preset shapes — rectangle, L-shape, circle — as _factory functions_
  building the one type, so the free-form outline a user drags is the same code
  path); the schema rejects self-intersecting, collapsed and under-3-corner
  outlines with messages Stage 3.2 can show. Counting is **shape-aware**: a
  lattice is laid over the region's bounding box and a plant is kept only if the
  whole rectangle it is allotted lies inside the outline, so an L-shaped plot
  counts strictly fewer plants than its bounding box and "a plant that half-fits
  doesn't" is a rule rather than an aspiration. It is **method-aware** too (rows
  vs. intensive beds, ADR 0004 §2), offers square or offset/hexagonal packing,
  and returns a result that explains itself — method used vs. asked for, whether
  the spacing was recorded or derived, the effective grid, every plant's
  position for the canvas (Stage 3.4), and a sentence for the UI. The decisions
  worth reading the ADR for are the whole-cell containment rule (which makes the
  area upper bound a theorem), the offset row pitch `√(b² − (s/2)²)` and why it
  is not a blanket `√3/2`, and the **fallback rule**: 135 of the 144 shipped
  records have row spacing only, so asking for an intensive count derives a
  conservative equal-area square and labels it rather than refusing.
  Stage 2.3 ([`adr/0014`](./adr/0014-warnings-and-companion-suggestions.md)) adds
  the **warnings & companion-suggestion engine**
  (`packages/engine/src/warnings/`), the last piece of `DESIGN.md`'s core
  loop: `evaluatePlot(conditions, placements)` is the single entry point Stage
  3.5 calls per state change, returning every warning (`wrong-light`,
  `overcrowded`, `wrong-sowing-season`, `antagonist-adjacency`,
  `climate-mismatch` — a closed, discriminated-union `Warning` type, never
  prose to parse) and every companion suggestion for what's already placed, in
  one call. Three warning kinds are thin wrappers over Stage 2.1's per-dimension
  findings (only `mismatch`/`unsuitable` warn — `marginal` and both `unknown-*`
  findings stay silent, so the sparse shipped dataset doesn't nag about its own
  gaps); two are new work over Stage 2.2's geometry. The design decisions worth
  reading the ADR for: **"planted nearby"** is real polygon-to-polygon distance
  (never a bounding-box shortcut) against a threshold derived from the two
  crops' own spacing, not a fixed constant; **overcrowding** reuses `fitPlant`
  directly, since its whole-cell-conservative count already makes "placed more
  than fits" and "placed closer than spacing" the same test; and **evidence
  tags** (ADR 0008) are carried through unaveraged into both antagonist-warning
  severity and companion-suggestion wording, phrased assertively for the three
  `well-supported` links and hedged for the 82 `traditional` ones rather than
  hiding the folklore majority outright. A user-defined crop (ADR 0011) can
  never produce or receive a suggestion or an antagonist warning — not via a
  defensive check, but because its `companions`/`antagonists` are structurally
  always absent.
- **`app`** is the React + Vite front-end — the only thing deployed. It loads the
  dataset, calls the engine, and renders the drag-and-drop UI. Stage 3.1
  ([`adr/0015`](./adr/0015-app-state-management.md)) adds the shell every later
  Phase 3 stage hangs off: `routes/` holds the router (`react-router-dom`, a
  `createBrowserRouter`/`createMemoryRouter`-shared route tree so tests don't
  need a real browser History object) with its `basename` derived from Vite's
  `base` — the two must move together for a GitHub Pages project-site subpath
  to work, verified against a **built** preview rather than dev, since `vite
dev` doesn't reproduce a subpath deployment. `dataset/shipped-plants.ts` is
  the dataset-loading layer: it imports `data/plants.json` as an ordinary
  bundled JSON module (no fetch, no loading state) and re-validates every
  record through `safeValidatePlant` before anything else sees it, failing
  loudly on a corrupt artifact rather than three components deep.
  `state/user-plants-store.ts` is a small Zustand store holding the session's
  user-defined crops as `Record<Plant['id'], Plant>` (keyed by id, so "no
  duplicate id" is structural rather than a rule call sites remember); and
  `state/use-plant-list.ts`'s `usePlantList()` is the **one** hook every later
  stage should call for "the current plant list" — it concatenates the shipped
  array with the overlay's values and is the runtime realisation of ADR 0011's
  shipped-∪-user design. See the ADR for why Zustand and why an id-keyed map
  over an array.
  Stage 3.2 ([`adr/0016`](./adr/0016-outline-editor-svg-not-konva.md)) adds the
  **plot-definition page** (`app/src/plot/`), which now renders at the index
  route (`routes/Home.tsx` — Stage 3.1 left it a placeholder specifically for
  this stage to replace, per its own brief): `ShapePicker.tsx` builds a
  `PlotRegion` from a preset (rectangle/L-shape/circle) and metre-valued
  dimensions via the engine's factory functions, converted to centimetres at
  the boundary (`plot/units.ts`); `PlotOutlineEditor.tsx` is the free-form
  drag/add/remove-corner editor, re-validating every edit through
  `safeValidatePlotRegion` and showing an invalid outline (self-intersecting,
  too few corners, a collapsed edge) inline rather than ever handing it to
  `onChange` — its pure vertex-array edits live separately in
  `plot/outline-ops.ts` so they're testable with no DOM at all;
  `PlotConditionsForm.tsx` assembles light (required), soil (optional,
  all-or-nothing per facet per `PlotSoilSchema`), and location (the UK default
  or a `CLIMATE_REGIONS` pick — no free-text geocoding, per ADR 0010's defer)
  into a `PlotConditionsInput`, resolving it live via `resolvePlotConditions`
  to show whether it's currently valid. `state/plot-store.ts` is the new
  per-concern Zustand store (ADR 0015's convention) holding the current
  `PlotRegion` and `PlotConditionsInput` — the _input_ shape, not a resolved
  `PlotConditions`, so the form stays editable; downstream stages call
  `resolvePlotConditions` themselves at the point they need the resolved
  value. The one decision worth reading the ADR for: the outline editor is
  **plain SVG + native pointer events, not react-konva** — react-konva is
  ratified (`WORKPLAN.md` §0.5) but for Stage 3.4's actual canvas scene; a
  handful of draggable polygon corners doesn't need a retained-canvas
  renderer, and adopting Konva here would hand 3.4 both the library and
  whatever conventions this editor happened to establish for it, instead of
  letting 3.4 design against its own requirements. The ADR also records the
  drag math's coordinate-conversion trick (a fixed, component-known
  pixel-per-centimetre ratio via the SVG's own `viewBox` scaling, needing no
  `getBoundingClientRect`/`getScreenCTM` call — both are awkward-to-nonexistent
  under the jsdom test environment).
  Stage 3.3 adds the **plant palette** (`app/src/palette/`) — `DESIGN.md` §1
  step 2 of the core loop. `PlantPalette.tsx` reads `usePlantList()` and the
  plot store's `conditionsInput` directly (no props passed down from
  `PlotDefinitionPage`), resolves the latter via `resolvePlotConditions`
  defensively (falling back to an inline alert rather than throwing, mirroring
  `PlotConditionsForm`'s own pattern), and ranks the result with `rankPlants`.
  Because both the palette and the plot form read the same Zustand store, the
  palette re-ranks live the moment either the light level or any other
  condition changes — no event wiring beyond the shared store subscription.
  `filters.ts` holds the palette's own pure logic (search-text and category
  matching), kept separate from the component for the same reason
  `plot/outline-ops.ts` is: testable with plain data, no rendering involved.
  Search and category are **display-only** narrowings applied after
  `rankPlants` has already scored and ordered the list; a third control, a
  "hide unsuitable crops" checkbox, instead maps onto `rankPlants`' own
  `excludeUnsuitable` option and actually changes what got ranked in. Every
  rendered entry shows the engine's own `summary`, `confidence`, and
  per-dimension `reason` strings verbatim — never a bare score — because
  `rankPlants`' own documentation warns that most of today's shipped dataset
  carries no hardiness/soil/season data, so a lone percentage would read as
  more certain than the model actually is.
  **The layout call the brief asked this stage to make explicitly:** the
  palette renders _on the plot-definition page_, directly below the
  growing-conditions form, rather than behind a second route/nav link. This
  is recorded here rather than as an ADR because the reasoning follows
  directly from ground already staked out in `DESIGN.md` (§1's "describe →
  discover → arrange → validate" is framed as one continuous loop, not four
  navigations) and restated in the Stage 3.3 brief itself — there was no real
  second option once Stage 3.4 is considered: that stage's canvas needs the
  palette visible _alongside_ placement (drag a plant from the palette onto
  the plot) rather than a click away, so introducing a nav boundary now would
  only have to be undone next stage.
  Stage 3.4 ([`adr/0017`](./adr/0017-plot-canvas-konva-and-dnd-kit.md)) adds the
  **plot canvas** (`app/src/canvas/`) — `DESIGN.md`'s signature interaction and
  the app's first real `react-konva` work (ADR 0016 deferred it here on
  purpose). `PlotCanvas.tsx` renders the current `PlotRegion` as a Konva
  `<Line>` and every placed plant as a `<Group>` (a coloured `<Circle>` plus
  its initial letter — no icon set yet, Stage 4.1/4.2's job) that is
  selectable, Konva-draggable (moves update the placements store directly —
  no dnd-kit involved once a plant is on the canvas, see the ADR for why),
  and removable by double-click, Delete/Backspace, or a toolbar button
  (`PlotCanvasSection.tsx`). `state/placements-store.ts` is the new
  per-concern store (ADR 0015's convention) holding what's placed —
  `{ id, plant, x, y }` in the region's own centimetre frame. The
  palette→canvas handoff is dnd-kit's job: every `PlantPalette.tsx` entry is
  now a `useDraggable` source (carrying its `Plant` as drag data), the
  canvas's container is a single `useDroppable` target, and
  `PlotDefinitionPage.tsx` owns the shared `DndContext` and drop handler
  (`canvas/useCanvasDropHandler.ts`, over the pure `canvas/drop.ts`) since
  that's the one place both features are already composed. Coordinate
  conversion (`canvas/geometry.ts`) reuses `PlotOutlineEditor`'s ADR-0016
  fixed-scale trick (the canvas's pixel size is set to exactly
  `(region bounds + padding) × a scale it picks itself`, so pixel↔centimetre
  conversion is pure arithmetic, no `getBoundingClientRect` involved) with its
  own scale rather than reusing the outline editor's literal constant. Live
  density/count feedback (`canvas/feedback.ts`, rendered by
  `canvas/PlacementFeedbackPanel.tsx`) calls `fitPlant` per distinct placed
  crop and shows its `summary` sentence verbatim plus a placed-vs-fits tally —
  never re-deriving a count or judging whether a placement is "too many": that
  judgement is explicitly Stage 3.5's job. The ADR is worth reading for the
  test-strategy call: `PlotCanvas.tsx` itself has no component test (a Konva
  `<Stage>` renders to a `<canvas>` jsdom can't back or query, and — new
  wrinkle this stage hit — `konva`'s Node build crashes on import without the
  native `canvas` package, worked around by a global `vi.mock('react-konva',
...)` in `app/src/test/setup.ts` so pages _containing_ the canvas still
  render in tests); every pure piece it's built on (`placements-store.ts`,
  `geometry.ts`, `drop.ts`, `feedback.ts`) is unit- or component-tested
  directly, and the real drag-and-drop gesture is covered by a Playwright E2E
  journey (`app/e2e/plot-canvas.spec.ts`) using genuine pointer events rather
  than Playwright's native-HTML5 `dragAndDrop()` helper (which dnd-kit's
  `PointerSensor` doesn't listen for).
  Stage 3.5 ([`adr/0018`](./adr/0018-placement-derivation-for-warnings.md))
  adds the **warnings overlay & companion suggestions** (`app/src/warnings/`)
  — `DESIGN.md`'s last core-loop step, "validate continuously", closing
  describe → discover → arrange → validate. The stage's real work, before any
  UI: `evaluatePlot`'s `CropPlacement` (a bed — plant, region, count) doesn't
  match Stage 3.4's point placements (`{ id, plant, x, y }`), and the two
  warning rules that use it want the coercion done differently.
  `placement-derivation.ts` resolves this with **two derivations**, chosen by
  rule family: `deriveOvercrowdingPlacements` groups placements by plant id
  with `region` = the whole plot (reusing `canvas/feedback.ts`'s
  `computePlacementTally` grouping directly, extended with a
  `representativePlacementId` field) for `overcrowdingWarning` and
  `companionSuggestions`; `derivePerInstancePlacements` gives every placed
  instance its own small footprint region (sized from the crop's own
  `resolveLatticeSpacing`) for `suitabilityWarningsFor` and
  `antagonistWarnings`, which need real per-instance geometry to mean
  anything. `evaluate-canvas.ts`'s `evaluateCanvasWarnings` calls the four
  engine rule functions directly rather than `evaluatePlot` itself (each
  against the one derivation it actually needs) and indexes every resulting
  `Warning` by placement id — broadening an `overcrowded` warning to _every_
  current instance of the overcrowded crop, not just the one representative
  placement its `subjects` names, so every marker of an overcrowded bed shows
  the badge. `PlotCanvas.tsx` gained a `severityByPlacementId` prop and draws
  a small severity-coloured badge on any marker present in it — no new
  warning logic in the Konva scene itself, following ADR 0017's "keep
  `PlotCanvas.tsx` thin" precedent; `severity.ts` holds the pure
  severity-ranking and severity→colour logic instead. `WarningsPanel.tsx` (a
  plain-DOM, component-tested "4. Check for problems" list of every warning
  and companion suggestion, evidence tags and all) and `WarningsSection.tsx`
  (its store-wiring wrapper) are new; `PlotDefinitionPage.tsx` computes
  `useCanvasWarnings` once and threads the result to both it and
  `PlotCanvasSection`, so the five rules run once per render rather than once
  per consumer. The E2E journey (`app/e2e/warnings-overlay.spec.ts`) places a
  real shipped antagonist pair (potato/tomato, the dataset's one
  `well-supported` link) close together, confirms the warning, then drags one
  away and confirms it clears.
  Stage 3.6 adds **user-defined crops** (`app/src/user-crops/`) —
  `DESIGN.md`'s "beyond the core loop" capability, not a fifth numbered
  core-loop step, so `UserCropsSection.tsx` renders unnumbered between the
  palette and the canvas on `PlotDefinitionPage.tsx` rather than claiming a
  "5." heading. `AddCropForm.tsx` collects exactly what
  `UserPlantInputSchema` accepts (Stage 0.3, ADR 0011) — `commonName`,
  `category`, `light`, a row-vs-intensive spacing toggle for `SpacingSchema`,
  plus optional hardiness/soil/season fields — and validates on submit with
  `safeValidateUserPlantInput`, bucketing the returned `ZodError`'s
  `issues[].path` by top-level field and rendering each bucket next to the
  fieldset it concerns, mirroring `PlotConditionsForm.tsx`'s own inline-error
  pattern (Stage 3.2) rather than one generic banner. **The id-collision
  check is separate from schema validation**: a schema-valid input can still
  mint an id (`userPlantIdFromName`) that collides with a crop already in the
  session (two packets, one name); the form checks the derived id against
  `useUserPlantsStore()`'s current keys after validation succeeds and blocks
  submission with a message until the user renames the crop or fills in the
  `UserPlantInputSchema.id` escape hatch. `UserCropsSection.tsx` is the thin
  store-wiring wrapper (mirroring `warnings/WarningsSection.tsx`'s own split
  from `WarningsPanel.tsx`): it hands `AddCropForm` the store's current ids
  and `addUserPlant`, and renders a "Your added crops" list with edit/remove
  buttons gated on `isUserPlant(plant)` — re-opening the form pre-filled
  (`plant-to-input.ts`'s `plantToUserPlantInput`, the inverse of the engine's
  own upcast) and re-submitting with the same id, which
  `useUserPlantsStore().addUserPlant` already replaces by id. **No new
  palette or canvas code was needed** — confirmed with a dedicated E2E
  journey (`app/e2e/add-custom-crop.spec.ts`) rather than assumed, per the
  brief's own caution — because both already consume `usePlantList()`'s
  shipped-∪-user overlay with no origin-awareness (Stage 3.1), exactly as
  ADR 0011 designed.

  **The icon-picker scoping decision (this stage's one open call).**
  `WORKPLAN.md`'s dependency map names Stage 4.1 (the bundled SVG icon set)
  as one of Stage 3.6's dependencies, and the Stage 3.6 workplan entry
  describes an icon picker "constrained to the bundled SVG set". At the time
  this stage ran, **Phase 4 had not started** (no Phase 4 rows existed in the
  Progress table) — there was no bundled set to constrain a picker to. Rather
  than block the whole stage on Stage 4.1, or invent icon assets outside this
  stage's mandate, the form simply leaves `UserPlantInputSchema.icon` unset
  for every user crop, falling back to whatever generic per-category
  rendering the palette and canvas already use for _any_ crop (both render a
  coloured circle plus an initial letter today — Stage 3.4's own note that
  no icon set exists yet, "Stage 4.1/4.2's job"). This is recorded here
  rather than as an ADR because, once Stage 4.1's status is checked (which
  the brief made a hard requirement, not a judgment call), there is no real
  second option: building a picker with nothing to pick from would mean
  either inventing throwaway icon assets outside this stage's scope or
  blocking Stage 3.6 entirely on a phase that hasn't started, and the crop's
  own value — scored, ranked, placed, counted like any shipped crop — never
  depended on having an icon in the first place. A real picker constrained to
  the bundled set is Stage 4.1 (icon creation) plus Stage 4.2's (wiring)
  natural follow-up once both exist; nothing about today's schema or store
  needs to change for that later picker to slot in, since `icon` was already
  an optional `SlugSchema` key on `UserPlantInputSchema` from Stage 0.3.

  Stage 4.1 fills the gap the paragraph above left open: the **bundled SVG
  icon set** (`app/src/icons/`, the first stage in Phase 4 — Content &
  assets). One crop icon per `data/plants.json` id — 162 at the time, 144
  after Stage 6.0's crop-list curation — plus one generic
  fallback, all generated — not hand-drawn — from a small reusable shape
  library (`tools/icons/archetypes.ts`, ~19 archetypes such as `leaf`,
  `rootLong`, `bulbAllium`, `pod`, `roundFruit`) composed with a category fill
  colour (vegetable/fruit/herb) and one shared ink stroke, via
  `tools/icons/classification.ts`'s explicit crop-id → archetype map and
  `tools/icons/generate.ts` (a developer-only script outside the npm
  workspaces, run with `node --experimental-strip-types tools/icons/generate.ts`,
  mirroring `packages/etl`'s own build-time-tool convention). The generator
  hard-fails if the classification map and `data/plants.json` disagree about
  which ids exist — the same "no silent gap" posture as the ETL's dataset
  gate, applied to keeping the icon files in lockstep with the dataset records.
  Every icon is SVGO-optimized; the whole set is ~112 KB today (145 files, ~794
  bytes average), well inside the budget `app/src/icons/budget.test.ts`
  enforces on every test run. The interface Stage 4.2 will call is
  `resolveIcon(plant): IconAsset` (`app/src/icons/resolveIcon.ts`, exported
  from `app/src/icons/index.ts`): resolves `plant.icon ?? plant.id` against
  the bundled set (via `import.meta.glob`, not a hand-maintained import list),
  falling back to the generic icon — which is exactly what every shipped crop
  (no `icon` set yet) and every user-defined crop (Stage 3.6 never sets one
  either) does today, respectively via its `id` and via the fallback. See
  [`docs/icon-style-guide.md`](./icon-style-guide.md) for the visual
  conventions and how to add or replace an icon, and
  [`adr/0019`](./adr/0019-icon-set-archetypes-and-resolution.md) for why this
  approach was chosen over hand-illustrating a whole catalogue of crops.

  Stage 4.2 ([`stage-4.2-brief.md`](./stage-4.2-brief.md)) adds the **wiring of
  icons into the palette and canvas** (`app/src/palette/PlantPalette.tsx`,
  `app/src/canvas/PlotCanvas.tsx`): the `resolveIcon` interface from Stage 4.1
  is now consumed throughout. `PlantPalette.tsx` renders each entry's resolved
  icon as an `<img>` next to its name and score. `PlotCanvas.tsx` keeps the
  coloured category background circle (rendering immediately for instant visual
  feedback) and layers the resolved icon on top once loaded via a custom
  `useIconImage` hook that wraps image loading in React (`app/src/icons/useIconImage.ts`).
  The fallback icon (for user-defined crops and any future crop before its icon ships)
  renders the same way as any other — no warning UI, since `isFallback` is an expected,
  common case. Component tests cover both resolved and fallback cases; E2E
  verification confirms every placed dataset plant renders an icon or the defined fallback.

  Stage 3.7 ([`adr/0020`](./adr/0020-plot-export-canvas-compositing.md)) adds
  **plot-image export** (`app/src/canvas/export.ts`, an "Export image" button
  in `PlotCanvasSection.tsx`): the user downloads a PNG of the finished plot —
  the rasterised Konva scene plus a legend naming every placed crop and the
  plot's resolved conditions (light, soil texture if known, location, hardiness
  band). Konva's `stage.toCanvas({ pixelRatio: 2 })` rasterises the plot itself;
  the legend is composited beside it with the plain 2D Canvas API rather than a
  Konva `Group`, specifically so `export.ts` only needs `konva`'s _types_, never
  its runtime — importing the real package at module scope is what
  `app/src/test/setup.ts` already documents as crashing under Vitest (ADR 0017).
  `PlotCanvas.tsx` gained one small addition to make this possible: an optional
  `stageRef` prop forwarded onto react-konva's `<Stage>`, so `PlotCanvasSection.tsx`
  can hand the mounted `Konva.Stage` to the export pipeline without `PlotCanvas.tsx`
  knowing anything about exporting. The export awaits `document.fonts.ready` and
  every visible icon `<Image>`'s load before rasterising — both documented gotchas
  in `docs/stage-3.7-brief.md` — then triggers a browser download (chosen over
  opening a new tab, per the brief's own recommendation). A terminal picture, not
  a re-loadable save: no serialisation or persistence subsystem was needed. The
  legend builder is unit-tested directly; the button's wiring is component-tested
  with the real pipeline mocked out; the full rasterise-and-download flow is
  covered by `app/e2e/plot-export.spec.ts`, the only place it actually runs.

## Stage 5.1 — PWA / offline support

Stage 5.1 ([`adr/0022`](./adr/0022-pwa-offline-support.md)) turns "the app has
no runtime network calls" (true since Stage 3.1) into "the app is actually
installable and works with the network off" — a service worker and web app
manifest, generated by `vite-plugin-pwa` (`app/vite.config.ts`), rather than a
hand-rolled service worker: the default `generateSW` Workbox strategy
precaches the whole build output, which is all this app's offline requirement
needs (no runtime API to route network-first/cache-first, unlike a typical
`injectManifest` use case). Two things were confirmed rather than assumed,
per the Stage 5.1 brief's own steer:

- **The dataset and icon set are covered "for free."** Building the app and
  inspecting `dist/` shows the bundled dataset
  (`app/src/dataset/shipped-plants.ts`, a build-time JSON import) compiles
  straight into the one JS bundle, and every crop icon
  (`app/src/icons/resolveIcon.ts`) is small enough to fall under Vite's
  default asset-inlining threshold too — so `dist/` today has no separate
  crop-icon files a service worker could miss. `workbox.globPatterns` is
  still widened from the plugin's default (`**/*.{js,wasm,css,html}`) to add
  `svg` and `webmanifest`, as a safety net for the two new manifest icon
  files and for if a future icon set ever grows past that inline threshold —
  not because today's build needs it. See the ADR for exactly what was
  inspected.
- **`clientsClaim`/`skipWaiting`** make a newly-installed service worker
  activate and take control of the page immediately, rather than needing a
  second manual reload — the classic "service worker doesn't control the
  page that installed it" gotcha, solved by config rather than by the E2E
  test working around it.

Two new manifest icons (`app/public/pwa-icon.svg`, `app/public/maskable-icon.svg`)
reuse the existing fallback icon's twin-leaf glyph
(`app/src/icons/generic.svg`) recoloured onto a solid background, rather than
commissioning new art or adding an image-rasterisation dependency for PNGs —
plain SVG, consistent with the rest of the icon set. `app/e2e/offline.spec.ts`
is the explicit offline test `WORKPLAN.md` §1.3 has required since the
verification strategy was written: it loads the app online (so the service
worker installs), confirms `navigator.serviceWorker.controller` is set, then
goes offline (`context.setOffline(true)`) and re-runs the core
plot-canvas journey (search → drag a crop onto the canvas → see count
feedback) entirely without a network. A locally-runnable Lighthouse PWA audit
command is recorded in the root `README.md` (today's score: see that section
— the current `lighthouse` npm package has actually removed the scored PWA
category entirely, so the documented command pins an older major version
that still has it, with the gap this causes explained inline).

## Stage 5.2 — GitHub Pages deployment

Stage 5.2 ([`adr/0024`](./adr/0024-github-pages-manual-deploy.md)) turns the
already-static, already-offline-capable build into an actually-hosted one —
without adding automation `WORKPLAN.md` §1.4 defers to Stage 6.4. Three
pieces:

- **The deploy command**: a root `deploy` script
  (`GITHUB_PAGES=true npm run build -w app && gh-pages -d app/dist`) using
  the `gh-pages` npm package to publish `app/dist` to the `gh-pages` branch.
  No app code changed — `app/vite.config.ts`'s `base` env-gating (Stage 0.1,
  extended for the PWA manifest in Stage 5.1) was already correct, confirmed
  again by building with the flag and inspecting `dist/index.html` and
  `dist/manifest.webmanifest` by hand.
- **The one-time manual prerequisite**: enabling Pages itself
  (Settings → Pages → source branch) needs repo-admin access no automated
  session has — documented as a manual step in the root `README.md`, not
  attempted here.
- **A post-deploy smoke check**: a second Playwright config
  (`app/playwright.pages.config.ts`) and spec (`app/e2e/deployed-smoke.spec.ts`)
  pointed at the live URL, run via `npm run smoke:deployed` — deliberately
  excluded from `npm run e2e`/`verify` so those stay free of any network
  dependency beyond `localhost`.

Whether an actual deploy has been completed and verified live is recorded
honestly in the README's "Deployment" section rather than assumed — see the
ADR's "What could and couldn't be verified" section for exactly what a
sandboxed session could and couldn't do here (builds and local checks: yes;
an actual `gh-pages` push or a request to the live Pages URL: no).

## Why a monorepo with these boundaries

Keeping `engine` and `etl` free of any UI-framework dependency means the
horticultural logic and the data pipeline can each be tested and reasoned about
on their own, and the "build-time vs run-time" split is enforced by the package
boundaries rather than by discipline alone. See `adr/0003`.

## Phases 1–4 complete

Four capabilities were added to the plan after Phase 1's original scope: the
curated dataset input (Stage 1.7), user-defined crops (Stage 3.6), the icon
set plus wiring (Stages 4.1–4.2), and plot-image export (Stage 3.7). All four
are now built, closing out Phases 1–4 in full. Phase 5 (offline & deployment)
is complete too: Stage 5.1 (above) adds PWA/offline support, and Stage 5.2
adds a manual GitHub Pages deploy path (`gh-pages`, a root `deploy` script, a
post-deploy Playwright smoke check against the live URL — see
[ADR 0024](./adr/0024-github-pages-manual-deploy.md) and the README's
"Deployment" section; deliberately no `.github/workflows/`, per
`WORKPLAN.md` §1.4). Phase 6 (community readiness) is now under way — see the
Stage 6.0 section below; `WORKPLAN.md`'s Progress table and dependency map
cover what remains.

## Stage 6.0 — the crop list itself

The data gaps Stage 6.0 set out to close were never in the engine, and only
half of them were in the _fields_. The soil-moisture half landed first
(`packages/etl/src/moisture/`, giving 72 crops a moisture preference); this
stage did the other half, which is the **crop list**.

Two changes, both curation against the settled schema — no engine, schema or
scoring change:

- **Six British staples added** through the Stage 1.7 curated channel
  (`packages/etl/src/curated/plants.ts`): `apple`, `pear`, `raspberry`,
  `brussels-sprouts`, `swede`, `pumpkin`. Each carries RHS-cited spacing,
  hardiness, soil and season data, so each is a record the suitability engine
  can score on all four dimensions rather than one.
- **Twenty-four crops removed** — the ones that cannot be grown outdoors in
  Britain (dragon fruit, papaya, pineapple, citrus, lemongrass, okra, peanut,
  the melons, and others). They live on as data, not as a deleted commit:
  `packages/etl/src/exclusions/` records each id, the ground it fails on
  (`too-tender` or `wont-ripen`), and a sentence of reasoning. The merge drops
  them before anything joins onto them, so the nine companion links that
  pointed at an excluded crop were dropped by the existing referential-integrity
  machinery with a stated reason, not hand-edited out.

[ADR 0025](./adr/0025-uk-outdoor-crop-exclusions.md) records the decision the
workplan left open — **delete rather than flag** — and its reasoning: flagging
would need a new field on the keystone schema, a new scoring rule, new UI and a
location model to be relative to, against an undo (Stage 3.6's in-app add-crop
form) the app already ships.

The dataset goes from 162 crops to **144**, and every pinned coverage number
moved with it: light 144/144 (133 full-sun, 11 partial-shade), soil 80/144,
hardiness and seasons 8/144, companion links 76 across 50 records. Those pins
live in `packages/engine/src/{suitability,spacing,warnings}/dataset.test.ts` and
were re-pinned to the new real figures — a failure there is how a crop-list
change proves it reached the engine. What this stage deliberately did **not** do
is close the hardiness/season gap (still 8/144, and a new source's job, not
curation's) or prune cultivar padding (four onions, seven squashes, six peppers
— all of which grow here perfectly well).

## Stage 6.2 — accessibility & responsive polish

Three passes, each landing on a finding rather than confirming an
assumption — full writeup in [`docs/accessibility.md`](./accessibility.md),
reasoning in ADR
[0026](./adr/0026-keyboard-placement-and-severity-glyphs.md).

**Keyboard-operable placement.** `dnd-kit`'s `KeyboardSensor` really is
present for free (§0.5's promise held) and lets a focused palette entry be
picked up and nudged in raw screen pixels — but that's impractical as the
_primary_ keyboard path across a page-length distance with no defined target
position. So every palette entry (`app/src/palette/PlantPalette.tsx`) also
gets an "Add to plot" button (places at the plot's centre, selects it, no
drag math at all), and the canvas (`app/src/canvas/PlotCanvas.tsx`,
`PlotCanvasSection.tsx`) gains arrow-key nudging plus Previous/Next-placement
buttons, since Konva markers aren't independently focusable DOM elements.

**Colour-contrast and ARIA, audited rather than assumed.** Two colour values
genuinely failed WCAG AA's 4.5:1 (darkened one hue-step each, measured not
eyeballed); the canvas's severity badges were genuinely colour-only (fixed
with a per-severity glyph). Running the axe check this stage adds found a
real bug neither of those two targeted audits would have: `aria-label` on
elements with no ARIA role (the canvas container, the outline editor's
corner handles) — `aria-prohibited-attr`, fixed with `role="group"`/
`role="button"`.

**Responsive layout, the actual cause fixed.** `docs/review-pre-deployment.md`'s
canvas-at-y≈3500px finding traced to the plant palette rendering every
matching crop with **no height limit at all** — an unbounded number that
grows with the dataset. Capping the list to a scrolling `65vh` box is the
structural fix; `overflow-x` containers on the canvas and outline editor
stop a large plot forcing the whole page to scroll horizontally. Verified on
real 390×844 and 320×568 viewports, not by reasoning about CSS.

**Left behind:** a locally-runnable axe check (`npm run a11y`, 0 violations
today) and a scripted keyboard-only walkthrough (`npm run
keyboard-walkthrough`), both recorded honestly in `docs/accessibility.md` —
including the gaps that remain (the free-form outline-corner editor stays
pointer-only; no real screen-reader testing yet).

## Where to look next

| Topic                                                             | File                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Concept, data-source assessment, licensing rationale              | [`DESIGN.md`](../DESIGN.md)                                                   |
| Staged build plan, per-stage models, verification                 | [`WORKPLAN.md`](../WORKPLAN.md)                                               |
| Specific decisions and their alternatives                         | [`adr/`](./adr/)                                                              |
| The plant-record schema (types + validation)                      | `packages/engine/src/schema/`                                                 |
| User-crop input schema and its upcast to a `Plant`                | `packages/engine/src/schema/user-plant.ts`                                    |
| Location/climate static data and `resolveClimate`                 | `packages/engine/src/climate/`                                                |
| Suitability scoring, its reasoning, and `rankPlants`              | `packages/engine/src/suitability/`                                            |
| The plot-region polygon, packing geometry, `fitPlant`             | `packages/engine/src/spacing/`                                                |
| Warnings, companion suggestions, `evaluatePlot`                   | `packages/engine/src/warnings/`                                               |
| App shell, routing, GitHub Pages basename                         | `app/src/routes/`                                                             |
| Dataset-loading layer (loads + validates the shipped list)        | `app/src/dataset/shipped-plants.ts`                                           |
| The user-plant overlay store and merged `usePlantList`            | `app/src/state/`                                                              |
| The plot-definition page, shape picker, outline editor            | `app/src/plot/`                                                               |
| The plot store (current region + conditions input)                | `app/src/state/plot-store.ts`                                                 |
| The ranked/searchable/filterable plant palette                    | `app/src/palette/`                                                            |
| The drag-and-drop plot canvas (Konva scene + dnd-kit handoff)     | `app/src/canvas/`                                                             |
| The placements store (what's placed on the canvas)                | `app/src/state/placements-store.ts`                                           |
| The drag-and-drop E2E journey                                     | `app/e2e/plot-canvas.spec.ts`                                                 |
| The warnings overlay, companion suggestions, placement derivation | `app/src/warnings/`                                                           |
| The warnings-overlay E2E journey                                  | `app/e2e/warnings-overlay.spec.ts`                                            |
| The add-crop form, id-collision check, edit/remove                | `app/src/user-crops/`                                                         |
| The add-custom-crop E2E journey                                   | `app/e2e/add-custom-crop.spec.ts`                                             |
| The icon set, `resolveIcon`, and its style guide                  | `app/src/icons/`, [`docs/icon-style-guide.md`](./icon-style-guide.md)         |
| The icon generator (developer tool, not shipped)                  | `tools/icons/`                                                                |
| The plot-image export pipeline and legend builder                 | `app/src/canvas/export.ts`                                                    |
| The plot-export E2E journey                                       | `app/e2e/plot-export.spec.ts`                                                 |
| The ETL pipeline shell, GBIF resolver, adding a source            | `packages/etl/README.md`                                                      |
| The hand-verified spacing table (curation, not ingest)            | `packages/etl/src/spacing/`                                                   |
| Evidence-tagged companion/antagonist data                         | `packages/etl/src/companions/`                                                |
| Maintainer-curated full-plant input                               | `packages/etl/src/curated/`                                                   |
| The UK-outdoor exclusion list (which crops are pruned, and why)   | `packages/etl/src/exclusions/`                                                |
| The Stage 1.5 merge, validation gate, and artifact                | `packages/etl/src/merge/`                                                     |
| The committed dataset artifact and its caveats                    | `data/README.md`                                                              |
| Service worker + manifest config (`VitePWA`)                      | `app/vite.config.ts`                                                          |
| Manifest icons (`any` + maskable)                                 | `app/public/pwa-icon.svg`, `app/public/maskable-icon.svg`                     |
| The offline E2E journey                                           | `app/e2e/offline.spec.ts`                                                     |
| Lighthouse PWA audit command and today's recorded score           | root `README.md`                                                              |
| Accessibility writeup, contrast/ARIA findings, responsive fix     | [`docs/accessibility.md`](./accessibility.md)                                 |
| The axe check (locally-runnable, today's result recorded)         | `app/e2e/a11y.spec.ts`, root `README.md`                                      |
| The keyboard-only walkthrough script and its recorded findings    | `app/keyboard-walkthrough.mjs`, [`docs/accessibility.md`](./accessibility.md) |
| The "Skip to plot canvas" link                                    | `app/src/plot/SkipToCanvasLink.tsx`                                           |
