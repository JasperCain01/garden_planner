# Post-review fixes workplan

**Origin.** A full read-only review of the UI-redesign branch (2026-08-04) — code, live
look-and-feel at four viewports, and a test-suite audit — found no blocking defects: lint,
typecheck, 304 unit tests, 39 E2E specs and 8 axe scans all pass. What it did find is
listed here as an executable workplan. **These are the only changes intended before this
branch merges to `main`.** The features the same review proposed live separately, in
[`future-developments-workplan.md`](./future-developments-workplan.md), and none of them
start until this document is done.

**How to work this plan.** One fix per commit, tests updated in the same commit, in the
priority order below (within a tier, any order). Tier A is merge-blocking; Tier B is
strongly wanted but a judgement call under time pressure; Tier C is cleanup that can ride
along with whichever commit touches the same file, or be skipped.

**Ground rules — the same ones every redesign phase carried:**

- Keep all keyboard paths and ARIA structure working; `npm run a11y` stays at 0 violations.
- Update unit and E2E tests in the same change as the code they cover.
- Touch no engine code (`packages/engine`). App-side pure functions are fine.
- Where a fix contradicts a recorded decision, say so where the decision is recorded
  (a dated note in the relevant ADR or module doc), don't silently override it.
- The bar before calling this plan done: `npm run verify` green, `npm run a11y` green,
  `npm run keyboard-walkthrough` all steps passing.

---

## Tier A — merge-blocking

### A1. A canopy larger than the plot floods the whole canvas

**Problem.** `PlotCanvas.tsx`'s footprint-true markers draw a crop's canopy as a
translucent category-coloured disc at true scale (`footprint.ts#canopyRadiusPx`). For a
tree-scale crop this disc is bigger than the plot itself: place an Apple (360×450 cm
spacing) on the default 3×2 m bed and its canopy covers the **entire canvas** — plot,
soil surround, every other marker — in translucent red. It reads as an error overlay, not
as one plant's footprint. Verified live; screenshot attached to the review.

**Fix — clip the canopy fill to the plot outline.** The scene already has exactly this
mechanism: the grid group clips to the outline polygon via `clipFunc`
(`PlotCanvas.tsx`, the grid `<Group>`). Render the canopy **fills** inside a group
clipped the same way, and keep each canopy's **outline ring** unclipped. The flood is
gone (fill can never spill past the plot edge onto the soil and the padding band), while
the honesty is kept — the ring still shows a pumpkin at the plot edge claiming ground
beyond it, and the engine's "1 planted but only 0 fit" feedback still tells the numeric
truth.

Implementation notes:

- The marker is currently one `<Group>` per placement (canopy + core + icon + badge).
  Splitting the canopy fill into a clipped sibling layer must not break: selection glow
  (drawn under everything), the drop pop (animates the group — decide whether the fill
  pops with it or the pop moves to the core, either is fine, say which and why), hit
  testing (the **core** is what's clicked; the canopy fill should become
  `listening={false}` if it isn't already).
- Consider additionally easing fill alpha down as `canopyRadiusPx` grows past ~half the
  plot's drawn diagonal, so even the in-plot portion of a huge canopy doesn't drown the
  markers under it. Optional; measure whether clipping alone is enough with the
  Apple-on-3×2m case before adding it.

**Acceptance.**

- Apple placed on the default 3×2 m plot: soil surround and dimension labels fully
  legible, other markers' cores unobscured; the Apple ring still visibly exceeds the plot.
- No change for crops whose canopy fits (radish, onion, brussels sprouts).
- Extend `e2e/canvas-scale.spec.ts`'s pixel-differencing approach: place an Apple and
  assert pixels **outside** the outline's bounding box in the padding band are unchanged
  from the empty-plot baseline (the existing `getImageData` helpers make this a
  measurement, not a screenshot diff).

### A2. Marker name labels collide

**Problem.** Each marker draws its name centred beneath the canopy once
`pxPerCm ≥ NAME_LABEL_MIN_PX_PER_CM` (`PlotCanvas.tsx`). Neighbouring placements render
overlapping strings — verified live: "Brussels sprouts" and "Broad bean" run together
into one unreadable line, and a label can sit under a neighbour's marker or its own
warning badge.

**Fix — a pure label-visibility pass, then render only the survivors.** Add a pure
function (suggested home: `canvas/labels.ts`, mirroring how `footprint.ts` and
`grid.ts` keep scene maths out of the component):

```
visibleLabels(placements, region, pxPerCm, selectedId): ReadonlySet<string>
```

Greedy and deterministic: walk placements in a stable order (selected first — the
selected placement's label must always win — then placement order), estimate each
label's pixel box with the same width heuristic `PlantTooltip` already uses, and drop
any label whose box intersects one already kept. No partial nudging or leader lines —
hidden-when-crowded is the simple honest answer, and the hover tooltip and the
selected-placement readout both already carry the name for anything suppressed.

**Acceptance.**

- Unit tests on the pure function: two overlapping labels → one shown; the selected
  placement's label always shown; non-overlapping labels all shown; deterministic
  across calls.
- Live check at 1440×900 with the review's repro (brussels sprouts, swede, broad bean
  and onion clustered at plot centre): no two rendered labels intersect.

### A3. Edits inside the save-debounce window are lost on a design switch

**Problem.** `designs-store.ts` debounces autosave (`SAVE_DEBOUNCE_MS = 200`). None of
the four switching actions — `newDesign`, `loadDesign`, `duplicateDesign`,
`deleteDesign` — flush that pending save first, so an edit made <200 ms before a switch
is written to **neither** design: `openDesign` resets `lastSavedDesign` and reschedules
the timer against the new active id, and the outgoing design's record keeps its stale
content. Not reproducible through real UI clicks (opening the switcher takes longer
than the window), but reachable — e.g. a corner-drag released immediately before a
`deleteDesign` — and it silently violates the phase's own promise that "there is never
unsaved work".

**Fix.** Call `flushPendingSave()` as the first statement of all four actions (it is
already exported and idempotent — a no-op when no timer is pending). In
`duplicateDesign`, flush **before** reading `records.get(id)` so the copy is made from
the freshened record.

**Acceptance.** A unit test in `designs-store.test.ts` with fake timers (the file
already uses them for the debounce tests): edit the active design, advance time by
_less_ than `SAVE_DEBOUNCE_MS`, call `duplicateDesign` on it — both the original's
stored record and the copy contain the edit. A second case for `loadDesign` (edit, then
switch away within the window; the outgoing record has the edit).

### A4. Restore accepts duplicate placement ids

**Problem.** `design-codec.ts#parseDesign` validates each stored placement's shape but
not uniqueness: two placements with the same `id` both load. Selection restore
(`design-history.ts#restoreSelection`) and undo bookkeeping key placements by `id`.
Corrupt-input-only, but the gate is already right there.

**Fix.** Track seen ids in the placement loop; skip a duplicate `id` the same way an
unresolvable `plantId` is skipped (silently continuing is fine — this is corrupt input,
and the missing-plant path is the precedent for how much noise that earns; a note in
`missingPlantIds`-style reporting is _not_ needed for this).

**Acceptance.** A `design-codec.test.ts` case: a stored design with two placements
sharing an id round-trips to a design containing exactly one.

---

## Tier B — should fix

### B1. Palette category word degrades below its measured compromise

**Context, honestly stated.** The truncation is a _recorded decision_:
`PlantPalette.module.css`'s `.head` comment measured "vegetab…" on 4 of 144 rows and
accepted it, and `.band`'s comment explains why the chip never shrinks instead. But the
review's live session (Chromium, default font stack, 1440×900) rendered "veget…" — worse
than the measured floor — on **every** excellent-match vegetable row. The compromise is
platform-sensitive: whatever the measurement machine's font metrics gave, other
renderings give less, and the category word is the palette's WCAG 1.4.1 answer for
colour-blind users (`docs/accessibility.md` §8), so it degrading to ambiguity is not
cosmetic.

**Fix — remove the collision instead of re-tuning it.** Recommended: shorten the band
chip's **visible** text to one word ("Excellent", "Good", "Fair", "Poor", "Unsuitable" —
`BAND_LABELS` presumably central; keep the two-word phrase in the accessible name via
the pattern `ShapePicker` already uses for units, so nothing announced changes and no
E2E selector breaks). "Excellent" at the chip's font is ~40px narrower than "Excellent
match", which more than refunds the 11px the category word is short. Alternative if the
label change is unwanted: let `.head`'s second line wrap the category word under the
chip at a fixed two-line row height — but that spends ~14px of row height × 144 rows
against the "≥8 crops visible" acceptance, so measure before choosing it.

**Acceptance.** At 1440×900 with default fonts, no category word ellipsizes on any of
the 144 rows (extend `e2e/palette.spec.ts`: for each rendered row, assert
`scrollWidth <= clientWidth` on the category element — cheap, and it pins the fix
against future font drift). `≥8 crops visible` spec still passes. Axe still green.
Update the `.head` CSS comment to describe the new arrangement — it is currently the
record of the old one.

### B2. Toolbar reflows to two rows when entering Edit shape

**Problem.** The canvas toolbar (`PlotCanvasSection.module.css` `.toolbar`,
`flex-wrap: wrap`) holds more buttons in edit mode ("Done editing shape", "Add corner",
"Remove corner" replace/join the arrange-mode set) and wraps to a second row at
1440×900, shifting the whole canvas viewport down ~44px on every mode toggle. Verified
live.

**Fix.** Either (a) tighten the edit-mode button set so both modes fit one row at the
supported widths — the review noted "Clear all" and "Export image" have no job while
editing a shape and could hide in edit mode (they act on placements, not the outline),
or (b) reserve the height (`min-height` for two rows always). Prefer (a): fewer
controls in a mode is also less to read, and the pair already contextually swaps
(Previous/Next placement ↔ corner), so precedent exists. Whichever is chosen, the
canvas viewport's top edge must not move when toggling modes.

**Acceptance.** An E2E assertion (natural home: `e2e/canvas-scale.spec.ts`'s edit-shape
spec): the canvas viewport element's `boundingBox().y` is identical before and after
toggling "Edit shape" at 1440×900.

### B3. Reshaping the plot strands placements with no cue

**Problem.** Apply a smaller shape (or drag corners inward) with plants placed:
placements keep their old coordinates, and any now outside the outline just sit on the
soil with nothing saying so. The original aesthetic review listed this under "smaller
but real"; it survived all six phases. (It is **not** one of ADR 0035's three declined
items — it is simply still open.)

**Fix.** Two halves, both app-side:

1. A pure containment test — check `warnings/` and the engine's exports first: if a
   point-in-polygon helper already exists for the warning rules, use it; if not, a
   ~15-line ray-cast over `region.vertices` in `canvas/geometry.ts` with unit tests
   (convex, L-shape notch, on-edge cases).
2. Surface it twice, cheaply: (a) on the canvas, draw a stranded marker's core
   desaturated with a dashed outline ring (the muted-when-unsuitable palette precedent:
   visible-but-honest, no motion); (b) in the warnings dock, one summary card — "N
   plants are outside the plot outline" — with the existing "Show me" affordance
   targeting the first stranded placement. Do **not** auto-delete or auto-move anything:
   the user may be mid-reshape, and undo already covers regret.

**Acceptance.** Unit tests for containment; a component or E2E case: place a plant near
the 3×2 edge, apply the 2.5 m circle preset, the dock reports it and the marker renders
in the stranded style; drag it back inside, both clear. Axe scan of the dock state with
the new card.

### B4. Phone header truncates the brand and the design name

**Problem.** At 390px the header renders "Garden Plan… / Designs: M…" —
`AppShell.module.css` pins one row `nowrap` (a recorded Phase 5 decision) and
`DesignChrome.module.css` ellipsizes the switcher button. Both worst cases hit at once
on a phone.

**Fix.** Scoped entirely inside the existing narrow breakpoint (do not touch desktop):
below it, let the header wrap to two rows (brand on the first; undo/redo + switcher on
the second), or shorten the switcher's visible text to the design name alone ("My
garden", dropping the "Designs:" prefix — the accessible name keeps the full phrase).
Either is small; pick one and note it beside the `nowrap` comment the choice amends.

**Acceptance.** At 390×844: the full brand wordmark and a 10-character design name both
render without ellipsis; no horizontal page scroll; the stacked-layout E2E spec still
passes.

---

## Tier C — cleanup (ride along or skip)

- **C1. Doc drift:** `design.ts` (~line 141) refers to `design-history.ts`'s
  `labelNextEdit`; the function shipped as `recordAs`. And `design-codec.ts`'s module
  doc claims the module "never casts" while `parseDesign` carries two validated-first
  casts (`raw as UserPlantInput`, `x as number`) — soften the claim to describe the
  trust boundary as it is.
- **C2. Pan listeners:** `PlotCanvas.tsx` attaches window `pointermove`/`pointerup`
  for the pan gesture for the component's whole life. Attach on `pointerdown`, detach
  on `pointerup`/unmount. Behaviour-neutral; keep the deselect-on-unmoved-press path
  covered by the existing slop logic.
- **C3. Test pruning:** delete `e2e/smoke.spec.ts` (every other spec loads the page
  and asserts strictly more — it is the one superseded spec in the suite) and
  `App.test.tsx`'s "renders the title" (a strict subset of the two tests after it).
  Mark the two pixel-differencing specs in `canvas-scale.spec.ts` with `test.slow()`
  so their timeout budget lives in the spec file rather than in a run flag the
  qa-checklist has to remember.
- **C4. Autosave whisper:** a transient "Saved" indicator in the header after a flush.
  Deliberately optional — the no-save-button design is sound; this only buys visible
  trust. If skipped here it does not move to the future plan; it just waits for a
  reason.

---

## Done means

All Tier A and (unless explicitly dropped) Tier B commits landed, each with its tests;
`npm run verify` green; `npm run a11y` 0 violations across all scanned states including
any state a fix added; `npm run keyboard-walkthrough` all steps passing; the two CSS/ADR
comments amended where B1/B4 changed a recorded decision. Then this branch merges to
`main`, and `future-developments-workplan.md` takes over.
