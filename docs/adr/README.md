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
- [0019 — Icon set: programmatic archetypes instead of 160 bespoke illustrations, and the icon-resolution rule](./0019-icon-set-archetypes-and-resolution.md)
- [0020 — Plot export: 2D-canvas legend compositing instead of a Konva `Group`, and how the stage ref reaches it](./0020-plot-export-canvas-compositing.md)
- [0021 — Curated full-plant input: shape, join-order placement, and the "curated wins" conflict rule](./0021-curated-plant-input.md)
- [0022 — PWA / offline support: `vite-plugin-pwa`, `generateSW`, and confirming the "free" precache](./0022-pwa-offline-support.md)
- [0023 — Relicense the dataset to CC0-1.0](./0023-dataset-licence-cc0.md)
- [0024 — GitHub Pages deployment: `gh-pages`, script placement, and a manual post-deploy smoke check](./0024-github-pages-manual-deploy.md)
- [0025 — Pruning the crop list: delete the crops Britain can't grow, keep the reasoning](./0025-uk-outdoor-crop-exclusions.md)
- [0026 — Keyboard placement without pixel-drag, and severity glyphs alongside colour](./0026-keyboard-placement-and-severity-glyphs.md)
- [0027 — CI: what the checks workflow runs, and which checks gate a merge](./0027-ci-checks-workflow-and-blocking-policy.md)
- [0028 — Deploy-on-merge: the constraint lifted, and we still didn't automate it](./0028-deploy-on-merge-not-automated.md)
- [0029 — The design system: CSS custom properties + CSS Modules, and one self-hosted font](./0029-design-tokens-css-modules-and-self-hosted-font.md)
- [0030 — The app is a workspace, not a document](./0030-workspace-layout-not-a-document.md)
- [0031 — The canvas as hero: a live scale, footprint-true markers, and one picture of the plot](./0031-canvas-as-hero-live-scale-and-one-plot-picture.md)
- [0032 — The palette: compact cards, reasoning on demand, and one element with two gestures](./0032-palette-compact-cards-and-details-on-demand.md)
- [0033 — The settings column: a pinned warnings dock, shape tiles, and segmented conditions](./0033-warnings-dock-shape-tiles-and-segmented-conditions.md)
- [0034 — What a design is: named designs in storage, and one undo history over two stores](./0034-designs-persistence-and-one-history-over-two-stores.md)
- [0035 — Printing the plan, and three nice-to-haves declined with their measurements](./0035-print-the-plan-and-three-declined-nice-to-haves.md)
