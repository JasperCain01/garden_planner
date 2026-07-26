# Architecture overview

This is a short map of how the pieces fit together. For the _why_, read
[`DESIGN.md`](../DESIGN.md) and the ADRs in [`adr/`](./adr/); for the build
sequence read [`WORKPLAN.md`](../WORKPLAN.md).

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
  exists at runtime. As of Stage 1.5 it holds 160 validated, merged plants; see
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
  is not a blanket `√3/2`, and the **fallback rule**: 151 of the 160 shipped
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

## Why a monorepo with these boundaries

Keeping `engine` and `etl` free of any UI-framework dependency means the
horticultural logic and the data pipeline can each be tested and reasoned about
on their own, and the "build-time vs run-time" split is enforced by the package
boundaries rather than by discipline alone. See `adr/0003`.

## Planned additions (not yet built — see `WORKPLAN.md`)

Three capabilities were added to the plan after Phase 1. They are staged in
`WORKPLAN.md` but not yet implemented, and they shape a few of the boundaries
above:

- **User-defined crops (Stage 3.6; the enabling schema work is done — Stage 0.3,
  [`adr/0011`](./adr/0011-user-defined-crop-schema.md)).** A user who buys seeds can
  add their own crop from the packet (name, spacing, season, light, category) and
  pick a bundled icon for it. The schema side already exists: `UserPlantInputSchema`
  accepts what a packet gives, and `createUserPlant` upcasts it to a full `Plant`
  with synthesised `user-entered` provenance and a `user-`-namespaced id — while
  _shipped_ data stays fully attributed, because the base schema and the ETL gate
  were left strict. What remains for 3.6 is the form and the icon picker; the state
  wiring landed in Stage 3.1 (`app/src/state/user-plants-store.ts`,
  [`adr/0015`](./adr/0015-app-state-management.md)). That upcast is also why the
  app's runtime plant list (Stage 3.1) is
  **the shipped dataset plus an in-memory, session-scoped overlay of user crops** —
  every entry is a valid `Plant`, so the engine consumes the merged list and is
  indifferent to a plant's origin, and user crops carry no companion links so the
  merged list has nothing to dangle. User crops live for the session only; there is
  no reload-persistence layer.
- **Maintainer-authored crops in the dataset (Stage 1.7).** A curated
  full-`Plant` input feeding the same Stage 1.5 merge and hard-fail gate, so the
  shipped crop list can grow by hand without a new external source. Distinct from
  user crops: these are permanent, fully attributed, and go through the build.
- **Plot-image export (Stage 3.7).** The user can export a PNG of their finished
  plot plus a legend of chosen crops and the soil/climate settings, via the canvas
  library's own image export. A terminal picture, not a re-loadable save — which
  is precisely why no plan-serialisation or persistence subsystem is needed. The
  self-owned, same-origin icon set (Stage 4.1) is what keeps the export canvas
  untainted and the feature possible.

## Where to look next

| Topic                                                             | File                                       |
| ----------------------------------------------------------------- | ------------------------------------------ |
| Concept, data-source assessment, licensing rationale              | [`DESIGN.md`](../DESIGN.md)                |
| Staged build plan, per-stage models, verification                 | [`WORKPLAN.md`](../WORKPLAN.md)            |
| Specific decisions and their alternatives                         | [`adr/`](./adr/)                           |
| The plant-record schema (types + validation)                      | `packages/engine/src/schema/`              |
| User-crop input schema and its upcast to a `Plant`                | `packages/engine/src/schema/user-plant.ts` |
| Location/climate static data and `resolveClimate`                 | `packages/engine/src/climate/`             |
| Suitability scoring, its reasoning, and `rankPlants`              | `packages/engine/src/suitability/`         |
| The plot-region polygon, packing geometry, `fitPlant`             | `packages/engine/src/spacing/`             |
| Warnings, companion suggestions, `evaluatePlot`                   | `packages/engine/src/warnings/`            |
| App shell, routing, GitHub Pages basename                         | `app/src/routes/`                          |
| Dataset-loading layer (loads + validates the shipped list)        | `app/src/dataset/shipped-plants.ts`        |
| The user-plant overlay store and merged `usePlantList`            | `app/src/state/`                           |
| The plot-definition page, shape picker, outline editor            | `app/src/plot/`                            |
| The plot store (current region + conditions input)                | `app/src/state/plot-store.ts`              |
| The ranked/searchable/filterable plant palette                    | `app/src/palette/`                         |
| The drag-and-drop plot canvas (Konva scene + dnd-kit handoff)     | `app/src/canvas/`                          |
| The placements store (what's placed on the canvas)                | `app/src/state/placements-store.ts`        |
| The drag-and-drop E2E journey                                     | `app/e2e/plot-canvas.spec.ts`              |
| The warnings overlay, companion suggestions, placement derivation | `app/src/warnings/`                        |
| The warnings-overlay E2E journey                                  | `app/e2e/warnings-overlay.spec.ts`         |
| The ETL pipeline shell, GBIF resolver, adding a source            | `packages/etl/README.md`                   |
| The hand-verified spacing table (curation, not ingest)            | `packages/etl/src/spacing/`                |
| Evidence-tagged companion/antagonist data                         | `packages/etl/src/companions/`             |
| The Stage 1.5 merge, validation gate, and artifact                | `packages/etl/src/merge/`                  |
| The committed dataset artifact and its caveats                    | `data/README.md`                           |
