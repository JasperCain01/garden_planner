# Docs index — where do I look for X?

This page exists so you don't have to guess which file answers your
question. It links to the docs that already answer things rather than
repeating them — if you find yourself duplicating a paragraph from
somewhere else into this file, that's a sign it belongs as a link instead.

## I'm new here

1. [Root `README.md`](../README.md) — what this is, quick start (`npm
install && npm run dev`), offline use, deployment, and the honest
   "caveat worth knowing" about how uneven the shipped data's coverage is.
2. [`DESIGN.md`](../DESIGN.md) — the concept: what problem this solves, the
   data-source assessment, and the original licensing reasoning (superseded
   in part — see below).
3. [`docs/architecture.md`](./architecture.md) — how the pieces fit
   together, stage by stage. It's long because it's also the project's build
   log; see its own "How to read this" note for a shorter path through it.

That's the whole path from clone to a running app. From there, the fastest
way to see the app do something is the plot-definition page itself: pick a
shape, describe your plot's light (and optionally soil/location), and the
palette below ranks the shipped crops against it.

## I want to add or change something in the shipped data

All of these are in [`packages/etl/README.md`](../packages/etl/README.md),
written as the pipeline was built — they're the "how", not duplicated here:

| I want to…                                           | Guide                                                                                                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a crop to the shipped dataset permanently        | `packages/etl/README.md`'s ["Adding a curated crop"](../packages/etl/README.md#adding-a-curated-crop) section                                                                           |
| Add a hand-verified spacing figure                   | `packages/etl/README.md`'s ["Adding a crop to the spacing table"](../packages/etl/README.md#adding-a-crop-to-the-spacing-table) section                                                 |
| Record a soil-moisture preference                    | `packages/etl/README.md`'s ["Adding a moisture row"](../packages/etl/README.md#adding-a-moisture-row) section                                                                           |
| Mark a crop as not growable outdoors in the UK       | `packages/etl/README.md`'s ["Adding an exclusion"](../packages/etl/README.md#adding-an-exclusion) section                                                                               |
| Add a companion/antagonist relationship              | `packages/etl/README.md`'s ["Adding a companion/antagonist relationship"](../packages/etl/README.md#adding-a-companionantagonist-relationship) section                                  |
| Add a new external data source (a `SourceAdapter`)   | `packages/etl/README.md`'s ["Adding a source"](../packages/etl/README.md#adding-a-source-pfaf-permapeople-and-beyond) section                                                           |
| Run the ETL pipeline / regenerate `data/plants.json` | `packages/etl/README.md`'s ["Running it"](../packages/etl/README.md#running-it) and ["Building the dataset"](../packages/etl/README.md#building-the-dataset-srcmerge-stage-15) sections |
| Add or replace a crop icon                           | [`docs/icon-style-guide.md`](./icon-style-guide.md)'s ["Adding an icon for a new crop"](./icon-style-guide.md#adding-an-icon-for-a-new-crop) section                                    |

Any of these that change `data/plants.json` also need the icon set
regenerated (a test enforces one icon per shipped id) — the icon guide above
covers that step too.

**Adding your own crop from a seed packet, without touching the shipped
data, is an in-app form** (Workplan Stage 3.6) — open the running app and
use "Add a crop" on the plot-definition page. It's session-only (not
written to `data/plants.json`) and deliberately relaxed-schema (no
scientific name or citation required), unlike every guide in the table
above. There's no separate written walkthrough for it because the form
itself, with its inline field-level validation, is the walkthrough; see
[ADR 0011](./adr/0011-user-defined-crop-schema.md) if you want the schema
reasoning behind what it does and doesn't ask for.

**Exporting a plot as an image** is likewise a single button ("Export
image", next to the canvas) rather than a guide — see
[ADR 0020](./adr/0020-plot-export-canvas-compositing.md) if you want to know
how the export pipeline itself works.

## I want to know how accessible or responsive the app is

[`docs/accessibility.md`](./accessibility.md) (Workplan Stage 6.2) — the
keyboard-operable alternative to drag-and-drop, the colour-contrast/ARIA
audit, the responsive-layout fix and its measured before/after numbers, the
locally-runnable axe check (today's result recorded in
[`README.md`](../README.md#accessibility-axe-check)), and a scripted
keyboard-only walkthrough of the core journey with its findings — including
what's still pointer-only, recorded honestly rather than hidden. See ADR
[0026](./adr/0026-keyboard-placement-and-severity-glyphs.md) for the
reasoning behind the keyboard-interaction model.

## I want to know where a fact came from, or what I can do with the data

[`docs/data-provenance-and-licensing.md`](./data-provenance-and-licensing.md)
— one page gathering what `NOTICE`, `data/README.md` and three ADRs
(0009, 0023, 0025) each say about sourcing and licensing, including the one
point worth reading closely: no cited page was ever fetched directly from
the build environment that authored this dataset.

## I want to understand _why_ something was built the way it was

[`docs/adr/`](./adr/) — Architecture Decision Records, one per non-obvious
choice (a library, an algorithm, a data trade-off). Start at
[`docs/adr/README.md`](./adr/README.md) for the index and the format. Every
ADR referenced elsewhere in this index is also indexed there.

## I want to see the build plan, or what's done and what's left

[`WORKPLAN.md`](../WORKPLAN.md) — the staged build plan. §0 has the ground
rules every stage follows (read this if you're about to make a change and
aren't sure what's expected); the Progress table tracks what's shipped;
later sections have the full brief for each stage, past and future.

## I want to contribute a change

[`CONTRIBUTING.md`](../CONTRIBUTING.md) — the short version of `WORKPLAN.md`
§0's ground rules, plus the definition-of-done commands to run before
opening a change.

## Historical / archival

These record a point-in-time snapshot rather than the current state — useful
for the reasoning, not for today's figures (check
`packages/engine/src/{suitability,spacing,warnings}/dataset.test.ts` for
those instead):

- [`docs/review-pre-deployment.md`](./review-pre-deployment.md) — a
  pre-deployment review from before Stage 6.0's crop-list curation; its
  crop counts predate the current dataset.
- `docs/stage-*-brief.md` — the brief handed to the session that built each
  stage. Each one front-loads what existed before that stage started; read
  the one for the stage you're picking up, not the others.
