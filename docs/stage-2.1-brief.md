# Stage 2.1 brief — suitability scoring engine ⭐ keystone

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1 the core loop, §3 "What the app actually does with the data") and
[`WORKPLAN.md`](../WORKPLAN.md) (§0 ground rules and the Stage 2.1 entry) first;
this brief concentrates the requirements and, more importantly, **the shape of the
real data you'll be scoring** — which is not what you'd assume.

Stages 0.1–1.6 **and 0.3** are done and on the branch you'll be given. You have a
real dataset (`data/plants.json`, 160 plants), a real climate module, and a settled
plant schema. Build on them; don't redefine any of it.

## Goal

The "brain": **pure, framework-free functions that score any `Plant` against a
plot's conditions**, producing a ranked, explainable suitability result. The UI
(Stage 3.3's palette) ranks crops with it and shows the user _why_ a crop scored
as it did, so **the reasoning is a deliverable, not a debug aid**.

## Where it lives

`packages/engine/src/` — a new module beside `schema/` and `climate/` (e.g.
`packages/engine/src/suitability/`), exported from `src/index.ts` the way
`climate/index.ts` is. Framework-free: no React, no DOM (WORKPLAN §0.2).

## What to build

1. **A plot/conditions input type** — what the user will describe in Stage 3.2:
   light level, soil (texture/pH/moisture), and a location resolved to a
   `ClimateProfile`. Reuse the Stage 0.2 vocabulary (`LightRequirementSchema`,
   `SoilTextureSchema`, `SoilPhSchema`, `SoilMoistureSchema`) rather than restating
   it — a plot's light level and a plant's light requirement must be the same enum
   so `lightRequirementRank` can measure the distance between them. zod as the
   single source of truth, types via `z.infer`, exactly as every other schema
   module does.
2. **Per-dimension scorers** — light, hardiness (vs. the location's climate band),
   soil, season — each returning a score _and_ a short human-readable reason.
3. **An aggregate `scorePlant(plant, conditions)`** combining them into one ranked
   result that carries the per-dimension breakdown. **The weighting/aggregation
   model is the design decision of this stage** — record it in the ADR.
4. **A ranking helper** over a plant list (the palette's entry point).

## The one thing that will surprise you: the real data is sparse

Check this before designing the scoring model — it is the single biggest
constraint, and it is easy to design a beautiful four-dimension scorer that in
practice returns the same number for all 160 plants. In today's
`data/plants.json`:

| Field        | Coverage                                     |
| ------------ | -------------------------------------------- |
| `light`      | **160/160** (146 full-sun, 14 partial-shade) |
| `spacing`    | 160/160 (151 row-only, 9 with intensive)     |
| `category`   | 160/160 (97 vegetable, 34 fruit, 29 herb)    |
| `companions` | 56/160                                       |
| `hardiness`  | **0/160**                                    |
| `soil`       | **0/160**                                    |
| `seasons`    | **0/160**                                    |
| `gbifId`     | `null` on all 160 (GBIF blocked — ADR 0009)  |

So: **light is effectively the only requirement dimension with real coverage
today**, and it has only two distinct values in the shipped data. Hardiness, soil
and season scoring must be built (the schema and the climate module support them,
Stage 1.7 will add curated records that populate them, and a **user-defined crop
can supply all three** — see below), but the model has to behave sensibly when a
dimension is **absent**, and "absent" must not silently mean "perfect match" or
"total mismatch". Decide the unknown-data policy explicitly, make it visible in the
result's reasoning ("no hardiness data for this crop"), and record it in the ADR —
this is the judgement call that makes the stage Opus.

## What Stage 0.3 changed that matters here

Stage 0.3 ([`docs/adr/0011`](./adr/0011-user-defined-crop-schema.md)) added
user-defined crops **without changing `Plant`**. Consequences for you:

- **Everything you score is a plain, fully-valid `Plant`.** A user crop is upcast
  to one at the input boundary (`createUserPlant`), so the engine never sees a
  half-populated record and needs no origin-awareness. Stage 3.1 will hand you a
  `shipped ∪ user` list; don't special-case it.
- **Don't treat `scientificName` as a botanical name.** For a user crop it is just
  the common name. It is a display/identity field, never a key.
- A user crop **can** carry `hardiness`, `soil` and `seasons` (the form offers
  them) even though no shipped record does today — another reason the
  unknown-data policy must be per-record, not a global "we have no hardiness data".
- User crops carry **no** companion/antagonist links, by design. Relevant to Stage
  2.3, not to scoring, but don't build anything that assumes links exist.

## What the climate module already gives you (Stage 1.6, ADR 0010)

Import from `@garden-planner/engine`; don't re-derive any of it:

- `resolveClimate(location?)` → a `ClimateProfile`, **fully offline**, defaulting to
  the UK national profile. A location is a discriminated union of `default`,
  `region` (by `regionId`) and `coordinates` (`lat`/`lng`, nearest region wins).
- `ClimateProfile` carries `hardiness` (an RHS band + optional `minTempC`, the
  **same `HardinessSchema` a plant carries**, so compare with `rhsHardinessRank`
  and no conversion), `frost` (last spring / first autumn frost as month+day), and
  a derived `growingSeason` `MonthRange`.
- `MonthRange` **wraps around the new year** (`end < start` is meaningful and
  legal — see `MonthRangeSchema`'s docs). Any "is month M in range R" helper you
  write must handle that; there isn't one yet, and the engine is the right home
  for it.

## Deliverables

1. The scoring module under `packages/engine/src/`, publicly exported, with the
   conditions/plot schema, per-dimension scorers, the aggregate scorer, and the
   ranking helper — all commented per WORKPLAN §0.2.
2. **Unit tests (Vitest):** golden cases as documented worked examples (a full-sun
   crop in a shady plot, a tender crop in a cold region, a perfect match); the
   sparse-data cases (a plant with no hardiness/soil/seasons — i.e. **every record
   in the shipped dataset**); edge cases the workplan names — no matching plants,
   an all-shade plot; and ranking stability/ordering. Score against real records
   from `data/plants.json` as well as hand-built ones, so the tests prove the
   engine works on the data that actually ships.
3. **ADR** `docs/adr/0012-suitability-scoring.md`: the score scale, the weighting
   and aggregation model, **the unknown/missing-data policy**, and how reasoning is
   represented. Mirror the shape of `0004`/`0009`/`0011`. Add it to
   `docs/adr/README.md`'s index.
4. Update `docs/architecture.md` (the engine bullet) to describe the new module.
5. **Write the brief for the next stage** (WORKPLAN §0.6) — the natural next stage
   is **2.2 (spacing/density calculator, Opus)**, which depends on 2.1's
   conventions; note in it that the shipped data is 151/160 row-only spacing, so
   the intensive path needs hand-built fixtures.

## Notes / gotchas already solved (don't re-discover)

- **Toolchain:** single pinned Vite 6 / Vitest 3; Node ≥ 20; ESM
  (`"type": "module"`); strict TS with `verbatimModuleSyntax` (use `import type`).
  `packages/engine` uses **explicit `.ts` extensions on relative imports** (see
  `src/index.ts`) because the ETL CLI loads the engine via
  `node --experimental-strip-types` — match that in new files. Test files import
  siblings **without** the extension (see `schema/plant.test.ts`).
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` from the repo root, plus `npm run format:check` (Prettier is
  enforced; `npx prettier --write` the files you touch).
- **The network is blocked** at the egress proxy for external data sources
  (GBIF/PFAF/RHS all return 403). You need nothing from the network for this stage
  — everything is local. Don't add a fetch.
- **Don't build the UI.** The palette is Stage 3.3, the plot form is Stage 3.2.
  Stage 2.1 is scoring functions + tests + ADR. Warnings and companion suggestions
  are Stage 2.3 — expose enough reasoning for them to build on, but don't write the
  rules engine here.

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; new code commented per
§0.2; ADR written and indexed; `docs/architecture.md` updated; the Stage 2.2 brief
written. Run `/code-review` and `/verify` before finishing. Commit and push to the
branch you're given.

## Model

**Opus** — `WORKPLAN.md` Stage 2.1. Core domain logic whose scoring model has
lasting consequences for the palette, the warnings engine, and every explanation
the UI shows.

## Also unblocked (but not next)

Stage **3.6** (user-defined crops) is unblocked by Stage 0.3 but sits later in the
frontend track — it needs the palette (3.3), the canvas (3.4) and the icon set
(4.1) first. Its schema work is already done; see ADR 0011.
