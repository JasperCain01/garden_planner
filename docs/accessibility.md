# Accessibility & responsive polish (Workplan Stage 6.2)

What this stage changed, what it verified, and — as honestly as Stage 5.1
recorded its one failing Lighthouse audit — what it didn't fix. See ADR
[0026](./adr/0026-keyboard-placement-and-severity-glyphs.md) for the
reasoning behind the non-obvious calls; this page is the "what was done and
what was found" record, not the "why" (that's what the ADR is for).

## 1. Keyboard-operable placement

Two places needed a non-pointer path (`docs/stage-6.2-brief.md`), and both
now have one:

- **Palette → canvas.** Every palette entry (`app/src/palette/PlantPalette.tsx`)
  has an "Add to plot" button next to its draggable card. Pressing it places
  the plant at the plot's centre and selects it — no drag, no pointer, no
  guessing at a "keyboard drop point" (`dnd-kit`'s own `KeyboardSensor` is
  present and does let a focused card be picked up with Space and nudged
  with arrow keys, but that moves the card in raw screen pixels across a
  potentially page-length distance, which is why it isn't the primary path —
  see ADR 0026 §1–2 for the full reasoning).
- **On-canvas move/select/remove.** `app/src/canvas/PlotCanvas.tsx` already
  handled Delete/Backspace for a selected placement; this stage adds
  arrow-key nudging (10cm per press, 50cm with Shift, clamped to the plot's
  bounds) and, since Konva markers aren't focusable DOM elements,
  "Previous placement"/"Next placement" buttons
  (`app/src/canvas/PlotCanvasSection.tsx`) as a keyboard-only way to select
  one.
- **A "Skip to plot canvas" link** (`app/src/plot/SkipLinks.tsx` — one link at
  the time, two as of UI redesign Phase 1, see §6), the one thing the keyboard
  walkthrough below turned up as worth adding — see §4.

## 2. Colour contrast and ARIA

Audited rather than assumed, per the same "verify, don't trust" posture
Stage 6.1 used for doc figures.

**Contrast (WCAG 1.4.3, 4.5:1 for normal text) — measured with the standard
relative-luminance formula, not eyeballed:**

| Colour                                           | Before                | After                 |
| ------------------------------------------------ | --------------------- | --------------------- |
| `PlantPalette.tsx` `BAND_COLORS.good`            | `#4c8c2b` — 4.12:1 ❌ | `#3f7522` — 5.56:1 ✅ |
| `PlantPalette.tsx` `BAND_COLORS.fair`            | `#9a7b0a` — 4.03:1 ❌ | `#8a6c00` — 4.97:1 ✅ |
| `warnings/severity.ts` `SEVERITY_COLORS.warning` | `#d97706` — 3.19:1 ❌ | `#b45309` — 5.02:1 ✅ |

Every other band/severity colour already cleared 4.5:1 and was left alone.
Unit tests (`severity.test.ts`, and the equivalent reasoning recorded in
`PlantPalette.tsx`'s own comment) hold these ratios going forward.

**Re-measured in UI redesign Phase 0 (2026-07-28), when the band became a
chip.** The five band colours above were tuned against a **white** background,
which is what they sat on. Phase 0 renders the band as a chip — the same text
on a tint of its own hue — and a tint is darker than white, so every pairing
had to be computed again rather than assumed to carry over. Three survived
unchanged; two could not clear 4.5:1 against _any_ usable tint and were
darkened one step in the same hue:

| Band         | Chip pairing           | Ratio                                                                    |
| ------------ | ---------------------- | ------------------------------------------------------------------------ |
| `excellent`  | `#1a7f37` on `#eaf7ee` | 4.60:1 ✅ (colour unchanged)                                             |
| `good`       | `#3f7522` on `#eef6e8` | 5.02:1 ✅ (colour unchanged)                                             |
| `fair`       | `#8a6c00` on `#fcf7e8` | 4.64:1 ✅ (colour unchanged)                                             |
| `poor`       | `#a85600` on `#fdf0e4` | 4.69:1 ✅ (was `#b35c00`, which tops out at 4.48:1 on any usable tint)   |
| `unsuitable` | `#6b6b6b` on `#f0efed` | 4.64:1 ✅ (was `#767676`, which reaches only 4.54:1 even on plain white) |

Both darkened values also still clear the bar on plain white (5.26:1 and
5.33:1). The band colours now live as the `--band-*` tokens in
`app/src/styles/tokens.css` — that file carries the working, and is where to
change them — rather than as `PlantPalette.tsx`'s old `BAND_COLORS` map.

Phase 0's own new pairings were measured the same way, and are recorded beside
the tokens they belong to: body text 10.78:1 on the page background, muted text
5.03:1, the focus ring 4.87:1, and `--border-input` at 3.47:1 against the page
(WCAG 1.4.11's 3:1 bar for a control's boundary, not the text bar). The severity
colours are unchanged, and every surface that shows a severity word is a white
card — which is the background their 4.5:1 figures were measured against.

**Colour-only meaning:** the brief named two candidates.

- `BAND_COLORS` — **not actually colour-only**: `BAND_LABELS`'s text
  ("Excellent match", "Good match", …) renders right next to the colour, so a
  colour-blind or screen-reader user already gets the same information a
  different way. No further change needed beyond the contrast fix above. (Still
  true of Phase 0's chip: the chip's own content _is_ that text.)
- The canvas's severity badges — **were** colour-only: every severity drew
  the same `"!"` glyph, so colour was the _only_ signal on the canvas itself
  (`WarningsPanel.tsx`'s own severity label already shows the word, so that
  one needed no change). Fixed with `severity.ts`'s new `severityGlyph`
  (`i`/`!`/`×` for info/warning/severe).

**ARIA, found by actually running axe** (`e2e/a11y.spec.ts`), not by
reasoning about the markup in the abstract:

- The plot canvas's container `<div>` and the outline editor's corner/
  midpoint `<circle>`s all carried `aria-label` with no ARIA role — axe's
  `aria-prohibited-attr` rule correctly flags this (an element with no role
  has an implicit role that doesn't support naming at all). Fixed with
  `role="group"` on the canvas container and `role="button"` on the outline
  editor's circles (they _are_ buttons functionally). See ADR 0026 §6 for why
  the circles get the role but deliberately not a `tabIndex` — that would
  claim keyboard operability they don't have yet (§5 below).
- The palette's new "Add to plot" button is a **sibling** of the draggable
  card, not nested inside it — nesting a real `<button>` inside `useDraggable`'s
  own `role="button"` element is exactly what axe's `nested-interactive`
  rule exists to catch. See ADR 0026 §2.

Today's axe result (command + full output) is recorded in the root
[`README.md`](../README.md#accessibility-axe-check), mirroring Stage 5.1's
Lighthouse section.

## 3. Responsive layout for small screens

`docs/review-pre-deployment.md` §2 found the plot canvas rendering at
**y ≈ 3500px** in a default-conditions plot, and noted the figure "was chosen
when the palette was shorter; the dataset has grown since" — i.e. an
_unbounded, still-growing_ number, not a fixed one. The actual cause: the
palette rendered **every** matching crop in full detail with no height limit
at all (up to 130+ rows in the common no-filter case), so the page's own
height scaled with the dataset, not with the viewport.

**The fix is structural, not a media query:** `PlantPalette.tsx`'s result
list now renders inside a `max-height: 65vh; overflow-y: auto` container.
The page's height is now bounded regardless of how many crops match or how
large the dataset grows — the actual "usable on a phone" problem, not a
cosmetic one.

Two more, smaller fixes for the same reason (verified, not assumed — see §4
for how):

- `PlotCanvasSection.tsx` wraps the canvas in a `max-width: 100%; overflow-x:
auto` container, and `PlotOutlineEditor.tsx` does the same for its SVG — a
  plot large enough to render wider than a phone's viewport (fixed
  `PX_PER_CM` scales, so a 10m×10m plot really is wider than a 320px phone
  screen) now scrolls _inside its own box_ instead of forcing the whole page
  to overflow horizontally, which would otherwise drag the form and palette
  sideways with it.
- `AppShell.tsx` gained horizontal padding (`0 1rem`) so content doesn't sit
  flush against the screen edges on a narrow viewport.

**Deliberately not done:** making the canvas compute its own
pixels-per-centimetre from the available viewport width (an alternative the
brief raised). Rejected because it would make plant icons illegible on a
large plot squeezed into a narrow screen, and — more importantly — because
`canvas/drop.ts#resolveDrop`'s drop-point math and the canvas's render-time
`cmToPx`/`pxToCm` calls would all need to agree on the _same_ dynamically-
computed scale at the moment of any given drop, which is a real source of
subtle bugs (a resize mid-drag, a stale value) for a gain the fixed-scale
`overflow-x: auto` wrapper already gets more simply and more safely.

### Verified on real small viewports (Playwright device emulation), not just by reasoning about CSS

| Check                                                   | Result                                                                                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| iPhone 12 (390×844), default plot, no search filter     | No horizontal overflow (`scrollWidth` 390 = `clientWidth` 390). Canvas at y≈2678px — down from the previously-diagnosed 3500px+ _and unbounded growth_, and now a bounded number regardless of dataset size. |
| 320×568 (smallest common phone width), default plot     | No horizontal overflow.                                                                                                                                                                                      |
| Same 320px viewport, after applying a 10m×10m rectangle | Still no horizontal overflow — the canvas scrolls inside its own container instead of blowing out the page.                                                                                                  |

Honest framing: 2678px is a real, measured improvement over an unbounded,
still-growing number, not "no scrolling required" — the plot-definition
page's four-step core loop (`DESIGN.md`) is inherently more content than one
phone screen holds. The fix makes the page's height _bounded and
predictable_ rather than a function of dataset size; it does not make the
canvas appear above the fold on first load.

## 4. Automated a11y check (axe)

A locally-runnable command — and, since Workplan Stage 6.4, a **blocking CI
check** on every push and pull request (`.github/workflows/checks.yml`, ADR
[0027](./adr/0027-ci-checks-workflow-and-blocking-policy.md)). A new axe
violation now fails the build:

```bash
npm run build -w app && npm run preview -w app   # serve the production build at :4173, in one terminal
# in another terminal:
npm run a11y -w app
```

Scans the plot-definition page in two states (fresh load, and after placing
a crop via keyboard so the "Selected: …"/warnings-panel DOM is exercised
too) against the `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` rule tags. **Today's
result: 0 violations in both states.** Full output and the exact command are
recorded in [`README.md`](../README.md#accessibility-axe-check).

`e2e/a11y.spec.ts`'s own doc comment records what axe structurally can't
check here: the Konva-rendered canvas is one opaque `<canvas>` element to any
DOM-based tool (so the severity-glyph and contrast fixes to the badge are
unit-tested and reviewed, not axe-verified), and axe checks markup, not
"does tabbing through the page actually work" — which is what §5 covers.

## 5. Manual keyboard-only walkthrough of the core journey

The brief asks for this as a completed, honestly-recorded deliverable, not
an optional check alongside axe. Rather than a purely subjective pass (this
session has no hands or eyes to drive a browser by feel), the walkthrough is
a **scripted, keyboard-only drive** of the app — `page.keyboard.*` only, no
`page.mouse`, no `.click()` — which is a stronger, more reproducible proof
that every step is reachable and operable than a one-off manual click-through
would be, while still not a substitute for real assistive-tech testing (see
the gap noted at the end).

Run it yourself:

```bash
npm run build -w app && npm run preview -w app   # in one terminal
PW_EXECUTABLE_PATH=/path/to/chromium npm run keyboard-walkthrough -w app   # in another
```

(`app/keyboard-walkthrough.mjs`, `PW_EXECUTABLE_PATH` only needed if your
environment ships its own Chromium instead of Playwright's managed one, same
as every other Playwright config in this repo.)

**Today's recorded run** — the core journey, describe plot → find a crop →
place it → check warnings, driven entirely by keyboard:

```
=== Step 0: the "Skip to plot canvas" link (Workplan Stage 6.2) ===
  OK   the skip link jumps focus straight to the plot canvas

=== Step 1: describe the plot (keyboard only) ===
  OK   reached the rectangle width field by Tab alone
  OK   applied a 4m x 3m rectangle via keyboard (Tab + type + Enter)

=== Step 2: find a crop (keyboard only) ===
  OK   reached the palette search field by Tab and typed a crop name

=== Step 3: place it (keyboard only, via "Add to plot") ===
  OK   activated "Add to plot" via keyboard (Tab + Enter) — no drag involved
  OK   the placed crop shows as "Selected" (auto-selected on add, per addPlacement)

=== Step 3b: nudge it with arrow keys (keyboard only) ===
  OK   reached the plot canvas by Tab alone (35 presses from the search field — see the "friction" note below)
  OK   nudged the selected plant into a new position with arrow keys, no pointer at all

=== Step 4: check warnings (read-only, but confirm reachable) ===
  OK   the "Check for problems" section is present and reachable (no interaction needed to read it)

All steps passed.
```

### Findings worth carrying forward (not hidden)

- **Every step of the core journey is keyboard-reachable and keyboard-
  operable.** No dead ends, no pointer-only requirement anywhere in
  describe → discover → place → check.
- **Reaching the canvas after placing a crop takes 35 tab presses** in this
  run's six-crop search match ("Onion" matches Onion, Red Onion, Spring
  Onion, White Onion, Yellow Onion, Green Onion — each row is two tab stops,
  plus the whole "Add your own crop" form sits between the palette and the
  canvas). Real friction, not a bug: everything is reachable, just slowly.
  The "Skip to plot canvas" link (§1) helps a user who wants to jump to the
  canvas _before_ placing something, but doesn't help the specific
  "just placed one, now go nudge it" case, since focus is already past the
  link's position by then. Worth a future look — e.g. moving focus to the
  new marker's row automatically after "Add to plot" — but that's a focus-
  management change with its own trade-offs (unexpected focus jumps are
  their own accessibility anti-pattern if done carelessly), so it's recorded
  here rather than rushed into this stage.
- **The free-form plot-outline corner editor is still pointer-only**
  (`PlotOutlineEditor.tsx`'s draggable corners). **Closed in UI redesign
  Phase 2 — see §7.** The rest of this bullet is left as written, because it
  is the record of what was true at Stage 6.2. The walkthrough's "describe
  the plot" step deliberately used the preset shape picker (radio buttons +
  number inputs, fully keyboard-operable) rather than the free-form drag —
  that's a real, working keyboard path for describing a plot, but adjusting
  an outline's exact shape by dragging a corner is not yet possible without
  a pointer. This is in scope by the Stage 6.2 brief's own framing — it names
  exactly two places needing a keyboard alternative (palette→canvas,
  on-canvas move/remove) — but it's a real gap for a future stage, not
  something to silently pretend doesn't exist. `role="button"` was added to
  the corner handles this stage (needed for `aria-prohibited-attr`, see §2),
  but deliberately without `tabIndex` — see ADR 0026's "alternatives
  considered" for why a focusable-but-inert control would be worse, not
  better.
- **Not done: real screen-reader testing** (NVDA/VoiceOver/JAWS). The
  scripted walkthrough proves keyboard _reachability and operability_, which
  axe cannot; it does not prove that a screen reader _announces_ every state
  change usefully (e.g. does a user hear that a plant was placed and
  selected, not just see it). That's a real, recorded gap for whichever
  future session has access to real assistive-tech software to test with.

## 6. Re-verified after the UI redesign's layout phase (2026-07-28)

Phase 1 of [`docs/ui-aesthetic-review.md`](./ui-aesthetic-review.md) replaced
the stacked document this page was written against with a three-region
workspace (ADR [0030](./adr/0030-workspace-layout-not-a-document.md)). That
moves reading order, tab order and every landmark in the app, so none of §1–§5
could be assumed to carry over. What follows is what was re-run, and what
changed.

### The reading order moved, and cost something

Reading order is now **plants → plot → settings**, so the shape-and-conditions
form sits behind the whole 144-crop palette where it used to come first. That
is a real cost, and it is paid the way Stage 6.2 paid the same kind of cost: a
**second skip link**, "Skip to plot settings", alongside the existing one to the
canvas (`app/src/plot/SkipLinks.tsx`, renamed from `SkipToCanvasLink.tsx`).

The alternative considered and rejected: leave the settings column first in the
DOM and move it into the third grid column with `grid-column`. That fixes the
tab count by making focus jump from the right edge of the screen back to the
left — precisely what WCAG 2.4.3 (Focus Order) exists to prevent. Recorded in
ADR 0030 §5.

### Structure: landmarks in place of the numbers

The numbered "1. Define your plot" … "4. Check for problems" headings were
navigable structure as well as (bad) instruction. Each of the three regions is
now a labelled `region` landmark — Plants, Your plot, Plot settings and checks —
with its own `<h2>`; the settings column's three panels are
`<details>`/`<summary>` with the heading inside the summary, so each is a
disclosure control and a heading at once. `App.test.tsx` asserts the three
landmarks exist, so they can't quietly go missing.

### axe: 0 violations, now in three states

`npm run a11y -w app` gained a third scan. "Add your own crop" moved into a
modal `<dialog>` (`app/src/ui/ModalDialog.tsx`), and a modal is exactly the kind
of surface that regresses quietly — an unnamed dialog, a heading order that
restarts, a control the trap leaves behind — so it is scanned in the state a
user meets it in.

```
  ✓  1 e2e/a11y.spec.ts:36:1 › the plot-definition page has no axe violations in its initial state
  ✓  2 e2e/a11y.spec.ts:44:1 › the plot-definition page has no axe violations once a plant is placed and selected
  ✓  3 e2e/a11y.spec.ts:64:1 › the add-crop dialog has no axe violations while open
  3 passed
```

The dialog's focus trap, Esc handling and focus-return are the **browser's**,
not ours: it is a real `<dialog>` opened with `showModal()`, not a
`<div role="dialog">` with a hand-written trap. axe doesn't check those, so the
walkthrough does (last two steps below).

### The keyboard walkthrough: shorter, and re-shaped to the layout

`app/keyboard-walkthrough.mjs` follows the app's reading order, so it changed
shape with the app: it starts at the palette and reaches the shape form _from_
the canvas, and gained a step per skip link plus one for the dialog.

```
=== Step 0: the skip links (Workplan Stage 6.2; second link added in UI redesign Phase 1) ===
  OK   the first skip link jumps focus straight to the plot canvas
  OK   the second skip link jumps focus straight to the plot settings column

=== Step 1: find a crop (keyboard only) ===
  OK   reached the palette search field in 4 tabs and typed a crop name

=== Step 2: place it (keyboard only, via "Add to plot") ===
  OK   activated "Add to plot" via keyboard (Tab + Enter) — no drag involved
  OK   the placed crop shows as "Selected" (auto-selected on add, per addPlacement)

=== Step 3: nudge it with arrow keys (keyboard only) ===
  OK   reached the plot canvas by Tab alone (15 presses from the search field — see the "friction" note below)
  OK   nudged the selected plant into a new position with arrow keys, no pointer at all

=== Step 4: describe the plot (keyboard only) ===
  OK   reached the rectangle width field in 4 tabs from the canvas
  OK   applied a 4m x 3m rectangle via keyboard (Tab + type + Enter)

=== Step 5: check warnings (read-only, but confirm reachable) ===
  OK   the "Problems & suggestions" panel is present and reachable (no interaction needed to read it)

=== Step 6: the add-crop dialog (UI redesign Phase 1) ===
  OK   opening the dialog moves focus inside it
  OK   Esc closes the dialog and returns focus to the trigger that opened it

All steps passed.
```

**The friction §5 recorded is measurably smaller: 15 tab presses to the canvas
where it was 35**, for the same six-crop "Onion" search. Most of that is the
"Add your own crop" form — ~25 tab stops — leaving the page for a dialog; the
rest is the canvas's own toolbar buttons now sitting before it rather than
after. The finding itself stands: everything is reachable, and the long way
round is still long. The skip link remains the short way.

### Small screens: the Stage 6.2 work is kept, as the one breakpoint

Below 900px the workspace stops pinning to the viewport, the three regions stack
into cards, and the palette's crop list gets its `min(65vh, 40rem)` cap back —
§3's reasoning unchanged, because it is still right: on a phone this app reads
as one page of sections, and three internally-scrolling regions on a 640px-tall
viewport would be three cramped windows onto it. Above that width the cap is
gone and the list simply fills the sidebar, which is better than a fraction of
the viewport ever was.

Re-verified at 390×844: the regions stack in reading order, the page scrolls
normally, and nothing forces horizontal overflow —
`app/e2e/workspace-layout.spec.ts` asserts all three, so this can't regress
unnoticed.

### Still not done, still recorded

The two gaps §5 ends on are **unchanged by this phase**: the free-form
plot-outline corner editor is still pointer-only, and there has still been no
real screen-reader testing (NVDA/VoiceOver/JAWS). Neither got better or worse;
both remain in `WORKPLAN.md` §5.2's backlog with an explicit disposition.
(The first of the two is closed as of UI redesign Phase 2 — §7.)

## 7. Re-verified after the UI redesign's canvas phase (2026-08-03)

UI redesign Phase 2 (ADR
[0031](./adr/0031-canvas-as-hero-live-scale-and-one-plot-picture.md)) is the
first phase to add a whole new _interaction mode_ since Stage 6.2, so it is the
first to need this page updated for a reason other than "the layout moved".

### The pointer-only outline editor: closed, not moved

§5 has recorded since Stage 6.2 that "adjusting an outline's exact shape by
dragging a corner is not yet possible without a pointer", and the keyboard
walkthrough ended by saying so. Phase 2 merges that editor into the plot canvas
— and merging it is exactly the wrong moment to carry a known gap across, so it
is fixed instead.

The fix is the pattern ADR 0026 already established for placements, because the
constraint is the same one: Konva draws painted pixels, not focusable DOM, so
the thing being acted on needs a _selection_ that lives outside the scene.

| Doing this to a plot corner | With a pointer               | With a keyboard                        |
| --------------------------- | ---------------------------- | -------------------------------------- |
| choose one                  | click a handle               | ◀/▶ "Previous / Next corner" (toolbar) |
| move it                     | drag the handle              | arrow keys (Shift for 50cm steps)      |
| add one                     | click a blue midpoint handle | "Add corner" (toolbar)                 |
| remove one                  | double-click a handle        | Delete/Backspace, or "Remove corner"   |

Entering "Edit shape" selects corner 0, so the arrow keys work immediately
rather than after a hunt — a mode whose keys silently do nothing until you find
something to click is the pointer-first assumption this exists to remove.

The canvas's `aria-label` **changes with the mode**, because the keys do: a
user who turned on "Edit shape" and heard the arrange-mode instructions read
back would be told the wrong thing about the only controls they have.

### Every new control is a button, and the gestures are extras

The canvas toolbar gained zoom (−, a live readout, +, Fit), "Edit shape" and
"Clear all". All are real `<button>`s with full `aria-label`s — the icon-only
ones are compact in their _drawing_, never in their name — and the zoom readout
is `aria-live="polite"`, because otherwise "Zoom in" is a control whose entire
effect is invisible to a screen-reader user. Ctrl-free pointer gestures were
added on top (drag empty ground to pan a zoomed-in plot) but never as the only
way to do anything, per ADR 0026.

"Clear all" is destructive and unrecoverable until Phase 5 builds undo, so it
confirms first — through `ui/ModalDialog.tsx`, the same real `<dialog>` the
add-crop form uses, so the focus trap, Esc and focus-return are the browser's.

### Motion, inside a canvas

`styles/global.css` has honoured `prefers-reduced-motion` since Phase 0, but a
stylesheet cannot reach inside a `<canvas>`. Phase 2's one canvas animation —
a 150ms scale "pop" when a marker lands — reads the same media query in
JavaScript (`ui/usePrefersReducedMotion.ts`) and skips entirely when it
matches. Subscribed rather than sampled once, because the preference is an OS
setting a user can change while the app is open.

### Contrast: one new text pairing

The scene draws the plot's dimensions ("3.0 m") in `--soil-700` on the
`--soil-100` surround: **6.01:1**, computed the same way §2 computed everything
else. Nothing else Phase 2 added to the canvas is text — the grid, the canopy
discs and the outline handles are all non-text, and each is paired with
something else that carries the meaning (the labels, the icon and name, the
mode's own instructions).

### axe: 0 violations, now in five states

Two new surfaces got their own scans, following Phase 1's precedent with the
add-crop dialog: **edit-shape mode** (which rewrites the canvas's accessible
name and half the toolbar) and the **clear-all confirmation**. With the three
existing states that is five scans, all clean.

### The keyboard walkthrough: two more steps, and five more tab presses

Reaching the canvas from the palette search is now **20** tab presses, where
Phase 1 measured 15 and Stage 6.2 measured 35. The five are the canvas
toolbar's new buttons, which sit between the palette and the canvas in reading
order — the cost of them being real buttons rather than gestures, and the right
trade.

New steps 3b and 3c walk the zoom controls (reached in 7 Shift+Tabs back from
the canvas) and reshape the plot with no pointer at all. Today's recorded run:

```
=== Step 0: the skip links ===
  OK   the first skip link jumps focus straight to the plot canvas
  OK   the second skip link jumps focus straight to the plot settings column

=== Step 1: find a crop (keyboard only) ===
  OK   reached the palette search field in 4 tabs and typed a crop name

=== Step 2: place it (keyboard only, via "Add to plot") ===
  OK   activated "Add to plot" via keyboard (Tab + Enter) — no drag involved
  OK   the placed crop shows as "Selected" (auto-selected on add, per addPlacement)

=== Step 3: nudge it with arrow keys (keyboard only) ===
  OK   reached the plot canvas by Tab alone (20 presses from the search field)
  OK   nudged the selected plant into a new position with arrow keys, no pointer at all

=== Step 3b: the canvas toolbar — zoom (UI redesign Phase 2) ===
  OK   reached "Zoom in" in 7 Shift+Tabs from the canvas and zoomed the plot (646.551px → 808.189px)
  OK   returned to a fitted plot with the "Fit" button

=== Step 3c: reshape the plot on the canvas (keyboard only, UI redesign Phase 2) ===
  OK   moved a plot corner with the arrow keys, reshaping the outline (stage 1.36 → 1.89 wide-to-tall)
  OK   left edit-shape mode from the keyboard

=== Step 4: describe the plot (keyboard only) ===
  OK   reached the rectangle width field in 4 tabs from the canvas
  OK   applied a 4m x 3m rectangle via keyboard (Tab + type + Enter)

=== Step 5: check warnings (read-only, but confirm reachable) ===
  OK   the "Problems & suggestions" panel is present and reachable

=== Step 6: the add-crop dialog (UI redesign Phase 1) ===
  OK   opening the dialog moves focus inside it
  OK   Esc closes the dialog and returns focus to the trigger that opened it

All steps passed.
```

### Still not done, still recorded

**Real screen-reader testing (NVDA/VoiceOver/JAWS) has still not happened**,
and Phase 2 makes that gap slightly more pointed rather than less: the canvas
now carries considerably more meaning — a footprint, a grid, dimensions, a mode
— and none of it is in the accessibility tree, because it is painted pixels.
The mode's instructions and the placement/corner readouts are the DOM's account
of that scene, and whether they are a _sufficient_ account is exactly the
question only a real screen-reader session answers. It remains in
`WORKPLAN.md` §5.2's backlog.

## 8. Re-verified after the UI redesign's palette phase (2026-08-04)

UI redesign Phase 3 (ADR
[0032](./adr/0032-palette-compact-cards-and-details-on-demand.md)) rewrote the
surface that §5's friction figures are mostly _about_ — 144 crops, two tab
stops each — and put a second interaction on an element that already had one.
Both are reasons this page could not be assumed to carry over.

### The tab-stop budget, and why it is written down

144 crops × 2 focusable controls per row = **288 tab stops in the palette**,
plus six for the sidebar's own chrome (search, the category radio group, two
toggle chips, the ranking-note disclosure, and the add-crop trigger): **294**
measured in the browser. That number is the constraint the phase's shape was
chosen against.

The review asks for the reasoning to open on a click. The obvious way to build
that is a third control per row — a "why?" button beside the drag surface and
the `＋` — and that would make it **432**, past the point where this page's own
keyboard walkthrough gives up hunting (its step 6 budget is 320). So the card
_itself_ became the disclosure, which costs no stops at all.
`PlantPalette.test.tsx` asserts two per row, and names them, so a fourth
affordance can't quietly arrive as a third control.

### One element, two gestures, and what each announces

The palette card is dnd-kit's drag surface (`role="button"`, `tabIndex={0}`,
`aria-roledescription="draggable"`) and now a disclosure as well. Three things
make that honest rather than merely functional:

|                   | pointer                                 | keyboard                                         |
| ----------------- | --------------------------------------- | ------------------------------------------------ |
| place the crop    | drag the card (past 4px), or press `＋` | `＋` (Enter/Space), or Space to pick the card up |
| read why it ranks | click the card                          | Enter on the card                                |

- **Enter is free for the disclosure** because `PlotDefinitionPage` narrows
  dnd-kit's `KeyboardSensor` to start a drag on **Space alone** (its default is
  either key). A `role="button"` `<div>` doesn't synthesise a click from Enter
  the way a real `<button>` does, so without this the disclosure would have
  been pointer-only — the exact class of gap ADR 0026 exists to prevent. Space
  is the key dnd-kit's own screen-reader instructions name, so what a user is
  told to press is unchanged.
- **The accessible name says both jobs**: `drag <crop> onto the plot to place
it, or press to see why it ranks here`. A control announced as "collapsed"
  whose name mentions only dragging is a control whose name is wrong.
  `aria-expanded` carries the state.
- **No `aria-controls`.** The reasoning isn't in the DOM while collapsed, and
  referencing an absent id is an `aria-valid-attr-value` violation; the
  disclosure sits immediately after its trigger instead.

The `＋` button's name is untouched — `Add <crop> to the plot, without
dragging`, the string ADR 0026 made contractual and three specs plus the
walkthrough select on. Only its drawing shrank to a glyph.

### Structure: 144 headings retired

The crop name was an `<h3>`. Two things were wrong with that, and only one is
about clutter:

1. ARIA makes a `role="button"` element's subtree **presentational**, and the
   `<h3>` was inside the drag surface — so conforming assistive tech was
   entitled to flatten it. The outline claimed structure it did not reliably
   have.
2. 144 crop headings sit ahead of the six that actually structure the app,
   which makes heading navigation useless in the one document where it would
   help most.

What replaces them was already there: a `<ul>` of `<li>`, announced as "list,
144 items". The ordering test that read the headings now reads each row's own
accessible name.

### Contrast: three new pairings, and one the review asked for that fails

Computed the same way §2 computed everything else.

| Pairing                                                  | Ratio      | Bar                     |
| -------------------------------------------------------- | ---------- | ----------------------- |
| `--text-strong` on `--category-vegetable-bg` (`#eaf1e6`) | 12.87:1 ✅ | 4.5:1 (chip text)       |
| `--text-strong` on `--category-herb-bg` (`#e0efed`)      | 12.52:1 ✅ | 4.5:1                   |
| `--text-strong` on `--category-fruit-bg` (`#f7e7e6`)     | 12.37:1 ✅ | 4.5:1                   |
| `--category-vegetable` dot on its own tint               | 3.58:1 ✅  | 3:1 (1.4.11, graphical) |
| `--category-herb` dot on its own tint                    | 4.49:1 ✅  | 3:1                     |
| `--category-fruit` dot on its own tint                   | 4.54:1 ✅  | 3:1                     |

The obvious alternative — a selected chip filled with its category colour,
labelled in white — was **rejected on measurement**: white on
`--category-vegetable` is **4.12:1**, and moving that green would change the
canvas markers (`styles/tokens.test.ts` mirrors them) to fix a chip.

**The review's `opacity: 0.6` for unsuitable crops is the pairing that fails**,
and this phase declined it rather than carrying it forward. Composited over a
white card:

| Element at `opacity: 0.6`                                              | Full    | Composited    |
| ---------------------------------------------------------------------- | ------- | ------------- |
| the crop's name (`--text-strong`)                                      | 14.83:1 | **4.08:1** ❌ |
| the category word (`--text-muted`)                                     | 5.58:1  | **2.49:1** ❌ |
| the band chip's text (`--band-unsuitable`, tuned to 4.64:1 in Phase 0) | 4.64:1  | **2.24:1** ❌ |

These were already true, at larger scale, of the pre-Phase-3 rows — this phase
found them rather than introducing them. "Visible but muted" is now carried by
the parts with no ratio to lose: a **greyscale icon on a neutral disc** instead
of its category tint, and the name one step down to `--text-muted` (5.58:1).

**And a word that colour alone would otherwise have carried.** The compact card
keeps the category in _words_ beside the band chip, which the review's "icon,
name, band chip. That's it" doesn't call for. The icon's disc is tinted by
category, and without the word that tint is information conveyed by colour
alone (WCAG 1.4.1). A legend does not fix that for the people 1.4.1 is about —
a reader who can't tell the teal chip from the green one can't use a teal/green
key either. Measured cost: at 287px the longest band label and the longest
category word don't quite both fit, so **4 rows of 144** ellipsis "vegetable"
to "vegetab…" — still unambiguous, where the alternative ("V…") was not.

### axe: 0 violations, now in six states

A palette card with its reasoning expanded got its own scan, following the
precedent Phases 1 and 2 set for the dialogs and edit-shape mode. It is the
state worth scanning: one element carrying `role="button"`,
`aria-roledescription`, `aria-describedby` and `aria-expanded` at once has
plenty of ways to end up invalid, and an icon-only `＋` button is a
`button-name` failure the moment its label slips.

```
  ✓  1 the plot-definition page has no axe violations in its initial state
  ✓  2 the plot-definition page has no axe violations once a plant is placed and selected
  ✓  3 the canvas has no axe violations in edit-shape mode
  ✓  4 the clear-all confirmation has no axe violations while open
  ✓  5 the palette has no axe violations with a card’s reasoning expanded
  ✓  6 the add-crop dialog has no axe violations while open
  6 passed
```

### The keyboard walkthrough: one more step, and the same counts

The friction figures §7 recorded are **unchanged**: 4 tabs to the palette
search field, **20** from there to the canvas. That is the point — the phase
changed what a row _is_ without changing what a row _costs_.

```
=== Step 1: find a crop (keyboard only) ===
  OK   reached the palette search field in 4 tabs and typed a crop name

=== Step 2: place it (keyboard only, via "Add to plot") ===
  OK   activated "Add to plot" via keyboard (Tab + Enter) — no drag involved
  OK   the placed crop shows as "Selected" (auto-selected on add, per addPlacement)

=== Step 2b: read why a crop ranks where it does (UI redesign Phase 3) ===
  OK   opened a crop’s summary, confidence and per-dimension reasoning with Enter — one key, no pointer

=== Step 3: nudge it with arrow keys (keyboard only) ===
  OK   reached the plot canvas by Tab alone (20 presses from the search field)
  OK   nudged the selected plant into a new position with arrow keys, no pointer at all
```

(Steps 0, 3b, 3c, 4, 5 and 6 are unchanged from §7's run and all pass.)

### Still not done, still recorded

**Real screen-reader testing (NVDA/VoiceOver/JAWS) has still not happened.**
This phase adds a specific question to that list: the palette card is now a
draggable, a disclosure and — while dragging — an `aria-pressed` toggle, all on
one node. Whether that composite announces _usefully_, rather than merely
validly, is exactly what only a real screen-reader session answers. It remains
in `WORKPLAN.md` §5.2's backlog.

## 9. Re-verified after the UI redesign's settings-column phase (2026-08-04)

UI redesign Phase 4 (ADR
[0033](./adr/0033-warnings-dock-shape-tiles-and-segmented-conditions.md))
rewrote every control in the right-hand column, replaced a severity _word_ with
an icon in two places, and put a form control behind a disclosure. Each of those
is a reason this page could not be assumed to carry over.

### The tab-stop budget, measured either side

**13 before, 11 after** in the default state; **14** with the soil disclosure
open. Counted by walking Tab in Chromium from the column's own anchor (the one
the second skip link lands on) until focus left it — not by counting selectors,
which would have miscounted the closed disclosure's contents.

| stop | before                           | after                            |
| ---- | -------------------------------- | -------------------------------- |
| 1    | "Plot shape & size" summary      | "Plot shape & size" summary      |
| 2    | shape radio group                | shape **tile** radio group       |
| 3–4  | Width, Height                    | Width, Height                    |
| 5    | "Use this shape"                 | "Use this shape"                 |
| 6    | "Growing conditions" summary     | "Growing conditions" summary     |
| 7    | Light level `<select>`           | Light level **segmented group**  |
| 8–10 | Soil texture / pH / moisture     | "Describe your soil" summary     |
| 11   | Location radio group             | Region `<select>`                |
| 12   | Planting month `<select>`        | Planting month `<select>`        |
| 13   | "Problems & suggestions" summary | "Problems & suggestions" summary |

It went **down** because the phase spent no new stops. A segmented control is
one radio group where a `<select>` was one control; the three soil facets sit
behind one summary; and the shape tiles are the same single radio group the
three radios already were — which is exactly why they are native radios rather
than buttons (ADR 0032 §6's reasoning, reused). The three soil stops come back
when the disclosure is opened, which is when they are reachable.

The keyboard walkthrough's **step 4 is unchanged**: it tabs to Width, then
expects Height, then "Use this shape". That adjacency survives both the tiles
(a group is one stop) and the unit moving inside the field — checked rather than
assumed, because it is the kind of thing that fails several steps later with a
message about something else.

### The unit is inside the field and still announced

The review asks for "3 m" inside the dimension inputs. A decorative suffix drawn
over the box is not in the accessible name, so the unit would have been visible
and unspoken. The answer is in the label rather than in an `aria-describedby`:

- visible label text: **"Width"**
- accessible name: **"Width (m)"** — the "(m)" is a `visually-hidden` span

WCAG 2.5.3 (label in name) wants the visible label contained in the accessible
name, which holds. `aria-describedby` pointing at the suffix would have
announced a bare "m" after the value instead, which says less.

### The severity word did not disappear; it moved

`WarningsPanel` and `PlotCanvasSection` both rendered
`warning.severity.toUpperCase()`. Both now render `warnings/SeverityIcon.tsx`,
which draws `severity.ts`'s **existing** `severityGlyph` (`i` / `!` / `×`) —
the glyph Stage 6.2 added so the canvas marker's badge carried severity in shape
and not only colour. Three things keep that honest:

- The icon is `role="img"` with `aria-label={severity}`, so a screen reader
  announces "severe" exactly where it used to read "SEVERE". `role="img"` also
  makes the subtree presentational, so the glyph is never read out as a
  character ("times").
- A `title` puts the same word under a sighted pointer — which the uppercase
  word never needed and a glyph does.
- The count badges carry their own name: `aria-label="2 severe"` over a number
  and an icon that are both hidden from the accessibility tree, so the badge
  reads aloud as one unit rather than as "2" next to an unlabelled mark.

Colour is still never the only signal (WCAG 1.4.1): each severity has its own
glyph, the card keeps its severity-coloured left edge _and_ the icon, and the
reason sentence carries the substance.

### Contrast: four new pairings, and one rejected on measurement

Computed the same way §2 and §8 computed everything else.

| Pairing                                                      | Ratio          | Bar                   |
| ------------------------------------------------------------ | -------------- | --------------------- |
| `--text-on-dark` on `--green-700` (selected segment)         | 6.39:1 ✅      | 4.5:1                 |
| `--text-on-dark` on `--green-900` (hovered selected segment) | 11.08:1 ✅     | 4.5:1                 |
| `--text-strong` on `--green-100` (selected shape tile)       | 12.55:1 ✅     | 4.5:1                 |
| `--green-700` tile/segment border on `--surface-card`        | 6.39:1 ✅      | 3:1 (1.4.11, control) |
| `--severity-*` as icon and badge text on `--surface-card`    | 4.83–5.17:1 ✅ | 4.5:1                 |

The severity figures are §2's, unchanged — and that is the point rather than a
shortcut. **Every severity-coloured thing this phase drew is text or a border on
the white card**, which is the background those values were measured against, so
no severity pairing in the dock is a new sum at all. The one that would have
been is the one the phase avoided: `--severity-severe` on the page cream is
**4.35:1** ❌, which is why §2's standing rule is that any surface showing a
severity is a card. The settings column is `--surface-card`, so the dock is.

**What a filled count badge would actually have cost, since the obvious
objection is the wrong one.** Contrast is symmetric, so white knocked out of a
`--severity-*` pill measures exactly what the colour measures as text on white:

| Fill                 | White on it | Same colour as text on white |
| -------------------- | ----------- | ---------------------------- |
| `--severity-severe`  | 4.83:1 ✅   | 4.83:1 ✅                    |
| `--severity-warning` | 5.02:1 ✅   | 5.02:1 ✅                    |
| `--severity-info`    | 5.17:1 ✅   | 5.17:1 ✅                    |

So a filled badge would have **passed**, and it was not rejected on contrast. It
was rejected because the icon inside it is meant to be the same mark Konva draws
on the marker, at a size where a 10.5px glyph reversed out of a saturated fill
is the least legible way to draw it, and because three filled pills in a 300px
column read as more urgent than the sentence they are counting. Recorded here so
the next person does not re-derive a failure that isn't there.

### Structure: two headings kept, three fieldsets re-cut

Phase 3 retired 144 per-item `<h3>`s and gave two reasons (ADR 0032 §3). The
warnings dock's two — "Warnings" and "Companion suggestions" — were re-examined
against both and **kept**: they are not inside a `role="button"` subtree that
ARIA makes presentational, and two headings are not 144. They are how a
screen-reader user moves between the dock's two lists, which is what document
structure is for.

The fieldsets were re-cut rather than deleted, each against one test — _is the
group's name recoverable from its own members' labels?_

| Group                       | Before                       | After                                 |
| --------------------------- | ---------------------------- | ------------------------------------- |
| Shape                       | `<fieldset>`, visible legend | kept, legend `visually-hidden`        |
| Soil                        | `<fieldset>`, visible legend | retired — every member says "Soil"    |
| Location                    | `<fieldset>`, two radios     | retired — collapsed to one `<select>` |
| Light level / pH / moisture | plain `<label>` + `<select>` | **new** `<fieldset>`, visible legend  |

Net: 3 nested fieldsets become 4 flat ones, and the nesting the review objected
to is gone. Shape's legend is the only hidden one, because the panel heading
above it already says "Plot shape & size" and the tiles draw the shapes; "Acid /
Neutral / Alkaline" genuinely does not say what it is of, so those legends stay
visible.

### A closed `<details>` is not a hidden field to jsdom

Soil moved behind a "Describe your soil (optional)" disclosure, and
`getByLabelText` finds a control inside a closed `<details>` perfectly happily.
Two component tests (`PlotConditionsForm.test.tsx`,
`PlotDefinitionPage.test.tsx`) would have gone on passing while driving a
control no browser user could reach. They open the disclosure now, and
`e2e/plot-settings.spec.ts` asserts in Chromium that the control really is
hidden until they do — the half jsdom structurally cannot answer.

### axe: 0 violations, now in eight states

Two more scans, following the precedent Phases 1–3 set of scanning what the
phase newly created: the dock with a warning in it (a `role="img"` whose label
is the only place the severity word survives, and count badges whose visible
content is entirely `aria-hidden`), and the conditions form with the soil
disclosure open (two more segmented fieldsets).

```
  ✓  1 the plot-definition page has no axe violations in its initial state
  ✓  2 the plot-definition page has no axe violations once a plant is placed and selected
  ✓  3 the canvas has no axe violations in edit-shape mode
  ✓  4 the clear-all confirmation has no axe violations while open
  ✓  5 the palette has no axe violations with a card’s reasoning expanded
  ✓  6 the warnings dock has no axe violations with a warning in it
  ✓  7 the growing-conditions form has no axe violations with the soil disclosure open
  ✓  8 the add-crop dialog has no axe violations while open
  8 passed
```

### The keyboard walkthrough: one more step, and the same friction

§7 and §8's friction figures are **unchanged**: 4 tabs to the palette search
field, 20 from there to the canvas, 4 from the canvas to the width field. The
new step 5b walks the dock's "Show me", which is a new interaction and so falls
under ADR 0026's rule that every one of them has a keyboard path.

```
=== Step 5: check warnings (read-only, but confirm reachable) ===
  OK   the "Problems & suggestions" panel is present and reachable (no interaction needed to read it)
  OK   the warnings dock and the "Use this shape" button are in the column together, unscrolled

=== Step 5b: "Show me" (UI redesign Phase 4) ===
  OK   the dock counts the new problem by severity, announced as "1 severe" rather than drawn only
  OK   reached "Show me" in 12 tabs from the settings column and selected the warned-about plant ("Selected: Potato")
```

(Steps 0–4 and 6 are unchanged from §8's run and all pass.)

### Still not done, still recorded

**Real screen-reader testing (NVDA/VoiceOver/JAWS) has still not happened.**
This phase adds two questions to that list. Whether a severity announced only as
`role="img"`/"severe" reads as well as the word did in flow is exactly the kind
of thing only a real session answers; and the count badge deliberately hides its
own visible content behind `aria-hidden` in favour of a composed label, which is
correct by the spec and worth hearing. It remains in `WORKPLAN.md` §5.2's
backlog.

## 10. Re-verified after the UI redesign's persistence phase (2026-08-04)

UI redesign Phase 5 (ADR
[0034](./adr/0034-designs-persistence-and-one-history-over-two-stores.md)) is the
first phase to **add chrome rather than reshape it**: the header carried one
control for the app's whole life and now carries three, and they are the app's
first tab stops. It also added a third modal dialog, retired a second one, and
changed what a page reload means.

### The tab-stop budget: the header, measured either side

**1 before, 1–3 after**, depending on what there is to undo — and the range is
the finding rather than a hedge. A `disabled` button is not in the tab order, so
the cost appears only when the reach does:

| state                            | header tab stops | what they are            |
| -------------------------------- | ---------------- | ------------------------ |
| before this phase                | 1                | title link               |
| a fresh load                     | 2                | title link, "Designs: …" |
| after one edit                   | 3                | + Undo                   |
| after an undo, with a redo ready | 4                | + Redo                   |

Counted by walking Tab in Chromium from the top of the document, not by counting
selectors, and asserted in `e2e/persistence.spec.ts` so it stays true. The two
skip links still follow immediately.

**Why the skip links were not moved above the header** to keep the bypass first.
They target `#plot-canvas` and `#plot-settings`, which exist only on the
workspace route, and `NotFound` renders through the same shell — links pointing
at absent targets on that page would be a worse fault than one to three stops.
The design chrome renders itself away off the workspace route instead, so
`NotFound`'s header is exactly what it always was.

**Why the switcher is one button and not four.** save/load/duplicate/delete in
the band would have been four stops before the skip links on every load, for
every keyboard user, forever. One button opening a dialog is one — and the dialog
has room for what each design is, which a chip in a 56px band does not.

### The friction figures moved by exactly the stop that was added

| leg                                | §7–§9 | now   |
| ---------------------------------- | ----- | ----- |
| top of page → palette search field | 4     | **5** |
| search field → plot canvas         | 20    | 20    |
| canvas → rectangle width field     | 4     | 4     |

The walkthrough gained **step 2c**, which walks undo and redo from the header
with no pointer — a new interaction, so ADR 0026's standing rule applies. The
buttons are the keyboard path; Ctrl+Z is an accelerator over them, because a
chord is invisible, undiscoverable and unavailable to anyone driving the app by
switch or voice. It also stands down entirely inside a text field, where Ctrl+Z
means the browser's own text undo and a user would be astonished to find it
removing a plant instead.

```
=== Step 2c: undo and redo the placement (UI redesign Phase 5) ===
  OK   reached Undo in 10 Shift+Tabs from the palette and undid the placement — announced as "Undo planting Onion", not a bare "Undo"
  OK   redid it from the adjacent button ("Redo planting Onion")
```

### A button that names what it will undo, and why that is the feature

`aria-label` is "Undo planting Onion", not "Undo" — composed from a diff of the
two designs (`state/design.ts`'s `describeEdit`). This is not decoration: it is
what replaced the "Clear all" confirmation dialog. That dialog existed because
clearing could not be undone; with undo it is a click that buys nothing, and the
thing a user who has just emptied their plot actually needs is to be told the way
back exists and what it will bring. A dialog asked a question; a named button
answers one.

The rule applied is **reversibility, not destructiveness** — deleting a saved
design still confirms, because the history is per-design and cannot reach it.

### The keyboard walkthrough caught something reasoning had not

Undo and redo restore the design; a **selection** is not part of a design and is
deliberately not recorded. But the canvas's arrow keys act on the selected
placement, so a redo that put a plant back without selecting it left a keyboard
user pressing arrows at nothing — visible in the walk as a "Selected:" readout
that never came back, and invisible to every unit test. A history step now
carries the selection it happened in, which is a different claim from recording
selections: `selectPlacement` still costs no undo step.

### Contrast: three new pairings, all reuse or near it

Computed the same way §2, §8 and §9 computed everything else.

| Pairing                                                     | Ratio         | Bar                    |
| ----------------------------------------------------------- | ------------- | ---------------------- |
| `--text-strong` on `--green-100` (the open design's row)    | 12.55:1 ✅    | 4.5:1                  |
| `--text-muted` on `--green-100` (that row's "5 plants · …") | **4.72:1** ✅ | 4.5:1                  |
| `--text` on `--surface-sunken` (the restore notice)         | 9.70:1 ✅     | 4.5:1                  |
| `--green-700` on `--surface-sunken` (its "Dismiss")         | **5.18:1** ✅ | 4.5:1                  |
| `--green-500` drag-ghost border on `--surface-card`         | 3.83:1 ✅     | 3:1 (1.4.11, non-text) |

The first is §9's figure unchanged, and that is the point: the switcher marks its
open design with the same `--green-100` the selected shape tile and the selected
segment use, so it is a reuse rather than a new sum. The two genuinely new text
pairings are the muted meta line on that tint and the notice's inline "Dismiss",
and both clear 4.5:1 with room.

`--severity-warning` appears in the restore notice only as a 3px left rule (4.07:1
on `--surface-sunken`, above the 3:1 non-text bar), never as a fill and never as
the only signal — the sentence beside it carries the substance. That keeps §2's
standing rule intact: every surface showing a severity is a white card, because
`--severity-severe` on the page cream is 4.35:1.

### Structure: what the new surfaces announce

- **The designs switcher** is `ui/ModalDialog.tsx` again — a real `<dialog>`, so
  the focus trap, Esc and focus-return are the browser's (ADR 0030). Its rows are
  a `<ul>`; each design's buttons carry the design's name in their accessible
  names ("Open My garden", "Duplicate My garden"), because "Open" three times over
  is a list a screen-reader user cannot navigate.
- **"— open" is a word, not a dot.** The open design's row is tinted, and a tint
  alone would be meaning carried by colour (WCAG 1.4.1) — the same reason the
  palette's category chips carry their names.
- **The switcher button's visible text is its whole accessible name.** WCAG 2.5.3
  wants the visible label contained in the name, and "Untitled design 2" is only
  distinguishable from "Untitled design" if the name is spoken in full — so the
  design name **truncates with an ellipsis** at narrow widths rather than being
  hidden, since `display: none` would take it out of the accessibility tree along
  with the pixels.
- **The example-bed button is the one place a short visible label sits inside a
  longer name**: "Example bed", named "Start with an example bed". That is a
  measurement, not a preference — spelled out, it wrapped the canvas toolbar to a
  second row and cost 35px of the canvas. 2.5.3 holds either way.
- **The drag ghost is `aria-hidden`.** dnd-kit announces drags through its own
  live region and the card the user picked up keeps its name and its focus; a
  second copy of "Drag Onion onto the plot" in the tree mid-drag would be one crop
  announced twice.

### axe: 0 violations, still in eight states

The clear-all confirmation's scan is gone with the dialog, and the designs
switcher took its place — scanned **twice over**, before and during its inline
delete confirmation, because that confirmation replaces the focused button in
place and the row's remaining controls change meaning around it. The
plant-placed scan now also covers the header in its live state, since placing a
crop is what turns Undo from a disabled button into a named one.

```
  ✓  1 the plot-definition page has no axe violations in its initial state
  ✓  2 the plot-definition page has no axe violations once a plant is placed and selected
  ✓  3 the canvas has no axe violations in edit-shape mode
  ✓  4 the designs switcher has no axe violations, including mid-confirmation
  ✓  5 the palette has no axe violations with a card’s reasoning expanded
  ✓  6 the warnings dock has no axe violations with a warning in it
  ✓  7 the growing-conditions form has no axe violations with the soil disclosure open
  ✓  8 the add-crop dialog has no axe violations while open
  8 passed
```

### Still not done, still recorded

**Real screen-reader testing (NVDA/VoiceOver/JAWS) has still not happened**, and
this phase adds two questions to that list. Whether "Undo planting Onion" reads
well as a button name, or whether the repetition across a row of designs
("Open My garden", "Duplicate My garden", "Delete My garden") is helpful or
tiring, are both things only a real session answers. It remains in `WORKPLAN.md`
§5.2's backlog.

## Related

- ADR [0026](./adr/0026-keyboard-placement-and-severity-glyphs.md) — the
  reasoning behind the keyboard-interaction model and the severity-glyph/
  contrast decisions.
- ADR [0030](./adr/0030-workspace-layout-not-a-document.md) — the workspace
  layout §6 re-verified this page against, including why the second skip link
  rather than a DOM order that fights the visible columns.
- ADR [0031](./adr/0031-canvas-as-hero-live-scale-and-one-plot-picture.md) —
  the canvas phase §7 re-verified this page against, including why the outline
  editor's keyboard path is the same pattern ADR 0026 chose for placements.
- ADR [0032](./adr/0032-palette-compact-cards-and-details-on-demand.md) — the
  palette phase §8 re-verified this page against, including the tab-stop budget
  that decided the shape of the disclosure and why the review's `opacity: 0.6`
  was declined.
- ADR [0033](./adr/0033-warnings-dock-shape-tiles-and-segmented-conditions.md) —
  the settings-column phase §9 re-verified this page against, including where the
  severity word went and why a filled badge was declined on legibility rather
  than on contrast.
- ADR [0034](./adr/0034-designs-persistence-and-one-history-over-two-stores.md) —
  the persistence phase §10 re-verified this page against, including why the
  switcher is one header button rather than four controls, and why the skip links
  were not moved above the header to compensate.
- [`docs/stage-6.2-brief.md`](./stage-6.2-brief.md) — the brief this stage
  worked from.
- [`WORKPLAN.md`](../WORKPLAN.md) §5.2 — the post-v1 backlog, where the two
  gaps this page records honestly (the pointer-only outline corners, and the
  absence of real screen-reader testing) each get an explicit disposition
  rather than being left as open questions.
