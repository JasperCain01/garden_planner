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

A stage is complete only when: deliverables exist; `lint`, `typecheck`, and the
test suite pass; the app still builds; new code is commented per 0.2; any
non-obvious decision has an ADR; and relevant docs are updated. Run the repo's
`/verify` and `/code-review` skills before considering a stage finished.

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

**Licensing (confirmed): non-commercial.** Code under a permissive/copyleft OSS
licence (MIT or GPL); the shipped **dataset** under **CC BY-NC-SA** to honour
PFAF's terms, with attribution recorded in a `NOTICE`/provenance file.

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
- **Offline test.** An E2E run that loads the app, goes offline, and confirms it
  still functions — this is a _requirement_, so it gets an explicit test.
- **PWA / performance audit.** A Lighthouse check in CI for installability and
  offline readiness.

### 1.4 Continuous validation (the safety net)

- **CI on every push** runs: lint → typecheck → unit → component → build → E2E →
  dataset validation. A stage that breaks any of these is not done.
- **Deploy preview.** The GitHub Pages deploy (Stage 5.2) runs on merge so the
  hosted version is always current and testable.

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
  - test runner configured; CI workflow (lint/typecheck/test/build); `README`
    skeleton; `LICENSE` for code (MIT or GPL; dataset licence is CC BY-NC-SA,
    finalized with attribution in Stage 1.5 per PFAF terms); `CONTRIBUTING.md`;
    ADRs recording the stack and framework choices (§0.5).
- **Model:** **Sonnet.** Well-understood setup work; some judgement on structure.
- **Verification:** `npm install && npm run build && npm test` succeeds from a
  clean clone; CI passes on the first push.

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
  file (PFAF is CC BY-NC-SA → dataset inherits non-commercial share-alike; record
  this in an ADR).
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
- **Model:** **Opus.** The packing geometry is the most algorithmically subtle
  piece in the app.
- **Verification:** Golden cases against hand-worked answers; **property-based
  tests** (monotonicity, area upper bound); zero/degenerate-region cases.

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
  **GitHub Pages base path** (this bites early if ignored), dataset-loading layer.
- **Model:** **Sonnet.**
- **Verification:** App loads the bundled dataset and renders a placeholder;
  builds correctly under the Pages base path.

#### Stage 3.2 — Plot definition UI

- **Goal:** Let the user describe their plot.
- **Depends on:** 3.1, 1.6.
- **Deliverables:** Inputs for dimensions (and/or draw a shape), light level
  (with per-area zones if feasible — see open questions in `DESIGN.md`), soil,
  and location (defaulting to Britain).
- **Model:** **Sonnet.**
- **Verification:** Component tests for input validation; produces a plot object
  the engine accepts.

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
  total icon payload stays within an agreed size budget (checked in CI).

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
- **Verification:** The **offline E2E test** (§1.3) passes; Lighthouse PWA audit
  passes in CI.

#### Stage 5.2 — GitHub Pages deployment

- **Goal:** A hosted, always-current working version.
- **Depends on:** 3.x (a deployable app), ideally 5.1.
- **Deliverables:** A GitHub Actions workflow building the static site and
  deploying to Pages; correct base-path config; deploy-on-merge; README badge /
  link to the live site.
- **Model:** **Sonnet**, or **Haiku** if following a standard Vite-to-Pages
  recipe closely.
- **Verification:** The deployed URL loads and works; a post-deploy smoke check
  (even a simple Playwright hit against the live URL) confirms it.

### Phase 6 — Community readiness & polish

#### Stage 6.1 — Documentation pass ⭐ (directly serves "easy to clone")

- **Goal:** Make the project genuinely easy for others to clone, run, understand,
  and extend.
- **Depends on:** a substantially working app.
- **Deliverables:** A complete `README` (what it is, live link, one-command local
  run, offline use); an **architecture overview** tying `DESIGN.md`, the ADRs,
  and the code together; a **data-provenance & licensing** doc (sources, PFAF
  attribution, dataset licence); and **how-to guides**: "add a plant", "add a
  companion relationship", "add an icon", "run the ETL". Verify code comments
  meet §0.2 across the codebase.
- **Model:** **Sonnet.**
- **Verification:** A newcomer (or a fresh session simulating one) can go from
  clone to running app and to adding a plant using only the docs.

#### Stage 6.2 — Accessibility & responsive polish

- **Goal:** Usable on a phone in the garden and by assistive tech.
- **Depends on:** Phase 3.
- **Deliverables:** Keyboard-operable drag-drop alternative, colour-contrast and
  ARIA passes, responsive layout for small screens.
- **Model:** **Sonnet.**
- **Verification:** Automated a11y checks (e.g. axe) in CI; manual keyboard-only
  walkthrough of the core journey.

#### Stage 6.3 — Final validation & coverage pass

- **Goal:** Confirm the whole system holds together before calling it v1.
- **Depends on:** everything.
- **Deliverables:** Fill test-coverage gaps on engine and data; a full E2E
  regression run; a documented manual QA checklist for release.
- **Model:** **Sonnet**; **Opus** if a deep bug hunt across the engine is needed.
- **Verification:** Full CI green including offline + a11y + PWA audits; manual
  QA checklist completed.

---

## 3. Dependency map & suggested order

```
0.1 ─► 0.2 ─┬─► 1.1 ─► 1.2 ─┐
            ├─► 1.3 ────────┼─► 1.5 ─► 2.1 ─► 2.2 ─► 2.3
            ├─► 1.4 ────────┘                 │
            └─► 1.6 ──────────────────────────┘
0.1 ─► 3.1 ─► 3.2 ─► 3.3 ─► 3.4 ─► 3.5
Phase 1 crop list ─► 4.1 ─► 4.2
MVP ─► 5.1 ─► 5.2
all ─► 6.1, 6.2, 6.3
```

Natural critical path: **0.1 → 0.2 → (data phase) → engine → frontend → offline →
deploy → docs.** Phases 1 (data) and 3 (frontend scaffolding) can proceed in
parallel by different sessions once 0.2 exists, since the frontend can start
against sample data before the full dataset is built.

## 4. Model-tier summary

| Tier                                       | Stages                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| **Opus** (keystone / algorithmic)          | 0.2, 1.5, 2.1, 2.2 (+ optionally 3.4, 6.3)                                          |
| **Sonnet** (bulk of the build)             | 0.1, 1.1, 1.2 (first adapter), 1.3, 1.4, 1.6, 2.3, 3.1–3.5, 4.1, 5.1, 5.2, 6.1, 6.2 |
| **Haiku / local qwen3-coder** (mechanical) | 1.2 (later adapters), 4.2, parts of 4.1 & 5.2                                       |

Rule of thumb: **Opus where a wrong decision is expensive to unwind; Sonnet for
well-scoped feature work; Haiku/local for mechanical work against a settled
pattern with machine-checkable output.** Prefer the local model (qwen3-coder) for
the mechanical tier when you want offline, zero-cost iteration — it fits the
project's self-hostable ethos.

---

## 5. First step

Start with **Stage 0.1** (Sonnet). It's self-contained, unblocks everything, and
establishes the conventions the rest of the plan assumes.
