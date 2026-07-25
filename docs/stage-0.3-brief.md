# Stage 0.3 brief — schema amendment for user-defined crops ⭐ keystone

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1 "Beyond the core loop") and [`WORKPLAN.md`](../WORKPLAN.md) (§0 ground rules
and the Stage 0.3 entry) first; this brief concentrates the requirements and the
one trap that makes this an Opus stage. Stages 0.1–1.6 are done and on the
branch you'll be given — build on the Stage 0.2 schema
(`packages/engine/src/schema/plant.ts`), **don't redefine it**.

## Goal

Let the canonical plant schema describe a crop a **user** enters from a seed
packet — not only a fully-sourced record produced by the ETL — so Stage 3.6
(user-defined crops) can add one from the packet's fields alone. A user has
"Cherry Belle", not _Raphanus sativus_, and has no citation to offer; the schema
must accept that **without** letting _shipped_ data quietly skip the same fields.

## Why this is a keystone, and why now

The plant schema is the single source of truth the engine (Phase 2) and the whole
UI (Phase 3) build on. Relaxing it is cheap while only tests depend on the shape
and expensive to unwind once scoring, packing, and the palette are written against
the stricter one — so it lands here, before Phase 2, not when Stage 3.6 finally
needs it (`WORKPLAN.md` Stage 0.3, "Why now").

## The trap: one validator is doing two jobs

`validatePlant` / `PlantSchema` is currently **the ETL's hard-fail gate for
_shipped_ data**, at three call sites:

- `packages/etl/src/sources/openfarm/map.ts:129` — validates each mapped OpenFarm
  record.
- `packages/etl/src/resolve/apply-resolution.ts:26` — re-validates a record after
  attaching its `gbifId`.
- `packages/etl/src/merge/validate.ts:71` — the whole-dataset gate
  (`safeValidatePlant`) that guarantees "no malformed record ever ships".

If you simply make `scientificName` and `provenance` optional on `PlantSchema`,
**all three of those silently weaken**: the build would now accept a shipped
record with no botanical name and no attribution — exactly the CC BY-NC-SA /
provenance guarantee Stage 1.5 (`docs/adr/0009`) exists to enforce. **This is the
cross-cutting risk that makes the stage Opus.** Whatever you choose, a shipped
record must still be required to carry full identity + provenance, and a test
must prove it.

## The decision to make (and document in the ADR)

There is no single obviously-correct shape; pick one and record why. Two clean
options:

1. **Separate input schema, keep the base strict (recommended default).** Leave
   `PlantSchema`/`validatePlant` exactly as they are (shipped bar unchanged, all
   three ETL call sites untouched). Add a `UserPlantInputSchema` /
   `validateUserPlantInput` that captures only what a packet gives (common name,
   spacing, light, category, optional seasons/hardiness/soil, chosen icon), with
   `scientificName` and `provenance` **absent**. Then a small **upcast adapter**
   turns that input into a full, valid `Plant` — synthesising
   `provenance: { sources: [{ source: 'user-entered' }] }`, defaulting
   `scientificName` to the common name (the schema only requires `min(1)`, not a
   real binomial), `gbifId: null`, and a `user-`-namespaced `id`. **Payoff:** the
   relaxation lives only at the input boundary; everything downstream — the
   engine, palette, canvas, and the runtime plant list — still sees nothing but
   fully-valid `Plant`s, so there is zero divergence to maintain and the ETL gate
   is untouched by construction.
2. **Relax the base, add a strict shipped validator.** Make the two fields
   optional on `PlantSchema`, and add a `ShippedPlantSchema` /
   `validateShippedPlant` superset that re-requires them. Then **switch all three
   ETL call sites above** to the strict validator. Simpler type story (one
   `Plant`), but it is only safe if every shipped-data path is migrated — miss one
   and the guarantee leaks. If you choose this, a test must assert a
   provenance-less record fails `validateShippedPlant` _and_ that the merge gate
   uses it.

Either way: **the user path is permissive, the shipped path stays strict**, and
the boundary between them is explicit and tested — not left to whoever calls
which function.

## What to build

1. The chosen schema change under `packages/engine/src/schema/` (keep zod the
   single source of truth; derive every type via `z.infer`, exactly as
   `plant.ts` does), exported from the engine's public surface
   (`schema/index.ts` → `index.ts`).
2. The **upcast/adapter** (option 1) or the **strict shipped validator + call-site
   migration** (option 2), whichever you chose.
3. A documented **`user-` id-namespacing convention** so a user crop's `id` can
   never collide with a shipped `id` (Stage 3.6 will slugify the packet name and
   apply it; the rule and a helper belong here, next to the schema).
4. Confirm user crops need **no companion/antagonist links** (a packet doesn't
   supply them), so they raise no referential-integrity concern in Stage 3.1's
   runtime `shipped ∪ user` list — note this so Stage 3.6 doesn't re-litigate it.

## Deliverables

1. The schema amendment + user-input validator/adapter under
   `packages/engine/src/schema/`, publicly exported.
2. **Unit tests (Vitest):** a minimal user-shaped input (common name + spacing +
   light + category; **no** scientific name, **no** source) is accepted and
   upcasts to a `validatePlant`-clean `Plant`; a **shipped** record still **fails**
   if it lacks provenance/scientific name (whichever mechanism enforces that); the
   `user-` id rule is enforced; and **every existing Stage 0.2 sample record still
   parses unchanged** (no regression to the shipped shape).
3. **ADR** `docs/adr/0011-user-defined-crop-schema.md` (see outline below); add it
   to `docs/adr/README.md`'s index.
4. Update `docs/architecture.md`'s schema note and `data/README.md` if the schema
   surface changes.

## ADR outline (`docs/adr/0011-user-defined-crop-schema.md`)

Mirror the shape of `docs/adr/0004` / `0009`:

- **Status / Date / Workplan stage** (0.3).
- **Context** — the two jobs `validatePlant` does today; the three shipped-data
  call sites; the requirement to loosen the user path without loosening the
  shipped path; link to `DESIGN.md` §1 and Stage 3.6.
- **Decision** — which option (1 or 2); the exact fields made optional / the exact
  new schema+validator; the upcast rules (synthesised provenance string, default
  scientific name, `gbifId: null`, `user-` id); the id-namespacing convention.
- **Alternatives considered** — the option you didn't take, and "just relax the
  base with no strict shipped validator" (rejected: silently weakens the Stage 1.5
  gate).
- **Consequences** — what stays a full `Plant` downstream; that the ETL gate is
  unchanged (option 1) or migrated (option 2); that user provenance is honestly
  labelled `user-entered`; that a user "scientific name" may just be the common
  name and nothing downstream should assume it's a real binomial.

## Definition of done (WORKPLAN §0.3)

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all green
from the repo root; new code commented per §0.2; ADR written; docs updated. Run
`/code-review` and `/verify` before finishing. **Write the brief for the next
stage** (§0.6) — the natural next stage is **2.1 (suitability scoring engine,
Opus)**, which can now run against the real `data/plants.json`; note that Stage
3.6 (user-defined crops) is unblocked by this stage but sits later in the
frontend track. Commit and push to the branch you're given.

## Notes / gotchas for the fresh session

- **Keep the engine framework-free** — no React/DOM in the schema (WORKPLAN §0.2).
- **Toolchain quirks already solved (don't re-discover):** single pinned Vite 6 /
  Vitest 3; Node ≥ 20; ESM (`"type": "module"`); strict TS with
  `verbatimModuleSyntax` (use `import type` for type-only imports). `packages/engine`
  uses **explicit `.ts` extensions** on relative imports (see `index.ts`'s
  `export * from './schema/index.ts'`) because the ETL CLI loads the engine via
  `node --experimental-strip-types`; match that convention in any new file.
- **Don't build the form or the ETL curated input here.** The add-crop UI is Stage
  3.6; the maintainer's curated full-`Plant` dataset input is Stage 1.7. Stage 0.3
  is schema + validator/adapter + tests + ADR only.

## Model

**Opus** — `WORKPLAN.md` Stage 0.3. A keystone-schema change whose one wrong move
(loosening shipped-data validation while loosening the user path) is exactly the
cross-cutting, expensive-to-unwind error §0.4 reserves for Opus.
