# 0011 — User-defined crops: a separate input schema, an upcast, and the `user-` id namespace

> **Note (ADR [0023](./0023-dataset-licence-cc0.md)):** this ADR justifies required provenance partly by the dataset's then CC BY-NC-SA attribution
> obligation. The dataset is now **CC0-1.0**, so provenance is no longer a licence requirement — but the decision below is unchanged. It is kept for
> **traceability**: it is what makes a horticultural claim checkable, and what stops a user-entered crop passing itself off as sourced data.

- **Status:** Accepted
- **Date:** 2026-07-25
- **Workplan stage:** 0.3 (⭐ keystone) — schema amendment for user-defined crops

## Context

`DESIGN.md` §1 promises that a user who buys seeds can **add their own crop** from
the packet — name, spacing, season, light, category — pick a bundled icon for it,
and have it behave like any shipped crop for the session (Stage 3.6). The plant
schema has to be able to describe that record. Today it cannot: `PlantSchema`
requires `scientificName` and `provenance`, and a person holding a packet of
"Cherry Belle" has neither a binomial nor a citation to offer.

This lands now, before Phase 2, because the schema is the single source of truth
the engine and the whole UI build on. Relaxing it is cheap while only tests depend
on the shape, and expensive to unwind once scoring, packing and the palette are
written against the stricter one (`WORKPLAN.md` Stage 0.3, "Why now").

### The complication: one validator is doing two jobs

`validatePlant` / `PlantSchema` is not only "the shape". It is also the ETL's
**hard-fail gate for shipped data**, at three call sites:

- `packages/etl/src/sources/openfarm/map.ts` — validates each mapped OpenFarm record.
- `packages/etl/src/resolve/apply-resolution.ts` — re-validates a record after
  attaching its `gbifId`.
- `packages/etl/src/merge/validate.ts` — the whole-dataset gate (`safeValidatePlant`)
  that backs the promise that no malformed record ever ships.

Making `scientificName` and `provenance` optional on `PlantSchema` would have
weakened all three at once: the build would then accept a shipped record with no
botanical name and no attribution — precisely the CC BY-NC-SA / provenance
guarantee ADR 0009 exists to enforce. The requirement, then, is not "relax the
schema" but **relax the user path without moving the shipped bar at all**.

## Decision

**Option 1 of the stage brief: a separate input schema plus an upcast adapter.**
`PlantSchema` and `validatePlant` are **unchanged by this stage**, and so are all
three ETL call sites above. The relaxation lives at the input boundary only, in a
new module `packages/engine/src/schema/user-plant.ts` (exported through
`schema/index.ts` → the engine's public surface).

```text
  packet fields ──► UserPlantInputSchema ──► userPlantInputToPlant ──► Plant
  (no sci. name,     (permissive about       (synthesises the         (fully valid,
   no provenance)     what's required,        missing fields)          validatePlant-
                      strict about values)                             clean)
```

### 1. `UserPlantInputSchema` — what a packet can supply

Required: `commonName`, `category`, `light`, `spacing` — exactly the fields
`DESIGN.md` §1 promises the form asks for, and the minimum the suitability engine
and the density calculator need to treat the crop like any other. Optional:
`seasons`, `hardiness`, `soil`, `icon`, and an explicit `id`.

**Absent** — and rejected if supplied, because the object is `.strict()`:
`scientificName`, `provenance`, `gbifId`, `companions`/`antagonists`, `cultivar`,
`synonyms`, `edibleParts`. Rejecting rather than ignoring means a caller trying to
hand-supply provenance gets an error instead of a silent drop.

Every optional field reuses the canonical Stage 0.2 schemas unchanged. The input
schema loosens **which fields are required**, never **what counts as a valid
value**: months are still 1–12, spacing still positive, enums still closed. One
addition of its own — `commonName` must contain at least one letter or digit,
because the id is derived from it (below), so this makes the derivation total.

### 2. The upcast, and what it synthesises

`userPlantInputToPlant(input)` fills in what a packet cannot:

| Field                      | Value                                              | Why                                                                                |
| -------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `id`                       | explicit id, else `user-` + slugified `commonName` | Namespaced so it can never collide with a shipped id (§3).                         |
| `scientificName`           | the `commonName`                                   | The schema requires `min(1)`, not a binomial. Honest and valid — see Consequences. |
| `gbifId`                   | `null`                                             | Nothing has resolved this crop; the nullable field exists for exactly this state.  |
| `provenance`               | `{ sources: [{ source: 'user-entered' }] }`        | Truthful attribution rather than a missing block or a borrowed citation.           |
| `companions`/`antagonists` | omitted                                            | A packet supplies no relationships (§4).                                           |

The result is passed through **`validatePlant` itself**, so the upcast cannot emit
a record the rest of the app would reject. `createUserPlant(unknown)` composes
validate + upcast into the single call Stage 3.6's submit handler needs — which is
also how that stage's "validated on submit with the same `validatePlant`"
requirement is met: a user crop _is_ a first-class `Plant`, not a parallel shape.

### 3. The `user-` id-namespacing convention

Every user crop's `id` starts with `user-`; no shipped record's `id` ever does.
Both halves are **enforced**, not merely documented:

- **User ids always carry it** — `UserPlantIdSchema` rejects an id that doesn't
  (including bare `"user-"` and `"user"`), and the upcast mints ids through
  `userPlantIdFromName`, which slugifies the packet name (accent-folding, punctuation
  collapsed) and prefixes it: `"Radish 'Cherry Belle'"` → `user-radish-cherry-belle`.
- **Shipped ids never carry it** — the ETL's dataset gate (`merge/validate.ts`)
  gained a structural check rejecting any shipped record whose id is in the
  namespace. This is a _strengthening_ of the shipped gate, the only ETL change in
  this stage, and it is what turns the collision guarantee from a convention into
  a build failure. A dataset-level rule belongs in the dataset gate rather than in
  the per-record schema, which cannot see the shipped/user distinction.

`slugifyName` is exported so Stage 3.6 can preview an id and de-duplicate when two
packets slugify the same (it then passes an explicit `id` such as
`user-cherry-belle-2`); a second, subtly-different slugifier elsewhere is exactly
how id rules drift apart.

### 4. User crops carry no companion/antagonist links

Confirmed and recorded here so Stage 3.6 need not re-litigate it: a seed packet
supplies no relationships and a user has no way to know them, so the upcast emits
none. Therefore user crops raise **no referential-integrity concern** in Stage
3.1's runtime `shipped ∪ user` list — a plant with no links cannot dangle, and no
shipped record can point at a `user-` id (those ids do not exist at build time, and
the gate in §3 forbids them). The Stage 1.5 dataset gate remains the only place
referential integrity is checked, and it only ever sees shipped data.

## Alternatives considered

- **Option 2: relax `PlantSchema`, add a strict `ShippedPlantSchema` and migrate
  the three ETL call sites.** A simpler type story — one `Plant`, one validator per
  audience. Rejected because the guarantee then depends on _every_ shipped-data
  path having been migrated: miss one call site today, or add one in Stage 1.7's
  curated-crop input, and the provenance guarantee leaks silently. Option 1 keeps
  the strict bar as the _default_ — a new shipped-data path is safe unless someone
  deliberately routes it through the user boundary — and leaves no divergent
  downstream shape to maintain, since everything past the upcast is a plain `Plant`.
- **Just relax the base, with no strict shipped validator.** Rejected outright: it
  silently weakens the Stage 1.5 gate and turns ADR 0009's licensing/attribution
  promise into an honour system.
- **Let the input carry an optional `provenance` the caller may supply.** Rejected:
  it invites a UI (or a future importer) to attach a citation the user never gave.
  Synthesising `user-entered` unconditionally is the honest floor.
- **Allow `scientificName` as an optional input field** for the keen user who knows
  it. Deferred, not refused — adding an optional field later is a non-breaking
  change, and starting narrow keeps the Stage 3.6 form to the packet's own
  vocabulary. Same reasoning for `cultivar`, `synonyms` and `edibleParts`.
- **Enforce the reserved `user-` prefix inside `PlantSchema`.** Rejected: the base
  schema is shared by both audiences and cannot tell which side a record is on —
  it would have to forbid the prefix for user crops too. The dataset gate is the
  layer that knows it is looking at shipped data.

## Consequences

- **The shipped bar did not move.** `PlantSchema`, `validatePlant` and
  `safeValidatePlant` are byte-for-byte unchanged; all Stage 0.2 sample records
  still parse; a record lacking provenance or a scientific name still fails, and
  `user-plant.test.ts` asserts that explicitly alongside the new user-path tests.
  The three ETL call sites were untouched.
- **Everything downstream of the upcast sees only valid `Plant`s.** The engine,
  the palette, the canvas and Stage 3.1's merged runtime list need no
  origin-awareness and no optional-field handling. `isUserPlant(plant)` exists for
  the places that genuinely care (a user crop is removable/editable in-session; a
  shipped one is not).
- **A user crop's `scientificName` may just be its common name.** Nothing
  downstream may assume that field holds a real binomial. It is a display/identity
  field; the join key is `gbifId`, and ADR 0009's merge policy already refuses to
  unify full records by name, so this creates no new risk in the pipeline.
- **User provenance is honestly labelled `user-entered`.** No user data enters the
  shipped artifact (user crops are session-scoped, never written back), so the
  dataset's CC BY-NC-SA attribution roll-up is unaffected; if a future stage ever
  did export user crops, they are trivially identifiable by both source string and
  id namespace.
- **The ETL gate is one check stricter.** A contributor who names a shipped crop
  `user-something` now gets a build failure with a pointer to this ADR. No existing
  record is affected (no shipped id uses the prefix).
- **Stage 3.6 is unblocked**: its form validates with `safeValidateUserPlantInput`
  (field-addressable errors), then calls `createUserPlant` on submit. Stage 1.7's
  maintainer-curated crops are unaffected — they are full `Plant`s going through
  the ordinary shipped gate, which is exactly the distinction this design preserves.
