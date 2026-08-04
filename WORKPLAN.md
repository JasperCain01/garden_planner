# Garden / Allotment Planner — Build Workplan

This is the staged build plan for the edibles-only garden planner described in
[`DESIGN.md`](./DESIGN.md). Read `DESIGN.md` first — it explains _what_ we're
building and _why_. This document covers _how_ and _in what order_.

The plan is deliberately broken into **small, self-contained stages**. Each
stage is scoped so that a fresh session (with no memory of previous ones) can
pick it up given only: this file, `DESIGN.md`, the repository in its current
state, and the stage's own brief below. Every stage leaves the repository in a
**green, working state** (builds, lints, tests pass) so the next session starts
from solid ground.

---

## Progress

Where the build has got to. **Update this table as part of the stage** — it is
the one place a fresh session can see what already exists without reading the
whole plan, and a stale entry costs the next session more than it saves this
one. A stage counts as ✅ only when it meets the definition of done (§0.3):
green, commented, ADR written, docs updated, and the next brief handed off.

| Stage                                           | Status     | Left behind                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 Repo scaffolding & tooling                  | ✅         | ADRs [0001](./docs/adr/0001-tech-stack.md)–[0003](./docs/adr/0003-static-client-side-architecture.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 0.2 Data schema ⭐                              | ✅         | ADR [0004](./docs/adr/0004-plant-schema.md); `packages/engine/src/schema/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 0.3 Schema amendment: user crops ⭐             | ✅         | ADR [0011](./docs/adr/0011-user-defined-crop-schema.md); `schema/user-plant.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1.1 ETL scaffolding & name resolution           | ✅         | ADR [0005](./docs/adr/0005-gbif-name-resolver.md); GBIF resolver (offline-cached)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1.2 Source adapters                             | ⚠️ partial | ADR [0006](./docs/adr/0006-openfarm-source-adapter.md); **OpenFarm only.** PFAF/Permapeople adapters are **no longer planned** — Stage 6.0 fills the gaps by curation instead, and records why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1.3 Hand-verified spacing table ⭐              | ✅         | ADR [0007](./docs/adr/0007-hand-verified-spacing.md); `packages/etl/src/spacing/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1.4 Companion-planting data                     | ✅         | ADR [0008](./docs/adr/0008-companion-planting-data.md); 85 companion + 6 antagonist links then (8 antagonist links ship today — Stage 1.7 added two; companion links now **76 across 50 records** — Stage 6.0's exclusions dropped 9 that pointed at a removed crop)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1.5 Dataset build, merge & validation ⭐        | ✅         | ADR [0009](./docs/adr/0009-dataset-merge-and-licensing.md); `data/plants.json` (160 crops then; **144 today** — Stage 1.7 added two, Stage 6.0 added six and pruned 24)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1.6 Location & climate static data              | ✅         | ADR [0010](./docs/adr/0010-location-climate-static-data.md); `packages/engine/src/climate/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 1.7 Curated full-plant input                    | ✅         | ADR [0021](./docs/adr/0021-curated-plant-input.md); `packages/etl/src/curated/` (`broad-bean`, `jerusalem-artichoke`, and Stage 6.0's six British staples); the channel every hardiness/season record in the dataset comes through                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1.8 Curated soil-moisture table                 | ✅         | `packages/etl/src/moisture/`; 72 crops gained `soil.moisture` — the engine's second working dimension; soil coverage is 80/144 today (see Stage 6.0)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2.1 Suitability scoring engine ⭐               | ✅         | ADR [0012](./docs/adr/0012-suitability-scoring.md); `src/suitability/`, `rankPlants`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2.2 Spacing / density calculator ⭐             | ✅         | ADR [0013](./docs/adr/0013-spacing-density-calculator.md); `src/spacing/`, `fitPlant`, `PlotRegionSchema`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2.3 Warnings & companion suggestions            | ✅         | ADR [0014](./docs/adr/0014-warnings-and-companion-suggestions.md); `src/warnings/`, `evaluatePlot`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3.1 App shell, state & routing                  | ✅         | ADR [0015](./docs/adr/0015-app-state-management.md); `app/src/routes/`, `app/src/state/`, `app/src/dataset/shipped-plants.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3.2 Plot definition UI                          | ✅         | ADR [0016](./docs/adr/0016-outline-editor-svg-not-konva.md); `app/src/plot/`, `app/src/state/plot-store.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3.3 Plant palette (filtered & ranked)           | ✅         | `app/src/palette/` (`PlantPalette.tsx`, `filters.ts`); layout decision recorded in `docs/architecture.md` (no ADR — follows directly from `DESIGN.md`'s core loop)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3.4 Drag-and-drop plot canvas ⭐                | ✅         | ADR [0017](./docs/adr/0017-plot-canvas-konva-and-dnd-kit.md); `app/src/canvas/`, `app/src/state/placements-store.ts`; E2E in `app/e2e/plot-canvas.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 3.5 Warnings overlay & companion suggestions UI | ✅         | ADR [0018](./docs/adr/0018-placement-derivation-for-warnings.md); `app/src/warnings/`; E2E in `app/e2e/warnings-overlay.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 3.6 User-defined crops                          | ✅         | `app/src/user-crops/`; icon-picker scoping decision (fallback icon, no picker — Stage 4.1 hasn't landed) recorded in `docs/architecture.md`; E2E in `app/e2e/add-custom-crop.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3.7 Plot-image export                           | ✅         | ADR [0020](./docs/adr/0020-plot-export-canvas-compositing.md); `app/src/canvas/export.ts` (legend builder + export pipeline), "Export image" button in `PlotCanvasSection.tsx`; E2E in `app/e2e/plot-export.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 4.1 SVG crop icon set                           | ✅         | ADR [0019](./docs/adr/0019-icon-set-archetypes-and-resolution.md); `app/src/icons/` (160 crop icons + 1 fallback then; **144 + 1 today** — one per shipped id, kept exact by test through Stage 1.7's and Stage 6.0's crop-list changes, `resolveIcon`); `tools/icons/` (generator); [`docs/icon-style-guide.md`](./docs/icon-style-guide.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4.2 Wire icons into palette & canvas            | ✅         | `app/src/icons/useIconImage.ts` (image loader); `PlantPalette.tsx` renders icons; `PlotCanvas.tsx` layers icons over category circles; component + E2E tests cover resolved and fallback cases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5.1 PWA / offline support                       | ✅         | ADR [0022](./docs/adr/0022-pwa-offline-support.md); `vite-plugin-pwa` in `app/vite.config.ts`; manifest icons in `app/public/`; E2E in `app/e2e/offline.spec.ts`; Lighthouse PWA audit command + score in `README.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 5.2 GitHub Pages deployment                     | ✅         | ADR [0024](./docs/adr/0024-github-pages-manual-deploy.md); root `deploy` script (`gh-pages`); manual Pages-settings prerequisite + deploy command documented in `README.md`; post-deploy smoke check (`app/playwright.pages.config.ts`, `app/e2e/deployed-smoke.spec.ts`, `npm run smoke:deployed`); **no `.github/workflows/` added** (§1.4); actual live deploy not completed/verified from this sandboxed session — see the ADR and README                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6.0 Fill the data gaps that actually matter ⭐  | ✅         | ADR [0025](./docs/adr/0025-uk-outdoor-crop-exclusions.md); `packages/etl/src/exclusions/` (24 crops that can't be grown outdoors in Britain, deleted not flagged) + six British staples via `packages/etl/src/curated/` (`apple`, `pear`, `raspberry`, `brussels-sprouts`, `swede`, `pumpkin`); **`data/plants.json` now 144 crops**; the engine's pinned coverage tests re-pinned to the new real numbers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6.1 Documentation pass ⭐                       | ✅         | No ADR (a docs reorganisation, not a decision — see the stage entry below for why); [`docs/README.md`](./docs/README.md) (new docs index); [`docs/data-provenance-and-licensing.md`](./docs/data-provenance-and-licensing.md) (new, consolidates `NOTICE` + `data/README.md` + ADRs 0009/0023/0025); stale companion-link figure fixed (WORKPLAN's own Stage 1.4 row, `packages/etl/README.md`); code-comment audit found the codebase (including `app/`) already meets §0.2's bar — no thin modules found to improve                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6.2 Accessibility & responsive polish           | ✅         | ADR [0026](./docs/adr/0026-keyboard-placement-and-severity-glyphs.md); [`docs/accessibility.md`](./docs/accessibility.md) (new — the full writeup, findings and known gaps); "Add to plot" keyboard-operable placement + on-canvas arrow-key nudge + Previous/Next-placement selection (`app/src/palette/PlantPalette.tsx`, `app/src/canvas/PlotCanvas.tsx`, `PlotCanvasSection.tsx`) plus a "Skip to plot canvas" link (`app/src/plot/SkipToCanvasLink.tsx`); contrast fixes to `BAND_COLORS`/`SEVERITY_COLORS` and a severity glyph so the canvas badge isn't colour-only (`app/src/warnings/severity.ts`); the palette's unbounded crop list capped to a scrolling `65vh` box — the actual fix for the canvas-3500px-down-the-page finding — plus `overflow-x` containers so a large plot can't force the whole page to scroll horizontally (`PlantPalette.tsx`, `PlotCanvasSection.tsx`, `PlotOutlineEditor.tsx`); locally-runnable axe check (`app/e2e/a11y.spec.ts`, `npm run a11y`, 0 violations today — recorded in `README.md`) and a scripted keyboard-only walkthrough (`app/keyboard-walkthrough.mjs`, `npm run keyboard-walkthrough`) with its findings recorded honestly, gaps included (the free-form outline-corner editor stays pointer-only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6.3 Final validation & coverage pass            | ✅         | No ADR (a confirmation pass following established test patterns, not a non-obvious decision — see the stage entry below); coverage audit closed real gaps in `packages/engine/` (`suitability/model.test.ts` new — the `bandForScore` "poor" band boundary was never exercised; `warnings/adjacency.test.ts` — a "+"-shaped polygon overlap where neither region's vertices lie inside the other, and a degenerate zero-length edge; `warnings/model.test.ts` new — `formatCm`'s decimal-formatting branch) and `packages/etl/` (`merge/sanity.test.ts` — the `plantsPerSquare` floor and `perSquareMetre` ceiling in the Stage 1.5 gate's own sanity bounds; `merge/validate.test.ts` — the empty-dataset structural check and the positional-id fallback for an unusably-broken record; `merge/join.test.ts` — a stale curated-alias entry pointing at no known plant; new `exclusions/schema.test.ts` and `moisture/schema.test.ts`, mirroring `spacing/schema.test.ts`'s existing split, covering each table's own invalid-row/duplicate-id error paths; `resolve/gbif-resolver.test.ts` — a non-`Error` transport rejection); engine coverage 99.73%→99.83% statements, 95.33%→96.06% branches; etl 95.67%→96.54% statements, 93.54%→95.22% branches (remaining gaps are schema-guaranteed-unreachable defensive fallbacks or barrel re-exports, left alone per the "not a rewrite" constraint); full E2E regression (`npm run e2e`, 7/7 passing, no flake this run) plus the by-hand offline/a11y/keyboard-walkthrough/Lighthouse checks, all re-confirmed unchanged from their last-recorded results (axe 0 violations, Lighthouse 0.88/1.00); new [`docs/qa-checklist.md`](./docs/qa-checklist.md) (indexed from `docs/README.md`) — the release QA checklist covering the core journey, custom crops, plot export, offline behaviour, and a pointer at every known a11y gap so it isn't rediscovered |
| 6.4 Continuous integration (the last stage)     | ✅         | ADRs [0027](./docs/adr/0027-ci-checks-workflow-and-blocking-policy.md) (what CI runs, and which jobs gate a merge) and [0028](./docs/adr/0028-deploy-on-merge-not-automated.md) (why deploy-on-merge was declined, with a ready-to-adopt recipe); `.github/workflows/checks.yml` — `verify` and `a11y` blocking, `audits` (Lighthouse PWA + keyboard walkthrough) informational, Node pinned to the `engines` floor, actions pinned by SHA, `permissions: contents: read`, npm + Playwright browser caches; `.github/scripts/report-lighthouse-pwa.mjs` (reports the score _and_ warns when no score could be measured, so a silently-broken informational check can't read as a pass); `retries: CI ? 1 : 0` and `forbidOnly` in `app/playwright.config.ts` (the `plot-export.spec.ts` flake fixed where it lives, not with a workflow-level `continue-on-error`); proven green→red→green on PR [#23](https://github.com/JasperCain01/garden_planner/pull/23). Also the project's closing pass: [`docs/security-review.md`](./docs/security-review.md) (new), an ADR consistency audit (dated notes on ADRs 0005/0006/0024 where later stages overtook them), README/CONTRIBUTING/architecture/QA-checklist brought in line with a repository that now has CI, and the v1 sign-off + post-v1 backlog in §5 below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

**In one line:** the data layer and the engine's whole brain — suitability
scoring, spacing/density, and warnings & companion suggestions — are built and
green; Phase 2 is complete, and Phase 3 (the UI) now has its app shell, state
management, routing, dataset-loading layer (Stage 3.1), plot-definition UI
(Stage 3.2 — shape picker, free-form outline editor, growing-conditions form,
and the plot store), a ranked, searchable, filterable plant palette (Stage
3.3), and — the app's signature interaction — a drag-and-drop plot canvas
(Stage 3.4: react-konva scene, dnd-kit palette handoff, live `fitPlant`
density feedback, and select/move/remove for placed plants), all composed on
the one plot-definition page, which now closes `DESIGN.md`'s core loop with a
warnings overlay & companion-suggestion UI (Stage 3.5: severity-badged
placement markers, a "4. Check for problems" panel, and the two-derivation
placement modelling ADR 0018 records), and goes one capability beyond the
core loop with user-defined crops (Stage 3.6: an add-crop form validated via
`safeValidateUserPlantInput`, an id-collision check, edit/remove gated on
`isUserPlant`, and a generic fallback icon in place of a real picker since
Stage 4.1's icon set hadn't landed yet). Phase 4 (Content & assets) is
complete: Stage 4.1 ships the bundled SVG icon set — one crop icon per shipped
id plus a generic fallback, generated from a small reusable shape library rather
than hand-drawn (`tools/icons/`) — and Stage 4.2 wires the tested `resolveIcon(plant)`
lookup (`app/src/icons/`) into both the palette (`PlantPalette.tsx`) and the
canvas (`PlotCanvas.tsx`), replacing the coloured-circle-plus-initial
placeholder. Phase 3 (Frontend MVP) now closes out too: Stage 3.7 adds
**plot-image export** — an "Export image" button (`PlotCanvasSection.tsx`)
that rasterises the Konva scene via `stage.toCanvas()` and composites a
plain-text legend (placed crops, resolved conditions) beside it with the 2D
Canvas API rather than a Konva node (ADR 0020, avoiding a `konva`-runtime
import that would crash under Vitest), then downloads the result as a PNG —
a terminal picture, not a re-loadable save. Phase 1 (Data pipeline) now closes
out too: Stage 1.7 adds a **maintainer-curated full-plant input**
(`packages/etl/src/curated/`) — a hand-authored `Plant[]` held to the same
unrelaxed `validatePlant` bar as every OpenFarm-sourced record, folded into
the Stage 1.5 merge as a fourth input where a curated crop colliding with an
OpenFarm one replaces it outright (curated wins, ADR 0021). Two crops ship
today — `broad-bean` (closing a gap ADR 0009 had left open) and
`jerusalem-artichoke` — bringing the shipped dataset to 162 plants at the time.
**Phases
2, 3 and 4 are complete; Phase 1 is complete apart from Stage 1.2**, which
remains ⚠️ partial — OpenFarm is still the only source adapter, and PFAF and
Permapeople have never landed. That is not a bookkeeping detail: they are the
sources carrying hardiness and soil, so at that point 160 of 162 shipped records
had light data and nothing else, and three of the suitability engine's four
dimensions reported `unknown-plant` for almost the whole catalogue (see
[`docs/review-pre-deployment.md`](./docs/review-pre-deployment.md) §3.9).
**Stage 6.0** closes as much of that gap as curation can, rather than ingesting
another source — the reasoning, and the measurements behind it, are recorded in
the stage itself, and it is now **complete**. Its first half was a **curated
soil-moisture table** (`packages/etl/src/moisture/`) giving 72 core British
crops a `soil.moisture` preference and the app a second working axis: on a plot
that names its moisture, drought-tolerant crops genuinely outrank thirsty ones,
where before every full-sun crop tied. Its second half re-curated the **crop
list itself** — six British staples added through the Stage 1.7 curated channel
(`apple`, `pear`, `raspberry`, `brussels-sprouts`, `swede`, `pumpkin`, each with
RHS-cited spacing, hardiness, soil and season data) and **24 crops that can't be
grown outdoors in Britain removed** (`packages/etl/src/exclusions/`, ADR
[0025](./docs/adr/0025-uk-outdoor-crop-exclusions.md), which records the
delete-rather-than-flag decision the stage left open). The dataset now ships
**144 crops**: light 144/144 (133 full-sun, 11 partial-shade), soil 80/144,
hardiness and seasons 8/144, companion links 76 across 50 records. The ranking's
top eight places are now decided by real data rather than the alphabet — but
8/144 is still thin, and closing the hardiness/season gap properly needs a new
source (Stage 1.2's unstarted adapters), not more curation. CI, deferred since
Stage 0.1 by §1.4, is scheduled last as **Stage 6.4**.
Phase 5 (Offline & deployment) is now complete:
Stage 5.1 adds **PWA / offline support** (ADR 0022) — a service worker and
web app manifest via `vite-plugin-pwa`'s `generateSW` strategy
(`app/vite.config.ts`), confirming (by inspecting a production build) that
the default precache already covers the bundled dataset and icon set with no
bespoke runtime-caching logic needed, plus two new manifest icons derived
from the existing fallback icon's style (`app/public/`). The explicit offline
E2E test §1.3 has required since the verification strategy was written now
exists (`app/e2e/offline.spec.ts`): load the app online, confirm the service
worker takes control, go offline, and re-run the core drag-a-crop-onto-the-
canvas journey with the network off. A locally-runnable Lighthouse PWA audit
command and today's score are recorded in `README.md`. **Stage 5.2** adds a
**manual GitHub Pages deploy path** (ADR
[0024](./docs/adr/0024-github-pages-manual-deploy.md)) — a root `deploy`
script wrapping the `gh-pages` npm package, publishing a `GITHUB_PAGES=true`
build of `app/dist` to the `gh-pages` branch, plus a post-deploy Playwright
smoke check (`app/e2e/deployed-smoke.spec.ts`, run via `npm run
smoke:deployed`, deliberately outside `npm run e2e`/`verify` so those stay
network-free) — deliberately **no `.github/workflows/`**, per §1.4. Enabling
Pages itself is a one-time, repo-admin-only Settings step no automated
session can perform, and this session's own outbound network couldn't reach
the live Pages URL or complete a real branch push either — both are
documented as the maintainer's next manual step (`README.md`, ADR 0024)
rather than asserted as done. (Stage 6.4 later found that Pages **is** enabled
on the real repository — but on the `main` branch, not the `gh-pages` branch
`npm run deploy` publishes to, so the app is still not live. See README.md's
"Live site" and §5.2's backlog.) **Phase 6** (community readiness) is
**complete**: Stages 6.0, 6.1, 6.2, 6.3 and 6.4 all landed (see above and the
stage entries below). Stage 6.2 (accessibility & responsive polish) gives every
drag-and-drop interaction a keyboard-operable alternative — an "Add to plot"
button per palette entry (placing at the plot's centre and selecting it, no
pixel-drag math involved, ADR 0026) plus arrow-key nudging and
Previous/Next-placement selection on the canvas — runs a real
colour-contrast and ARIA audit rather than assuming one was needed (two
`BAND_COLORS`/`SEVERITY_COLORS` entries were genuinely below WCAG AA and are
fixed; the canvas's severity badges gained a glyph so colour isn't their only
signal), and fixes the responsive problem `docs/review-pre-deployment.md`
diagnosed but didn't touch: the plant palette's previously **unbounded**
crop list — which is what actually pushed the canvas to y≈3500px and kept
growing as the dataset did — is now a bounded, scrolling box, verified on a
real 390px and 320px viewport (`docs/accessibility.md`) rather than assumed
from CSS alone. The stage leaves behind exactly the kind of runnable-command
deliverable Stage 6.4 will later wire into CI: a locally-runnable axe check
(`npm run a11y`, 0 violations today) alongside a scripted keyboard-only
walkthrough of the core journey, both recorded honestly in
[`docs/accessibility.md`](./docs/accessibility.md) — including what's still
a real gap (the free-form plot-outline corner editor stays pointer-only).
**Stage 6.3** (final validation & coverage pass) is now complete too: a
genuine coverage audit — not a rewrite — closed real, specific gaps in both
`packages/engine/` and `packages/etl/` (see the Progress table row above for
the full list), lifting engine branch coverage from 95.33% to 96.06% and etl
from 93.54% to 95.22%; a full E2E regression (`npm run e2e`, 7/7, no flake
this run) plus every by-hand check (offline, axe, the keyboard walkthrough,
Lighthouse) was re-run and confirmed unchanged from its last-recorded result;
and a new [`docs/qa-checklist.md`](./docs/qa-checklist.md) gives a release
manager a single by-hand checklist for the core journey, the two
beyond-the-core-loop capabilities, offline behaviour, and every known a11y
gap, so none of Stage 6.2's honestly-recorded findings need rediscovering.
**Stage 6.4 closes the plan.** It lifts the one constraint that has held
since Stage 0.1 — §1.4's ban on `.github/workflows/` — and automates exactly
the list §1.4 named and nothing more: `npm run verify` and the axe check as
blocking jobs, the Lighthouse PWA audit and the keyboard-only walkthrough as
informational ones (ADR
[0027](./docs/adr/0027-ci-checks-workflow-and-blocking-policy.md)), with the
gate proven green→red→green on a real pull request rather than asserted. The
deploy stays manual, now by choice rather than by rule (ADR
[0028](./docs/adr/0028-deploy-on-merge-not-automated.md)). **Nothing is left
to do in this plan** — see §5, "v1: what this is, and what it isn't", for the
sign-off and for the explicit disposition of every gap that is deliberately
not in v1.

---

## 0. Ground rules that apply to every stage

These are constraints and conventions that hold across the whole build. A fresh
session should read this section before starting any stage.

### 0.1 The hosting constraint shapes the architecture

**The app must run as a fully static site (GitHub Pages) and work offline.**
This has three hard consequences that every stage must respect:

1. **No runtime backend and no server-side database.** Everything the running
   app needs must be a static file served from Pages. The plant "database" ships
   as a **static data artifact** (a bundled JSON file, or a SQLite file loaded
   in-browser via `sql.js`/WASM), generated at build time.
2. **The ETL / data pipeline is a developer tool, not part of the app.** It runs
   on a contributor's machine, pulls from external sources _once_, and commits
   the resulting static artifact. The deployed app never calls PFAF, GBIF, etc.
   This is also what makes the app work offline and insulates it from those
   sources going down.
3. **All "services" from the original design collapse into client-side modules
   or static data.** The suitability/spacing engine is browser-side TypeScript.
   The location/climate "service" ships as a static lookup table (UK default),
   with _optional_ online geocoding as a progressive enhancement that degrades
   gracefully when offline.

```
   BUILD TIME (developer machine, online)        RUN TIME (browser, offline-capable)
   ┌──────────────────────────────┐             ┌──────────────────────────────┐
   │ ETL pipeline                  │   emits     │ Static app (GitHub Pages)     │
   │  PFAF · OpenFarm · Permapeople│ ──────────► │  · bundled dataset (JSON/WASM)│
   │  · GBIF · hand-verified data  │  committed  │  · engine (client TS)         │
   │  → normalize → validate       │  artifact   │  · SVG icon set               │
   └──────────────────────────────┘             │  · service worker (offline)   │
                                                 └──────────────────────────────┘
```

### 0.2 Engineering conventions (mandatory, every stage)

Because a core goal is that **others can clone and understand this easily**,
these are not optional niceties:

- **Comment code clearly.** Every non-trivial function gets a docstring saying
  what it does and why it exists. Favour comments that explain _intent and
  reasoning_ ("onions use intensive spacing here because…") over comments that
  restate the code.
- **Explain design choices where they aren't obvious.** When a stage makes a
  decision a newcomer might question (a library choice, an algorithm, a data
  trade-off), record a short **Architecture Decision Record (ADR)** in
  `docs/adr/NNNN-title.md` — a few paragraphs: context, decision, alternatives,
  consequences. Link it from the code where relevant.
- **Prefer clarity over cleverness.** This is a community project meant to be
  forked and learned from. Readable beats terse.
- **Keep modules self-contained and framework-agnostic where possible** — the
  engine and data layers must not depend on the UI framework, so they can be
  tested and reused in isolation.
- **Update docs as part of the stage, not later.** A stage isn't done until its
  README/architecture notes reflect reality.

### 0.3 Definition of done (every stage)

A stage is complete only when: deliverables exist; `lint`, `typecheck`,
`format:check` and the test suite pass; the app still builds; new code is
commented per 0.2; any non-obvious decision has an ADR (and is added to
`docs/adr/README.md`'s index); relevant docs are updated; **the Progress table
above records the stage**; and **the brief for the next stage is written**
(§0.6).

> There is **no `.claude/` skills directory in this repository**, so the
> `/verify` and `/code-review` commands earlier drafts of this plan referred to
> do not exist. Review your own diff before calling a stage done.

### 0.4 How to read the "Model" recommendation

Each stage suggests a model tier. The philosophy:

| Tier                    | Use for                                                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Opus**                | Architecture-defining work, tricky algorithms, ambiguous/cross-cutting decisions. The keystone stages where a wrong call is expensive to unwind.                                                                                                                                                |
| **Sonnet**              | The bulk of feature work: well-scoped app logic, UI components, deployment config, most ETL adapters, docs. Strong default once the shape is set.                                                                                                                                               |
| **Haiku**               | Mechanical, tightly-specified work with an obvious shape: boilerplate, wiring, repetitive transforms following an established pattern.                                                                                                                                                          |
| **Local (qwen3-coder)** | Same profile as Haiku — mechanical, machine-checkable work — but chosen when you want zero-cost, private, offline-friendly iteration. Good for schema-validated data transforms and test-fixture generation where correctness is easy to verify automatically. Avoid for ambiguous design work. |

Where two tiers are reasonable, both are listed with a note.

### 0.5 Recommended stack (proposed in Stage 0.1, ADR-worthy)

Ratified (Stage 0.1 records these as ADRs):

- **TypeScript + Vite** — fast static builds with first-class GitHub Pages support.
- **React** as the UI framework. Chosen over Svelte because the app's polish is
  concentrated in a drag-and-drop canvas, where React's interaction ecosystem is
  the most mature and best-documented — which lowers the effort to reach an
  engaging UI _and_ keeps the project easy to clone and contribute to (larger
  pool). The trade-off (larger bundle than Svelte) is minor for a
  cached-after-first-load PWA.
- **dnd-kit** for accessible, fluid drag-and-drop (also supplies the
  keyboard-accessible drag alternative Stage 6.2 needs).
- **react-konva** (or Pixi) for performant 2D canvas rendering of the plot.
- **Framer Motion (Motion)** for physics-based micro-interaction animation.
- **Vitest** for unit tests, **Playwright** for end-to-end (already available in
  this environment), **zod + JSON Schema** for data validation, and a
  **service worker** (via `vite-plugin-pwa`) for offline.

The ETL is a separate Node/TypeScript workspace.

**Licensing (settled): as open as the inputs allow.** Code under **MIT**; the
shipped **dataset** under **CC0-1.0**, a public-domain dedication, with
attribution recorded in `NOTICE` and per-record provenance for traceability
rather than compliance.

> This entry originally read "non-commercial … dataset under CC BY-NC-SA to
> honour PFAF's terms". That was written when PFAF was expected to be ingested;
> it isn't (Stage 6.0), and every input that actually ships is CC0 or original
> curation. Relicensed in ADR
> [0023](./docs/adr/0023-dataset-licence-cc0.md), which supersedes ADR 0009's
> licensing section. If a share-alike source is ever ingested, that build gets
> relicensed then — the restriction is not held speculatively in the meantime.

### 0.6 Write the next stage's brief before finishing (hand-off discipline)

Every stage runs in a **fresh session with no memory of the ones before it** (the
preamble to this section). The thing that makes that work is the per-stage brief
in `docs/stage-<n>-brief.md`: a tight, self-contained hand-off that concentrates
what the next session needs — what was built, the decisions and trade-offs made,
the traps discovered, and where the new code lives — so it doesn't have to
reconstruct any of it from the diff. This has been the practice since the start;
it is now a **requirement, not an optional courtesy**, so it can't be lost just
because a prompt forgot to ask for it.

**A stage is not done until it has written the brief for the stage that comes
next** (`docs/stage-<next>-brief.md`), mirroring the shape of the existing briefs:
_goal_, _where it lives_, _what to build_, _constraints/gotchas already solved_,
_deliverables_, _definition of done_, and _model_. Record anything this stage
learned that the next one would otherwise rediscover the hard way — environment
blockers, schema/interface shapes to reuse, and the decisions an ADR captures
(point the next session _at_ the ADR rather than repeating it). If the next stage
is ambiguous (the dependency map branches), write the brief for the most likely
next stage and note the alternatives. This closes the loop the ADRs open: an ADR
records _why_ a decision was made; the brief tells the next session _what to do
with it_.

---

## 1. Verification & validation strategy (design this deliberately)

Validation is a first-class concern, not an afterthought — especially because
the app makes _horticultural claims_ ("this many onions fit", "these are
companions") that users will act on. There are four distinct layers, each owned
by different stages.

### 1.1 Data validation (correctness of the facts)

- **Schema validation.** Every plant record must validate against the JSON
  Schema / zod schema from Stage 0.2. The dataset build (Stage 1.5) **fails hard**
  if any record is invalid. No malformed data ever ships.
- **Referential integrity.** Every companion/antagonist link must point to a
  plant that exists in the dataset. Broken links fail the build.
- **Sanity bounds.** Automated checks for implausible values (negative spacing,
  spacing > plot-scale absurdities, sow-month outside 1–12, etc.).
- **Provenance & cross-checking.** The hand-verified spacing table (Stage 1.3)
  requires each figure to be checked against **at least two authoritative
  sources**, with the sources recorded per row. This is human verification, but
  the _record_ of it is committed and reviewable.

### 1.2 Engine validation (correctness of the logic)

- **Unit tests on pure functions.** The engine is deterministic and
  framework-free, so it's fully unit-testable. Maintain a suite of **golden
  cases** — worked examples with known answers (e.g. "a 1m × 3m bed of onions at
  8 cm intensive spacing yields N plants"). These double as living documentation.
- **Property-based tests** for the packing/density calculator: e.g. count must be
  monotonic (a bigger plot never fits fewer plants), and never exceed the
  theoretical area bound.
- **Edge cases as fixtures:** zero-area plots, single-plant plots, plants larger
  than the plot, mixed light zones.

### 1.3 Application validation (correctness of the experience)

- **Component tests** for UI logic (filtering, ranking, warning display).
- **End-to-end tests (Playwright)** for the core journeys: define a plot → see a
  ranked palette → drag a plant in → see a count → trigger and clear a warning.
- **User-content & export journeys.** The new capabilities get their own coverage:
  a user-defined crop validates through the same `validatePlant` gate and behaves
  like a shipped crop end-to-end (Stage 3.6), and the plot-image export produces a
  non-blank PNG with icons and legend (Stage 3.7).
- **Offline test.** An E2E run that loads the app, goes offline, and confirms it
  still functions — this is a _requirement_, so it gets an explicit test.
- **PWA / performance audit.** A Lighthouse check for installability and
  offline readiness — a documented, locally-runnable command. Since Stage 6.4
  it also runs in CI, as an **informational** job that reports the score
  without gating a merge (ADR
  [0027](./docs/adr/0027-ci-checks-workflow-and-blocking-policy.md) explains
  why this one reports and the axe check blocks).

### 1.4 Continuous validation (the safety net)

The checks themselves are the safety net, and they are **not optional**: lint →
typecheck → format → unit → component → build → E2E → dataset validation. A
stage that breaks any of these is not done (§0.3).

**Automating them in GitHub Actions was deliberately deferred until the project
was complete — and Stage 6.4 has now landed them.** For the whole build, from
Stage 0.1 to Stage 6.3, there was no `.github/workflows/` directory and no
stage was allowed to add one (that included the Pages deploy in Stage 5.2,
which stayed a manual deploy throughout). That rule has served its purpose and
is spent; `.github/workflows/checks.yml` exists as of Stage 6.4. **What has not
changed is the rule underneath it:** every check CI runs is a check a
contributor can run locally with a documented command, so a red build always
reproduces on a laptop. Run them locally, from the repo root, before calling a
change done — don't wait for CI to tell you:

```bash
npm run verify
```

which is exactly `lint → typecheck → format:check → test → build → e2e`.

**Run `verify`, not `npm test` alone.** `npm test` covers only the unit and
component suites; Playwright lives behind `npm run e2e`. A stage checked with
`npm test` therefore never exercises the E2E specs at all — which is precisely
how a racy `plot-export.spec.ts` reached `main` unnoticed (see
[`docs/review-pre-deployment.md`](./docs/review-pre-deployment.md) §3.1). The
list in the paragraph above says "E2E" for a reason; `npm run verify` is the
single command that honours it.

**Stage 6.4 landed them, last in the plan**, and automated exactly what this
section specified: `npm run verify` plus the offline, a11y and Lighthouse runs
the later stages describe — and nothing else. Concretely:

| Job      | Command                                                         | Blocking?     |
| -------- | --------------------------------------------------------------- | ------------- |
| `verify` | `npm run verify` (the offline spec runs inside its `e2e` step)  | **yes**       |
| `a11y`   | `npm run a11y -w app`                                           | **yes**       |
| `audits` | the `lighthouse@11` PWA command; `npm run keyboard-walkthrough` | no — reported |

The blocking-vs-informational split is a real decision with real consequences
(a Lighthouse regression is a warning annotation, not a red build), so it is
recorded in ADR
[0027](./docs/adr/0027-ci-checks-workflow-and-blocking-policy.md) rather than
left implicit. There is deliberately **no** coverage gate, bundle budget,
dependency-review action or Node matrix: each would be a check nobody can
reproduce by hand, which is the failure mode this whole deferral was
protecting against.

---

## 2. The stages

Format for each: **Goal**, **Depends on**, **Deliverables**, **Model**,
**Verification**. Documentation/commenting per §0.2 is implied in every stage.

### Phase 0 — Foundations

#### Stage 0.1 — Repository scaffolding & tooling

- **Goal:** A green, empty-but-runnable project skeleton others can clone and
  build in one command.
- **Depends on:** nothing.
- **Deliverables:** Chosen stack wired up (see §0.5); workspace layout
  (`/app` frontend, `/engine` framework-free logic, `/etl` build-time pipeline,
  `/data` committed artifacts, `/docs` + `/docs/adr`); lint + format + typecheck
  - test runner configured; `README` skeleton; `LICENSE` for code (MIT or GPL;
    dataset licence settled as CC0-1.0 — see §0.5 and ADR 0023);
    `CONTRIBUTING.md`; ADRs recording the stack and framework
    choices (§0.5). _(This stage originally shipped a CI workflow too; it has
    since been removed — GitHub Actions wait until the project is complete,
    §1.4.)_
- **Model:** **Sonnet.** Well-understood setup work; some judgement on structure.
- **Verification:** `npm install && npm run build && npm test` succeeds from a
  clean clone.

#### Stage 0.2 — Data schema definition ⭐ keystone

- **Goal:** The canonical plant-record schema everything else is built on.
- **Depends on:** 0.1.
- **Deliverables:** TypeScript types + JSON Schema (and/or zod) for a plant
  record: identity (common name, scientific name, GBIF id), edible category,
  light requirement, **method-aware spacing** (in-row, between-row, _and_
  intensive per-m²/per-square — see `DESIGN.md`), hardiness, soil, sowing/harvest
  seasons, companion & antagonist links, icon reference, and per-field
  provenance. ADR explaining the schema shape, especially the method-aware
  spacing decision.
- **Model:** **Opus.** This is the schema every later stage depends on; getting
  the spacing and provenance modelling right here avoids expensive rework.
- **Verification:** Schema validates a hand-written sample record for 2–3 crops
  (onion, lettuce, a fruit); invalid samples are correctly rejected by tests.

#### Stage 0.3 — Schema amendment for user-defined crops ⭐ keystone

- **Goal:** Let the schema describe a crop a **user** enters from a seed packet,
  not only a fully-sourced record from the ETL — the enabling change for
  user-defined crops (Stage 3.6).
- **Depends on:** 0.2.
- **Why now (before Phase 2):** the plant schema is the single source of truth the
  engine (Phase 2) and UI (Phase 3) build on. Relaxing it is cheap while only
  tests depend on it, and expensive to unwind once scoring, packing, and the
  palette are written against the stricter shape — so it lands here, not when the
  UI finally needs it.
- **Deliverables:** Make the two fields a seed-packet user can't supply
  **optional** — `scientificName` (a user has "Cherry Belle", not _Raphanus
  sativus_) and record-level `provenance` — _or_ keep `provenance` required but let
  callers pass a synthesised `{ sources: [{ source: 'user-entered' }] }`. Decide
  which, keeping `validatePlant` usable as **both** the ETL's hard-fail gate _and_
  the UI's on-submit validator. A **user-crop id-namespacing convention** (e.g. a
  `user-` prefix) so a user crop can never collide with a shipped `id`. An ADR
  (`docs/adr/0011-user-defined-crop-schema.md`) recording exactly which fields were
  relaxed, why, and — crucially — **how the guarantee that _shipped_ data stays
  fully attributed is preserved** (e.g. a `validateShippedPlant` vs
  `validateUserPlant` split, or an ETL-side lint that re-tightens what the schema
  now permits). This must not become a licence/provenance loophole for shipped
  data.
- **Model:** **Opus.** Keystone-schema change with a cross-cutting consequence
  (it must loosen the user path without weakening the shipped-data guarantee) —
  exactly the "wrong call is expensive to unwind" profile §0.4 reserves for Opus.
- **Verification:** A minimal user-shaped record (common name + spacing + light +
  category, no scientific name, no source) validates; a _shipped_ record still
  fails if it lacks provenance (whichever mechanism enforces that); every existing
  Stage 0.2 sample record still parses unchanged.

### Phase 1 — Data pipeline

#### Stage 1.1 — ETL scaffolding & name resolution

- **Goal:** The build-time pipeline skeleton and a GBIF-based scientific-name
  resolver that becomes the join key across sources.
- **Depends on:** 0.2.
- **Deliverables:** `/etl` runnable pipeline shell; a cached name-resolution step
  (fetch once, cache to repo so it works offline thereafter); a documented "add a
  source" extension point.
- **Model:** **Sonnet.**
- **Verification:** Resolver maps a handful of known common names to correct GBIF
  ids; cache means a second run needs no network.

#### Stage 1.2 — Source adapters (PFAF, OpenFarm dump, Permapeople)

- **Goal:** Import each external source and map it into the Stage-0.2 schema.
- **Depends on:** 1.1. _(Can be split into one sub-stage per source — each is a
  clean fresh-session unit once the first establishes the pattern.)_
- **Deliverables:** One adapter per source, each emitting schema-shaped records
  with provenance tags; downloaded source data cached in-repo for offline builds.
- **Model:** **Sonnet** for the first adapter (establishes the pattern);
  **Haiku or local qwen3-coder** for subsequent adapters (mechanical field
  mapping against an established pattern and a validating schema).
- **Verification:** Each adapter's output validates against the schema; spot-check
  fixtures confirm known crops map correctly.

#### Stage 1.3 — Hand-verified spacing table ⭐ data-critical

- **Goal:** The authoritative method-aware spacing figures for the starter set of
  common British edibles — the number the density calculator lives or dies by.
- **Depends on:** 0.2.
- **Deliverables:** A curated data file with in-row / between-row / intensive
  spacing for each starter crop, **each figure cross-checked against ≥2 sources
  (RHS, square-foot charts, extension guides), sources recorded per row.**
- **Model:** **Sonnet** (needs care and source cross-referencing, not just
  transcription). A human contributor may prefer to own this directly; the model
  assists and structures.
- **Verification:** Every row validates; every row cites its sources; automated
  sanity bounds pass; a reviewer signs off the provenance.

#### Stage 1.4 — Companion-planting data (evidence-tagged)

- **Goal:** Companion/antagonist relationships stored with an honesty tag.
- **Depends on:** 0.2, and the plant set from 1.2/1.3 for referential integrity.
- **Deliverables:** Relationship data where each pairing carries an **evidence
  level** ("well-supported" vs. "traditional"), so the UI can be honest about the
  mixed evidence base.
- **Model:** **Sonnet.**
- **Verification:** Referential integrity (every link resolves); evidence tag
  present on every relationship; schema validates.

#### Stage 1.5 — Dataset build, merge & validation ⭐ keystone

- **Goal:** Combine all sources into the single static artifact the app ships,
  reconciling conflicts, and enforce all data-validation rules.
- **Depends on:** 1.2, 1.3, 1.4.
- **Deliverables:** A merge step that reconciles overlapping records by GBIF id
  (with a documented conflict-resolution policy — e.g. hand-verified spacing wins
  over scraped); the **hard-fail validation gate** (§1.1); the emitted artifact
  in `/data`; finalized **dataset licensing** decision + `NOTICE`/attribution
  file (recorded in ADR 0009, and relicensed to CC0-1.0 by ADR 0023 once PFAF
  was dropped — see §0.5).
- **Model:** **Opus.** Reconciliation policy and the validation gate are
  cross-cutting and easy to get subtly wrong.
- **Verification:** Build fails loudly on an intentionally-broken record (test
  this); passes on the real data; artifact loads and validates.

#### Stage 1.6 — Location & climate static data

- **Goal:** Offline-capable climate context, defaulting to Britain.
- **Depends on:** 0.2.
- **Deliverables:** A static lookup shipping frost dates / hardiness / season
  timing for the UK default (and a small extensible set of regions); an
  interface the engine consumes; _optional_ online geocoding as graceful
  progressive enhancement.
- **Model:** **Sonnet.**
- **Verification:** UK default resolves fully offline; optional geocoding
  degrades cleanly when offline (tested).

#### Stage 1.7 — Curated full-plant input (maintainer-authored crops)

- **Goal:** A channel for the maintainer to **permanently add a crop to the
  shipped dataset** by hand — the "grow the list of available crops" request —
  feeding the same merge and hard-fail gate as every other source.
- **Depends on:** 0.2 (0.3 optional — maintainer-added crops should meet the full
  shipped-data bar, so they need no relaxation), and 1.5 (the merge it extends).
- **Why it's needed:** today the dataset is assembled from OpenFarm plants plus
  the _thin_ spacing and companion slices; there is **no input for a hand-authored
  _full_ `Plant`**. This adds one: a curated `Plant[]` file (e.g.
  `packages/etl/src/curated/plants.ts`) that the Stage 1.5 merge folds in directly
  — the same "curated slice, hand-verified wins" pattern already there, but with
  full records, so it is _less_ work than the spacing join.
- **Deliverables:** The curated-plants module + its wiring into
  `packages/etl/src/merge/` so its records reconcile alongside OpenFarm's (decide
  and document the conflict rule when a curated crop overlaps an OpenFarm one —
  curated presumably wins, mirroring hand-verified spacing); each curated record
  fully schema-valid with real provenance; referential integrity preserved (keep
  curated additions link-free, or only linking to ids known to ship). ADR for the
  input's shape and its place in the join order; update the ETL README and
  `data/README.md`.
- **Model:** **Sonnet** to build the input and wiring (establishes the pattern);
  **Haiku / local qwen3-coder** to add individual crop rows later against the
  settled shape and the validating schema.
- **Verification:** A curated crop appears in the built `data/plants.json` and
  passes the gate; an intentionally-broken curated record fails the build loudly
  (reuses Stage 1.5's gate); a curated crop overlapping an OpenFarm slug
  reconciles by the documented rule, not by silent duplication.

### Phase 2 — Engine (framework-free, browser-side)

#### Stage 2.1 — Suitability scoring engine ⭐ keystone

- **Goal:** The "brain" — score any plant against a plot's conditions.
- **Depends on:** 0.2, and sample data (1.5) to test against.
- **Deliverables:** Pure, framework-free functions scoring light match, hardiness
  vs. location climate, soil, and season into a ranked suitability result; the
  reasoning behind each score exposed so the UI can explain _why_.
- **Model:** **Opus.** Core domain logic; the scoring model is a design decision
  with lasting consequences.
- **Verification:** Golden-case unit tests (documented worked examples); edge
  cases (no matching plants, all-shade plot) covered.

#### Stage 2.2 — Spacing / density calculator ⭐ algorithmic

- **Goal:** "How many onions fit?" — shape-aware, method-aware counts.
- **Depends on:** 0.2, 2.1 conventions.
- **Deliverables:** Functions computing plant counts from method-aware spacing
  and a plot _region_ (respecting shape, not just area), offering square vs.
  offset (hexagonal) packing; clear docs on the geometry.
- **Region model (decided):** the region is an **arbitrary simple polygon**. The
  product direction is **preset shapes** (rectangle, L-shape, …) that the user
  then **adjusts free-form** by dragging, adding and removing corners — so
  non-convex regions are the normal case, presets are factories for one polygon
  type rather than separate variants, and "respecting shape, not just area" means
  real containment testing rather than a bounding-box approximation.
- **Model:** **Opus.** The packing geometry is the most algorithmically subtle
  piece in the app.
- **Verification:** Golden cases against hand-worked answers; **property-based
  tests** (monotonicity, area upper bound); zero/degenerate-region cases; a
  non-convex region counting strictly fewer plants than its bounding box.

#### Stage 2.3 — Warnings & companion-suggestion engine

- **Goal:** Turn engine outputs into actionable warnings and suggestions.
- **Depends on:** 2.1, 2.2, 1.4.
- **Deliverables:** Rules producing warnings (wrong light, overcrowding, wrong
  sowing season, antagonist adjacency, climate mismatch) and companion
  suggestions, each carrying a human-readable explanation and (for companions)
  the evidence tag from 1.4.
- **Model:** **Sonnet.**
- **Verification:** Unit tests per warning type; a fixture plot deliberately
  triggering each warning; companion suggestions respect evidence tags.

### Phase 3 — Frontend MVP

#### Stage 3.1 — App shell, state & routing

- **Goal:** The static SPA skeleton the features hang off.
- **Depends on:** 0.1.
- **Deliverables:** App shell, state management, routing configured for a
  **GitHub Pages base path** (this bites early if ignored), and a dataset-loading
  layer that exposes the runtime plant list as **the shipped dataset plus any
  user-defined crops** (Stage 3.6) layered on top — an in-memory, session-scoped
  overlay, _not_ a rewrite of the shipped artifact. The engine and palette consume
  this merged list and must not care which source a plant came from. (User crops
  live only for the session; there is no persistence layer — the app exports a
  _picture_, not a re-loadable save file, see Stage 3.7.)
  - _Addendum, UI redesign Phase 5 (2026-08-04): there **is** a persistence layer
    now — designs are saved to `localStorage` and there is a re-loadable save
    file in all but name. This sentence still holds where it matters, though, and
    deliberately: `state/user-plants-store.ts` is **still** an in-memory,
    session-scoped overlay that writes nothing. A user crop outlives the tab only
    by travelling inside a saved design that uses it, which is what stops one
    accumulating in a browser forever. ADR
    [0034](./docs/adr/0034-designs-persistence-and-one-history-over-two-stores.md)
    §2 argues it out against this line rather than around it._
- **Model:** **Sonnet.**
- **Verification:** App loads the bundled dataset and renders a placeholder;
  builds correctly under the Pages base path.

#### Stage 3.2 — Plot definition UI

- **Goal:** Let the user describe their plot.
- **Depends on:** 3.1, 1.6, 2.2 (for the region shape it must produce).
- **Deliverables:** A **shape picker offering presets** (rectangle, L-shape, …)
  sized by dimensions, plus **free-form adjustment** of the outline — drag,
  add and remove corners — emitting the polygon region Stage 2.2 defines; light
  level (with per-area zones if feasible — see open questions in `DESIGN.md`),
  soil, and location (defaulting to Britain).
- **Model:** **Sonnet.**
- **Verification:** Component tests for input validation, including that an
  outline dragged into a self-intersecting shape is rejected with a message
  rather than passed to the engine; produces a plot object the engine accepts.

#### Stage 3.3 — Plant palette (filtered & ranked)

- **Goal:** Show the user suitable edibles for their plot.
- **Depends on:** 3.2, 2.1.
- **Deliverables:** A searchable, filterable palette driven by suitability
  scores, showing _why_ a plant is/isn't recommended.
- **Model:** **Sonnet.**
- **Verification:** Component tests; E2E: defining a shady plot surfaces
  shade-tolerant crops and demotes sun-lovers.

#### Stage 3.4 — Drag-and-drop plot canvas ⭐ signature feature

- **Goal:** The core interaction — arrange plants on the plot.
- **Depends on:** 3.3, 2.2.
- **Deliverables:** A canvas representation of the plot; drag plants from the
  palette; live density/count feedback from the calculator as plants are placed;
  select/move/remove.
- **Model:** **Opus or Sonnet.** Opus if the canvas interaction + geometry proves
  fiddly; Sonnet if the calculator (2.2) already does the hard math and this is
  mostly wiring. Start Sonnet, escalate if needed.
- **Verification:** E2E drag-drop journey; placed plants show correct counts
  matching the engine's golden cases.

#### Stage 3.5 — Warnings overlay & companion suggestions UI

- **Goal:** Surface the engine's warnings and suggestions in context.
- **Depends on:** 3.4, 2.3.
- **Deliverables:** Non-intrusive warning indicators on the canvas with
  explanations; a companion-suggestion affordance that shows the evidence tag.
- **Model:** **Sonnet.**
- **Verification:** E2E: place an antagonist pair → warning appears; resolve it →
  warning clears.

#### Stage 3.6 — User-defined crops ⭐ (new capability)

- **Goal:** Let a user who has bought seeds **add their own crop** from the packet
  — name, spacing, growing season, light, category — pick an icon for it from the
  bundled set, and use it in the palette and on the canvas exactly like a shipped
  crop, for the duration of the session.
- **Depends on:** 0.3 (the relaxed schema), 3.1 (the shipped ∪ user overlay), 3.3
  (palette), 3.4 (canvas), 4.1 (the icon set to pick from).
- **Deliverables:** An add-crop form capturing the seed-packet fields, validated on
  submit with the **same `validatePlant`** the ETL uses (a user crop is a
  first-class `Plant`, not a parallel shape); slugified, `user-`-namespaced ids
  that can't collide with shipped ones; an **icon picker constrained to the bundled
  SVG set** plus the generic fallback (no external-image upload — it would break
  the self-owned-asset/licensing story _and_ taint the export canvas, see Stage
  3.7); the crop injected into the session's runtime plant list so the palette
  ranks it and the canvas can place it. User crops persist **in session state
  only** (no reload persistence — out of scope by decision).
- **Model:** **Sonnet.** Well-scoped form + validation + state wiring against the
  settled schema and palette.
- **Verification:** Component tests for the form (valid packet → a `Plant` the
  engine accepts; missing required field → a clear error); E2E: add a custom crop
  → it appears in the palette, scores against the plot, and drags onto the canvas
  with a correct count.

#### Stage 3.7 — Export the plot as an image ⭐ (new capability)

- **Goal:** Let the user **export a picture** (PNG) of the plot they've built — the
  canvas plus a **key naming the chosen crops** and the plot's **soil/climate
  settings** — to keep, print, or share. A terminal image artifact, not a
  re-loadable save.
- **Depends on:** 3.4 (the canvas) and 4.2 (icons wired, so the picture shows real
  crop icons); 3.5/3.6 for what the legend lists. Best implemented after Phase 4.
- **Deliverables:** An export action that composes plot + legend + settings and
  renders them to a downloadable image via the canvas library's own export
  (`react-konva`/Konva `toDataURL`/`toBlob` — largely built-in, §0.5). Compose the
  legend and soil/climate text into the exported frame (a Konva side layer is
  simplest). **Default to PNG** (flat illustration + text compresses badly as
  JPEG); offer JPEG as a secondary option if wanted. Export at a fixed `pixelRatio`
  so the image is crisp regardless of screen size.
- **Gotchas to handle (record in the ADR):** await `document.fonts.ready` and **all
  icon-image loads before rasterising**, or the export shows blank icons / fallback
  fonts; the canvas stays **untainted only because every icon is self-owned and
  same-origin** (Stage 4.1) — never draw an external-URL image onto it or export
  silently breaks (a reason Stage 3.6's icon picker excludes uploads).
- **Model:** **Sonnet.** Well-scoped canvas feature; the heavy lifting is
  library-provided.
- **Verification:** E2E: build a small plot → export → a non-empty PNG downloads
  whose dimensions match the fixed export size; a visual snapshot confirms icons
  and legend render (not blank). Ties into the a11y/legibility pass (6.2) for the
  key.

### Phase 4 — Content & assets

#### Stage 4.1 — SVG crop icon set

- **Goal:** A small, consistent, self-owned illustration per crop.
- **Depends on:** the crop list from Phase 1.
- **Deliverables:** Flat SVG icons (a few KB each) in one coherent style,
  bundled with the app; a documented style guide so contributors can add more;
  licensing kept clean (self-owned / permissive) per `DESIGN.md`.
- **Model:** **Sonnet** to generate/normalize SVGs and tooling; note this is
  partly a **design task** a human may prefer to own or commission. **Haiku /
  local** can handle batch normalization/optimization once the style is set.
- **Verification:** Every crop has an icon; icons pass an SVG optimizer;
  total icon payload stays within an agreed size budget (enforced by
  `app/src/icons/budget.test.ts`, since §1.4 defers CI).

#### Stage 4.2 — Wire icons into palette & canvas

- **Goal:** Replace placeholder graphics with the real icon set.
- **Depends on:** 4.1, 3.3, 3.4.
- **Deliverables:** Icons rendered in palette and on the canvas, resolved via the
  schema's icon reference; sensible fallback for a missing icon.
- **Model:** **Haiku or local qwen3-coder.** Mechanical wiring against a settled
  interface.
- **Verification:** Every dataset plant renders an icon or a defined fallback;
  visual E2E snapshot.

### Phase 5 — Offline & deployment

#### Stage 5.1 — PWA / offline support

- **Goal:** Make the app installable and fully functional offline.
- **Depends on:** a working MVP (through Phase 3, ideally 4).
- **Deliverables:** Service worker caching app shell + dataset + icons; web app
  manifest; offline-first data loading.
- **Model:** **Sonnet.**
- **Verification:** The **offline E2E test** (§1.3) passes; a locally-run
  Lighthouse PWA audit's score is recorded. (At the time this stage ran there
  was no CI at all — §1.4 — so the audit stayed a documented manual command.
  Stage 6.4 wired it in, and deliberately kept it a **reported** figure rather
  than a gate: ADR 0027.)

#### Stage 5.2 — GitHub Pages deployment

- **Status: ✅ done**, with one honestly-recorded gap: the deploy tooling and
  smoke check are built and the build-time base-path config is confirmed
  correct (`GITHUB_PAGES=true` build inspected by hand), but the actual
  `gh-pages` push and a request to the live Pages URL could not be completed
  or observed from this sandboxed session (blocked network, and enabling
  Pages is a repo-admin Settings step no session can perform). See ADR
  [0024](./docs/adr/0024-github-pages-manual-deploy.md) and `README.md`'s
  "Deployment" section for exactly what a maintainer still needs to do
  (enable Pages once, then run `npm run deploy` and `npm run smoke:deployed`).
- **Goal:** A hosted, always-current working version.
- **Depends on:** 3.x (a deployable app), ideally 5.1.
- **Deliverables:** A **manual** deploy path building the static site and
  publishing it to Pages (no GitHub Actions workflow — §1.4 explicitly defers
  all CI/CD automation, including this one, until the project is complete;
  this entry originally called for a GitHub Actions workflow before that
  ground rule was written down, and §1.4 wins); correct base-path config
  (already wired in Stage 0.1 via the `GITHUB_PAGES` env flag, and extended
  in Stage 5.1 so the PWA manifest's `start_url`/`scope` follow it); a documented,
  repeatable local/maintainer command (e.g. an npm script wrapping `gh-pages`
  or an equivalent manual publish step); README badge/link to the live site.
- **Model:** **Sonnet**, or **Haiku** if following a standard Vite-to-Pages
  recipe closely.
- **Verification:** The deployed URL loads and works; a post-deploy smoke check
  (even a simple Playwright hit against the live URL) confirms it — run by
  hand, not as a CI gate.

### Phase 6 — Community readiness & polish

#### Stage 6.0 — Fill the data gaps that actually matter ⭐ data-critical

- **Goal:** make the suitability engine mean something on the crops people
  actually grow, by curating the missing fields rather than ingesting another
  source.
- **Depends on:** 1.5 (the merge and the hard-fail gate). Nothing else.
- **Status:** **partially done.** The soil-moisture half has landed (see below);
  the crop-list half has not.

##### Why this replaced "finish the PFAF/Permapeople adapters"

This stage was originally written as "complete Stage 1.2's outstanding source
adapters". That was the wrong shape, and the evidence is worth keeping because
it is the kind of thing a fresh session would otherwise re-derive:

- **The adapter work is mostly not acquisition.** Of the OpenFarm adapter's 730
  lines, only ~15% is transport and caching. The rest is mapping and
  classification — and much of _that_ wouldn't apply, because the goal here is
  to **enrich the 162 records that existed then**, not create new ones.
- **The join would have been the real cost.** Only 95 of those 162 records join
  uniquely by scientific name; **67 (41%) sit in 16 ambiguous species groups** —
  _Brassica oleracea_ alone covers 11 crops. And PFAF has one row per species,
  so its hardiness could honestly be broadcast to all 11 while its _sowing
  season_ could not. That is an editorial problem no adapter solves.
- **The scope didn't need it.** This is a personal, non-commercial planner for
  a residential garden or allotment. It needs to say how much space peas want
  versus potatoes and whether they'll suffer somewhere dry — not to be a
  taxonomic authority.

##### Done: the curated soil-moisture table

`packages/etl/src/moisture/` — a thin enrichment slice in the Stage 1.3 spacing
table's mould (original curation keyed to a crop id, folded into the 1.5 merge,
not a `SourceAdapter`). **72 core British crops** gained a `soil.moisture`
preference; the dataset went from 2 to 74 records with soil data.

What it bought, precisely — and the small print is half the point:

- On a plot whose soil the user **hasn't** described, nothing changes. Soil
  scores `unknown-plot` rather than `unknown-plant`: the gap moved from the crop
  to the plot. Confidence stays at 0.35.
- On a plot that **does** name its moisture, 72 crops rise to 0.55 confidence and
  the palette genuinely re-orders — on dry ground rosemary and carrot now
  outrank peas and celery, with reasoning a gardener can act on ("Prefers moist
  conditions, not dry — soil is amendable, so treat this as a job rather than a
  barrier").

Both halves are pinned in `suitability/dataset.test.ts`. The plot form's "Soil
moisture" dropdown, which previously asked a question nothing could use, now
does something.

Deliberately **moisture only** — no texture, no pH. Those matter far less for
annual veg, a gardener rarely knows their pH, and skipping them cut the job by
two-thirds without costing anything the app needed.

##### Done: the crop list

The 162 shipped crops overstated what was actually there: a fifth of them could
not be grown outdoors in Britain, while **apple, pear, raspberry, Brussels
sprouts, swede and pumpkin were all absent** — something a British allotmenteer
notices in the first five minutes. Both halves of that are now fixed, and the
result is a catalogue curated for the same thing every other field in this
dataset already was.

**Six staples added** through the Stage 1.7 curated input
(`packages/etl/src/curated/plants.ts`), each with RHS-cited spacing, hardiness,
soil and season data. They are the first records to carry a _full_ set of
requirement fields, which is why they — and only they — let the engine score on
all four dimensions.

**Twenty-four crops removed** (`packages/etl/src/exclusions/`) — the ones
failing one stated test: _in an average British summer, can this crop give a
usable harvest outdoors, with no greenhouse or polytunnel?_ Twelve are
`too-tender` (a British winter kills them and they can't be grown to a harvest
as summer annuals either: the tropicals, citrus, lemongrass, ginger, olive),
twelve `wont-ripen` (they live here quite happily and never give you anything:
okra, peanut, cowpea, cumin, the three melons, loquat, pomegranate, persimmon,
feijoa, pawpaw).

The open question this entry left — **delete or flag?** — is answered in ADR
[0025](./docs/adr/0025-uk-outdoor-crop-exclusions.md): **delete**, because
flagging would need a new field on the keystone schema, a new scoring rule, new
UI, and a location model to be relative to — against an undo the app already
ships (Stage 3.6's add-crop form). What is _kept_ is the reasoning: one row per
crop, with the ground it fails on and a sentence a reader can disagree with, so
the judgement stays reviewable in version control even though the record is
gone.

Three things worth carrying forward:

- **The list is 24, not the ~32 this entry estimated.** The estimate predated
  anyone enumerating it. The difference is crops British gardeners really do
  grow outdoors, awkwardly but successfully — aubergine, chillies, sweet potato,
  soya, cape gooseberry, tomatillo, the tender herbs. Marginal is what a
  suitability score is _for_; hiding those would be the app answering a question
  it should be ranking.
- **Cultivar padding was deliberately left alone** (4 onions, 3 cauliflowers, 3
  carrots, 4 radishes, 7 squashes, 6 peppers). Every one grows here perfectly
  well, so removing them is a tidiness decision on entirely different grounds —
  worth doing one day, with its own argument, not smuggled into this one.
- **The merge needed no special-casing for the fallout.** Nine companion links
  pointed at, or were owned by, an excluded crop; the existing
  referential-integrity step dropped every one with a stated reason, because
  exclusion runs before anything joins onto a plant.

The coverage tests behaved exactly as this entry predicted — and one more than
it predicted: `suitability/`, `spacing/` **and** `warnings/dataset.test.ts` all
failed, and all were re-pinned to the new real numbers (144 crops; light
144/144, 133 full-sun and 11 partial-shade; soil 80/144; hardiness and seasons
8/144; 76 companion links on 50 records). The icon set moved with the dataset in
the same change (144 + 1 fallback).

- **Model:** **Sonnet.** Horticultural judgement about what a British plot
  actually grows, plus mechanical curation against a settled schema.
- **Verification:** ✅ `npm run verify` green; the hard-fail gate passes on the
  rebuilt dataset; every shipped id has exactly one icon; the coverage tests
  were re-pinned rather than relaxed.

#### Stage 6.1 — Documentation pass ⭐ (directly serves "easy to clone")

- **Goal:** Make the project genuinely easy for others to clone, run, understand,
  and extend.
- **Depends on:** a substantially working app.
- **Status:** **complete.**

Two of the four deliverables substantially existed already (the README, and
the how-to guides in `packages/etl/README.md`/`docs/icon-style-guide.md`), so
this stage was consolidation and an audit, not writing from scratch — see
[`docs/stage-6.1-brief.md`](./docs/stage-6.1-brief.md) for the brief that
made that call and the reasoning behind it.

- **A docs index** ([`docs/README.md`](./docs/README.md), new): "where do I
  look for X?", linking every existing how-to guide rather than duplicating
  it, plus a table for the in-app capabilities (adding your own crop,
  exporting a plot) that don't need a written guide because the UI itself
  walks a user through them.
- **A data-provenance & licensing doc**
  ([`docs/data-provenance-and-licensing.md`](./docs/data-provenance-and-licensing.md),
  new): gathers what `NOTICE`, `data/README.md` and ADRs 0009/0023/0025 each
  said in part, keeping the one point worth not softening front and centre —
  no cited page was ever fetched directly from the build environment that
  authored it, so spacing/curated-crop figures came from web-search snippets
  and the moisture/exclusion judgements cite nothing at all.
- **`docs/architecture.md` reshaped, not rewritten**: a "How to read this
  file" section up top explains it's both an overview and a stage-by-stage
  build log, and points a newcomer at the existing "Where to look next" table
  instead of the full changelog.
- **The §0.2 code-comment audit** — done for real, not ticked: sampled every
  app module by comment-to-code ratio, read the lowest-ratio files in full
  (`app/src/plot/`, `app/src/user-crops/`, `app/src/canvas/`,
  `app/src/palette/`, `app/src/warnings/`). Finding, worth recording because
  it corrects this stage's own brief: **the premise that `app/` is thinner
  than `packages/engine`/`packages/etl` didn't hold.** Every non-trivial
  function already carries a why-comment; the low ratios are JSX-heavy form
  markup, not undocumented logic. No comments were added, because the
  alternative was restating code — which §0.2 and `CONTRIBUTING.md` both
  rule out.
- **A stale-figure sweep**: found and fixed one — this table's own Stage 1.4
  row still read "85 companion links" after Stage 6.0's exclusions dropped
  nine of them (now 76 across 50 records), and `packages/etl/README.md`
  carried the same pre-exclusion figure without noting the shipped count
  differs. No other current-state doc (README, `data/README.md`, `NOTICE`,
  `docs/icon-style-guide.md`, `docs/architecture.md`'s own Stage 6.0 section)
  disagreed with the pinned dataset tests.
- **No ADR.** A docs reorganisation is not a decision a newcomer might
  question in the ADR sense (§0.2) — there was no library choice, algorithm,
  or data trade-off to record, just consolidation. Writing one anyway to
  satisfy the checklist would be exactly the thin-ADR anti-pattern the brief
  warned against.
- **Model:** **Sonnet.**
- **Verification:** ✅ `npm run verify` green (one E2E test flaked once under
  parallel workers and passed standalone and on a full re-run — unrelated to
  this stage's doc-only diff); the docs answer the newcomer test (clone →
  `docs/README.md` → running app → `packages/etl/README.md`'s "Adding a
  curated crop" or the in-app add-crop form); no stale crop-count or coverage
  figure found anywhere in the repo's current-state docs.

#### Stage 6.2 — Accessibility & responsive polish

- **Goal:** Usable on a phone in the garden and by assistive tech.
- **Depends on:** Phase 3.
- **Status:** **complete.**

Three deliverables, each landing on a finding rather than an assumption —
see [`docs/accessibility.md`](./docs/accessibility.md) for the full writeup
and ADR [0026](./docs/adr/0026-keyboard-placement-and-severity-glyphs.md)
for the reasoning behind the non-obvious calls.

- **Keyboard-operable placement.** `dnd-kit`'s `KeyboardSensor` genuinely is
  present "for free" (§0.5's promise held), but a raw 25px-per-arrow-press
  pixel drag across a potentially page-length distance, with no defined
  target position, isn't a usable _primary_ path — so every palette entry
  (`app/src/palette/PlantPalette.tsx`) also gets an "Add to plot" button that
  places the plant at the region's centre and selects it, no drag involved.
  The canvas (`app/src/canvas/PlotCanvas.tsx`) gains arrow-key nudging
  (10cm/press, 50cm with Shift) and, since Konva markers aren't focusable DOM
  elements, "Previous/Next placement" buttons
  (`PlotCanvasSection.tsx`) for keyboard-only selection.
- **Colour-contrast and ARIA, audited rather than assumed.** Two colour
  values genuinely failed WCAG AA's 4.5:1 (`BAND_COLORS.good`/`.fair` in
  `PlantPalette.tsx`, `SEVERITY_COLORS.warning` in `warnings/severity.ts`) —
  darkened one hue-step each, measured, not eyeballed. The canvas's severity
  badges were genuinely colour-only (same "!" glyph for every severity); now
  carry a distinct glyph too. Running the axe check this stage adds
  (rather than only reasoning about the DOM) found a real ARIA bug neither
  of those audits would have: `aria-label` on elements with no ARIA role at
  all (the canvas container, the outline editor's corner handles) — fixed
  with `role="group"`/`role="button"` respectively.
- **Responsive layout, the actual cause fixed, not a media query.**
  `docs/review-pre-deployment.md`'s canvas-at-y≈3500px finding was caused by
  the plant palette rendering **every** matching crop with no height limit at
  all — an unbounded number that grows with the dataset, confirmed by that
  review's own note that "the figure was chosen when the palette was
  shorter". Capping the list to a `65vh` scrolling box is the structural fix;
  `overflow-x` wrapper containers on the canvas and outline editor stop a
  large plot from forcing the whole page to scroll horizontally. Verified on
  real 390×844 and 320×568 viewports (Playwright device emulation), not by
  reasoning about CSS: no horizontal overflow at either size, even with a
  10m×10m plot; canvas moved from an unbounded, still-growing number to a
  measured y≈2678px.

**Verification left behind, matching Stage 5.1's Lighthouse shape exactly:**
a locally-runnable axe check (`app/e2e/a11y.spec.ts`, its own Playwright
config so it's never part of `npm run e2e`/`verify`, `npm run a11y`) —
**today's result: 0 violations** in both a fresh load and a
placed-and-selected state — and a scripted, keyboard-only walkthrough
(`app/keyboard-walkthrough.mjs`, `npm run keyboard-walkthrough`) of the core
journey, recorded honestly including what it found still doesn't work
perfectly: reaching the canvas after a keyboard placement takes ~35 tab
presses in a six-crop search match (a "Skip to plot canvas" link now helps
the _other_ direction — jumping to the canvas before placing something — but
not that specific case), and the free-form outline-corner drag
(`PlotOutlineEditor.tsx`) stays pointer-only, out of this stage's
two-place scope (palette→canvas, on-canvas move/remove) but a real gap for a
future stage to pick up.

- **Model:** **Sonnet.**
- **Verification:** ✅ `npm run verify` green (two component tests needed
  longer explicit timeouts — `App.test.tsx`, `PlotDefinitionPage.test.tsx` —
  because mounting a second interactive control on ~130+ palette rows
  measurably slows jsdom, a documented, accepted cost, not a regression);
  `npm run a11y` — 0 violations; the keyboard-only walkthrough completed with
  its findings recorded in `docs/accessibility.md`.

#### Stage 6.3 — Final validation & coverage pass

- **Goal:** Confirm the whole system holds together before calling it v1.
- **Depends on:** everything.
- **Deliverables:** Fill test-coverage gaps on engine and data; a full E2E
  regression run; a documented manual QA checklist for release.
- **Model:** **Sonnet**; **Opus** if a deep bug hunt across the engine is needed.
- **Verification:** ✅ `npm run verify` green (lint, typecheck, format:check,
  372 engine + 276 etl + 166 app tests, build, 7/7 e2e with no flake this
  run); `npm run a11y` — 0 violations, unchanged; the keyboard-only
  walkthrough — same findings as Stage 6.2, unchanged; `npx lighthouse@11 …
--only-categories=pwa` — 0.88/1.00, unchanged since Stage 5.1 (same single
  failing audit, the PNG-splash-screen requirement); the offline test
  confirmed both by the automated suite and by hand against the preview
  server. No deep engine bug turned up, so this stayed Sonnet throughout. The
  coverage audit found and closed real gaps rather than chasing every
  uncovered branch — several remaining ones turned out to be
  schema-guaranteed-unreachable defensive code, left alone rather than padded
  with tests that would just restate the type system (see `docs/qa-checklist.md`
  §6 for the full before/after). The manual QA checklist
  ([`docs/qa-checklist.md`](./docs/qa-checklist.md)) written and indexed from
  `docs/README.md`.

#### Stage 6.4 — Continuous integration (the deferred automation, finally)

- **Goal:** Automate the checks §1.4 has been deferring since Stage 0.1, now
  that "until the project is complete" has arrived.
- **Depends on:** everything — this is deliberately **last**. §1.4's ground
  rule is that no stage adds `.github/workflows/`, and that rule holds right up
  until this stage; Stage 0.1 originally shipped a CI workflow and it was
  removed again precisely to keep it.
- **Deliverables:** A `.github/workflows/` directory containing a checks
  workflow that runs **`npm run verify`** (lint → typecheck → format:check →
  test → build → e2e) on push and pull request, plus the offline, a11y and
  Lighthouse runs the later stages describe. §1.4 is the specification and it
  is a tight one: **automate exactly that list and nothing else** — "nothing
  that isn't already a check a contributor can run by hand." A check that only
  exists in CI is a check nobody can reproduce locally, which is the failure
  mode this deferral was protecting against.
- **Optionally, deploy-on-merge.** Stage 5.2 ships a _manual_ Pages deploy
  only because §1.4 forbade the workflow. That constraint lifts here, so
  automating the deploy is now available — but it is a separate decision from
  automating the checks, and the manual command must keep working either way.
- **Gotchas to expect:** the runner needs Node 20+ and a browser for
  Playwright (`npx playwright install --with-deps chromium`) — note that this
  repo's own config supports a `PW_EXECUTABLE_PATH` override for environments
  that ship their own Chromium, which a standard runner will not need. Cache
  `~/.npm` and the Playwright browsers or the E2E job dominates the run time.
  Expect to pin the workflow to the same Node version `engines` declares.
- **Model:** **Sonnet**, or **Haiku** following a standard Node-workspace
  Actions recipe. The judgement call is scope discipline — resisting the pull
  to add checks CI could run but a contributor can't. _(Run on **Opus** in the
  end, because the stage also carried the project's closing cross-cutting audit
  — see the closing section below.)_
- **Verification:** ✅ **Proven green → red → green on a real pull request**
  ([#23](https://github.com/JasperCain01/garden_planner/pull/23)), the same
  "prove the gate actually gates" standard Stage 1.5 set for the dataset gate:
  - **Green** — run
    [30304247320](https://github.com/JasperCain01/garden_planner/actions/runs/30304247320)
    on the first commit: all three jobs pass. The `audits` job measured the PWA
    score at **0.88/1.00** with the same single failing audit, and the keyboard
    walkthrough at **35 tab presses** — both identical to the by-hand figures
    Stage 6.3 recorded, which is the evidence that the workflow is measuring the
    same thing the documented commands do.
  - **Red** — run
    [30304630722](https://github.com/JasperCain01/garden_planner/actions/runs/30304630722),
    after deliberately breaking one assertion in
    `packages/engine/src/suitability/model.test.ts`: `verify` fails (`Process
completed with exit code 1`) while `a11y` and `audits` correctly stay green,
    since neither runs the unit suites. The gate really gates, and it gates on
    the right job.
  - **Green again** — run
    [30304805688](https://github.com/JasperCain01/garden_planner/actions/runs/30304805688)
    on the revert: all three jobs pass.
  - `npm run verify` also green locally throughout (166 app tests, 7/7 E2E, no
    flake).

---

## 3. Dependency map & suggested order

```
0.1 ─► 0.2 ─► 0.3 ─┬─► 1.1 ─► 1.2 ─┐
                   ├─► 1.3 ────────┤
                   ├─► 1.4 ────────┼─► 1.5 ─► 2.1 ─► 2.2 ─► 2.3
                   ├─► 1.6 ────────┤
                   └─► 1.7 ────────┘   (1.7 curated crops also feed the 1.5 merge)
0.1 ─► 3.1 ─► 3.2 ─► 3.3 ─► 3.4 ─► 3.5
(0.3 · 3.3 · 3.4 · 4.1) ─► 3.6   user-defined crops
(3.4 · 4.2) ─────────────► 3.7   export plot as image
Phase 1 crop list ─► 4.1 ─► 4.2
MVP ─► 5.1 ─► 5.2
1.5 ─────────────────────► 1.8   curated soil-moisture slice (done)
1.5 ─────────────────────► 6.0   fills the remaining data gaps by curation
6.0 ─► 6.1, 6.2, 6.3 ─► 6.4      6.4 (CI) is deliberately last
```

Natural critical path: **0.1 → 0.2 → 0.3 → (data phase) → engine → frontend →
offline → deploy → finish the data → docs → CI.** Phases 1 (data) and 3 (frontend scaffolding) can proceed in
parallel by different sessions once 0.2 exists, since the frontend can start
against sample data before the full dataset is built.

## 4. Model-tier summary

| Tier                                       | Stages                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Opus** (keystone / algorithmic)          | 0.2, 0.3, 1.5, 2.1, 2.2 (+ optionally 3.4, 6.3)                                                                    |
| **Sonnet** (bulk of the build)             | 0.1, 1.1, 1.2 (first adapter), 1.3, 1.4, 1.6, 1.7, 2.3, 3.1–3.7, 4.1, 5.1, 5.2, 6.0 (first adapter), 6.1, 6.2, 6.4 |
| **Haiku / local qwen3-coder** (mechanical) | 1.2 (later adapters), 1.7 (later crop rows), 4.2, parts of 4.1 & 5.2, 6.0 (second adapter), 6.4 (standard recipe)  |

Rule of thumb: **Opus where a wrong decision is expensive to unwind; Sonnet for
well-scoped feature work; Haiku/local for mechanical work against a settled
pattern with machine-checkable output.** Prefer the local model (qwen3-coder) for
the mechanical tier when you want offline, zero-cost iteration — it fits the
project's self-hostable ethos.

---

## 5. v1: what this is, and what it isn't

> **This build plan is complete.** Every stage from 0.1 to 6.4 is ✅ in the
> Progress table above. There is no Stage 6.5 and no next brief — §0.6's
> hand-off discipline ends here, deliberately, because there is no next stage
> to hand off to. What follows is the sign-off: what v1 actually is, what is
> deliberately outside it, and where each excluded thing is tracked.

### 5.1 What v1 is

A **fully static, offline-capable, client-side planner for edible gardens and
allotments**, deployable to GitHub Pages with no server and no runtime
database (§0.1, ADR 0003):

- **A curated dataset of 144 crops** for British outdoor growing, built by a
  build-time ETL pipeline and committed as a plain-JSON artifact that fails
  the build loudly if any record is invalid (Phase 1, ADR 0009's gate). CC0-1.0
  (ADR 0023), with per-record provenance kept for checkability rather than for
  licence compliance.
- **A framework-free engine** — suitability scoring with an explicit
  missing-data policy, a method-aware spacing/density calculator over an
  arbitrary polygon, and warnings plus companion suggestions (Phase 2, ADRs
  0012–0014).
- **The whole core loop as a working UI** — describe a plot, see a ranked and
  filterable palette, drag crops onto a canvas with live density feedback, and
  get warnings that clear when you move things apart (Phase 3) — plus two
  capabilities beyond it: user-defined crops from a seed packet, and plot-image
  export.
- **A bundled SVG icon per shipped crop**, generated rather than hand-drawn
  (Phase 4, ADR 0019).
- **Installable and genuinely offline** after one visit, proven by an E2E test
  that turns the network off and re-runs the core journey (Stage 5.1), with a
  documented one-command Pages deploy (Stage 5.2).
- **A keyboard-operable alternative to every drag interaction**, an audited
  colour-contrast/ARIA pass, and a bounded, phone-usable layout (Stage 6.2).
- **Every check automated on push and pull request** (Stage 6.4), with the
  deliberate constraint that CI runs nothing a contributor can't reproduce
  locally.

### 5.2 The post-v1 backlog — every parked gap, with its disposition

Nothing here is an oversight, and nothing here is "someone should probably
look at this someday". Each item is **intentionally deferred as post-v1
backlog, tracked here**, with the reason it was parked and what would unblock
it. Anyone picking one up should read the linked record first — the reasoning
is already written down.

| Gap                                                                        | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The free-form outline editor's corner handles are pointer-only.**        | Intentionally deferred as post-v1 backlog. Stage 6.2 scoped the keyboard-drag work to exactly two places (palette→canvas, on-canvas move/remove) and did both; the corner handles carry `role="button"` but deliberately **no** `tabIndex`, because a focusable-but-inert control is worse than an unfocusable one (ADR 0026). Unblocked by designing a real keyboard interaction for reshaping an outline — a design question, not a wiring one.                                                                                                                                                                                                                                             |
| **No real screen-reader testing** (NVDA/VoiceOver/JAWS).                   | Intentionally deferred as post-v1 backlog. Every automated session that has worked on this repository has been headless, and axe plus a scripted keyboard walkthrough prove reachability and operability, not that state changes are _announced_ usefully. Unblocked by a human with assistive-tech software, not by more code. Recorded in `docs/accessibility.md` §5.                                                                                                                                                                                                                                                                                                                       |
| **Hardiness/season data covers 8 of 144 crops.**                           | Intentionally deferred as post-v1 backlog, and it is a **data** gap, not an engine bug — the engine says so per-crop, with a confidence figure. Stage 6.0 measured that curation can't close it at scale and that PFAF/Permapeople (Stage 1.2's unstarted adapters) are **not planned** (ADR 0023's context, ADR 0006's dated note). Unblocked only by a new, freely-licensed source with cultivar-level data.                                                                                                                                                                                                                                                                                |
| **Lighthouse's splash-screen audit fails (0.88, not 1.00).**               | Intentionally deferred as post-v1 backlog, and arguably won't-fix. The legacy audit hard-requires a **PNG** icon ≥512px; this project ships SVG icons throughout (ADR 0022). Closing it means shipping a raster icon purely to satisfy one audit. Unblocked by deciding that trade is worth it — the score is reported in CI on every run, so the number can't drift unnoticed.                                                                                                                                                                                                                                                                                                               |
| **GitHub Pages is enabled on the wrong source, and the app is not live.**  | Deferred as post-v1 backlog, but **half-closed at Stage 6.4**: `npm run deploy` was run for real for the first time, so the `gh-pages` branch now exists and carries a verified build (correct base path, right files at the root). What remains is the repo-admin half no session can do — Pages still builds from `main`, so **Settings → Pages → Source must be switched to `gh-pages`**, then `npm run smoke:deployed`. The first real deploy also surfaced two untidy-but-harmless details recorded in README.md: `gh-pages` leaves root dotfiles from the old branch content behind, and there is no `.nojekyll` guard. See README.md's "Deployment" section and ADR 0024's dated note. |
| **No deploy-on-merge workflow.**                                           | Intentionally deferred as post-v1 backlog, with a full decision record and a ready-to-paste workflow in ADR [0028](./docs/adr/0028-deploy-on-merge-not-automated.md). Unblocked by the row above: automating a deploy to a branch nothing serves would be automation that looks like it works.                                                                                                                                                                                                                                                                                                                                                                                                |
| **`react-router`'s RSC-mode CSRF advisory stays unpatched.**               | Intentionally deferred as post-v1 backlog, and **deliberately not "fixed"**: the advisory is server-side-only and this app has no server, no RSC and no route actions, and the only available "fix" is a downgrade that discards seven minor versions. Triaged in full in [`docs/security-review.md`](./docs/security-review.md) §1. Unblocked by upstream shipping a patched 7.x.                                                                                                                                                                                                                                                                                                            |
| **Build-time glob/template DoS advisories** (eslint / workbox chain).      | Intentionally deferred as post-v1 backlog. Build-time only, never shipped, and the only inputs are this repository's own config globs. Fixing them needs major bumps of `vite-plugin-pwa`/`eslint` that buy nothing. See [`docs/security-review.md`](./docs/security-review.md) §1.                                                                                                                                                                                                                                                                                                                                                                                                           |
| **GBIF ids are `null` for all 144 records.**                               | Intentionally deferred as post-v1 backlog. GBIF has been unreachable from every environment that has run the build, so the resolver has never had a live answer to cache. It costs nothing today (OpenFarm is the only full-plant source, so there is nothing to reconcile _across_), and the join design upgrades for free if the block ever lifts — ADR 0005's dated note has the detail.                                                                                                                                                                                                                                                                                                   |
| **`focus` after "Add to plot" takes ~35 tab presses to reach the canvas.** | Intentionally deferred as post-v1 backlog. Real friction, not a dead end, and the obvious fix (move focus automatically) is itself an accessibility anti-pattern if done carelessly. Recorded with its trade-offs in `docs/accessibility.md` §5.                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### 5.3 If you are picking this up cold

Read [`docs/README.md`](./docs/README.md) first — it is the "where do I look
for X?" index, and it will get you to the right file faster than this plan
will. For _why_ something is the way it is, [`docs/adr/`](./docs/adr/) has one
record per non-obvious decision. For _what was built when_, the Progress table
at the top of this file, and `docs/architecture.md` for the same story in
prose. The per-stage briefs (`docs/stage-*-brief.md`) are historical hand-offs:
each one describes the repository as it was **before** that stage, so read the
one for the work you're picking up, not the others.

## 6. Appendix — the original first step

Start with **Stage 0.1** (Sonnet). It's self-contained, unblocks everything, and
establishes the conventions the rest of the plan assumes.

_(Kept for the record. Stage 0.1 shipped long ago and every stage after it is
now ✅ — see the Progress table.)_
