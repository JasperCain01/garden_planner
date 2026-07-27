# Stage 6.2 brief — accessibility & responsive polish

A tight starting point for a fresh session. Read [`WORKPLAN.md`](../WORKPLAN.md)
(§0 ground rules, and the Stage 6.2 entry) before starting; this brief
concentrates what that entry leaves implicit.

Everything through Stage 6.1 is merged into `main` — **branch from `main`**.

## Why this stage, and why now

`WORKPLAN.md`'s dependency map is `6.0 ─► 6.1, 6.2, 6.3 ─► 6.4`: 6.2 and 6.3
were both unblocked when 6.1's brief was written, and it argued for 6.1 first
on the strength of "easy to clone" being a stated, unclaimed project goal.
That's done now (see [`WORKPLAN.md`](../WORKPLAN.md)'s Stage 6.1 entry). 6.2
is the natural next pick, for the reason 6.1's own brief gave: it's the only
remaining stage that changes what a user actually experiences, and the only
Phase 6 stage that leaves behind a new _runnable command_ (an axe check)
Stage 6.4 later wires into CI. 6.3 (final validation) is better run after —
it's a confirmation pass, and confirming before 6.2 lands means confirming
something you're about to change.

If you pick 6.3 first instead, say so in the Progress table and update this
brief (or write 6.3's) so the next session doesn't have to re-derive the
ordering.

## What Stage 6.1 leaves you that's relevant here

- **The docs are now indexed and audited** ([`docs/README.md`](./README.md)),
  so if this stage adds a new runnable command (the axe check the workplan
  entry asks for), give it a home there too — probably alongside the
  Lighthouse PWA audit's pattern in the root `README.md` (see Stage 5.1's
  "Lighthouse PWA audit" section for the shape a locally-runnable, no-CI
  audit command and its recorded result take).
- **The code-comment audit found nothing to fix.** Comment quality across
  `app/` (including `app/src/canvas/`, `app/src/palette/`, `app/src/plot/`)
  is already at the bar §0.2 asks for. Don't re-run that audit; if this
  stage adds genuinely non-obvious a11y logic (why a particular ARIA pattern,
  why a specific keyboard-interaction model), comment it as you go, same as
  everywhere else in this codebase.
- **A known, already-diagnosed viewport problem, not yet fixed in the app
  itself.** `docs/review-pre-deployment.md`'s §2 E2E investigation (and
  `WORKPLAN.md`'s Stage 6.1 brief) found the plot canvas rendering at
  **y ≈ 3500 px** down the page in the app's default layout — not a test
  artifact, a real layout fact, discovered because a 3500 px-tall Playwright
  viewport put the canvas _just below the fold_ and made drag E2E tests
  flaky until the viewport was raised to 4000px (`app/e2e/drag.ts`). Raising
  the test viewport fixed the tests; it says nothing about a real phone,
  which is this stage's problem to actually solve — a phone screen doesn't
  have a 4000px viewport to raise. The plot-definition page's vertical
  layout (growing-conditions form → palette → canvas → warnings, all
  stacked) is almost certainly the thing to address, not any one component
  in isolation.

## What Stage 6.2 actually asks for

`WORKPLAN.md`'s entry:

- **Keyboard-operable drag-drop alternative.** `dnd-kit` was chosen
  specifically because it supplies this (`WORKPLAN.md` §0.5) — check what
  `dnd-kit`'s `KeyboardSensor` gives you for free before building a custom
  interaction. The palette→canvas handoff (`app/src/canvas/drop.ts`,
  `app/src/palette/PlantPalette.tsx`'s `useDraggable` entries) and the
  on-canvas move/remove (`app/src/canvas/PlotCanvas.tsx`'s Konva
  `draggable`/`onDragEnd`, already keyboard-accessible for
  Delete/Backspace — see that file's `handleKeyDown`) are the two places
  that need a non-pointer path. Placing a plant via keyboard likely needs
  more than `KeyboardSensor` alone, since the actual placement math lives in
  `canvas/drop.ts#resolveDrop`, which assumes a pointer-driven drag; think
  about what "keyboard-initiated drop position" means before assuming
  `KeyboardSensor` is a drop-in fix.
- **Colour-contrast and ARIA passes.** The app already has real `aria-label`s
  in places (`PlotCanvas.tsx`'s canvas container, `PlantPalette.tsx`'s drag
  entries) — audit rather than assume, the same "verify rather than trust"
  posture Stage 6.1 used for doc figures. `app/src/palette/PlantPalette.tsx`'s
  `BAND_COLORS` and `app/src/warnings/severity.ts`'s severity colours are the
  two places colour alone currently carries suitability/severity information
  — check contrast ratios and whether colour is the _only_ signal (it likely
  isn't for band, since `BAND_LABELS` text is shown alongside; check
  severity badges on the canvas, which are colour-only circles today per
  `PlotCanvas.tsx`'s `PlacementMarker`).
- **Responsive layout for small screens.** See the viewport finding above.
  Consider whether the page's current single-column stack needs real
  breakpoints, or whether the fix is more structural (e.g. the canvas
  computing its own size from available viewport width rather than a fixed
  `PX_PER_CM`, `app/src/canvas/geometry.ts`). Test on an actual small
  viewport (Playwright's device emulation, or your own browser devtools),
  not just by reasoning about CSS.

## Traps and constraints (don't rediscover these)

- **`npm install` first**, then `npm run verify` from the repo root before
  finishing. If Playwright can't find a browser, set `PW_EXECUTABLE_PATH` —
  this environment ships Chromium at `/opt/pw-browsers/chromium`. One E2E
  test (`plot-export.spec.ts`) was observed to flake once under the default
  2-worker parallelism and pass standalone/on retry, unrelated to any
  particular stage's changes — if you see the same, retry before assuming
  you broke something.
- **`format:check` covers Markdown.** Run `npm run format` after any doc
  edits.
- **No `.github/workflows/` directory** — §1.4 holds until Stage 6.4. The
  axe check this stage adds must be **locally runnable**, not wired into
  CI (there isn't one yet) — same shape as Stage 5.1's Lighthouse audit
  command: a documented `npm`/`npx` invocation plus today's recorded result
  in the README, not an automated gate.
- **The manual keyboard-only walkthrough is part of verification, not
  optional.** The workplan entry asks for it explicitly alongside the
  automated axe check — actually drive the core journey (describe plot →
  find a crop → place it → check warnings) with a keyboard only, and record
  what you found, the same honest way Stage 5.1 recorded its Lighthouse
  score including the one failing audit.
- **Don't touch `packages/engine/` or `packages/etl/` for anything but
  comments** — this stage is UI/accessibility, not data or scoring logic.

## Definition of done (WORKPLAN §0.3)

`npm run verify` green; a locally-runnable axe-check command exists with
today's result recorded (README, mirroring the Lighthouse audit's shape); a
completed manual keyboard-only walkthrough of the core journey, recorded
honestly (gaps included, not hidden); `WORKPLAN.md`'s Progress table records
Stage 6.2; an ADR for any non-obvious accessibility-pattern decision (e.g. if
you invent a non-standard keyboard interaction for canvas placement — a
library choice like `dnd-kit`'s sensor config probably doesn't need one,
follow the same "does a newcomer need this reasoning next to the code"
test §0.2 gives); and the next stage's brief written (6.3, unless you find a
reason to reorder again — say so if you do).

## Model

**Sonnet.** Well-scoped UI/UX work against an established stack (`dnd-kit`
already chosen for its accessibility story) — not architecture-defining, but
real design judgement on the keyboard-interaction model and the responsive
layout, so budget real thinking time rather than treating this as mechanical.
