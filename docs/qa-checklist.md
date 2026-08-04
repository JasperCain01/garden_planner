# Manual QA checklist for release (Workplan Stage 6.3)

A by-hand checklist a maintainer (or a future session) can run through before
calling a build v1, without re-deriving anything from scratch. It complements
`npm run verify` and the automated E2E suite — it does not replace them; run
those first (see [`WORKPLAN.md`](../WORKPLAN.md) §1.4). Since Stage 6.4, CI
runs the automatable parts of this on every pull request
([`.github/workflows/checks.yml`](../.github/workflows/checks.yml)) — but this
page is deliberately **not** that: it is the by-hand list, and every item below
is here precisely because a script can only partly assert it (a non-blank PNG
is not the same as a legible one). Tick the boxes, or re-run the exact commands
below and compare to the numbers already recorded here.

## Before you start

```bash
npm install
npm run build -w app && npm run preview -w app   # serves the production build at :4173
```

Everything below assumes the preview server (not `npm run dev`) is what's
under test — it's the actual build users get, service worker included.

## 1. The core journey (`DESIGN.md`'s four steps)

- [ ] **Define the plot.** Pick a preset shape (e.g. rectangle), enter
      dimensions, apply it. Drag a corner to reshape the outline freely; drag
      it into a self-intersecting shape and confirm it's rejected with a
      message, not silently accepted. Set light level; optionally soil and
      location.
- [ ] **Discover suitable plants.** Confirm the palette re-ranks when you
      change the plot's light/soil/location — a shady plot should demote
      full-sun crops and promote shade-tolerant ones. Press a crop's card and
      confirm its summary, confidence and per-dimension reasoning open beneath
      it (UI redesign Phase 3 moved that content behind one press); confirm the
      chip filters narrow the list and that unsuitable crops stay visible but
      muted rather than vanishing.
- [ ] **Plan the layout.** Drag a plant from the palette onto the canvas.
      Confirm a live count/density figure appears and updates as you place
      more of the same crop.
- [ ] **Validate continuously.** Place two known antagonists near each other
      (e.g. onion and bean-family crops carry antagonist links in the shipped
      data) and confirm a warning appears; move one away and confirm it
      clears. Confirm a companion suggestion appears for at least one placed
      crop, showing its evidence tag (well-supported vs. traditional).
- [ ] **Represent each plant clearly.** Confirm placed crops show a
      recognisable icon (not just a coloured circle) and that an id with no
      dedicated icon falls back to the generic icon rather than breaking.

This is exactly what `app/e2e/plot-canvas.spec.ts` and
`app/e2e/warnings-overlay.spec.ts` already assert by script — this pass is
about looking at it, not re-proving the assertions.

## 2. Beyond the core loop

- [ ] **Add a custom crop.** Use "Add a crop" with a seed-packet-shaped input
      (name, spacing, light, category — no scientific name, no citation).
      Confirm it appears in the palette, scores against the current plot, and
      can be dragged onto the canvas with a sensible count. Confirm an
      obviously-invalid submission (e.g. a missing required field) shows an
      inline error rather than silently failing or crashing.
- [ ] **Export the plot as an image.** With at least one crop placed, click
      "Export image". Confirm a PNG downloads, its dimensions match the fixed
      export size, icons render (not blank — this is the
      `document.fonts.ready` / icon-preload gotcha ADR 0020 names), and the
      legend lists the placed crops plus the plot's soil/climate settings.

Covered by script in `app/e2e/add-custom-crop.spec.ts` and
`app/e2e/plot-export.spec.ts`; this pass confirms the artifact actually looks
right, which a script can only partially assert (a non-blank PNG is not the
same as a legible one).

## 3. Offline behaviour

With the preview server from "Before you start" already running:

- [ ] Load the app, reload once (so the service worker installs and takes
      control — check devtools' Application/Service Workers panel if unsure).
- [ ] Disconnect the network (devtools' "Offline" throttling, or physically).
- [ ] Reload again. Confirm the app still loads and the core journey (§1)
      still works with the network off.

`app/e2e/offline.spec.ts` automates exactly this; this is the "actually watch
it happen in a real browser" confirmation the Stage 6.3 brief asks for
alongside the automated pass.

## 4. Automated-but-manual checks to (re-)run

All four now run in CI as well as by hand — the first two as **blocking**
checks, the last two as **informational** ones that report into the run summary
without failing the build (Stage 6.4, [ADR
0027](./adr/0027-ci-checks-workflow-and-blocking-policy.md)). That makes rows 3
and 4 the ones still worth a human's attention: nothing goes red if the
Lighthouse score slips or a keyboard step regresses, so re-run them, compare to
the last-recorded result, and treat a material change as a note in `README.md`/
`docs/accessibility.md` rather than a shrug.

| Check                | Command                                                                                                 | Last recorded result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full E2E regression  | `PW_EXECUTABLE_PATH=/path/to/chromium npm run e2e`                                                      | 35/35 passing (UI redesign Phase 5 — was 7/7 through Stage 6.4, 13/13 after Phase 1's `workspace-layout.spec.ts`, 18/18 after Phase 2's `canvas-scale.spec.ts`, 22/22 after Phase 3's `palette.spec.ts`, 27/27 after Phase 4's `plot-settings.spec.ts`; `persistence.spec.ts` adds eight, holding Phase 5's acceptance criteria). **Blocking in CI.** `plot-export.spec.ts`'s long-standing flake was diagnosed and fixed in Phase 1 — see §5. Note that `canvas-scale.spec.ts`'s two pixel-differencing specs take 33s and 39s against a 30s default timeout on a slow machine; they are not flaky, they are slow, and `--timeout=90000` is the honest way to run them there. (Phase 5's container ran them in 21.6s each, i.e. inside the default — the note is for the slower machine, and 21s against a 30s budget is why it stays.) **Phase 5 also changed what a second `page.goto` means**: the app saves the open design now, and a context is fresh per _test_, not per navigation, so a spec that loads the app twice sees its own earlier work — `e2e/storage.ts`'s `startWithNoSavedDesigns` is how `canvas-scale.spec.ts` opts out. |
| Accessibility (axe)  | `npm run a11y -w app` (needs the preview server running)                                                | 0 violations, all eight scanned states (unchanged since Stage 6.2; each state arrived with the surface it scans — the add-crop modal in UI redesign Phase 1, edit-shape mode and the clear-all confirmation in Phase 2, an expanded palette card in Phase 3, the warnings dock with a warning in it and the soil disclosure open in Phase 4, and the designs switcher in Phase 5, which took the retired clear-all confirmation's place). **Blocking in CI.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Keyboard walkthrough | `PW_EXECUTABLE_PATH=/path/to/chromium npm run keyboard-walkthrough -w app`                              | All steps pass, 20 tab presses to the canvas (35 before UI redesign Phase 1 moved the add-crop form's ~25 stops behind a dialog, then 15, then 20 once Phase 2's canvas toolbar joined the path) — unchanged by Phases 3, 4 and 5. Reaching the palette search field is **5** presses where it was 4, which is the one stop Phase 5's header gained. Two skip links, and a step each for the dialog, zoom, edit-shape, Phase 3's card disclosure, Phase 4's warnings-dock "Show me" and Phase 5's undo/redo; see `docs/accessibility.md` §6–§10. **Informational in CI.** Note that the script clears the saved design on every navigation (Phase 5): it reloads three times for "a clean run", and without that it would silently start counting tab stops through a canvas that still had crops on it.                                                                                                                                                                                                                                                                                                                                         |
| Lighthouse PWA audit | `npx lighthouse@11 http://localhost:4173/ --only-categories=pwa --chrome-flags="--headless=new" --view` | **0.88 / 1.00** — unchanged since Stage 5.1, and measured at exactly 0.88 again by CI at Stage 6.4. Same single failing audit (custom splash screen needs a PNG ≥512px icon; this project ships SVG icons only, an accepted gap — see `README.md`). **Informational in CI**, and this figure is the baseline its run-summary reporter warns against.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## 5. Known gaps — don't re-discover these, don't silently fix them

Recorded honestly in [`docs/accessibility.md`](./accessibility.md); pointed
at here so a release note doesn't have to reconstruct them from scratch.
Closing any of these is a deliberate decision, not something to absorb quietly
into a QA pass — and since Stage 6.4 each one has an explicit disposition and
its unblocker named in [`WORKPLAN.md`](../WORKPLAN.md) §5.2's post-v1 backlog,
alongside the rest of what v1 deliberately leaves out.

- **Closed, not a gap any more: the free-form plot-outline corner editor was
  pointer-only.** UI redesign Phase 2 merged that editor into the plot canvas
  and gave its corners the keyboard treatment placements already had — a
  selection, ◀/▶ to move it, arrow keys to act (ADR 0031 §6,
  `docs/accessibility.md` §7). `app/src/plot/PlotOutlineEditor.tsx` is deleted.
- **Reaching the canvas after placing a crop takes ~20 tab presses** in a
  filtered search match with several results — real friction, not a dead
  end (it was ~35 before UI redesign Phase 1 moved the add-crop form into a
  dialog, and ~15 until Phase 2's canvas toolbar joined the path). The "Skip to
  plot canvas" link helps before placing something, not immediately after.
  Phase 3's compact palette rows did _not_ change this: it kept two tab stops
  per crop row, which is the budget `docs/accessibility.md` §8 records.
- **No real screen-reader testing has been done** (NVDA/VoiceOver/JAWS). The
  scripted keyboard walkthrough proves reachability and operability, not that
  a screen reader announces state changes usefully.
- **Closed, not a gap any more: `plot-export.spec.ts`'s intermittent failure.**
  Every session that met it re-ran the suite and moved on. UI redesign Phase 1
  instrumented a failing run instead, and the cause was the one the specs' own
  comments had guessed at: `fill()` on the palette search box fires one `input`
  event, and a React render already in flight with the old state can commit
  afterwards and write the previous term straight back onto the input — so the
  crop being searched for never renders, and no amount of waiting helps.
  `e2e/drag.ts`'s `filterPaletteTo` re-types instead of waiting harder, and ten
  consecutive full-suite runs came back clean. `retries: 1` under CI stays as
  insurance against an unknown; it is no longer covering for this.
- **Hardiness/season data covers 8 of 144 shipped crops.** Not an app bug —
  a dataset-coverage gap that needs a new, freely-licensed source with
  cultivar-level data, not more curation. Stage 1.2's PFAF/Permapeople adapters
  were investigated, blocked, and are **no longer planned** (ADR 0006's dated
  note). See `WORKPLAN.md`'s Stage 6.0 entry, §5.2's backlog, and
  `docs/data-provenance-and-licensing.md`.

## 6. Test-coverage audit (Stage 6.3)

A confirmation pass over `packages/engine/` and `packages/etl/`, not a
rewrite — every gap closed here was a genuinely untested edge case or error
path in existing logic, verified by reading the code, not assumed from a
coverage percentage alone. Full detail is in the Stage 6.3 `WORKPLAN.md`
entry; the short version:

- **Engine** (99.83% statements / 96.06% branches after this stage, up from
  99.73%/95.33%): closed the `bandForScore` "poor" band boundary (never
  exercised — every golden case in `score.test.ts` lands elsewhere), a real
  polygon-adjacency edge-crossing case (`regionDistanceCm` for a "+"-shaped
  overlap where neither region's vertices lie inside the other — a genuine
  gap for the non-convex region model `WORKPLAN.md` §2.2 commits to), a
  degenerate zero-length edge in the same function, and `formatCm`'s
  decimal-formatting branch (every existing warnings fixture used
  whole-centimetre distances).
- **ETL** (96.54% statements / 95.22% branches): closed real gaps in the
  Stage 1.5 hard-fail gate itself — `datasetSpacingIssues`'s
  `plantsPerSquare` floor and `perSquareMetre` ceiling were untested,
  `validateDataset`'s empty-dataset structural check and its positional-id
  fallback (for a schema-invalid record with no usable `id`) were untested,
  and `findSpacingTarget`'s "alias points at no known plant" error path (a
  stale curated-alias entry) was untested. Also added dedicated
  `schema.test.ts` files for the moisture and exclusion tables (mirroring
  `spacing/schema.test.ts`'s existing split) covering their own
  invalid-row/duplicate-id error paths, and a GBIF-resolver test for a
  non-`Error` transport rejection (a real possibility for a `fetch`-backed
  transport, not just an `Error` instance).
- **Left alone, deliberately:** a number of remaining uncovered branches
  turned out, on inspection, to be schema-guaranteed-unreachable defensive
  fallbacks (e.g. `spacing/method.ts`'s `?? 0`, already the same class of
  thing an existing `/* c8 ignore */` comment nearby documents) or barrel
  `index.ts` re-exports with no logic of their own — not rewritten or
  padded with tests that would just restate the type system.

## Related

- [`docs/accessibility.md`](./accessibility.md) — the full a11y/responsive
  writeup this checklist's §5 points at.
- [`WORKPLAN.md`](../WORKPLAN.md) — Stage 6.3's entry has the full coverage
  audit and verification record.
- [`docs/stage-6.4-brief.md`](./stage-6.4-brief.md) — CI, next and last.
