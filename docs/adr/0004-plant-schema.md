# 0004 — Plant-record schema (zod as source of truth; method-aware spacing)

## Status

Accepted (Stage 0.2).

## Context

Stage 0.2 defines the **canonical plant record** — the single data shape every
later stage depends on: the ETL adapters (Phase 1) emit it, the suitability and
spacing engine (Phase 2) consumes it, and the UI (Phase 3) renders it. The
Workplan flags this as an Opus-tier keystone because a wrong call here is
expensive to unwind once four other stages are built on top of it.

Three questions had to be settled: **how the schema and its types are authored**
(so runtime validation and static types can't drift), **how spacing is modelled**
(the crux — see `DESIGN.md` §2), and **how hardiness is represented** (so it can
be scored against climate data in Stage 1.6/2.1).

The schema lives in `packages/engine/src/schema/`, exported from the engine's
public index. The engine is deliberately framework-free (no React/DOM), so the
schema stays reusable and unit-testable in isolation.

## Decision

### 1. zod is the single source of truth; TypeScript types are derived

The schema is written once as zod schemas, and every TypeScript type is derived
with `z.infer`. There is no hand-written `interface Plant` that could fall out of
sync with the validator. Runtime validation (what the ETL's hard-fail gate needs)
and compile-time types (what the engine and UI need) are therefore guaranteed to
describe the same shape.

Two public validators are exposed:

- `validatePlant(input): Plant` — **throws** on the first invalid record. This is
  the hard-fail gate the dataset build (Stage 1.5) calls; invalid data must never
  ship, so failing the build is the desired behaviour.
- `safeValidatePlant(input)` — returns zod's non-throwing `{ success, … }` result
  so a whole-dataset validation pass can collect _all_ failures for a report.

A JSON Schema can be generated from the zod schema later if the ETL wants one, but
zod stays authoritative.

### 2. Spacing is method-aware (the crux)

Spacing is **not a single number**, because the number depends on the growing
method (`DESIGN.md` §"A note on what spacing data actually is"). Onions are ~4 cm
in-row × 30 cm between rows in a traditional plot, but ~8 cm on all sides
(9 per square-foot square) in an intensive bed — same plant, different densities.
A record storing one number would silently choose a method for the user.

So spacing is a structured, per-method object:

```ts
spacing: {
  row?:       { inRowCm, betweenRowCm },        // both required together
  intensive?: { perSquareMetre?, plantsPerSquare? } // ≥1 of the two
}
```

- `row` requires **both** distances — a row is _defined_ by in-row and
  between-row spacing, so one without the other is meaningless.
- `intensive` accepts either a plants-per-m² figure or a plants-per-square
  (square-foot-gardening) figure, because sources quote one or the other; at least
  one must be present.
- Both methods are **individually optional** (a fruit tree has row/tree spacing
  but no meaningful intensive density), **but at least one must be present** — a
  plant with no spacing at all can't be placed on the plot, which is the app's
  whole point. The density calculator (Stage 2.2) picks which method to apply.

### 3. Hardiness stores both an RHS band and a min temperature (both optional)

Hardiness is stored as two complementary, independently-optional representations:

- `rhsRating` — the RHS band (`H1a`…`H7`), the natural vocabulary for the
  Britain-default profile (`DESIGN.md` §"Climate / location data").
- `minTempC` — the lowest survivable temperature in °C. A portable,
  machine-comparable number that also bridges to non-UK climate models (USDA
  zones, Köppen) without committing everything to the RHS vocabulary.

The block is optional overall, but if present must carry at least one of the two.

### 4. Supporting shape decisions

- **Ordered enums.** `light` (full-sun → full-shade) and `rhsRating`
  (H1a → H7) are ordered on purpose and expose `…Rank()` helpers, so the engine
  can score _how far off_ a plant is, not just match/no-match. The ordering lives
  in one exported tuple that the zod enum and the rank helper both read.
- **Most fields optional.** Real horticultural data is patchy. Only identity
  (`id`, `commonName`, `scientificName`), `category`, `light`, a usable `spacing`
  block, and `provenance` are required; soil, seasons, hardiness, companions, and
  icon are optional. This lets the ETL be strict about identity without discarding
  a record merely because its soil pH is unknown.
- **`gbifId` is nullable, not optional.** It is _always present_ as a field but
  legitimately `null` until the GBIF resolver fills it in (Stage 1.1); nullable
  (rather than optional) makes "not yet resolved" an explicit, visible state.
- **Companion/antagonist links carry a mandatory `evidence` tag**
  (`well-supported` / `traditional`), because companion planting mixes science
  and folklore and the UI must be honest about which (`DESIGN.md` §"Companion
  planting data"). **Referential integrity is _not_ enforced here** — a single
  record can't see the whole dataset — but at dataset-build time (Stage 1.5).
- **Provenance is required, with optional per-field detail.** Every record needs
  at least one record-level source (for CC BY-NC-SA attribution and plain
  honesty); records assembled from several sources can additionally attribute
  individual fields via a closed `ProvenanceField` enum.
- **Month ranges allow wrap-around.** `{ start, end }` with `end < start` spans
  the new year (e.g. Nov–Feb); consumers must not assume `start <= end`. Expanding
  a range into concrete months is engine logic, not schema logic.
- **Strict objects (no unknown keys).** The record and every nested object use
  zod's `.strict()`, so a misspelled or stray key is a validation _error_ rather
  than silently stripped (zod's default). Because `validatePlant` is the ETL's
  hard-fail gate (Stage 1.5), a typo like `hardyness:` must fail loudly instead of
  shipping a record with that fact quietly missing — silent stripping would defeat
  the "no malformed data ever ships" guarantee (Workplan §1.1).
- **Sanity bounds are lower-bound only for now.** The schema enforces the
  _directional_ bounds that are always wrong (`spacing > 0`, `month ∈ 1..12`), but
  deliberately sets **no upper ceilings** on density figures or `minTempC`: a
  defensible ceiling depends on the real starter-crop data, and a wrong one would
  reject legitimate values. Absolute/plausibility bounds belong to the
  dataset-level sanity checks in Stage 1.5 (Workplan §1.1), which see the whole
  dataset.

## Alternatives considered

- **Hand-written TypeScript `interface` + a separate validator.** Rejected: two
  sources of truth drift. `z.infer` keeps them identical by construction.
- **A single spacing number (plants-per-m² or a generic "spacing").** Rejected:
  it silently bakes in one growing method and defeats the method-toggle the design
  calls for — the exact gap `DESIGN.md` calls out in general planners.
- **A free-form `spacingByMethod: Record<string, …>` map.** More flexible, but
  loses closed, type-checked method names and per-method field requirements
  (row needs two numbers; intensive needs a density). The explicit `row` /
  `intensive` shape documents itself and lets the calculator branch safely.
- **Hardiness as RHS band only.** Rejected: locks the model to UK vocabulary and
  makes non-UK climate scoring awkward. **Min temperature only** was also
  rejected: it discards the band that is the natural UK default and that source
  data often quotes directly. Keeping both, each optional, costs little and serves
  both the UK default and future global use.
- **JSON Schema as the authoritative artifact.** Rejected as the _source_: it's
  verbose to hand-author and doesn't give ergonomic TS types. zod → JSON Schema
  (generated on demand) is the better direction if the ETL needs it.
- **Enforcing referential integrity of companion links in the record schema.**
  Impossible at the per-record level and deferred to Stage 1.5 by design.

## Consequences

- Later stages import **one** shape; runtime and compile-time views can't diverge.
- The density calculator (2.2) can offer a genuine method toggle because the data
  supports it from day one — no migration when intensive growing is added.
- Requiring provenance up front means the CC BY-NC-SA attribution obligation is
  structural, not an afterthought bolted on before release.
- Cost: `spacing` and `hardiness` carry cross-field refinements (`at least one
method`, `at least one representation`), so their zod error messages are
  slightly less pinpoint than a single-field failure. Worth it for the invariant.
- zod is now a runtime dependency of the engine (and therefore of the app bundle).
  It is small and tree-shakeable, and validation at the data boundary is a
  first-class requirement (Workplan §1.1), so this is an accepted, deliberate cost.
- Adding a new provenance-worthy field means extending the closed `ProvenanceField`
  enum — a deliberate speed-bump that keeps provenance keys disciplined.
