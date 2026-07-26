# Architecture Decision Records (ADRs)

An ADR is a short note capturing a decision that a newcomer might otherwise
question: what we chose, why, what we considered, and what it costs us. They keep
the _reasoning_ next to the code so the project stays understandable as it grows.

## Format

Each ADR is a file named `NNNN-short-title.md` with these sections:

- **Status** — Accepted / Superseded / Proposed.
- **Context** — the situation and forces at play.
- **Decision** — what we're doing.
- **Alternatives considered** — the roads not taken, and why.
- **Consequences** — the trade-offs we accept.

Add a new ADR whenever you make a non-obvious choice (see `CONTRIBUTING.md`).
Never rewrite history: if a decision changes, add a new ADR that supersedes the
old one and mark the old one `Superseded`.

## Index

- [0001 — Tech stack: TypeScript + Vite monorepo](./0001-tech-stack.md)
- [0002 — UI framework: React](./0002-ui-framework-react.md)
- [0003 — Static, client-side architecture](./0003-static-client-side-architecture.md)
- [0004 — Plant-record schema (zod source of truth; method-aware spacing)](./0004-plant-schema.md)
- [0005 — GBIF name resolver: join key, offline cache, and the "add a source" extension point](./0005-gbif-name-resolver.md)
- [0006 — OpenFarm source adapter: why this dataset, and the mapping/caching design](./0006-openfarm-source-adapter.md)
- [0007 — Hand-verified spacing table: shape, sourcing method, and sanity bounds](./0007-hand-verified-spacing.md)
- [0008 — Companion-planting data: evidence tagging, sourcing, and the plant-id universe](./0008-companion-planting-data.md)
- [0009 — Dataset merge: join-key policy, conflict resolution, and licensing finalization](./0009-dataset-merge-and-licensing.md)
- [0010 — Location & climate static data: profile shape, frost-date representation, module home, and the geocoding defer](./0010-location-climate-static-data.md)
- [0011 — User-defined crops: a separate input schema, an upcast, and the `user-` id namespace](./0011-user-defined-crop-schema.md)
- [0012 — Suitability scoring: the weighting model, the missing-data policy, and how reasoning is represented](./0012-suitability-scoring.md)
- [0013 — Spacing / density calculator: the region model, the packing geometry, and the method-fallback rule](./0013-spacing-density-calculator.md)
- [0014 — Warnings & companion suggestions: adjacency on a polygon, the overcrowding test, the missing-data floor, and how evidence is surfaced](./0014-warnings-and-companion-suggestions.md)
- [0015 — App state management: Zustand, and the id-keyed user-plant overlay](./0015-app-state-management.md)
- [0016 — Outline editor: plain SVG + pointer events, not react-konva yet](./0016-outline-editor-svg-not-konva.md)
- [0017 — Plot canvas: react-konva's scene, dnd-kit's handoff, and how (little) it's component-tested](./0017-plot-canvas-konva-and-dnd-kit.md)
- [0018 — Placement derivation for warnings: two shapes for two rule families, not one](./0018-placement-derivation-for-warnings.md)
