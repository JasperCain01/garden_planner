# Stage 3.6 brief — user-defined crops

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1's "add your own crop" paragraph, just after the core-loop steps) and
[`WORKPLAN.md`](../WORKPLAN.md) (§0 ground rules and the Stage 3.6 entry)
first; this brief concentrates the requirements and the shape of the
app/engine surfaces Stage 3.6 builds against.

Stages 0.1–1.6, 0.3, all of Phase 2, and Stages 3.1–**3.5** are merged into
`main` — **branch from `main`**.

## ⚠️ Check this before starting: Stage 4.1 (icon set) status

`WORKPLAN.md`'s dependency map names Stage 3.6 as needing 0.3, 3.1, 3.3, 3.4,
**and 4.1's icon set** (the add-crop form's icon picker is meant to be
"constrained to the bundled SVG set… no external-image upload", per the
Stage 3.6 workplan entry). **As of this brief, Phase 4 has not started —
there is no icon set yet** (the `WORKPLAN.md` Progress table has no Phase 4
rows at all). Do not assume this has changed; check the Progress table
yourself first. If 4.1 still hasn't landed by the time you read this, the
icon-picker part of the form has no bundled set to constrain to yet. Two
reasonable paths, and this is this stage's own call to make, same as Stage
3.5's placement-derivation decision was its call:

1. **Build the form without a real icon picker for now**: every user crop
   gets a single generic fallback icon (`UserPlantInputSchema.icon` stays
   unset), and the picker itself is left as a small follow-up once 4.1 lands.
   This keeps the crop usable end-to-end (scored, placed, counted) without
   inventing icon assets this stage has no mandate to create.
2. **Do Stage 4.1 first** (a small, self-contained icon set — see its own
   `WORKPLAN.md` entry) so the picker has something real to offer.

Path 1 is likely the pragmatic default — Stage 3.6's own value (a crop the
user can score and place) doesn't depend on icons — but read the Stage 4.1
entry before deciding, and record whichever you pick (and why) in
`docs/architecture.md`, same as Stage 3.5 recorded its own scoping decisions.

## Goal

Let a user who has bought seeds **add their own crop** from the packet —
name, spacing, growing season, light, category — and use it in the palette
and on the canvas exactly like a shipped crop, for the session. This is
`DESIGN.md`'s "add your own crop" capability, staged after the core loop
(3.1–3.5) because it needs the palette (3.3) and canvas (3.4) it slots into,
and now also Stage 3.5's warnings — a user crop should be scored, warned
about, and suggested-for/against exactly like a shipped one, since nothing
in the engine or Stage 3.5's derivation is origin-aware.

## Where it lives

`app/` — a new `app/src/user-crops/` (sibling to `app/src/palette/`,
`app/src/canvas/`), or fold into `app/src/plot/` if a single add-crop
section reads more naturally there — this stage's call. `packages/engine` is
a dependency, not editable (ADR 0003): the schema-relaxation and upcast work
is **already done** (Stage 0.3, ADR 0011) — this stage is UI wiring against
an existing, tested contract, much like Stage 3.5 was for `evaluatePlot`.

## What's already built (don't rebuild any of this)

- **`packages/engine/src/schema/user-plant.ts`** (Stage 0.3, ADR 0011):
  - `UserPlantInputSchema` — what a seed-packet form can actually supply.
    Required: `commonName`, `category`, `light`, `spacing`. Optional:
    `seasons`, `hardiness`, `soil`, `icon` (a `SlugSchema` key into the
    bundled icon set — see the warning above), `id` (only needed if a
    derived id would collide). **Absent, and rejected if supplied** (the
    object is `.strict()`): `scientificName`, `provenance`, `gbifId`,
    `companions`, `antagonists`, `cultivar`, `synonyms`, `edibleParts` — the
    form must not try to collect any of these.
  - `validateUserPlantInput(input)` / `safeValidateUserPlantInput(input)` —
    throwing and non-throwing validators. The form should use the safe one
    for field-level errors (`error.issues[].path` maps onto which field to
    flag), mirroring `PlotOutlineEditor.tsx`/`PlotConditionsForm.tsx`'s own
    inline-validity pattern from Stage 3.2.
  - `createUserPlant(input)` — the upcast from `UserPlantInput` to a full,
    valid `Plant`: mints a `user-`-namespaced id (via `userPlantIdFromName`,
    exported for previewing the id before submit), synthesises
    `{ sources: [{ source: 'user-entered' }] }` provenance, leaves
    `companions`/`antagonists` absent. Read the file's own module doc for the
    full synthesis rules before assuming any field's default.
  - `slugifyName(name)` / `userPlantIdFromName(name)` — exported specifically
    so the form can **preview** the id it's about to mint (e.g. "this will be
    added as `user-cherry-belle`") and detect a same-name collision with a
    crop already in the session before submitting.
  - `isUserPlantId(id)` / `isUserPlant(plant)` — whether an id/plant belongs
    to the user namespace. The form's "edit/remove this crop" affordance
    should gate on this (a shipped crop is never removable), and is the
    only place origin-awareness belongs — nowhere else in the engine or UI
    should branch on it.
- **`app/src/state/user-plants-store.ts`** (Stage 3.1): `useUserPlantsStore`
  — `userPlants: Record<PlantId, Plant>`, `addUserPlant(input)` (validates
  via `createUserPlant`, throws the same `ZodError` on invalid input — the
  form should have already called `safeValidateUserPlantInput` before
  reaching this, so a throw here would mean the form's own validation was
  skipped), `removeUserPlant(id)`. This store is the "place it lands" — no
  new store is needed for Stage 3.6, only the form that calls
  `addUserPlant`.
- **`app/src/state/use-plant-list.ts`**'s `usePlantList()` (Stage 3.1) — the
  shipped ∪ user overlay every other stage already reads. Once
  `addUserPlant` is called, the new crop appears here automatically; the
  palette (3.3) re-ranks and the canvas (3.4) can place it with **no changes
  to either** — confirm this with a quick manual check rather than assuming
  it, since it's the main integration risk this stage has.
- **Stage 3.5's warnings** (`app/src/warnings/`) are also origin-blind by
  construction: `derivePerInstancePlacements`/`deriveOvercrowdingPlacements`
  take a `PlacedPlant`, which holds a whole `Plant` regardless of where it
  came from, and `companionSuggestions`/`antagonistWarnings` naturally
  produce nothing for a user crop since its `companions`/`antagonists` are
  always absent (ADR 0011 §4, restated in ADR 0018). Nothing here should
  need touching — if it does, that's a sign something regressed the
  origin-blindness this stage relies on.

## What to build

1. **An add-crop form** capturing the seed-packet fields
   `UserPlantInputSchema` accepts: name, category, light, spacing (reuse
   whatever spacing-input pattern already exists, or build the minimal
   row/intensive toggle `SpacingSchema` needs), and the optional fields
   (seasons, hardiness, soil) if time allows — required fields first, since
   those are what makes a crop placeable and scoreable at all.
2. **Validate on submit** with `safeValidateUserPlantInput`, showing
   field-level errors the same way `PlotConditionsForm.tsx`/`PlotOutlineEditor.tsx`
   already do for their own inline validity.
3. **An id-collision check before submit**: derive the id via
   `userPlantIdFromName(commonName)` (or `slugifyName` directly) and check
   it against `useUserPlantsStore`'s current `userPlants` keys; if it
   collides, either let the user rename or pass an explicit `id` in the
   submitted input (`UserPlantInputSchema.id`, exactly the escape hatch it
   documents).
4. **An icon picker** — see the ⚠️ section above for whether this is a real
   picker or a placeholder-fallback, depending on Stage 4.1's status.
5. **Wire the submit to `useUserPlantsStore().addUserPlant(input)`**, and
   surface the resulting `Plant` (e.g. confirm it landed, or scroll to it in
   the palette) — `addUserPlant` returns the created `Plant` specifically so
   a caller can do this.
6. **An edit/remove affordance** for a crop the user added, gated on
   `isUserPlant(plant)` (never true for a shipped crop) — Stage 3.6's own
   `WORKPLAN.md` entry names "edit/remove" as part of this capability.
   "Edit" can be as simple as re-opening the form pre-filled and re-submitting
   with the same id (the store's `addUserPlant` replaces by id already).

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.**
- **User crops are session-only, by design** (`docs/stage-3.1-brief.md`):
  no reload persistence, no `localStorage`, nothing to build here for
  "saving" a user crop across a page reload — that's explicitly out of
  scope, not a gap to fill.
- **The schema relaxation lives only at the `UserPlantInputSchema` boundary**
  — `PlantSchema`/`validatePlant` are unchanged, so the ETL's shipped-data
  gate stays strict. Nothing in this stage should touch `packages/engine`
  at all (ADR 0003) — if a task seems to need an engine change, that's a
  sign the form is trying to collect a field the schema deliberately
  excludes (re-read `UserPlantInputSchema`'s doc comment on what's absent
  and why before assuming it's an oversight).
- **The `user-` id namespace is load-bearing, not cosmetic**: never
  construct a user-crop id by hand outside `userPlantIdFromName` — a
  mismatched id could collide with a shipped crop's id in the merged
  `usePlantList()` overlay.
- **No icons yet, possibly** — see the ⚠️ section; check the Progress table
  before assuming 4.1 landed.
- **The network is blocked** at the egress proxy beyond package installs —
  nothing here needs it; everything is in-memory.
- **No `.claude/` skills directory** — review your own diff.
- **No CI workflow — don't add one.**
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, `npm run format:check` from the repo root. Add an E2E
  journey (a sibling to `app/e2e/plot-canvas.spec.ts` and
  `app/e2e/warnings-overlay.spec.ts`) for: add a custom crop → it appears in
  the palette, scores against the plot, and drags onto the canvas with a
  correct count — `WORKPLAN.md` §1.3 names this exact journey. Confirm the
  `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-*/chrome-linux/chrome`
  Playwright workaround this environment needs still applies (or has
  changed) before relying on a bare `npm run e2e -w app` — see
  `docs/adr/0017`'s Consequences and Stage 3.5's own experience: two
  consecutive drags in one spec need the canvas's bounding box **re-read
  after each palette search/filter change**, since the unfiltered palette
  (160 shipped crops, plus however many user crops exist) makes the page
  tall enough that a filter narrowing the result count moves the canvas's
  on-page position — a `canvasBox` captured once up front goes stale the
  moment a search narrows the list.

## Deliverables

1. The add-crop form (required fields at minimum; optional fields — seasons,
   hardiness, soil — if time allows), validated via
   `safeValidateUserPlantInput`.
2. An id-collision check before submit.
3. An icon-picker decision recorded (real picker vs. placeholder fallback,
   per the ⚠️ section), in `docs/architecture.md`.
4. Wiring to `useUserPlantsStore().addUserPlant`, with the new crop visible
   in the palette and placeable on the canvas with no changes needed to
   either (confirm this, don't assume it).
5. An edit/remove affordance gated on `isUserPlant`.
6. Component tests for the form (valid packet input → a `Plant` the engine
   accepts via `createUserPlant`; a missing required field → a clear,
   field-addressed error) and for the id-collision check.
7. An E2E journey: add a custom crop → appears in the palette, scores
   against the plot, drags onto the canvas with a correct count.
8. `docs/architecture.md` updated; `WORKPLAN.md`'s Progress table updated;
   the brief for the next stage written — check `WORKPLAN.md`'s dependency
   map for what's next (Stage 3.7's plot-image export needs 4.2's icons
   wired, which needs 4.1 first, so if 4.1 still hasn't landed, Stage 4.1
   itself is the more likely next stage than 3.7 — say so plainly in the
   handoff rather than assuming either).

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
new code commented per §0.2; an ADR for the icon-picker scoping decision if
its reasoning is non-obvious once written down (or a `docs/architecture.md`
note if it's a straightforward consequence of Stage 4.1's status, per §0.2's
own "ADR vs. architecture note" distinction — see how Stage 3.3 and Stage
3.5 each made that call); docs and the Progress table updated; the next
stage's brief written.

## Model

**Sonnet**, per `WORKPLAN.md`'s own table for this stage — a well-scoped
form + validation + state-wiring task against a settled schema and an
already-built overlay store; the hard modelling work (the schema relaxation,
the id namespace, the upcast) is Stage 0.3's, already done and already
tested.
