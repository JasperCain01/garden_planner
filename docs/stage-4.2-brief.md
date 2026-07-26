# Stage 4.2 brief — wire icons into palette & canvas

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§1 step 5, "represent each plant clearly") and [`WORKPLAN.md`](../WORKPLAN.md)
(§0 ground rules and the Stage 4.2 entry) first; this brief concentrates the
requirements and the shape of the Stage 4.1 interface this stage wires in.

Stages 0.1–1.6, 0.3, all of Phase 2, Stages 3.1–3.6, and Stage 4.1 are merged
into `main` — **branch from `main`**.

## Goal

Replace the palette's and canvas's placeholder graphics with the real icon
set (Stage 4.1): every plant — shipped or user-defined — renders its
resolved icon instead of a plain coloured circle/text-only row. Purely
mechanical wiring against a settled interface; **no new design decisions**
should be needed here (per `WORKPLAN.md`'s own model-tier note for this
stage — see "Model" below).

## Where it lives

No new module needed. Two existing files change:

- `app/src/canvas/PlotCanvas.tsx` — the Konva scene that draws each placed
  plant.
- `app/src/palette/PlantPalette.tsx` — the ranked/filterable plant list.

Both already import from `@garden-planner/engine`; both should now also
import from `app/src/icons` (the barrel — `app/src/icons/index.ts` — not
`resolveIcon.ts` or `crops/` directly).

## What's already built (don't rebuild any of this)

- **`resolveIcon(plant): IconAsset`** (`app/src/icons/resolveIcon.ts`,
  exported from `app/src/icons/index.ts`). Resolution order:
  `plant.icon ?? plant.id`, falling back to the generic icon. Returns
  `{ key, url, isFallback }` — `url` is a plain string (a Vite-bundled asset
  URL; small icons are inlined as `data:` URIs by Vite's default behaviour,
  larger ones would be hashed file paths — either way, no runtime fetch).
  Never throws, never returns an unresolved state. See
  `docs/icon-style-guide.md` and
  [ADR 0019](./adr/0019-icon-set-archetypes-and-resolution.md) for the full
  design; you shouldn't need to read `tools/icons/` at all for this stage.
- **160 crop icons + 1 fallback**, all 64×64 viewBox flat SVGs, category-fill
  colour + one shared ink stroke (`app/src/icons/crops/*.svg`,
  `app/src/icons/generic.svg`). `resolveIcon.test.ts` already asserts every
  shipped crop resolves to a non-fallback icon and every user-crop-shaped id
  falls back — you don't need to re-verify this, only consume it.
- **Today's placeholders, both origin-blind (no icon-awareness at all)**:
  - `PlotCanvas.tsx` (~line 161): a Konva `<Circle>` filled with
    `CATEGORY_COLORS[placement.plant.category]` plus a `<Text>` of the
    crop's first initial, per placed plant. `CATEGORY_COLORS` (~line 68) is
    a `Record<EdibleCategory, string>` — check whether this stage still
    wants it (e.g. as a background behind the icon, for at-a-glance category
    colour even with icons) or removes it in favour of icon-only markers;
    either is defensible, but decide and note it rather than leaving dead
    code.
  - `PlantPalette.tsx` has **no visual icon at all** today — entries are
    text rows (name, score, reasoning). Adding an icon here is a pure
    addition, not a replacement.

## What to build

1. **Canvas**: replace (or supplement) the `<Circle>` + initial-letter
   `<Text>` per placement with the plant's resolved icon. Konva doesn't load
   image URLs directly into `<Image>` — you need an `HTMLImageElement`
   first. The common react-konva pattern is the `use-image` package's
   `useImage(url)` hook (not currently an app dependency — check whether to
   add it, or write an equivalent small hook; either is fine, but a
   from-scratch loader must handle the same async-load-then-redraw case
   `useImage` does). Since every icon is a bundled asset (no network round
   trip), the load should resolve near-instantly, but it is still async — a
   placed plant's first paint may briefly show nothing or a fallback frame;
   decide how to handle that (e.g. keep the coloured circle as a background
   that renders immediately, with the icon layered on top once loaded,
   rather than blocking the whole marker on image load).
2. **Palette**: render each entry's resolved icon (an `<img>` is simplest —
   this is plain DOM/React, not Konva) next to its name/score.
3. **Fallback is not an error state** — `IconAsset.isFallback` is expected
   and common (every user-defined crop hits it, since Stage 3.6 never sets
   `icon`). Render the generic icon plainly; don't add a warning UI around
   it unless a follow-up stage asks for one.
4. **Update or add component tests** for both components covering: a plant
   with a resolvable icon renders it, and a plant that falls back (e.g. a
   user-defined crop) renders the generic icon — mirroring how
   `PlotCanvas.tsx`'s and `PlantPalette.tsx`'s existing test suites already
   check category colour/text today.
5. **Visual E2E check** — `WORKPLAN.md`'s own verification line for this
   stage: "every dataset plant renders an icon or a defined fallback; visual
   E2E snapshot." Extend `app/e2e/plot-canvas.spec.ts` (or add a small new
   spec) to assert an icon element/image is present for a placed plant,
   and/or a Playwright screenshot snapshot if the repo's E2E conventions
   already use those elsewhere (check before introducing a new pattern).

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.**
- **Don't touch `packages/engine`** — nothing about the schema changes;
  `Plant.icon` already exists and already resolves correctly via
  `resolveIcon`.
- **Don't touch `tools/icons/` or `app/src/icons/crops/`** — the icon set
  itself is Stage 4.1's finished deliverable. If a specific crop's icon
  looks wrong, that's a separate follow-up (edit `tools/icons/classification.ts`
  and re-run the generator, or hand-replace the one file — see
  `docs/icon-style-guide.md` — but that is not this stage's job unless
  something is actually broken, e.g. a missing file, not just "could look
  better").
- **The network is blocked** at the egress proxy beyond package installs —
  if this stage adds a dependency (e.g. `use-image`), that's a package
  install, which works; don't reach for a CDN-hosted icon library or
  external image loader.
- **No `.claude/` skills directory** — review your own diff.
- **No CI workflow — don't add one.**
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, `npm run format:check` from the repo root.

## Deliverables

1. `PlotCanvas.tsx` renders each placement's resolved icon.
2. `PlantPalette.tsx` renders each entry's resolved icon.
3. Component tests for both, covering the resolved and fallback cases.
4. A visual/E2E check per `WORKPLAN.md`'s verification line for this stage.
5. `docs/architecture.md` updated (the Stage 4.1 note this brief was written
   alongside currently says "this stage deliberately does not touch the
   palette or canvas" — update that once this stage does); `WORKPLAN.md`'s
   Progress table updated; the brief for the next stage written (check the
   dependency map — Stage 3.7, plot-image export, is the natural next stage
   once icons are wired in, per its own Progress-table note).

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
every dataset plant (and a stand-in user-defined crop) renders an icon or the
defined fallback, confirmed by test, not just by inspection; docs and the
Progress table updated; the next stage's brief written.

## Model

**Haiku or local qwen3-coder**, per `WORKPLAN.md`'s own table for this
stage — mechanical wiring of a settled interface (`resolveIcon`) into two
existing components, with no schema, resolution-logic, or visual-style
decisions left open. Escalate to Sonnet only if the async image-loading
interaction with Konva's render cycle proves fiddlier than expected.
