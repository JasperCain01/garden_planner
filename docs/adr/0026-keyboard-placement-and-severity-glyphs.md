# 0026 — Keyboard placement without pixel-drag, and severity glyphs alongside colour

- **Status:** Accepted
- **Date:** 2026-07-27
- **Workplan stage:** 6.2 — accessibility & responsive polish

## Context

`WORKPLAN.md` §0.5 chose `dnd-kit` specifically because it "supplies the
keyboard-accessible drag alternative Stage 6.2 needs" — but that turned out to
be only half true, and figuring out which half is the non-obvious call this
ADR records.

### What `dnd-kit`'s `KeyboardSensor` gives for free

`DndContext`'s default `sensors` already include `KeyboardSensor` alongside
`PointerSensor` (`@dnd-kit/core`'s own `defaultSensors`), and
`useDraggable`'s `attributes` already put `role="button"`/`tabIndex={0}` on
whatever node they're spread onto. So a focused palette entry (once its
draggable node is a real, focusable element — see below) can already be
picked up with Space/Enter and nudged with arrow keys, with **no extra
wiring at all**. `canvas/drop.ts#resolveDrop`'s own doc comment even predicts
this: it reads the dragged element's _translated rect_ regardless of how the
drag started, "keeping this function ignorant of _how_ the drag started".

That is real, and worth confirming rather than assuming — this is exactly
the "check what `KeyboardSensor` gives for free before building custom
interaction" instruction the Stage 6.2 brief opens with.

### Why it's not enough as the _primary_ keyboard path

`KeyboardSensor`'s default coordinate getter moves the dragged element in
raw screen pixels (25px per arrow press, `@dnd-kit/core`'s
`defaultKeyboardCoordinateGetter`). Two things make that impractical here:

1. **Distance.** The plot canvas can be a long way down the page — this is
   the same page-length problem this stage's responsive fix addresses
   (`docs/review-pre-deployment.md` §2's canvas-at-y≈3500px finding). Even
   after that fix shortens the page, a large plot's canvas can still be far
   from a palette entry a user has scrolled to.
2. **No target position.** A pointer drag has a natural drop point:
   wherever the pointer is. A keyboard activation doesn't — "keyboard-
   initiated drop position" isn't a well-defined thing to compute from
   Space/Enter alone, which is exactly what the brief flagged as needing
   real thought rather than assuming `KeyboardSensor` is a drop-in fix.

## Decision

### 1. A visible "Add to plot" button is the primary keyboard path

Every palette entry (`palette/PlantPalette.tsx`'s `PaletteEntry`) gets a
plain `<button>` — "Add to plot" — that calls the same `addPlacement` action
a resolved drag calls, at a deterministic position:
`canvas/geometry.ts#regionCentre` (the plot's bounding-box centre, always
inside the region). `addPlacement` already selects what it just placed
(`state/placements-store.ts`), so the new plant lands ready for the canvas's
new arrow-key nudge (below) to fine-position — no drag, no pixel math, no
guessing what "the keyboard drop point" means. It's a two-step model instead
of one: **place somewhere sane, then move it precisely** — deliberately
simpler than trying to make Space/Enter-and-arrows reconstruct what a mouse
drop point means.

**Why a real `<button>`, not reusing the draggable element's own
Space/Enter.** A visible, labelled control is discoverable without prior
knowledge of a hidden key binding; a screen-reader user's rotor/browse-mode
list of buttons shows it by name. Overloading Enter on the existing
draggable element (distinct from Space, which still starts a pixel-drag)
would work but adds an undocumented, inconsistent shortcut for no real
saving — the button costs one extra tab stop per row, not a new concept to
learn.

### 2. The button is a sibling of the draggable region, not nested inside it

`useDraggable`'s `attributes` put `role="button"` on the node `setNodeRef`
attaches to. The obvious-looking implementation — spread `{...listeners}
{...attributes}` on the whole `<li>` and put the new button inside it —
nests a real interactive control inside another element wearing an
interactive role, which is exactly what axe's `nested-interactive` rule
exists to catch (a screen reader has no sane way to navigate _into_ a
control that lives inside another control). `PaletteEntry` instead splits
the `<li>` into a draggable inner `<div>` (still carrying the drag
`aria-label`, still keyboard-focusable, still where `useDraggable`'s
listeners live) and the button as the `<li>`'s other, sibling child. This
was found by actually running the axe check this stage adds
(`e2e/a11y.spec.ts`), not by reasoning about the DOM shape in the abstract —
see that file's own note on what axe can and can't catch.

### 3. On-canvas move and select: arrow-key nudge plus explicit selection buttons

`canvas/PlotCanvas.tsx` already handled Delete/Backspace for the selected
placement (Stage 3.4/3.5). This stage adds arrow-key nudging (10cm per
press, 50cm with Shift, clamped to the region's bounding box via the
existing `clampToBounds`) to the same `handleKeyDown`, and
`canvas/PlotCanvasSection.tsx` adds "Previous placement"/"Next placement"
buttons that cycle `selectedId` through the placements array (wrapping
around, starting from the first/last when nothing is selected yet).

The buttons exist because **Konva shapes aren't DOM elements** — a placed
plant marker can't be given its own `tabIndex`/focus the way a real `<li>`
or `<button>` can (`docs/adr/0017-plot-canvas-konva-and-dnd-kit.md` already
established this boundary for a different reason: no queryable DOM inside
the `<canvas>`). Clicking a marker is one way to select it; without these
buttons it would be the _only_ way, which is exactly the kind of pointer-only
dependency this stage exists to remove.

### 4. Severity badges get a glyph, not just a colour

`warnings/severity.ts` gains `severityGlyph` (`i`/`!`/`×` for
info/warning/severe) alongside the existing `severityColor`.
`canvas/PlotCanvas.tsx`'s `PlacementMarker` badge drew the same `"!"` for
every severity before this stage — colour was the _only_ signal, which is
the exact gap the brief named ("severity badges on the canvas, which are
colour-only circles today"). `WarningsPanel.tsx`'s own severity label
already renders the word itself (`severity.toUpperCase()`), so it needed no
change; this was purely a canvas-badge gap.

### 5. Contrast: darken, don't rehue

Two colour maps had entries below WCAG AA's 4.5:1 normal-text bar (measured,
not eyeballed — see `severity.ts`'s and `PlantPalette.tsx`'s own doc
comments for the exact ratios): `PlantPalette.tsx`'s `BAND_COLORS.good`
(`#4c8c2b`, 4.12:1) and `.fair` (`#9a7b0a`, 4.03:1), and
`severity.ts`'s `SEVERITY_COLORS.warning` (`#d97706`, 3.19:1). Each was
darkened one step within the same hue rather than replaced with an
unrelated colour, so the existing "greener is better"/"amber means caution"
associations stay intact for a low-vision user who _can_ perceive some
colour, while a colour-blind or screen-reader user still gets the same
information from adjacent text (`BAND_LABELS`) or the new glyph (above).

### 6. A skip link, found by actually walking the keyboard journey

The keyboard-only walkthrough this stage records
(`docs/accessibility.md`) surfaced a real, measured friction that no amount
of reasoning about individual components would have: after placing a crop
via "Add to plot", reaching the canvas to nudge it into place means tabbing
through every remaining filtered palette row _and_ the whole "Add your own
crop" form — 35 tab presses in the walkthrough's own run. `plot/
SkipToCanvasLink.tsx` adds the standard WCAG 2.4.1 "bypass blocks" pattern:
an `<a href="#plot-canvas">`, visually hidden until it receives focus, as
the second tab stop on the page (right after the title link). It doesn't
eliminate the friction for the "just placed something, now reach the
canvas" case (the user is already past the link's position in the DOM by
then) — that residual gap is recorded honestly in `docs/accessibility.md`
rather than claimed as fixed.

## Alternatives considered

- **Wire `KeyboardSensor` and stop there**, treating "check what dnd-kit
  gives for free" as the whole answer. Rejected: functionally present, but a
  raw 25px-per-press pixel drag across a page-length distance with no
  defined target position is not a _usable_ primary path, even though it
  technically satisfies "keyboard operable" in the narrowest reading.
- **A custom keyboard drag mode** (press a key to enter "placement mode",
  arrow keys move a cursor overlay on the canvas, Enter confirms). More
  visually continuous with pointer dragging, but a materially bigger,
  riskier interaction to design and test well in one stage, for a gain
  ("see the plant follow your cursor before it lands") the two-step
  place-then-nudge model gets close enough to at much lower cost. Worth
  reconsidering if user feedback says the two-step model is confusing.
- **Overload Enter on the existing draggable element** instead of a visible
  button. Discussed above — rejected for discoverability.
- **Fake `tabIndex`/keyboard handlers on the outline editor's corner
  handles**, to make the `aria-prohibited-attr` fix (giving them
  `role="button"` — needed regardless, since a `<circle>` with no role can't
  carry `aria-label` at all) _look_ keyboard-operable. Rejected as actively
  dishonest: a focusable control with no keyboard handler behind it fails a
  keyboard user worse than a non-focusable one, because it promises
  something that doesn't work. `PlotOutlineEditor.tsx`'s corners keep
  `role="button"` (valid ARIA, and correct — they are buttons functionally)
  but no `tabIndex`, and the still-pointer-only state is recorded as a known
  gap, not built around with a decoy fix.
- **Rehue the failing colours entirely** (e.g. switch `warning` to a
  different colour family) rather than darken within the same hue.
  Rejected: it would fix contrast while discarding the amber/red
  warning/severe convention users already read correctly; darkening one step
  keeps both.

## Consequences

- **Two new interactive elements per palette row** (the "Add to plot"
  button, on top of the existing draggable card) measurably slows jsdom
  component-test renders of the full ~130+-row unfiltered palette — `App
.test.tsx` and `PlotDefinitionPage.test.tsx` needed longer explicit
  timeouts (documented in each test's own comment). This is a jsdom/RTL
  cost, not a claimed real-browser regression; it wasn't re-measured against
  a production build's actual paint time, which would be worth doing if a
  future session has reason to doubt it.
- **The region is read via `usePlotStore.getState()` at click-time**, not
  subscribed to as a prop, specifically so up to 144 palette rows don't
  re-render on every outline edit for a value only the click handler needs —
  a real, measured saving, though not one that eliminated the cost above by
  itself (see `PlantPalette.tsx`'s own comment on what it did and didn't
  fix).
- **`e2e/plot-canvas.spec.ts`'s `getByRole('button', { name: /remove/i })`
  needed to become an exact match.** Giving the outline editor's corner
  handles `role="button"` made their own labels ("...double-click to
  remove") match that loose regex too, once they were real ARIA buttons —
  a direct, traceable consequence of item 4's `aria-prohibited-attr` fix,
  not an unrelated flake.
- **The free-form outline-corner drag stays pointer-only.** Not silently
  dropped — recorded as a known gap in `docs/accessibility.md` and in this
  ADR's "Alternatives considered" above, for whichever future stage picks it
  up (Stage 6.3, the next one, is scoped as a validation pass, not further
  a11y work — see its brief for the reasoning).
