# Stage 4.1 brief — SVG crop icon set

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
and [`WORKPLAN.md`](../WORKPLAN.md) (§0 ground rules and the Stage 4.1 entry)
first; this brief concentrates the requirements and records why this is the
next stage rather than 3.7, so you don't have to reconstruct either from the
diff.

Stages 0.1–1.6, 0.3, all of Phase 2, and Stages 3.1–**3.6** are merged into
`main` — **branch from `main`**.

## Why this stage, not 3.7

`WORKPLAN.md`'s dependency map is `(3.4 · 4.2) ─► 3.7`, and `4.1 ─► 4.2`. Stage
3.6 (user-defined crops) is done, but its own brief flagged that Phase 4 had
not started, and — per the Progress table — **it still hasn't**: this is the
first Phase 4 stage. Stage 3.7 (plot-image export) needs 4.2's icons wired in
so the exported picture shows real crop illustrations rather than placeholder
circles, so 4.1 is a hard prerequisite, not an alternative. Say this plainly if
you're ever asked to reconsider: **Stage 4.1 is the correct next stage**, not
3.7.

## Goal

A small, consistent, self-owned illustration per shipped crop (160 today —
`data/plants.json`, 97 vegetable / 34 fruit / 29 herb), plus **one generic
fallback icon** for a crop with none — flat SVGs, a few KB each, in one
coherent visual style, bundled with the app (no runtime fetch — the whole
point of the static-hosting constraint, `WORKPLAN.md` §0.1).

## Where it lives

A new top-level asset location — `app/src/icons/` (SVGs plus whatever
lookup/registry module resolves a `Plant.icon` key or `Plant.id` to one) is
the natural home, sibling to `app/src/dataset/`. This stage does **not** touch
`packages/engine` (ADR 0003) beyond what already exists:
`PlantSchema.icon` (`packages/engine/src/schema/plant.ts`) is already an
optional `SlugSchema` key, "often equal to `id`" per its own doc comment —
that convention (icon key defaults to the plant's `id` when not set
explicitly) is the simplest resolution rule and avoids a second id-like field
to keep in sync, though confirming or revising it is this stage's own call.

## What's already built (don't rebuild any of this)

- **`Plant.icon?: string`** (Stage 0.2) — the schema slot this stage fills.
  No shipped record sets it today (no icons exist yet), and
  `UserPlantInputSchema.icon` (Stage 0.3/3.6) is the same optional
  `SlugSchema` key for a user-entered crop.
- **The generic-fallback convention already has a live consumer.** Stage 3.6's
  add-crop form (`app/src/user-crops/AddCropForm.tsx`) deliberately leaves
  `icon` unset for every user crop it creates — its own module doc explains
  why (Phase 4 hadn't started) and says the fallback icon is this stage's job.
  Once this stage's fallback SVG exists, Stage 3.6's form doesn't need to
  change to start using it — only whatever palette/canvas rendering Stage 4.2
  adds needs to resolve "no `icon` set" to the fallback.
- **The palette and canvas render a placeholder today, not nothing.**
  `app/src/canvas/PlotCanvas.tsx` draws a coloured circle plus the crop's
  initial letter for every placed plant (its own comment: "no icon set yet,
  Stage 4.1/4.2's job"); `app/src/palette/PlantPalette.tsx` has no visual icon
  at all today. Neither needs to change in this stage — **wiring the icons in
  is explicitly Stage 4.2's job**, a separate, mechanical stage over a settled
  interface (`WORKPLAN.md`'s own model-tier note: Haiku/local for 4.2). This
  stage's deliverable is the asset set and its lookup/registry module, not the
  rendering change.

## What to build

1. **One SVG icon per shipped crop** (160), plus one generic fallback, in a
   single coherent flat style (see `DESIGN.md`/`WORKPLAN.md` for any stated
   style preference — if none, pick something simple: e.g. a single-colour
   line-art or flat-fill icon per crop, consistent stroke width and canvas
   size across the set). This is partly a **design task** — `WORKPLAN.md`
   explicitly notes a human may prefer to own or commission it; don't over-invest
   a coding session generating polished illustrations if a simpler, honestly
   "placeholder-quality but consistent" set gets the pipeline working end to
   end for Stage 4.2 to wire up.
2. **A documented style guide** (viewbox/size convention, stroke width, colour
   rules) so a contributor can add more icons later without guessing the
   established pattern.
3. **A lookup/registry** resolving a `Plant` to its icon asset: probably
   `resolveIcon(plant: Plant): <asset>` keyed on `plant.icon ?? plant.id`,
   falling back to the generic icon when neither resolves to a bundled asset —
   this is what Stage 4.2 will call, and it's the one small piece of logic (as
   opposed to pure asset files) this stage should hand off tested.
4. **Licensing kept clean**: every icon self-owned or under a permissive
   licence compatible with the code's MIT/GPL choice (`WORKPLAN.md` §0.5) —
   this is what keeps Stage 3.7's export canvas untainted later (same-origin,
   self-owned assets only, no external-URL images — see that stage's own
   gotcha list).
5. **An SVG-optimizer pass and a size-budget check** (`WORKPLAN.md`'s own
   verification: "icons pass an SVG optimizer; total icon payload stays
   within an agreed size budget") — pick a concrete budget (e.g. a few KB per
   icon, low hundreds of KB total for 160+1) and record it.

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.**
- **No `.claude/` skills directory** — review your own diff.
- **No CI workflow — don't add one.**
- **The network is blocked** at the egress proxy beyond package installs — if
  you reach for an icon-generation service or external library fetch, expect
  it to fail; source or draw icons offline/locally instead.
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, `npm run format:check` from the repo root.
- **Don't touch `packages/engine`'s schema** — `Plant.icon` and
  `UserPlantInputSchema.icon` already exist and are already the right shape;
  this stage only needs to give that key something to resolve to.
- **Don't wire the icons into the palette or canvas** — that's Stage 4.2,
  kept separate deliberately (`WORKPLAN.md`'s own model-tier split: this
  stage is Sonnet/design work, 4.2 is mechanical Haiku/local wiring against
  whatever interface this stage settles on).

## Deliverables

1. 160 shipped-crop SVG icons + 1 generic fallback, bundled in the app build.
2. A style guide doc (where a contributor looks to add one more).
3. A tested `resolveIcon`-shaped lookup module.
4. Licensing/attribution recorded (a `NOTICE`-style note if any icon isn't
   fully original work).
5. SVG-optimizer pass run; a recorded size budget, checked (manually is fine —
   CI remains deferred, `WORKPLAN.md` §1.4).
6. `docs/architecture.md` updated; `WORKPLAN.md`'s Progress table updated
   (new Phase 4 row); the brief for Stage 4.2 written.

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
every crop resolves to an icon or the documented fallback (no silent gaps);
docs and the Progress table updated; Stage 4.2's brief written.

## Model

**Sonnet** to build the lookup module, tooling, and establish the style
pattern — per `WORKPLAN.md`'s own table, noting a human may prefer to own or
commission the actual illustration work. Batch normalization/optimization of
icons once the style is set can drop to **Haiku or local** once the pattern
exists.
