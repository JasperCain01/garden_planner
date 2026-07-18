# Stage 0.2 brief — Data schema definition ⭐ keystone

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md) and
[`WORKPLAN.md`](../WORKPLAN.md) first; this brief just concentrates Stage 0.2's
requirements so you don't have to reconstruct them.

## Goal

Define the **canonical plant-record schema** that every later stage builds on
(ETL adapters, the engine, the UI). Getting the shape right here — especially the
method-aware spacing — is what avoids expensive rework, which is why the workplan
flags this Opus-tier.

## Where it lives

The schema is domain data with no UI dependency, so it belongs in the
framework-free engine package:

- `packages/engine/src/schema/` — types + validation.
- Export the public types and validators from `packages/engine/src/index.ts`
  (replacing the current scaffold marker, or alongside it).

Use **zod** as the single source of truth and derive the TypeScript types from it
(`z.infer`), so runtime validation and static types can never drift. Add zod to
the engine workspace. A JSON Schema can be generated from the zod schema if
useful for the ETL later, but zod is authoritative.

## Fields the plant record must cover

Model these (names are a guide, not fixed). Edibles-only scope.

- **Identity**: stable `id` (slug), `commonName`, `scientificName`, `gbifId`
  (nullable — filled by the resolver in Stage 1.1), optional cultivar/synonyms.
- **Edible category**: e.g. vegetable / herb / fruit (an enum), plus edible parts
  if easy.
- **Light requirement**: an ordered enum (full sun / partial shade / full shade)
  — ordered so the engine can score "how far off" a plot is, not just match/no.
- **Spacing (method-aware — the crux)**: capture that spacing depends on growing
  method (see `DESIGN.md` §2 "A note on what spacing data actually is"):
  - row growing: `inRowCm` and `betweenRowCm`
  - intensive/square-foot: a density figure (`perSquareMetre` or plants-per-square)
  - Make the structure explicit so the calculator (Stage 2.2) can pick a method.
    A plant may have some but not all methods populated.
- **Hardiness**: a rating usable against the location/climate data (Stage 1.6) —
  decide a representation (e.g. RHS hardiness band and/or min temperature °C) and
  record the choice in the ADR.
- **Soil**: preferences (texture/pH/moisture) as small enums; all optional.
- **Seasons**: sowing and harvest windows as month ranges (1–12). Keep it simple
  and Britain-oriented for now.
- **Companion links**: references to other plant `id`s, split into companions and
  antagonists, **each carrying an evidence tag** (`well-supported` /
  `traditional`) per `DESIGN.md`. Referential integrity is enforced later at
  dataset-build time (Stage 1.5), not necessarily in the per-record schema.
- **Icon reference**: a key resolving to the SVG icon set (Stage 4.1).
- **Provenance**: per-record (and ideally per-field where practical) source
  attribution — needed for the CC BY-NC-SA obligations and honesty about data
  origin.

## Validation rules to bake in

- Sensible bounds: spacing values `> 0`; month values in `1..12`; enums closed.
- Optionality: most requirement fields optional (real data is patchy), but
  identity (`id`, `commonName`, `scientificName`) required.
- Provide a `validatePlant(input): Plant` (throwing) or safe-parse wrapper the
  ETL will call as its hard-fail gate in Stage 1.5.

## Deliverables

1. The zod schema + inferred TypeScript types under `packages/engine/src/schema/`.
2. Public exports from the engine index.
3. **Unit tests** (Vitest): a valid sample record for 2–3 real crops
   (e.g. onion, lettuce, a fruit) parses; representative invalid records are
   rejected (bad month, negative spacing, unknown enum, missing required field).
   These sample records double as documentation.
4. **ADR** `docs/adr/0004-plant-schema.md`: explain the schema shape — above all
   the **method-aware spacing** decision and the **hardiness representation** —
   with alternatives considered. Add it to the ADR index.
5. Update `data/README.md` and/or `docs/architecture.md` if the schema location
   or approach needs reflecting.

## Definition of done (per WORKPLAN §0.3)

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all green
from the repo root; new code clearly commented (WORKPLAN §0.2); ADR written;
docs updated; committed and pushed to `claude/garden-planner-design-36olf3`.

## Notes / gotchas for the fresh session

- **Toolchain quirks already solved in Stage 0.1** (don't re-discover): the repo
  pins a single Vite 6 copy with Vitest 3 — don't reintroduce a second Vite.
  Playwright's preinstalled browser needs `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium`
  when running `npm run e2e` locally (not needed for 0.2 unless you touch E2E).
- Keep the engine **framework-free** — no React/DOM imports in the schema.
- Don't build the ETL or ingest real data here — that's Phase 1. Stage 0.2 is
  schema + validation + tests only.
