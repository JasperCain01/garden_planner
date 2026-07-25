# Stage 2.3 brief — warnings & companion-suggestion engine

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1 step 4 "Validate continuously", and §2 "Companion planting data") and
[`WORKPLAN.md`](../WORKPLAN.md) (§0 ground rules and the Stage 2.3 entry) first;
this brief concentrates the requirements, the shape of the real data, and the
conventions Stages 2.1 and 2.2 set that this stage should follow rather than
reinvent.

Stages 0.1–1.6, 0.3, **2.1 and 2.2** are all merged into `main` — **branch from
`main`**. You have a real dataset (`data/plants.json`, 160 plants), a settled
plant schema, a climate module, a working suitability engine and a working
spacing/density calculator. Build on them; don't redefine any of them.

## Goal

Turn the two engines' outputs into **actionable warnings and companion
suggestions**: the last piece of `DESIGN.md`'s core loop, and what Stage 3.5
renders on the canvas. Five warning kinds are named in the Workplan — wrong
light, overcrowding, wrong sowing season, antagonist adjacency, climate mismatch
— each carrying a human-readable explanation, plus companion suggestions that
surface the **evidence tag** from Stage 1.4.

## Where it lives

`packages/engine/src/warnings/` (or `advice/` — your call, but pick one and say
why in the ADR) — a new module beside `schema/`, `climate/`, `suitability/` and
`spacing/`, exported from `src/index.ts` the way `suitability/index.ts` and
`spacing/index.ts` are. Framework-free: no React, no DOM (WORKPLAN §0.2).

## What you are building on (read these before designing)

### Stage 2.1 gave you machine-readable findings on purpose

[`docs/adr/0012`](./adr/0012-suitability-scoring.md) §6 splits every dimension's
verdict into a `finding` from a closed vocabulary (`match` / `marginal` /
`mismatch` / `unsuitable` / `unknown-plant` / `unknown-plot`) **and** a
human-readable `reason`, precisely so this stage keys rules off the former and
**never parses the prose**. `SuitabilityResult.limitedBy` already lists the
dimensions that came out `unsuitable`. Three of your five warning kinds — wrong
light, wrong sowing season, climate mismatch — are therefore mostly a matter of
mapping `(dimension, finding)` pairs onto warnings and deciding severity; the
scoring is done.

Note the missing-data policy while you do it: 0 of the 160 shipped records carry
hardiness, soil or seasons, so a naive "warn on anything that isn't `match`"
rule would fire on every crop for reasons that are gaps in our data rather than
problems with the plot. `unknown-plant` and `unknown-plot` are distinguished for
exactly this reason — one is our gap, the other is a question the UI can ask the
user. **Decide and record what each `unknown-*` produces** (probably: nothing,
or at most a quiet "we can't check this" note that is not a warning).

### Stage 2.2 gave you counts, positions and densities

[`docs/adr/0013`](./adr/0013-spacing-density-calculator.md) is the one to read
for the overcrowding rule and the antagonist-adjacency rule. What it hands you:

- `fitPlant(plant, region, options)` → a `SpacingCalculation` with `count`,
  `densityPerSquareMetre`, `grid.areaPerPlantCm2`, `grid.inRowCm` /
  `betweenRowCm` / `rowPitchCm`, every plant's `position`, and `spacingSource`
  (`recorded` / `derived-from-row` / `derived-from-intensive`).
- A **plot region** is an arbitrary simple polygon in centimetres
  (`PlotRegionSchema`, `validatePlotRegion`/`safeValidatePlotRegion`, presets as
  factory functions). Non-convex is the normal case.
- Geometry primitives you will want rather than rewrite: `polygonArea`,
  `polygonBoundingBox`, `pointInPolygon`, `rectInsidePolygon`,
  `regionAreaSquareMetres`, `regionBoundingBox`.

**What 2.2 deliberately did _not_ decide, and you must:** the calculator counts
_one_ crop into _one_ region. It has no notion of two different crops placed
near each other, and therefore no notion of "planted nearby". The
antagonist-adjacency rule needs that, in centimetres, on a polygon. Options
worth weighing in your ADR:

- a fixed threshold (e.g. "within 50 cm"), simple but arbitrary;
- a **spacing-derived** threshold — the mean or max of the two crops' between-row
  distances, say — which scales with the crops involved and reuses data you
  already have;
- **region overlap or proximity** if Stage 3.4 ends up placing crops as sub-regions
  rather than points (worth checking what shape 3.4 actually wants before you fix
  this, since the two stages have to agree).

Whatever you pick, the engine must take the placement as an argument and stay
pure — no reading a canvas, no DOM.

For **overcrowding**, note that 2.2's counts are already conservative and
whole-cell-based: a plant only counts if its whole allotted rectangle fits. So
the natural rule is not "did they exceed the count?" (the calculator would never
have produced more) but "has the user _placed_ more than the calculator says
fits, or placed them closer than the crop's spacing?". `count`,
`densityPerSquareMetre` and `grid.areaPerPlantCm2` are the figures to compare
against. Also decide what to do about `spacingSource !== 'recorded'` — an
overcrowding warning derived from a derived spacing figure deserves softer
wording, and the field is there so you can tell.

### Companion data: real, but thin, and mostly folklore

Stage 1.4 ([`docs/adr/0008`](./adr/0008-companion-planting-data.md)) built the
relationship dataset. What actually ships today, counted from
`data/plants.json`:

| Links         | Records                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `companions`  | **56/160 records**, 85 links — **3 `well-supported`, 82 `traditional`** |
| `antagonists` | **6/160 records**, 6 links (3 reciprocal pairs)                         |

The three antagonist pairs are the _entire_ shipped basis for the
antagonist-adjacency warning: **garlic ↔ green-bean** and **onion ↔ pea** (both
`traditional`), and **potato ↔ tomato** (`well-supported`). Build the fixture
plot the Workplan asks for around those; don't expect the dataset to give you
more.

Three consequences to design around, not discover:

1. **The `evidence` tag is mandatory on every link** (ADR 0004 §4, ADR 0008) and
   the UI must be honest about it — companion planting mixes science and
   folklore, and 82 of the 85 companion links are the folklore end. Carry the
   tag through to the suggestion, don't average it away, and consider whether a
   `traditional` link should be presented as a suggestion at all or only as a
   softer "gardeners often say…". Say what you chose in the ADR.
2. **Links are directed and the dataset is reciprocal where it should be**, but
   referential integrity is guaranteed by the Stage 1.5 build gate, not by the
   record schema. Within the shipped artifact you can rely on every `plantId`
   resolving.
3. **User-defined crops carry no links at all** (ADR 0011 §4 — the form doesn't
   collect them, and there'd be nothing to cite). A user crop must therefore
   never produce or receive a companion suggestion, and must never trip an
   antagonist warning. Make sure the rules degrade to silence rather than to a
   crash or a false "no companions known" that reads like a claim about the
   crop.

## What to build

1. **A warning type with a closed vocabulary.** Follow Stage 2.1's precedent:
   machine-readable fields (a `kind`, a severity, the plant/plants involved, and
   whatever the UI needs to locate it) **plus** a human-readable sentence. Stage
   3.5 renders these; nothing should have to parse the sentence to know what
   kind of warning it is.
2. **The five rules**, each independently testable, each explaining itself:
   wrong light, overcrowding, wrong sowing season, antagonist adjacency, climate
   mismatch. Three of them are thin wrappers over 2.1's findings; two are new
   work over 2.2's geometry.
3. **Companion suggestions** for what is already placed, carrying the evidence
   tag, and honest about how thin the well-supported set is.
4. **A single entry point** the UI calls with a plot (region + conditions) and
   its placed crops, returning all warnings and suggestions at once — Stage 3.5
   wants one call per state change, not five.

## Conventions to follow (they are settled, don't re-litigate)

- **Inputs are zod, outputs are plain TypeScript types** (ADR 0012 §7,
  ADR 0013 §7). A placement description crosses a trust boundary and should be
  zod-first with `z.infer` types; a computed warning does not and should not.
- **Reuse the vocabulary that exists.** `LightRequirementSchema`,
  `PlotConditionsSchema`, `PlotRegionSchema`, `MonthSchema`, `EvidenceLevel`,
  `SuitabilityFinding` — all already exported from `@garden-planner/engine`.
  Restating any of them is the mistake this project keeps successfully avoiding.
- **Tunable numbers in one file** (`model.ts`), the way `suitability/model.ts`
  and `spacing/model.ts` do it. Severity thresholds and adjacency distances are
  exactly the kind of number that will want re-tuning.
- **Explanations are a deliverable, not a debug aid.** "Onion and pea are
  traditionally said to grow poorly together, and these are 20 cm apart" beats
  "antagonist: true".
- **Wrap-around-aware month helpers already exist** in
  `suitability/month-range.ts` — you probably _do_ want them for the sowing-season
  rule.

## Constraints & gotchas already solved (don't re-discover)

- **`npm install` first.** The container starts with no `node_modules`, and
  `npm run typecheck` fails with a confusing "Cannot find type definition file
  for 'node'" until you install.
- **Toolchain:** single pinned Vite 6 / Vitest 3; Node ≥ 20; ESM; strict TS with
  `verbatimModuleSyntax` (use `import type`). `packages/engine` uses **explicit
  `.ts` extensions on relative imports**; test files import siblings **without**
  the extension (see any `*.test.ts` in `src/suitability/` or `src/spacing/`).
- **Reading the dataset from a test** works: see `src/spacing/dataset.test.ts`
  or `src/suitability/dataset.test.ts` (resolve `../../../../data/plants.json`
  against `import.meta.url`, then `validatePlant` each record). Testing against
  the real records as well as fixtures is what pins a model to the data that
  ships — and it is how the "only 6 antagonist links exist" fact above was
  established rather than assumed.
- **The network is blocked** at the egress proxy for external sources
  (GBIF/PFAF/RHS all 403). You need nothing from the network for this stage.
- **There is no `.claude/` skills directory in this repo**, so the `/verify` and
  `/code-review` commands the older briefs reference do not exist. Review your
  own diff instead.
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` from the repo root, plus `npm run format:check` (Prettier is
  enforced; `npx prettier --write` the files you touch).
- **Don't build the UI.** The warnings overlay is Stage 3.5, the canvas is 3.4
  and the palette is 3.3 — expose what they need, but don't write them here.

## Deliverables

1. The warnings/suggestions module under `packages/engine/src/`, publicly
   exported, commented per WORKPLAN §0.2.
2. **Unit tests (Vitest):** one per warning type; **a fixture plot deliberately
   triggering each warning** (the Workplan's own verification criterion); tests
   that companion suggestions respect evidence tags; a test that a user-defined
   crop (via `createUserPlant`) produces neither companion suggestions nor
   antagonist warnings; and a dataset test pinning today's link coverage as a
   tripwire, the way `spacing/dataset.test.ts` pins the 9 intensive records.
3. **ADR** `docs/adr/0014-…md`: the warning model (kinds, severity, how the
   explanation is represented), what each `unknown-*` finding produces, the
   adjacency rule and the distance it settles on, the overcrowding rule, and how
   evidence tags are surfaced. Mirror the shape of `0012`/`0013`, and add it to
   `docs/adr/README.md`'s index.
4. Update `docs/architecture.md` (the engine bullet and the "Where to look next"
   table).
5. **Write the brief for the next stage** (WORKPLAN §0.6 — a requirement, not a
   courtesy). The dependency map branches after 2.3: Phase 2 is complete, so the
   natural next stage is **3.1 (app shell, state & routing, Sonnet)**, which
   unblocks 3.2 → 3.3 → 3.4 → 3.5. Note in that brief that the engine now offers
   three consumable surfaces (`rankPlants`, `fitPlant`, and this stage's
   warnings), that `PlotRegionSchema` is the shape 3.2 must produce, and that
   Stage 3.1's runtime plant list is "shipped dataset ∪ session-scoped user
   crops" (ADR 0011) which the engine is deliberately indifferent to.

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean; new
code commented per §0.2; ADR written and indexed; `docs/architecture.md`
updated; the next stage's brief written. Commit and push to the branch you're
given.

## Model

**Sonnet** — `WORKPLAN.md` Stage 2.3. The hard geometry (2.2) and the hard
scoring model (2.1) are both done and settled; this stage is well-scoped rules
work over two stable contracts. The one genuinely open design question is what
"planted nearby" means, and the ADR is where to settle it.

## Also unblocked (but not next)

Stage **1.7** (maintainer-curated crops) is independent of Phase 2 entirely and
is the one thing that would move suitability scoring's confidence above 0.35 for
shipped records — see [`adr/0012`](./adr/0012-suitability-scoring.md)
§Consequences. It would also give the spacing calculator more than nine records
with a real intensive figure.
