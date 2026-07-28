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
  (`PlotOutlineEditor.tsx`'s draggable corners). The walkthrough's "describe
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

## Related

- ADR [0026](./adr/0026-keyboard-placement-and-severity-glyphs.md) — the
  reasoning behind the keyboard-interaction model and the severity-glyph/
  contrast decisions.
- ADR [0030](./adr/0030-workspace-layout-not-a-document.md) — the workspace
  layout §6 re-verified this page against, including why the second skip link
  rather than a DOM order that fights the visible columns.
- [`docs/stage-6.2-brief.md`](./stage-6.2-brief.md) — the brief this stage
  worked from.
- [`WORKPLAN.md`](../WORKPLAN.md) §5.2 — the post-v1 backlog, where the two
  gaps this page records honestly (the pointer-only outline corners, and the
  absence of real screen-reader testing) each get an explicit disposition
  rather than being left as open questions.
