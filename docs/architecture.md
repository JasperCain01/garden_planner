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

| Topic                                                      | File                                       |
| ---------------------------------------------------------- | ------------------------------------------ |
| Concept, data-source assessment, licensing rationale       | [`DESIGN.md`](../DESIGN.md)                |
| Staged build plan, per-stage models, verification          | [`WORKPLAN.md`](../WORKPLAN.md)            |
| Specific decisions and their alternatives                  | [`adr/`](./adr/)                           |
| The plant-record schema (types + validation)               | `packages/engine/src/schema/`              |
| User-crop input schema and its upcast to a `Plant`         | `packages/engine/src/schema/user-plant.ts` |
| Location/climate static data and `resolveClimate`          | `packages/engine/src/climate/`             |
| Suitability scoring, its reasoning, and `rankPlants`       | `packages/engine/src/suitability/`         |
| The plot-region polygon, packing geometry, `fitPlant`      | `packages/engine/src/spacing/`             |
| Warnings, companion suggestions, `evaluatePlot`            | `packages/engine/src/warnings/`            |
| App shell, routing, GitHub Pages basename                  | `app/src/routes/`                          |
| Dataset-loading layer (loads + validates the shipped list) | `app/src/dataset/shipped-plants.ts`        |
| The user-plant overlay store and merged `usePlantList`     | `app/src/state/`                           |
| The ETL pipeline shell, GBIF resolver, adding a source     | `packages/etl/README.md`                   |
| The hand-verified spacing table (curation, not ingest)     | `packages/etl/src/spacing/`                |
| Evidence-tagged companion/antagonist data                  | `packages/etl/src/companions/`             |
| The Stage 1.5 merge, validation gate, and artifact         | `packages/etl/src/merge/`                  |
| The committed dataset artifact and its caveats             | `data/README.md`                           |
