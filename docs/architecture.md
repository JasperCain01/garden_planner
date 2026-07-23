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
- **`app`** is the React + Vite front-end — the only thing deployed. It loads the
  dataset, calls the engine, and renders the drag-and-drop UI.

## Why a monorepo with these boundaries

Keeping `engine` and `etl` free of any UI-framework dependency means the
horticultural logic and the data pipeline can each be tested and reasoned about
on their own, and the "build-time vs run-time" split is enforced by the package
boundaries rather than by discipline alone. See `adr/0003`.

## Planned additions (not yet built — see `WORKPLAN.md`)

Three capabilities were added to the plan after Phase 1. They are staged in
`WORKPLAN.md` but not yet implemented, and they shape a few of the boundaries
above:

- **User-defined crops (Stage 3.6, enabled by the Stage 0.3 schema amendment).**
  A user who buys seeds can add their own crop from the packet (name, spacing,
  season, light, category) and pick a bundled icon for it. This is why the plant
  schema is being relaxed (Stage 0.3) so `scientificName`/`provenance` are optional
  on the user-authored path while _shipped_ data stays fully attributed, and why
  the app's runtime plant list (Stage 3.1) is **the shipped dataset plus an
  in-memory, session-scoped overlay of user crops** — the engine consumes the
  merged list and is indifferent to a plant's origin. User crops live for the
  session only; there is no reload-persistence layer.
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

| Topic                                                  | File                            |
| ------------------------------------------------------ | ------------------------------- |
| Concept, data-source assessment, licensing rationale   | [`DESIGN.md`](../DESIGN.md)     |
| Staged build plan, per-stage models, verification      | [`WORKPLAN.md`](../WORKPLAN.md) |
| Specific decisions and their alternatives              | [`adr/`](./adr/)                |
| The plant-record schema (types + validation)           | `packages/engine/src/schema/`   |
| Location/climate static data and `resolveClimate`      | `packages/engine/src/climate/`  |
| The ETL pipeline shell, GBIF resolver, adding a source | `packages/etl/README.md`        |
| The hand-verified spacing table (curation, not ingest) | `packages/etl/src/spacing/`     |
| Evidence-tagged companion/antagonist data              | `packages/etl/src/companions/`  |
| The Stage 1.5 merge, validation gate, and artifact     | `packages/etl/src/merge/`       |
| The committed dataset artifact and its caveats         | `data/README.md`                |
