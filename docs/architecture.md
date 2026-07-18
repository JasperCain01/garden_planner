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
  Permapeople, the OpenFarm dump, GBIF, etc., and writes the static dataset. The
  deployed app never calls those sources — which is what makes it offline-safe.
  As of Stage 1.1 (`packages/etl/README.md`, [`adr/0005`](./adr/0005-gbif-name-resolver.md))
  it has a runnable pipeline shell, a documented `SourceAdapter` extension
  point that Stage 1.2's PFAF/OpenFarm/Permapeople adapters implement, and a
  GBIF scientific-name resolver that fills the schema's `gbifId` — the join
  key the eventual merge step (Stage 1.5) reconciles records by. The resolver
  is offline-first: its answers are cached to a committed JSON file
  (`packages/etl/cache/`), so a second run — and CI, and an offline
  contributor — needs no network for a name it has already resolved.
- **`/data`** is that committed static artifact: the plant "database" as a file
  the browser loads directly. No database server exists at runtime.
- **`packages/engine`** is pure, framework-free logic (suitability scoring,
  spacing/density, warnings). It runs in the browser but has no UI dependency, so
  it is unit-testable in isolation. It also hosts the **canonical plant-record
  schema** (`packages/engine/src/schema/`, Stage 0.2): zod is the single source of
  truth and the TypeScript types are `z.infer`-derived from it, so the ETL, the
  engine, and the UI all validate and type against one shape. See
  [`adr/0004`](./adr/0004-plant-schema.md), especially the method-aware spacing.
- **`app`** is the React + Vite front-end — the only thing deployed. It loads the
  dataset, calls the engine, and renders the drag-and-drop UI.

## Why a monorepo with these boundaries

Keeping `engine` and `etl` free of any UI-framework dependency means the
horticultural logic and the data pipeline can each be tested and reasoned about
on their own, and the "build-time vs run-time" split is enforced by the package
boundaries rather than by discipline alone. See `adr/0003`.

## Where to look next

| Topic                                                  | File                            |
| ------------------------------------------------------ | ------------------------------- |
| Concept, data-source assessment, licensing rationale   | [`DESIGN.md`](../DESIGN.md)     |
| Staged build plan, per-stage models, verification      | [`WORKPLAN.md`](../WORKPLAN.md) |
| Specific decisions and their alternatives              | [`adr/`](./adr/)                |
| The plant-record schema (types + validation)           | `packages/engine/src/schema/`   |
| The ETL pipeline shell, GBIF resolver, adding a source | `packages/etl/README.md`        |
