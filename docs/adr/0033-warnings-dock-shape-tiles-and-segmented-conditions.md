# 0033 — The settings column: a pinned warnings dock, shape tiles, and segmented conditions

- **Status:** Accepted
- **Date:** 2026-08-04
- **Phase:** UI redesign Phase 4 — plot & conditions panel
  ([`docs/ui-aesthetic-review.md`](../ui-aesthetic-review.md))

## Context

The review's §2.6 finding is that the warnings list — "the highest-value live
feedback the engine produces" — sits "in the least visible location". Phase 1
moved it from the bottom of a stacked document to a disclosure panel in the
workspace's right-hand column, beside the canvas and directly under the form
that changes it. That got it closer. It did not get it into view.

Measured at 1440×900 before this phase, at the default state:

|                             |                                        |
| --------------------------- | -------------------------------------- |
| settings column             | 300 × 844 px                           |
| its content                 | **1,434px** — 590px of overflow        |
| "Plot shape & size"         | 440px                                  |
| "Growing conditions"        | 635px                                  |
| "Problems & suggestions"    | 312px                                  |
| tab stops in the column     | 13                                     |
| `<select>`s / `<fieldset>`s | 5 / 3 (legends: Shape, Soil, Location) |

And with the antagonist pair the E2E suite uses (potato and tomato, 60cm
apart — the shipped dataset's one `well-supported` antagonist link), content
grew to **1,738px**, overflow to **894px**, and the "Problems & suggestions"
panel's top edge sat **263px below the bottom of the column**. So at the exact
moment the panel had something to say, it was off screen — while the form that
changes what it says was on screen. That is the review's §2.6 finding surviving
Phase 1's move intact.

### The acceptance criterion had to be restated before it could be tested

The review asks for "the full tweak loop … with zero vertical page scroll at
1440×900". Since Phase 1 the **page** has never scrolled at all —
`e2e/workspace-layout.spec.ts` asserts exactly that, at exactly that viewport —
so as written the criterion was already true and measured nothing.

What this phase measures instead is the column's **own** internal overflow, and
specifically whether a warning is visible at the same time as the control that
causes it. Those are the numbers above, and `e2e/plot-settings.spec.ts` takes
them again on every run.

Six questions needed answering. As in Phases 2 and 3, none of them is "what
should it look like" — the review drew that.

1. What does the column's vertical budget buy, and do "shape" and "conditions"
   stay open by default once the warnings dock has to be permanently visible?
2. The shape tiles and the segmented controls are the palette's chip mechanic
   again. Reuse it how?
3. Where does a shape tile's drawing come from, given the engine deliberately
   forgets that a region was ever a preset?
4. "Flatten the fieldset nesting" — which fieldsets actually go?
5. The severity word becomes an icon. What happens to the word?
6. "Show me" should pan to a placement, and panning is a DOM scroll on an
   element the canvas store does not own. Where does that live?

## Decision

### 1. The column stops scrolling as a whole; the dock is pinned and the forms shrink to fit above it

Two halves, and both are load-bearing.

**The structure.** `.checks` is no longer one scroll box of three panels. The
two **form** panels live in a `.settings` box that scrolls, and the warnings
dock is a fixed sibling below it, capped at 45% of the column and scrolling its
own contents past that. This is the construction `PlantPalette` already uses
(filters fixed, list scrolling) and `PlotCanvasSection` already uses (toolbar,
viewport, dock), applied a third time — and it is what makes the acceptance
criterion true **structurally** rather than by fitting: whatever you scroll to
in the form, the warning it causes is on screen with it.

**The budget.** Pinning alone does not buy the room; it only changes who runs
out of it. What bought it was the two form panels getting smaller — §3 and §4
below took them from 440px and 635px to **292px** and **302px** — so that with
the dock at its empty height they total 786px of an 812px content box.

That is what let all three panels **stay open by default**, which is the part
ADR 0030 argued for explicitly ("a first-run user should see that the controls
exist before learning they collapse") and which this phase had to re-answer
rather than assume. Had the forms not shrunk enough, the honest alternative was
closing "Growing conditions" by default and saying so; it isn't needed, so it
isn't done.

**The cap scrolls the `<details>`, not the list inside it.** A flex chain from
the column down to the warnings list has to pass _through_ the disclosure's
content box, which Chrome exposes as a `::details-content` pseudo-element and
other engines do not — the body ends up a grandchild of the flex container and
silently refuses to shrink. Measured, that was **37px** of column overflow with
two crops placed: the cap held, the content ignored it. Scrolling the panel
itself needs no flex at all and behaves identically in every engine, at the cost
of the panel's own heading scrolling away, which `position: sticky` answers.

### 2. The chip mechanic moves to `ui/`, as CSS, not as a component

Phase 3 built exactly the control this phase needs twice more: a native radio,
visually hidden but still focusable, stretched over the thing the user sees,
styled from `:checked` / `:focus-visible` (ADR 0032 §6). Its reasons hold here
unchanged — a radio group is **one** tab stop with arrow keys inside it, and the
selected state is in the accessibility tree without an `aria-*` attribute.

`ui/choice.module.css` now holds the invisible half (`.control`, `.target`,
`.group`) and `palette/PlantPalette.module.css` composes it back rather than
keeping the original. What a chip, a tile and a segment _look_ like stays in
their own modules, because that is the only part that differs.

It is CSS and not a React component because the sibling-state selectors
(`.control:checked + .body`) have to name the consumer's own visible class: a
shared component would have to take a bag of class names and would buy nothing.
The one thing that had to change in the move is that `.control` is written
`.control.control` — `global.css` sizes radios with `input[type='radio']`, which
out-specifies a single class, and Phase 3 beat that with a `.chip .chipInput`
descendant pair that a `composes:` consumer cannot reproduce.

`ui/SegmentedControl.tsx` **is** a component, because three fields want the same
markup as well as the same mechanic, and because it has a decision inside it: a
radio group carries its name in a `<legend>`, so the legend is the field's
label and is visible.

### 3. A shape tile is drawn by the factory the button applies

`plot/shape-glyph.ts` builds each tile's outline by calling
`rectangleRegion` / `lShapeRegion` / `circleRegion` with the picker's current
dimensions, and draws the polygon that comes back. So a tile is not an
illustration of a rectangle — it is the outline you will get, at the aspect
you will get it, with the L's notch moving as you retype its size. The same
function produces the region "Use this shape" applies, so what the tile shows
and what the button does cannot drift apart.

**It reads the picker's own metre state, never `plot-store`'s region.**
`spacing/region.ts` is explicit that "nothing remembers it was a preset": once
an outline has been dragged on the canvas there is no width and height to read
back off the polygon. A tile fed from the committed region would start redrawing
itself when a corner moved, showing a shape the picker cannot rebuild.

Two smaller calls. `buildRegion` returns a **result** rather than throwing,
because it runs on every keystroke to redraw the tiles and half of typing "0.5"
is an invalid dimension; the result carries the factory's own message, so the
picker can show the engine's words ("notch width (1000) must be less than the
width (400)") without re-implementing the rule behind them. And the error moved
**under the fields**, referenced by each of them with `aria-describedby`, so it
is part of the field's announcement rather than a paragraph elsewhere.

**The unit is inside the field and still in the accessible name.** The label's
visible text is "Width"; a `visually-hidden` span makes its accessible name
"Width (m)". WCAG 2.5.3 wants the visible label contained in the accessible
name, which holds; every existing spec and the keyboard walkthrough select on
"Width (m)", which still matches; and a screen reader hears the unit while the
eye reads it in the box. The alternative, `aria-describedby` pointing at the
suffix, announces a bare "m" after the value.

### 4. Three nested fieldsets become four flat ones, and that is the flattening

The review says "flatten the fieldset nesting to labelled groups on one card".
That is not a licence to delete grouping a screen reader announces, so each
fieldset was decided on its own, against one test: **a `<fieldset>` earns its
place when the group's name is not recoverable from its members' own labels.**

- **Soil** — retired. Its members are "Soil texture", "Soil pH", "Soil
  moisture"; each says it. The disclosure's summary carries the visual grouping
  now. (Same test Phase 1 applied when it deleted the outermost fieldset.)
- **Location** — retired, because it collapsed to a single control. The two
  radios plus a conditional region `<select>` expressed a choice with exactly
  one interesting branch; the UK default is simply the first option now, so
  "no region picked" is a value the field can hold rather than a mode it can be
  in. The sentinel is a named `uk-default`, not `''`, so the mapping back to
  `location: undefined` is explicit at both ends and cannot collide with a real
  region id.
- **Shape** — kept, legend **visually hidden**. "Rectangle / L-shape / Circle"
  genuinely does not say what it is a choice of, so the group needs a name; the
  panel above says "Plot shape & size" and the tiles draw the shapes, so it does
  not need a second visible one. Same trade the palette's category chips make.
- **Light level, Soil pH, Soil moisture** — three new flat fieldsets, legends
  **visible**, because they are the fields' labels and "Acid / Neutral /
  Alkaline" does not say what it is of.

Net: 3 nested → 4 flat, nesting zero. Soil **texture** keeps its `<select>`:
five options do not fit a 300px row, and the review's own rule is ≤4.

### 5. The severity word becomes an icon, and the word moves into the name

`warnings/SeverityIcon.tsx` draws `severity.ts`'s existing `severityGlyph`
(`i` / `!` / `×`) — **not** a new icon set. That glyph exists because Stage 6.2
needed the canvas marker's badge to carry severity in shape and not only colour
(WCAG 1.4.1), and reusing it means a marker badged `×` and the dock card that
explains it are marked the same way. The connection between the badges and the
list is the reason both exist; a prettier second icon set would have broken it
for decoration.

The word is not gone: the icon is `role="img"` with an `aria-label` of the
severity, so a screen reader announces "severe" exactly where it used to read
"SEVERE", and a `title` puts the same word under a pointer. It replaced the
uppercase word in **both** places at once — the dock and
`PlotCanvasSection`'s selected-placement readout — so one severity never reads
two ways on one screen.

**Everything severity-coloured stays text or a border on a white card**, which
is the background `docs/accessibility.md` §2 measured those tokens against — so
no severity pairing in the dock is a new sum. The pairing that _would_ have been
one is the one this avoids: `--severity-severe` on the page cream is 4.35:1,
which is why §2's standing rule is that any surface showing a severity is a
card, and why the settings column being `--surface-card` is load-bearing rather
than incidental.

A filled count badge — a `--severity-*` pill with the count in white — was
declined, but **not** on contrast, and §9 records the sums so nobody re-derives
a failure that isn't there: contrast is symmetric, so white on
`--severity-severe` is the same 4.83:1 the colour scores as text on white, and
all three fills pass. It was declined because the icon is meant to be the same
mark Konva draws on a marker, and a 10.5px glyph reversed out of a saturated
fill is the least legible way to draw one — and because three filled pills in a
300px column read louder than the sentence they are counting.

**The two `<h3>`s stay, on purpose.** Phase 3 retired 144 per-item headings and
recorded two reasons (ADR 0032 §3); neither applies here. These are not inside a
`role="button"` subtree that ARIA makes presentational, and two headings are not
144 — they are how a screen-reader user jumps between the dock's two lists, which
is what document structure is for. They earn their space visually too, by
carrying their sections' counts on their own line.

### 6. "Show me" pans by asking, not by holding a DOM node

ADR 0031 §7 made panning the canvas viewport element's **native scroll**,
deliberately, "so that there is one notion of where the plot is rather than two
that can disagree". So scrolling a marker into view is a DOM operation on an
element `canvas-view-store` neither owns nor should learn about — a store
holding a `ref` would be the second notion of where the plot is, in the file
whose whole job is to be the first.

The store therefore carries the **intent**: `revealRequest`, a placement id and
a nonce. `canvas/useRevealPlacement.ts`, called by the component that holds the
viewport ref, performs it. The nonce is what makes the same warning's "Show me"
work twice — without it the second press sets state to the value it already had
and nothing re-runs.

`WarningsSection` calls two actions on two stores, because they are two
different facts: what is selected (`placements-store`) and where the plot is
being looked at (`canvas-view-store`).

**It pans; it does not zoom**, and that is a decision rather than an omission.
Every warning today is a _relationship between two placements_ ("these two are
only 10cm apart"), so zooming in on one of them is the likeliest way to push the
other off screen — the opposite of what the button is for. At the default fitted
scale there is nothing to pan to anyway; panning only does something once the
user has zoomed in, which is exactly when they have said they want a closer
look. And it does nothing at all when the marker is already comfortably visible:
re-centring something the user is looking at is a jump with no information in
it, and by the second press it reads as the button being broken.

## Alternatives considered

- **Closing "Growing conditions" by default** to make room for the dock. The
  obvious answer, and it would have contradicted ADR 0030's explicit argument
  for all three panels starting open. Rejected because §3 and §4 made it
  unnecessary — but it was the fallback, and it is what should happen if the
  form ever grows back.
- **Leaving the column one scroll box and simply moving the warnings panel to
  the top.** It would have made warnings visible and pushed the shape and
  conditions forms off instead: the same bug, aimed at a different control. The
  criterion is that both are visible together.
- **A flex chain from the column through the `<details>` to the warnings
  list**, so the badges and both headings stayed pinned while only the cards
  scrolled. Built, measured, and rejected in §1: `::details-content` breaks the
  chain in Chrome and the panel overflowed its own cap by 37px. `position:
sticky` on the panel's summary recovers most of the benefit for none of the
  fragility.
- **A filled severity badge** — a coloured pill with the count in white.
  Declined in §5, and worth listing because the reason is _not_ the one it looks
  like: it clears 4.5:1 (contrast is symmetric, so white on `--severity-severe`
  is the same 4.83:1 the red scores as text on white). The reasons are that the
  mark should match the canvas badge and a 10.5px glyph reversed out of a
  saturated fill doesn't, and that three filled pills shout over the sentences
  they count.
- **Keeping "SEVERE" as text beside the icon.** Honest, and it spends seven to
  eight characters of a 300px card restating what the sentence next to it says.
  The word is in the icon's accessible name, which is where a reader who needs
  it gets it.
- **A shared `<ChoiceControl>` React component** instead of shared CSS.
  Rejected in §2: the state selectors have to name the consumer's own visible
  class, so the component would be a pass-through for class names.
- **Drawing the shape tiles by hand** (three static SVG paths, scaled to the
  current aspect). Simpler, and it would let a tile show a shape the button
  refuses to build. Drawing them from the factories is the same guarantee
  `canvas/footprint.ts` gets by reusing `placement-derivation.ts`'s square.
- **Zooming as well as panning on "Show me"**, which is what the review's
  "pans/zooms to" asks for. Declined with a reason in §6, not skipped.
- **Keeping the soil block visible and closing something else.** Soil is three
  facets of a block most users leave entirely as "not sure" — the engine ranks
  fine without it and says so in its own confidence figure — so it is the part
  of the form with the best ratio of height to use.
- **Deleting the "Recomputed live as you place…" caption without replacing
  it.** Which is what happened, and it is listed here because Phase 3 made the
  opposite call about the palette's intro paragraph and was right to. The
  difference: that sentence said something about the _data_ that nothing on
  screen shows, and this one describes behaviour the dock now demonstrates in
  front of you. Three lines explaining that warnings update live cost ~60px of
  the height that makes it observable.

## Consequences

- **The number this phase exists to change: 590px of internal overflow → 0**,
  and 894px → 0 with the antagonist pair placed. The column's content is 844px
  in an 844px box, in both states.
- **A warning and the control that causes it are on screen together**, which is
  the acceptance criterion restated so it means something. Before: the
  "Problems & suggestions" panel's top edge was 263px _below_ the column's
  bottom while "Use this shape" was visible. After: the dock's top edge is 381px
  _above_ it, and `e2e/plot-settings.spec.ts` asserts both boxes are inside the
  column's at once.
- **Nothing in the column scrolls at rest.** The two form panels are 292px and
  302px (from 440px and 635px) and the empty dock is 176px (from 312px), so all
  three fit unscrolled. Loaded, the dock caps at 365px and scrolls itself.
- **Tab stops in the column: 13 → 11**, or 14 with the soil disclosure open.
  Down, not up: a segmented control is one radio group where a `<select>` was
  one control, three soil facets sit behind one summary, and the shape tiles are
  the same single radio group the three radios already were. Measured in the
  browser by walking Tab, not by counting selectors.
- **Step 4 of the keyboard walkthrough is unchanged**, which was worth checking
  rather than assuming — it tabs width → height → "Use this shape" and all three
  adjacencies survive the tiles and the unit-suffixed inputs.
- **`<select>`s 5 → 3; `<fieldset>`s 3 nested → 4 flat.** The legends went
  "Shape / Soil / Location" to "Shape (hidden) / Light level / Soil pH / Soil
  moisture".
- **A closed `<details>` is not a hidden field to jsdom**, and this phase put a
  control behind one. `getByLabelText` finds the soil select whether the
  disclosure is open or shut, so two component tests now open it first and
  `e2e/plot-settings.spec.ts` asserts in a real browser that it is genuinely
  hidden until they do — the half jsdom structurally cannot check.
- **`e2e/warnings-overlay.spec.ts`'s two assertions changed and got stronger.**
  `getByText('SEVERE')` became a check on the **dock's** severity count badge:
  the old page-wide `.first()` would have been satisfied by the canvas's own
  selected-placement readout, so that spec could have gone on passing while the
  dock showed nothing. The empty state moved from "No problems detected…" to the
  review's "No problems — looking good 🌿", and the clear-down step now also
  asserts the badge is gone.
- **axe covers eight states**, two more than Phase 3: the dock with a warning in
  it, and the conditions form with the soil disclosure open.
- **The narrow breakpoint degrades, as `workspace-layout.spec.ts` requires.**
  Below 900px a dock means nothing — there is no pinned column — so the cap, the
  scroll and the sticky heading are all switched off and the panel is an
  ordinary stacked card again, which is what it was.
- **`PlotCanvasSection`'s severity styling is gone from its module**, replaced
  by the shared icon. One fewer place for the `--severity-*` tokens to be spent
  slightly differently.
