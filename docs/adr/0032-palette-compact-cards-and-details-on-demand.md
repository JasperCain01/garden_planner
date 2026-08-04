# 0032 — The palette: compact cards, reasoning on demand, and one element with two gestures

- **Status:** Accepted
- **Date:** 2026-08-04
- **Phase:** UI redesign Phase 3 — palette redesign
  ([`docs/ui-aesthetic-review.md`](../ui-aesthetic-review.md))

## Context

The review's fourth finding is that "the palette is a debug log, not a plant
picker": every one of 144 crops rendered the engine's whole answer at once —
icon, name, band, category, summary sentence, confidence, and a four-bullet
per-dimension reasoning list. It estimated ~200px per row and ~28,000px of
list.

Measured in the Phase 1 sidebar at 1440×900, it was three times worse than
that, because a 320px sidebar wraps every paragraph to roughly double the lines
a 640px page column did:

|                                     | before                                           |
| ----------------------------------- | ------------------------------------------------ |
| crops rendered                      | 144, all fully expanded                          |
| crop-list box                       | 287 × 394 px                                     |
| row height                          | 589–820px, median **631px**                      |
| total list content                  | ~93,900px                                        |
| **crops visible without scrolling** | **0** — the shortest row was taller than the box |

Five questions needed answering. As in Phase 2, none of them is "what should it
look like" — the review drew that.

1. Where does the sidebar's vertical budget come from? A ~64px card in a 394px
   box is six crops, not the eight the acceptance criterion asks for.
2. The card is dnd-kit's drag surface. How can pressing it _also_ mean
   something, when a click and the start of a drag are the same event?
3. Do 144 crop names stay `<h3>`s?
4. Compact rows, or the 2-column grid of square tiles the review offers as an
   alternative?
5. What does "visible but muted" mean for an unsuitable crop, given the review
   asks for `opacity: 0.6` and this app measures its contrast?

## Decision

### 1. The sidebar's chrome shrinks with the rows, because the rows alone aren't enough

This is not in the review's bullet list, and it is the first thing the phase
had to do: the review assumed a taller list than the workspace actually gives.
Of the sidebar's 836px at 1440×900, the crop list had **394px** — the rest went
on the "Plants" heading, a three-line intro paragraph, a two-row filters grid,
a count line, and the "Add your own crop" trigger. Eight 62px cards need ~530px,
so ~300px was the whole budget for everything else.

What changed, and what it bought:

- The **count** moved onto the heading's line (~25px). It is four words about
  the list; it does not need a row.
- The **filters** became one search field and two wrapping rows of chips
  (~40px), replacing a two-row grid of labelled fields.
- The **intro paragraph** became a closed `<details>` above the list (~35px).
  It is not deleted, and that is deliberate: "most of today's dataset has no
  hardiness, soil or season data, so read the confidence and per-plant
  reasoning, not just the band" is the honest framing `rankPlants`' own doc
  insists on, and a phase that moves the reasoning behind a press is the last
  phase that should quietly drop the sentence explaining why you should read
  it. As a disclosure it costs one line and one tab stop, and it sits directly
  above the ranking it describes.

Net: **249px of chrome instead of 442px**, and a list box of 595px instead of
394px. The result is measured in `e2e/palette.spec.ts` rather than asserted.

### 2. One element, two gestures, told apart by distance and by key

The card is dnd-kit's `useDraggable` node — `role="button"`, `tabIndex={0}`,
an `aria-label` — and the review wants clicking it to open the reasoning. A
click and the beginning of a drag are the same `pointerdown`, and dnd-kit had
**no activation constraint**, so a press that drifted a single pixel became a
drag and swallowed the click. ADR 0030 was told to keep the dnd-kit wiring
exactly as it stood and did; changing it is this phase's call.

Three pieces, all in `plot/PlotDefinitionPage.tsx` (which owns the
`DndContext`) except the last:

- **`PointerSensor` with `activationConstraint: { distance: 4 }`.** A press
  that never travels 4px is a click. 4px is the slop `PlotCanvas` already uses
  to tell a pan from a deselect (ADR 0031 §7) — the same question, so the same
  answer and the same feel. The other half of this is dnd-kit's own: once a
  drag _does_ activate it adds a capture-phase `click` listener on the document
  that stops propagation, so the trailing click never reaches React. We did not
  have to write "was this a drag?" logic; we had to stop suppressing the case
  where it wasn't.
- **`KeyboardSensor` with `start: [Space]`**, where dnd-kit's default is Space
  _or_ Enter. A `role="button"` `<div>` does not synthesise a click from Enter
  the way a real `<button>` does, so without this the disclosure would have
  been pointer-only — precisely what ADR 0026 says this app doesn't ship. Space
  is the key the sensor's own screen-reader instructions name ("press the space
  bar"), so nothing announced changes.
- **The row's `onKeyDown` calls dnd-kit's listener first**, then considers
  Enter. Spreading `{...listeners}` and adding an `onKeyDown` after it silently
  replaces the sensor's handler and deletes the keyboard drag — a one-line
  mistake with no visible symptom in any existing test.

**The accessible name changed, deliberately, and every caller moved with it.**
A control announced as "collapsed" whose name only mentions dragging has a name
that is wrong, so it is now `drag <crop> onto the plot to place it, or press to
see why it ranks here`. The old string is kept verbatim as the prefix, so
`e2e/drag.ts`'s **anchored** regexes gained a suffix rather than being
rewritten — and the label itself moved into `palette/labels.ts`, which the
component and the E2E helper both import. That duplication (the string in the
component, its regex source in the spec) rots in exactly one direction: an
anchored locator that matches nothing fails several assertions later with a
message about something else. The anchoring stays; only the restatement is
gone.

`aria-expanded` goes on the same element. There is deliberately no
`aria-controls`: the reasoning is not in the DOM while collapsed, and pointing
at an id that doesn't exist is an `aria-valid-attr-value` violation — the
disclosure sits immediately after its trigger's row instead, which is the
pattern that needs no reference.

**At most one card is open at a time.** The expanded content is the ~470px wall
of text this phase moved out of the default view; several of them open at once
rebuilds it.

### 3. The crop name stops being an `<h3>`, and that is a fix

144 crop headings put the palette ahead of the six headings that actually
structure the app, which makes heading navigation useless in the one document
where it would help most. And they were not reliably headings anyway: ARIA
makes a `role="button"` element's subtree **presentational**, and the `<h3>`
was inside the drag surface. So the outline claimed structure that conforming
assistive tech was entitled to flatten.

What replaces it is what was already there: a `<ul>` of `<li>`, which a screen
reader announces as "list, 144 items" and navigates by. `PlantPalette.test.tsx`
read ranking order off `getAllByRole('heading', { level: 3 })`; it now reads it
off each row's drag surface, which is the row's own accessible name — a better
handle regardless, because a test that reads order can no longer drift from
what a user hears.

### 4. Compact rows, not a 2-column grid of tiles

The review offers the grid as an alternative and says it "roughly doubles crops
per unit of height". At this sidebar width it doesn't. 287px of content in two
columns is ~135px per tile; a square tile is then ~135px tall and holds two
crops, against ~66px per row holding one — a wash, arithmetically. What the
tile does cost is the crop's name: 135px truncates most of the shipped dataset,
where a full-width row gives the name 183px and truncates 3 of 144.

The review's "~64px tall" row is what shipped: 62px, uniform. Uniform matters
more than the exact figure — a row whose height depends on how its name wraps
makes "how many crops fit" a distribution rather than a number, and the phase's
acceptance criterion is a number.

### 5. Muted, but measured — which rules out `opacity: 0.6`

The review asks for the current `opacity: 0.6` on unsuitable rows plus a
greyscale icon. Composited over a white card, 0.6 opacity does this:

| element                                                   | at full opacity | at 0.6        |
| --------------------------------------------------------- | --------------- | ------------- |
| the crop's name (`--text-strong`)                         | 14.83:1         | **4.08:1** ❌ |
| the category word (`--text-muted`)                        | 5.58:1          | **2.49:1** ❌ |
| the band chip's own text, hand-tuned to 4.64:1 in Phase 0 | 4.64:1          | **2.24:1** ❌ |

Three WCAG 1.4.3 failures to say "this one is a long shot". (They are present
today, at larger scale, on rows that also carry the summary and reasoning —
this phase found them rather than introduced them.) So the muting is carried by
the parts that have no ratio to lose: the icon goes greyscale on a neutral disc
instead of its category tint, and the name steps down one level to
`--text-muted`, which is 5.58:1 and passes. The row still reads as demoted at a
glance; nothing in it became unreadable to do it.

### 6. The category chips are the legend

The review asks for colour-coded category filter chips _and_ "a one-line legend
at the sidebar top mapping category colours". A chip carrying a category's own
canvas colour and its name **is** that mapping; a separate line would restate it
for ~24px of the budget §1 was fighting for.

Two consequences worth recording. First, the chips are native radios (visually
hidden, styled through their labels) rather than toggle buttons: a radio group
is **one** tab stop with arrow keys inside it, which is the behaviour a
roving-tabindex widget would have to be hand-written to imitate, and this
palette counts its tab stops. Second, the inputs are stretched over their chips
rather than parked at 1×1 in a corner — a 1×1 input under a label that covers
it is operable by a human but not by a tool that checks what is under the
pointer, and Playwright rightly refuses to click it.

The **category word stays on the card**, which is a deviation from the review's
"icon, name, band chip. That's it". The icon's disc is tinted by category, and
with the word gone that tint would be information conveyed by colour alone
(WCAG 1.4.1) — and a legend does not fix that for the users 1.4.1 is about: a
reader who cannot tell the teal chip from the green one cannot use a teal/green
key either. It is the same reasoning that makes the band a labelled chip rather
than a coloured dot.

## Alternatives considered

- **A separate "why?" button on each row**, instead of making the card itself
  the disclosure. Rejected on the tab-stop budget: 144 crops × 2 controls is
  288 stops, and a third per row makes it 432 — past the point where the
  keyboard walkthrough's own step gives up (320). `PlantPalette.test.tsx`
  asserts two per row so this can't creep back.
- **Keeping the name an `<h3>` for the ordering test's sake.** Rejected in §3;
  the test got a better handle instead.
- **A floating popover for the reasoning**, which the review offers alongside
  "expando". Rejected: inside a scrolling list a popover has to be positioned
  against a scrollport that moves under it, and the content is a paragraph and
  four bullets — something to read, not something to point at.
- **Filling a selected category chip with its category colour and white text.**
  The obvious design, and it fails: white on `--category-vegetable` is 4.12:1.
  Moving the green to fix it would change the canvas markers (the value is
  mirrored from `CATEGORY_COLORS`, guarded by `styles/tokens.test.ts`) to fix a
  chip. Dark text on a measured tint clears the bar three times over.
- **Shortening the band chip to a single word** ("Excellent" rather than
  "Excellent match"), which would have given the category word all the room it
  wants. Rejected because `BAND_LABELS` is the engine's own wording and
  `docs/accessibility.md` §2's 1.4.1 argument rests on the chip's text _being_
  that wording; a second band vocabulary in the app is a worse cost than the
  measured one it avoids (4 rows of 144 ellipsis the category to "vegetab…",
  the pairing where both strings are at their longest).
- **Turning off dnd-kit's `KeyboardSensor` entirely** and letting Enter mean
  "expand" by default. It would have worked, and it would have deleted a
  keyboard path ADR 0026 documents as present-but-secondary. Narrowing its
  activation keys keeps both.

## Consequences

- **The number this phase exists to change: 0 → 8 crops visible without
  scrolling** at 1440×900, and 11 at 1920×1080. The list box grew from 287×394
  to 287×595 and the row shrank from a median 631px to a uniform 62px; the
  whole list is **9,508px** where it was ~93,900. `e2e/palette.spec.ts` counts
  the crops in the browser, against the scrollport's client box, and reports the
  slack under the last one so a regression says how close it was.
- **The reasoning is one press away and otherwise not in the DOM.** Same
  content, same words, ~470px of it when opened.
- **Two tab stops per row, unchanged at 288**, and the keyboard walkthrough's
  measured counts are unchanged either side (4 tabs to the search field, 20 from
  there to the canvas). It gained step 2b, which walks the new key.
- **`e2e/drag.ts` no longer restates the palette's aria-labels**, and the two
  most load-bearing selectors in the suite now come from `palette/labels.ts`.
  The anchoring — the part that must not be loosened — stays where it was.
- **axe covers a sixth state**: a palette card with its reasoning expanded,
  where one element carries `role="button"`, `aria-roledescription`,
  `aria-describedby` and `aria-expanded` at once.
- **`styles/tokens.css` gained three tints** (`--category-*-bg`), measured the
  same way the `--band-*-bg` tints were, and used for both the icon disc and a
  selected chip.
- **A drag now needs to travel 4px before it starts.** That is a real
  behavioural change to every drag in the app, not only the palette's: a drag
  begun with a very slow, very short pointer movement now needs 4px it did not
  need before. The gain is that a _click_ exists at all on these cards.
- **`PlotDefinitionPage.test.tsx` got roughly three times faster** — ~6s where
  it was ~18–19s — because the palette is a fraction of the DOM it was. The
  timeout that test carries stays as headroom, with its comment corrected.
