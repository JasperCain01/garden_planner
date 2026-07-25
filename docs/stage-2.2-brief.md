# Stage 2.2 brief — spacing / density calculator ⭐ algorithmic

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1 "The two calculations that make it useful" and §2 "A note on what 'spacing
data' actually is") and [`WORKPLAN.md`](../WORKPLAN.md) (§0 ground rules and the
Stage 2.2 entry) first; this brief concentrates the requirements, the shape of
the real spacing data, and the conventions Stage 2.1 just set that this stage
should follow rather than reinvent.

Stages 0.1–1.6, 0.3 **and 2.1** are done and on the branch you'll be given. You
have a real dataset (`data/plants.json`, 160 plants), a settled method-aware
spacing schema, a climate module, and a working suitability engine. Build on
them; don't redefine any of it.

## Goal

"**How many onions can I fit?**" — pure, framework-free functions that compute a
realistic plant count from a crop's method-aware spacing and a **plot region**,
respecting the region's _shape_ rather than just its area, and offering **square
vs. offset (hexagonal) packing**. This is the second of the two calculations
`DESIGN.md` says make the app useful, and the Workplan calls it the most
algorithmically subtle piece in the app.

## Where it lives

`packages/engine/src/spacing/` — a new module beside `schema/`, `climate/` and
`suitability/`, exported from `src/index.ts` the way `suitability/index.ts` is.
Framework-free: no React, no DOM (WORKPLAN §0.2).

> Note the name collision to avoid confusing yourself: `packages/etl/src/spacing/`
> already exists and is the **hand-verified spacing table** (build-time curation,
> ADR 0007). This stage is the run-time _calculator_, in the engine. Different
> package, different job.

## What to build

1. **A plot-region type.** What the user has drawn or typed: at minimum a
   rectangle in centimetres or metres. Decide whether to support more (an L-shape,
   a polygon, a circle) — and if you defer, define the type so a shape can be
   added without a breaking change, exactly as ADR 0010 §6 did for geocoding.
   zod as the single source of truth, types via `z.infer`, reusing existing
   vocabulary where it exists.
2. **The count functions**, per growing method:
   - **Row** — from `spacing.row` (`inRowCm` × `betweenRowCm`), laying rows across
     the region. Rows have an orientation; whether the caller chooses it or the
     calculator picks the better one is your call to make and document.
   - **Intensive** — from `spacing.intensive` (`perSquareMetre` and/or
     `plantsPerSquare`, where a "square" is a 30 cm × 30 cm square-foot cell).
     Note both figures are optional and either may be the only one present.
3. **Square vs. offset (hexagonal) packing** as an explicit option, with the
   geometry documented. Offset packing buys roughly 15% more plants for the same
   spacing; the row-offset arithmetic (`√3/2 × spacing` between rows) is the
   subtle part and deserves a worked comment.
4. **A result that explains itself.** Follow Stage 2.1's precedent: the count is
   not enough on its own — return the method used, the packing used, the
   effective grid, and a short human-readable line the UI can show ("28 onions:
   7 rows of 4 at 10 cm × 30 cm"). Stage 3.4 shows live count feedback as plants
   are dragged, and Stage 2.3 raises an overcrowding warning; both need more than
   an integer.

## The data you'll actually be calculating from

Check this before designing, the same way Stage 2.1's brief made you check
requirement coverage. In today's `data/plants.json`:

| Spacing shape             | Records                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `row` only                | **151/160**                                                                                                     |
| `row` **and** `intensive` | 9/160 (beet, carrot, garlic, green-bean, lettuce, onion, pea, radish, tomato — the Stage 1.3 hand-verified set) |
| `intensive` only          | 0/160                                                                                                           |

So **the intensive path has nine real records to test against, and the offset/
square-foot story is effectively untested by the shipped data** — build
hand-built fixtures for it, and say so in the ADR. Every `intensive` block that
does exist carries `plantsPerSquare` and no `perSquareMetre`, so the
"either figure may be the only one present" branch is real: don't assume
`perSquareMetre` is there. Also note a user-defined crop (ADR 0011) can supply
either or both.

`spacing` is guaranteed present with at least one method (ADR 0004 §2), so
"a plant with no spacing" is not a case you need to handle — but "this crop has
no intensive figure and the user asked for intensive" very much is. Decide
whether to fall back to row spacing, derive a density from it, or report that
the method isn't available, and record the choice.

## Conventions Stage 2.1 set that this stage should follow

Read [`docs/adr/0012`](./adr/0012-suitability-scoring.md) — it is short, and it
settles house style for engine modules. In particular:

- **Inputs are zod, outputs are plain TypeScript types.** A computed result is
  never parsed from untrusted input, so it doesn't need a runtime validator; the
  _inputs_ (a plot region here, plot conditions there) cross a trust boundary and
  do. See `suitability/conditions.ts` for the boundary-function pattern
  (`resolvePlotConditions`), and mirror `validate…`/`safeValidate…` naming.
- **Explanations are a deliverable, not a debug aid.** Stage 2.1 pairs a
  machine-readable `finding` with a human-readable `reason` on every dimension,
  precisely so Stage 2.3 keys rules off the former and never parses the latter.
  Do the same for anything 2.3 will consume.
- **The model's numbers live in one file** (`suitability/model.ts`) so they can
  be re-tuned in one place. If this stage has tunable constants (packing
  efficiency, edge allowances), give them the same treatment.
- **Round computed floats** (`roundScore` in `model.ts` uses 4 dp) so results are
  stable across platforms and readable in test expectations. Counts are integers,
  but any intermediate density figure you expose isn't.
- Wrap-around-aware month helpers already exist in
  `suitability/month-range.ts` if you need them (you probably don't).

## Constraints & gotchas already solved (don't re-discover)

- **Toolchain:** single pinned Vite 6 / Vitest 3; Node ≥ 20; ESM
  (`"type": "module"`); strict TS with `verbatimModuleSyntax` (use `import type`).
  `packages/engine` uses **explicit `.ts` extensions on relative imports**;
  test files import siblings **without** the extension (see any `*.test.ts` in
  `src/suitability/`).
- **`npm install` first.** The container starts with no `node_modules`, and
  `npm run typecheck` fails with a confusing "Cannot find type definition file for
  'node'" until you install.
- **Reading the dataset from a test** works: see
  `src/suitability/dataset.test.ts` for the pattern (resolve
  `../../../../data/plants.json` against `import.meta.url`, then `validatePlant`
  each record). Testing against the real records as well as hand-built fixtures is
  what pins the model to the data that actually ships — do the same here.
- **The network is blocked** at the egress proxy for external sources
  (GBIF/PFAF/RHS all 403). You need nothing from the network for this stage.
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` from the repo root, plus `npm run format:check` (Prettier is
  enforced; `npx prettier --write` the files you touch).
- **There is no `.claude/` skills directory in this repo**, so the `/verify` and
  `/code-review` commands the older briefs reference do not exist. Review your own
  diff instead.
- **Don't build the UI.** The canvas is Stage 3.4, the plot form is Stage 3.2 and
  the palette is 3.3. Overcrowding warnings are Stage 2.3 — expose what the rule
  needs, but don't write the rules engine here.

## Deliverables

1. The calculator module under `packages/engine/src/spacing/`, publicly exported,
   commented per WORKPLAN §0.2.
2. **Unit tests (Vitest):** golden cases against **hand-worked answers** (do the
   arithmetic in the comment, as `suitability/score.test.ts` does); the Workplan's
   **property-based tests** — monotonicity (a bigger region never yields fewer
   plants; wider spacing never yields more) and the **area upper bound** (a count
   never exceeds region area ÷ per-plant area); zero and degenerate regions (zero
   width, a region narrower than one plant's spacing); the intensive path against
   the nine real records that have one; and offset-vs-square on hand-built
   fixtures.
3. **ADR** `docs/adr/0013-spacing-density-calculator.md`: the region model, the
   packing geometry and its assumptions (edges, part-rows, rounding — a plant that
   half-fits doesn't), the method-selection/fallback rule, and how counts are
   explained. Mirror the shape of `0012`/`0011`, and add it to
   `docs/adr/README.md`'s index.
4. Update `docs/architecture.md` (the engine bullet and the "Where to look next"
   table).
5. **Write the brief for the next stage** (WORKPLAN §0.6, a requirement not a
   courtesy) — the natural next stage is **2.3 (warnings & companion-suggestion
   engine, Sonnet)**, which depends on 2.1, 2.2 and 1.4. Note in it that Stage
   2.1 exposes `finding`/`limitedBy` precisely so 2.3's rules need not parse
   prose; that companion links exist on only 56/160 records and carry a mandatory
   `evidence` tag (ADR 0008) the UI must be honest about; and that user-defined
   crops carry no links at all (ADR 0011 §4).

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean; new
code commented per §0.2; ADR written and indexed; `docs/architecture.md` updated;
the Stage 2.3 brief written. Commit and push to the branch you're given.

## Model

**Opus** — `WORKPLAN.md` Stage 2.2. The packing geometry is the most
algorithmically subtle piece in the app, and the region/packing model has lasting
consequences for the canvas (3.4) and the overcrowding warnings (2.3).

## Also unblocked (but not next)

Stage **3.3** (the plant palette) is unblocked by 2.1 and needs only 3.2 before
it; it is the first place a user sees the scoring engine's reasoning. Stage
**1.7** (maintainer-curated crops) is independent of Phase 2 entirely and is the
one thing that would move suitability scoring's confidence above 0.35 for shipped
records — see `docs/adr/0012` §Consequences.
