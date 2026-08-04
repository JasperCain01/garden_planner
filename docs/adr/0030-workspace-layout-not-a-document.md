# 0030 — The app is a workspace, not a document

- **Status:** Accepted, with a dated addendum at the foot of this file
- **Date:** 2026-07-28
- **Phase:** UI redesign Phase 1 — workspace layout
  ([`docs/ui-aesthetic-review.md`](../ui-aesthetic-review.md))

## Context

`docs/ui-aesthetic-review.md` lists five findings in order of importance, and
the first three are all the same finding wearing different hats:

1. The shell capped content at 640px and centred it. At 1920×1080 that used a
   third of the screen; the other two thirds were blank margin, and everything
   — form, palette, canvas, warnings — stacked into one column ~3,000px tall.
   "A landscape screen is wide and short; this app is narrow and tall."
2. The plot canvas, the signature feature, was a ~228×168px postage stamp
   two-thirds of the way down that column.
3. The advertised gesture — drag a plant from the palette onto the plot — was
   physically broken by the layout: the palette and the canvas were ~1,500px
   apart and never on screen together, so a drag needed dnd-kit's autoscroll to
   crawl the page mid-gesture.

Phase 0 built the design system and changed no layout, deliberately. Phase 1 is
the layout, and it is the phase with the largest blast radius in the plan: it
touches every region of the app, retires the numbered "1./2./3./4." headings
that several tests and the keyboard walkthrough keyed off, and moves one whole
capability ("Add your own crop") out of the page.

Four questions needed answering, and none of them are "what should it look
like" — the review already drew that.

1. Where does the grid live, given the app has a router and two routes?
2. What replaces the numbered headings as navigable structure?
3. What happens on a phone, where Stage 6.2 did real, measured responsive work?
4. Where does "Add your own crop" go, and how is a modal made accessible here?

## Decision

### 1. The shell owns the frame; the page owns the columns

`routes/AppShell.tsx` becomes a two-row grid pinned to the viewport
(`grid-template-rows: auto minmax(0, 1fr)`, `height: 100dvh`): a header band,
and a content row of exactly the height left over. `plot/PlotDefinitionPage.tsx`
fills that row with the three columns —
`grid-template-columns: 320px minmax(0, 1fr) 300px`.

The review's sketch draws it as a single grid with the header spanning all
columns. The seam is here instead because the columns _are_ route content: the
palette, canvas and controls all belong to the plot-definition page, and
`NotFound` renders through the same shell and wants none of them. Splitting at
the boundary the router already draws means the shell knows nothing about
gardens and the page knows nothing about chrome.

`minmax(0, 1fr)` rather than a bare `1fr` appears in both, and is load-bearing
in both: `1fr` means `minmax(auto, 1fr)`, whose `auto` minimum lets a track
refuse to be shorter than its content — so 144 palette rows would grow the grid
past the viewport and put the scrollbar back on the page, which is the one
thing this layout exists to remove. A `0` minimum keeps tracks
viewport-sized and hands overflow to the regions inside them.

### 2. Labelled `region` landmarks replace the numbered headings

"1. Define your plot" … "4. Check for problems" enforced a sequence over what
`DESIGN.md` describes as a loop, and the workspace _is_ the loop. But those
headings were also real structure — a screen-reader user's table of contents,
and what several e2e specs navigated by. So each region is a
`<section aria-label="…">` (Plants / Your plot / Plot settings and checks) and
each still carries a visible `<h2>`; the right-hand column's three panels are
`<details>`/`<summary>` with the heading inside the summary, so a panel is a
disclosure control _and_ a heading at once.

`<details>` rather than a hand-built accordion for the same reason the dialog
below is a `<dialog>`: it is keyboard-operable, announced as a disclosure, and
open/closed without a line of state.

### 3. The phone layout is kept, as one breakpoint, and it is the old layout

Below 900px (`--layout-narrow`) the shell stops pinning to the viewport, the
grid becomes a flex column, and each region becomes a card again — which is
exactly what it was before this phase. The palette's crop list gets its
`max-height: min(65vh, 40rem)` cap back for exactly the reason Stage 6.2 added
it (`docs/accessibility.md` §3): on a phone the app reads as one page of
sections, and three internally-scrolling regions on a 640px-tall viewport would
be three cramped windows onto it.

Above that width the cap is gone and the list simply fills the sidebar, which
is better than a fraction of the viewport ever was.

### 4. "Add your own crop" moves into a real `<dialog>`

It took ~800px of prime mid-page space, between the palette and the canvas, for
a capability used rarely — and every one of those pixels was also distance
between the palette and the canvas. It is now a trigger at the foot of the
plants sidebar opening `ui/ModalDialog.tsx`, the app's first shared UI
primitive.

That primitive is a real `<dialog>` element with `showModal()`, not a
`<div role="dialog">`. The browser then owns the focus trap, Esc, focus
returned to the trigger, and the `::backdrop` scrim — four things a hand-rolled
modal typically gets wrong, tested by browser vendors rather than by us. Its
children render only while open, so a shut dialog contributes nothing to the
accessibility tree and the form starts blank each time.

jsdom 25 doesn't implement `HTMLDialogElement` at all, so the component falls
back to toggling the `open` attribute when `showModal`/`close` are missing.
That branch never runs in a browser; it exists so component tests see the
content without every one of them mocking the element.

### 5. One new skip link, rather than a DOM order that fights the columns

Reading order is now plants → plot → settings, which puts the shape and
conditions form _behind_ the 144-crop palette where it used to come first.
`plot/SkipLinks.tsx` (Stage 6.2's `SkipToCanvasLink`, renamed) answers that
with a second link straight to the settings column.

The alternative — leaving the settings column first in the DOM and moving it
into the third grid column with `grid-column` — would have fixed the tab count
by making focus jump from the right edge of the screen back to the left, which
is precisely what WCAG 2.4.3 (Focus Order) exists to prevent. One more link is
the cheaper trade.

## Alternatives considered

- **Raise the max-width to ~1100px and put the palette and canvas side by side
  in a two-column grid** — the review's own Quick Win #4, "a crude interim
  version of Phase 1's core benefit". Rejected because it is strictly less than
  what a full-viewport grid gives for the same amount of work, and it would
  leave the warnings list four screens from the form that changes it.
- **A resizable/collapsible splitter between the three columns.** Genuinely
  nice, and genuinely a pile of pointer-interaction state to make keyboard-
  operable. Fixed widths plus an internally-scrolling sidebar solve the actual
  finding; a splitter can be added later without undoing any of this.
- **Routing the three regions as separate pages.** Would have made each region
  roomy and reintroduced exactly the problem Stage 3.3 already rejected: the
  core loop reads as one continuous flow, and a drag cannot cross a route
  boundary.
- **Ordering the DOM to match "describe → discover → arrange" and re-ordering
  the columns visually with `grid-column`.** See §5 — better tab counts, worse
  focus order.
- **A `<div role="dialog">` with a hand-written focus trap.** Rejected in §4.
  Stage 6.2's posture was to hand-build only what the platform doesn't supply,
  and here it supplies it.
- **Upgrading jsdom so `<dialog>` works in component tests.** A major dependency
  bump, mid-phase, to avoid a two-line fallback in one component. Not worth the
  blast radius; the real modal behaviour is verified in a real browser by the
  axe run and the keyboard walkthrough instead.

## Consequences

- **The canvas region is now ≥50% of the viewport** — 53% at 1440×900, 64% at
  1920×1080 — against the ~2% the postage stamp had.
  `e2e/workspace-layout.spec.ts` measures both, plus "the page does not scroll"
  and the narrow-breakpoint fallback, so the phase's acceptance criteria are
  regression-guarded rather than described.
- **The canvas has the space but does not yet use it.** The Konva stage is
  still drawn at the fixed `PX_PER_CM`, so the default 3×2m plot is a small
  rectangle centred in a large region. That is Phase 2's entire brief
  (scale-to-fit, zoom, grid, footprint-true markers), and Phase 1 deliberately
  stops at giving it somewhere to grow into.
- **Every drag-driven e2e spec got simpler.** The 4,000px-tall viewport trick
  those specs used to force the stacked page's palette and canvas into view at
  once is gone; they use ordinary desktop viewports. `e2e/drag.ts` also stopped
  hand-computing a press point from `boundingBox()` in favour of
  `locator.hover()` — a palette row can be ~560px tall, taller than the list
  box it lives in, so its box centre can be off-screen while the row is
  perfectly draggable.
- **A flake the project had lived with since Stage 6.3 is fixed, not
  inherited.** `plot-export.spec.ts` "fails once and passes on retry" was a
  documented known quantity (`docs/qa-checklist.md` §4). Rewriting these specs
  was the moment to instrument it rather than carry it forward, and the cause
  turned out to be the one the specs' own comments had guessed at: `fill()` on
  the palette search box fires a single `input` event, and a React render
  already in flight with the old state can commit afterwards and write the
  previous term back onto the input — so the crop being searched for never
  renders, and waiting longer cannot help. `filterPaletteTo` re-types instead;
  ten consecutive clean full-suite runs followed. `retries: 1` under CI stays,
  now as insurance against an unknown rather than cover for this.
- **The keyboard journey got shorter, and its script changed shape.** Reaching
  the canvas after placing a crop now takes 15 tab presses where it took 35,
  mostly because the add-crop form's ~25 stops left the page. The walkthrough
  itself follows the new reading order and gained steps for the second skip
  link and the dialog (`docs/accessibility.md` §6).
- **A dragged palette card is clipped at the sidebar edge.** The crop list
  scrolls, which makes it a clipping box on both axes, and the card follows the
  pointer in place. This was equally true before — the drag simply ran
  vertically out of the same box — and the canvas still lights up as a drop
  target throughout, but the short sideways gesture makes it more visible. The
  fix is a dnd-kit `DragOverlay`, which is what Phase 5's "drag ghost slightly
  enlarged with shadow" is; Phase 1 was told to keep the dnd-kit wiring as it
  stands, and did.
- **`PlotConditionsForm` lost its outermost `<fieldset>`** (only that one). The
  "Growing conditions" disclosure panel is now the labelled group that fieldset
  was, and keeping both would announce and draw the same name twice. The Soil
  and Location fieldsets inside it group things the panel doesn't, and stay.

## Addendum, 2026-08-04 — the clipped drag card is fixed

The last consequence above ends "the fix is a dnd-kit `DragOverlay`, which is
what Phase 5's 'drag ghost slightly enlarged with shadow' is". UI redesign Phase
5 built it (ADR
[0034](./0034-designs-persistence-and-one-history-over-two-stores.md) §7), so
this is recorded here rather than left for a reader to check.

`palette/PlantPalette.tsx`'s `PaletteDragGhost` renders inside a `<DragOverlay>`
at `plot/PlotDefinitionPage.tsx` — outside the crop list's clipping box
entirely — and the source card stops carrying an inline transform, dimming in
place instead. The clipping rule's note in
`palette/PlantPalette.module.css` was rewritten to describe what happens now
rather than what used to.

The two things this ADR's phase was told to leave alone are still untouched: the
`PointerSensor`'s 4px activation distance and `resolveDrop`'s pointer-first drop
point. The overlay does not disturb either — dnd-kit computes
`active.rect.current.translated` from the measured rect and the drag transform
whether or not anything renders that transform, so the keyboard-drag path is
unchanged.
