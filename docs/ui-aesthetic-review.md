# UI Aesthetic Review & Redesign Plan

**Scope:** strictly aesthetic/UX. The engine, data pipeline, stores, and interaction logic are
sound and out of scope. This document is a critique of how the app _looks, feels, and fits a
laptop/desktop screen_, followed by a phased redesign plan written to be handed to
implementation sessions one phase at a time.

**Method:** full read of `app/src` (shell, routes, plot forms, palette, canvas, warnings,
user-crops), plus a live session in Chromium at 1440×900 and 1920×1080 — loading the app,
applying shapes, adding crops via both drag and the "Add to plot" button, and exporting.
Measurements quoted below come from that session.

---

## Part 1 — The verdict

The app currently has **no visual design at all**. There is not a single CSS file in
`app/` — the only styling is a handful of inline `style` props (a max-width on the shell, a
scrollbox on the palette, borders on cards). Everything else is browser-default HTML:
default fieldsets with 1995-era etched borders, default buttons, default inputs, black text
on white. It reads as an engineering test harness for the engine — which, to be fair, is
essentially what the workplan built. The good news: because there is no design to unwind,
a redesign is almost purely additive.

The five findings that matter most, in order:

1. **The desktop screen is thrown away.** The shell hard-caps content at `40rem` (640px)
   and centres it (`AppShell.tsx:22`). At 1920×1080, 33% of the screen is used; 67% is
   blank white margin. Everything — forms, palette, canvas, warnings — is stacked in one
   narrow column ~3,000px tall (measured 2,913px at 1440×900 with the palette _already_
   capped at 65vh). A landscape screen is wide and short; this app is narrow and tall.
   It is the exact wrong shape for its medium.

2. **The signature feature is invisible.** The plot canvas — the whole point of the app —
   renders the default 3×2m plot at ~228×168px (`PX_PER_CM = 0.6`, `geometry.ts:22`), a
   pale green postage stamp buried two-thirds of the way down the page, _smaller than the
   "Add your own crop" form above it_. The scale is fixed: a small plot is tiny, a large
   plot overflows into a scrollbox. The canvas never grows to use the screen.

3. **The core interaction is physically broken by the layout.** The advertised gesture is
   "drag a plant from the palette onto the plot" — but the palette and the canvas are
   ~1,500px apart vertically and never on screen together. A drag requires dnd-kit's
   autoscroll to crawl the page mid-gesture. The workaround button ("Add to plot") drops
   every crop at the region centre, so adding three crops produces **one visible marker** —
   three markers stacked in the same spot (verified live). First-run experience: you add
   plants and the plot appears to eat them.

4. **The palette is a debug log, not a plant picker.** Every one of 144 crops renders
   fully expanded: name, band, category, summary sentence, confidence %, and a four-bullet
   per-dimension reasoning list — ~200px per row, ~28,000px of virtual list in a 65vh
   scrollbox. The lovely crop icon SVGs (144 hand-made icons in `src/icons/crops/`!) are
   drowned at 3rem beside walls of text. Scanning for "what can I plant?" means reading
   paragraphs. The reasoning is genuinely good content — it just must not be the _default_
   altitude.

5. **Zero identity, zero delight.** No colour system (the only colours are the band-label
   text colours and two greens on the plot fill), no typography beyond `system-ui`, no
   spacing rhythm (labels touch their inputs: "Width (m)3", "Light levelfull sun"), no
   hover states, no transitions, no drop feedback, no empty-state warmth. For a product
   whose subject is _gardens_ — colour, growth, play — the affect is a tax form.

Smaller but real:

- Two disconnected pictures of the same plot: you edit the outline in section 1's small
  SVG editor, then see the plot again, at a different scale, in section 3's Konva canvas.
  Users must mentally reconcile them; dimensions are labelled on neither (no ruler, no
  grid, no "3m" caption anywhere).
- The shape picker is three radio buttons + naked number inputs. Shape choice is an
  inherently visual decision rendered as text.
- Nested fieldsets three deep in "Growing conditions" produce a maze of etched boxes.
- "Add your own crop" — an advanced, rarely-used capability — occupies ~800px of prime
  mid-page real estate _between_ the palette and the canvas, pushing the canvas further
  out of reach.
- Marker size is fixed (16px radius) regardless of plant footprint: a squash and a radish
  read identical, so spatial planning ("what fits?") gets no visual support even though
  the engine computes spacing precisely.
- Default-styled buttons ("Use this shape", "Export image", "◀ Previous placement") look
  like wireframe placeholders.
- The `<h1>` "Garden Planner 🌱" is the entire brand.

**What must be preserved.** Stage 6.2 did real accessibility work that the redesign must
not regress: the skip-to-canvas link, keyboard placement path ("Add to plot" + arrow-key
nudge), WCAG-checked band colours (`PlantPalette.tsx` documents the contrast math),
`role`/`aria-label` structure, and the axe Playwright suite (`app/e2e/a11y.spec.ts`).
E2E tests also key off visible text and headings ("1. Define your plot", etc.) — layout
changes will require test updates in the same PR, and that is expected and fine.

---

## Part 2 — Detailed critique by area

### 2.1 App shell & first impression

- `AppShell.tsx` is a centred 640px column with an `<h1>`. No header bar, no footer, no
  surface separation — content floats on bare white.
- Above the fold at 1440×900 you see: heading, a paragraph, radio buttons, two number
  inputs, a tiny green rectangle, and the top of a fieldset maze. Nothing communicates
  "this is a fun tool for designing your garden." Nothing invites a click.
- First meaningful interaction (seeing a plant on a plot) requires: scroll, read, scroll,
  find button, click, scroll further to find the canvas. Time-to-delight is ~60s of
  reading; it should be under 10s.

### 2.2 Layout vs. landscape screens

- Single column at every width; no breakpoints, no grid, no sidebars. At 1920px the
  content:whitespace ratio is 1:2.
- The one layout constraint that exists (65vh palette scrollbox) was added to fix page
  height on _phones_ (`PlantPalette.tsx` comment) — desktop was never laid out at all.
- The four numbered sections enforce a false sequence. Real use is a loop: tweak plot ↔
  browse plants ↔ arrange ↔ check warnings. A vertical document makes every loop
  iteration a scroll journey; a workspace layout makes it free.

### 2.3 Plot definition (shape picker, outline editor, conditions)

- Shape picker: radio text + number fields; error text only after failure. Should be
  visual cards with shape glyphs and live dimension preview.
- Outline editor: functional and clever (SVG, drag corners, midpoint-add) but visually
  bare — flat fill, no grid, no dimension labels, no snapping feedback, corner handles are
  plain circles, "double-click to remove" is undiscoverable (documented only in an
  aria-label).
- Conditions form: three nested fieldsets, six inline selects, no grouping rhythm. "Not
  sure" defaults are good UX buried in bad chrome.

### 2.4 Palette

- Always-expanded reasoning inverts the information hierarchy: identity (icon, name,
  band) should be instant; evidence (dimensions, confidence) should be on demand.
- One column wastes width: at a sensible card size a desktop sidebar fits 1–2 columns,
  a full-width grid fits 4–6.
- Band is text-only colour-coded ("Excellent match" in green text) — should be a chip;
  category is an italic word — should be a coloured dot/chip matching the canvas marker
  colours (that mapping already exists in `CATEGORY_COLORS`, `PlotCanvas.tsx:91`, but is
  never shown in the palette, so the legend connection is lost).
- "Add to plot" is a detached default button under each card; it reads as a form control,
  not an action on the card.

### 2.5 Canvas

- Fixed 0.6px/cm scale is the root problem: the canvas should _fit the available space_
  (scale-to-fit with zoom), not the other way round.
- No grid, no ruler, no north/sun indicator, no plot dimensions. For a tool about
  _space_, the space itself is unlabelled.
- Markers: uniform 16px circles; category colour + icon is good, but footprint-blind
  sizing means the layout you draw has no relationship to what fits (the engine knows —
  `PlacementFeedbackPanel` prints "50 plants: 5 rows of 10 at 20 × 60 cm" as _text_ below
  the canvas instead of showing it _on_ the canvas).
- Centre-stacking on "Add to plot" (`PaletteEntry.handleAddToPlot` →
  `regionCentre`) is the single worst first-run bug-that-isn't-a-bug.
- Selection feedback is a stroke-width change; drop feedback is a dashed border on the
  container; there is no animation, ghost, or landing effect anywhere.
- Toolbar is scattered `<p>` tags of default buttons below the canvas.

### 2.6 Warnings

- A plain text list at the very bottom — the least visible location for the highest-value
  live feedback the engine produces. Severity is an uppercase coloured word. Warnings
  belong beside/on the canvas (badges already exist there — good) with the list docked
  in view, not four screens away from the form that changes them.

### 2.7 Play & iteration ("easy to play around with different garden ideas")

- No undo/redo — the store is Zustand; a temporal middleware is cheap. Without undo,
  experimentation is punished.
- No saved designs / scenarios — one implicit plot, no "duplicate and try a variant",
  no localStorage persistence of the arrangement (refresh loses the design).
- Changing the plot shape after placing keeps placements at their old coordinates —
  sensible mechanically, but with no visual affordance for "these are now outside".
- No "clear all", no example/demo garden to start from.

---

## Part 3 — Redesign plan

Written as six phases, each independently shippable, ordered so the biggest wins land
first. Each phase lists concrete specs and acceptance criteria an implementation session
can execute against. **Ground rules for every phase:** keep all keyboard paths and ARIA
structure working, keep axe green (`npm run a11y`), update unit/e2e tests in the same
change, touch no engine code.

### Phase 0 — Design system foundation (prerequisite, small)

> **Status: implemented** (2026-07-28). Tokens in `app/src/styles/tokens.css`,
> primitives in `global.css`, per-component CSS Modules, self-hosted Fraunces.
> Decisions and the roads not taken: ADR
> [0029](./adr/0029-design-tokens-css-modules-and-self-hosted-font.md); what
> changed and why, in `docs/architecture.md`. Two band colours moved one hue-step
> to stay above 4.5:1 on a tinted chip — measured, and recorded in
> `docs/accessibility.md` §2. Everything below is what was asked for; the notes
> in brackets are where the implementation differs.

Introduce real styling infrastructure and tokens; migrate existing inline styles.

- **Approach:** plain CSS with custom properties (design tokens) + CSS Modules per
  component. No component library needed; avoid adding Tailwind unless the implementer
  strongly prefers it — the app is small and tokens + modules keep the diff readable.
- **Tokens (starting palette — warm, garden, high-spirited):**
  - `--surface-page: #f6f3ea` (warm cream — kills the clinical white)
  - `--surface-card: #ffffff`, `--surface-raised` with soft shadow
  - `--green-900: #1b4332`, `--green-700: #2d6a4f`, `--green-500: #40916c`,
    `--green-100: #d8f3dc` (primary ramp)
  - `--soil-700: #6f4e37`, `--soil-100: #efe6dc` (secondary/earth accents)
  - `--sky-500: #4d94c4` (info/links), `--sun-400: #f4a259` (highlights/CTAs)
  - Band colours: keep the existing WCAG-verified values from `PlantPalette.tsx`
    (`#1a7f37`, `#3f7522`, `#8a6c00`, `#b35c00`, `#767676`) as chip text/border colours,
    paired with tinted chip backgrounds (e.g. `#e6f4ea` behind excellent).
  - Category colours: reuse `CATEGORY_COLORS` (`#4c8c2b` vegetable, `#00796b` herb,
    `#c0392b` fruit) everywhere a category appears — palette chips, canvas markers,
    legend — one consistent mapping.
  - Spacing scale 4/8/12/16/24/32; radius 8px (cards 12px); one shadow level for cards,
    one for overlays.
- **Typography:** a friendly display face for headings — **Fraunces** or **Nunito**
  (self-hosted via `@fontsource`, no CDN) — over a `system-ui` body stack. H1 ~28px,
  section headings 20px, body 15–16px, `line-height` 1.5.
- Restyle the primitives once, globally: buttons (primary = green-700 fill, hover
  darken + 1px lift; secondary = outline), inputs/selects (white fill, 1px `#d5cec0`
  border, 8px radius, visible focus ring `--sky-500`), fieldset borders removed in
  favour of card grouping with a small bold group label.
- **Acceptance:** no visual browser-default chrome remains; all existing tests pass;
  axe green. _(Met: `npm test` 168 passing, `npm run e2e` 7 passing, `npm run a11y`
  0 violations. Two test files changed with the code — `SkipToCanvasLink.test.tsx`,
  whose visually-hidden behaviour is now CSS rather than state, and
  `PlotCanvas.test.tsx`, which queried the canvas container by its inline border.
  `e2e/drag.ts` gained a `scrollIntoViewIfNeeded` — see ADR 0029's consequences.)_

### Phase 1 — Workspace layout (the big one)

> **Status: implemented** (2026-07-28). Shell frame in
> `app/src/routes/AppShell.tsx`, the three-column grid in
> `app/src/plot/PlotDefinitionPage.tsx`, the add-crop modal in
> `app/src/ui/ModalDialog.tsx` + `user-crops/AddCropDialog.tsx`. Decisions and
> the roads not taken: ADR
> [0030](./adr/0030-workspace-layout-not-a-document.md); what changed and why,
> in `docs/architecture.md`; the keyboard consequences, measured, in
> `docs/accessibility.md` §6. Everything below is what was asked for; the notes
> in brackets are where the implementation differs.

Replace the 640px vertical document with a full-viewport three-region workspace.
This single phase fixes findings 1, 3, and half of 2.

```
┌────────────────────────────────────────────────────────────┐
│ Header: 🌱 Garden Planner   [Undo] [Redo]   [Export image] │
├────────────┬───────────────────────────────┬───────────────┤
│  PLANTS    │                               │  PLOT & CHECKS│
│  (left     │        CANVAS                 │  (right panel,│
│  sidebar,  │   fills all remaining         │  ~300px,      │
│  ~320px,   │   space, scale-to-fit         │  collapsible) │
│  own       │                               │  • Shape/size │
│  scroll)   │                               │  • Conditions │
│  search    │                               │  • Warnings   │
│  filters   │   [zoom −/＋/fit]             │    (live)     │
│  crop cards│                               │               │
└────────────┴───────────────────────────────┴───────────────┘
```

- `AppShell` becomes a `100vh` CSS grid: `auto / 320px 1fr 300px`; header spans all
  columns. Sidebars scroll internally; the page itself never scrolls vertically on
  desktop. Below ~900px viewport width, collapse to the current stacked flow (the
  existing mobile reasoning in the code comments stays valid — keep it as the narrow
  breakpoint). _(Split in two: `AppShell` is a `100dvh` two-row frame — header, plus
  a content row of exactly the leftover height — and `PlotDefinitionPage` draws the
  three columns inside it. The columns are route content and `NotFound` shares the
  shell, so the seam sits where the router already put one. ADR 0030 §1.)_
- Palette (left) and canvas (centre) are now _always simultaneously visible_ → drag and
  drop becomes a short, natural gesture. Keep the dnd-kit wiring exactly as is.
- Right panel hosts: shape picker + outline editing controls, growing-conditions form,
  and the warnings list — the tweak-and-check loop sits beside the canvas it affects.
  Sections are collapsible accordions (conditions open by default).
- "Add your own crop" moves out of the flow entirely: a "+ Add your own crop" button at
  the bottom of the palette sidebar opening a modal dialog (focus-trapped, Esc to
  close). Same form inside, unchanged logic. _(Done, as a real `<dialog>` +
  `showModal()` — the focus trap, Esc, focus-return and backdrop are then the
  browser's rather than ours. The button also shows a count, because behind a dialog
  you can no longer simply see your own crops listed. ADR 0030 §4.)_
- The numbered "1./2./3./4." headings retire; the workspace _is_ the loop. Keep an
  `aria-label`ed landmark per region and keep the skip-to-canvas link (retargeted).
  _(Done, plus a **second** skip link. Reading order is now plants → plot →
  settings, which puts the shape/conditions form behind the whole 144-crop palette
  where it used to come first — a real cost of the layout, answered the way Stage 6.2
  answered the same shape of problem. `SkipToCanvasLink` → `SkipLinks`; ADR 0030 §5
  records why this rather than a DOM order that fights the visible columns.)_
- **Acceptance:** at 1440×900 and 1920×1080 the canvas region occupies ≥50% of viewport
  area; palette→canvas drag completes without any page scroll; e2e specs updated;
  keyboard walkthrough (`keyboard-walkthrough.mjs`) still completes. _(Met, and now
  regression-guarded: `e2e/workspace-layout.spec.ts` measures the canvas region at
  **53%** of viewport area at 1440×900 and **64%** at 1920×1080, asserts the page
  doesn't scroll at either size, drags palette→canvas from the unfiltered default
  state without scrolling, and checks the narrow breakpoint still stacks. `npm test`
  176 passing, `npm run e2e` 13 passing, `npm run a11y` 0 violations across three
  states (the modal got its own scan), keyboard walkthrough all steps passing — and
  15 tab presses to the canvas where it used to be 35.)_

### Phase 2 — Canvas as hero

> **Status: implemented** (2026-08-03). Live scale in
> `app/src/canvas/useCanvasScale.ts` + `app/src/state/canvas-view-store.ts`,
> marker sizing in `app/src/canvas/footprint.ts`, the first-free-position
> search in `app/src/canvas/geometry.ts`, the merged outline editor in
> `app/src/canvas/useOutlineEditing.ts` (and `plot/PlotOutlineEditor.tsx`
> deleted). Decisions and the roads not taken: ADR
> [0031](./adr/0031-canvas-as-hero-live-scale-and-one-plot-picture.md), plus a
> dated addendum on ADR [0016](./adr/0016-outline-editor-svg-not-konva.md),
> whose premise this phase changed; what changed and why, in
> `docs/architecture.md`; the keyboard and contrast consequences, measured, in
> `docs/accessibility.md` §7. Everything below is what was asked for; the notes
> in brackets are where the implementation differs.

- **Scale-to-fit + zoom:** compute `pxPerCm` from the canvas container size (fit the
  padded region bounds, clamp to sane min/max), with −/＋/fit-to-screen controls and
  ctrl+scroll zoom; pan by dragging empty space when zoomed in. Kill the fixed
  `PX_PER_CM` (keep the helpers, parameterise the scale — `geometry.ts` already accepts
  `pxPerCm` as a parameter throughout). _(Done, and `pxPerCm` became **required**
  rather than defaulted: `drop.ts` and `export.ts` both fail silently on a wrong
  scale, so the parameter is what turns that into a compile error. The scale lives
  in a store because `useCanvasDropHandler` is called from above the canvas region
  and can't see a size measured below it. ADR 0031 §1. Pan is the viewport's own
  scroll, driven by dragging empty ground — one notion of "where the plot is",
  not two.)_
- **Merge outline editing into the main canvas.** One plot picture, ever. An "Edit
  shape" toggle enters outline mode: corner/midpoint handles appear (port the SVG
  editor's interaction to Konva, or overlay the existing SVG at the canvas's scale);
  edge lengths render as labels while editing ("3.0 m"); exit returns to arrange mode.
  Section 1's separate mini-editor is deleted. _(Done, ported to Konva — an
  overlaid SVG is a second coordinate system and an element swallowing the stage's
  events, i.e. two pictures stacked. ADR 0016 chose SVG deliberately, so it carries
  a dated addendum saying what changed about its premise. The **plot's overall
  dimensions** are labelled, always, rather than per-edge lengths only while
  editing; per-edge labels on a 20-corner outline are a thicket, and "how big is my
  plot" is the question the review actually asks ("dimensions are labelled on
  neither"). The corner handles also stopped being pointer-only — see below.)_
- **Ground the scene:** subtle grid at 50cm (fainter) / 1m (stronger) inside the plot;
  overall plot dimensions labelled outside the outline; canvas background `--soil-100`
  outside the plot, `--green-100`→soil gradient or flat tint inside; 1px inner shadow
  on the plot to lift it off the page. _(Done, with two notes. The grid is anchored
  to absolute coordinates, not to the outline's corner, so it stays put while a
  dragged corner moves the plot across it. And the "1px inner shadow" is a soft
  drop shadow instead: Konva has no inset shadow, and lifting the bed off the soil
  reads better than a hairline inside it.)_
- **Footprint-true markers:** marker radius = plant spacing footprint in cm × scale
  (min 12px for clickability), rendered as a soft category-coloured disc ("canopy") with
  the icon centred and a name label under it at zoom ≥ some threshold. A squash now
  visibly needs more room than a radish — spatial planning becomes visual. (Spacing data
  is already on the `Plant`; the feedback panel maths proves it.) _(Done. The
  footprint is the square `warnings/placement-derivation.ts` already models a
  placement's personal space as, rather than a second definition — so what looks
  like crowding is what the engine agrees is crowding. The icon is capped at 18px
  so one pumpkin's canopy doesn't become the only thing on the plot.)_
- **Fix centre-stacking:** "Add to plot" places at the first free position via a simple
  spiral/offset search from centre (pure function in `geometry.ts`, unit-testable).
  _(Done. When the plot is genuinely full the centre comes back — the honest
  answer, with the count feedback already saying so.)_
- **Interaction feedback:** drop → 150ms scale-pop; selection → glow ring, not stroke
  tweak; hover → cursor + slight lift + tooltip (name, band, spacing); drag-over canvas
  → tint the plot interior, not the container border; deleting → fade-out. _(All done
  except the **delete fade-out**, which isn't: the store forgets a placement
  synchronously, so animating its exit means the canvas holding a copy of something
  the store no longer has — history state, which Phase 5's undo/redo builds
  properly. The pop is skipped under `prefers-reduced-motion`, read in JavaScript
  because a stylesheet cannot reach inside a `<canvas>`. The tooltip shows name and
  spacing but **not band**: suitability is computed against the plot's conditions
  in the palette and a `PlacedPlant` doesn't carry it.)_
- Canvas toolbar (top of canvas region, one row): zoom controls, Edit shape toggle,
  Clear all (confirm), Export image. Previous/Next placement buttons stay (keyboard
  path) but styled as compact icon buttons. _(Done. In edit-shape mode the
  Previous/Next **placement** buttons become Previous/Next **corner**, because that
  is what the canvas's arrow keys are then acting on — two modes, one pair of
  buttons, rather than four of which two are always inert. "Clear all" confirms
  through `ui/ModalDialog.tsx` rather than `window.confirm`.)_
- **Acceptance:** default 3×2m plot fills the canvas region on first load; markers
  scale with footprint; three "Add to plot" clicks yield three visibly separate
  markers; export still works. _(Met, and measured rather than eyeballed —
  `e2e/canvas-scale.spec.ts` reads Konva's own `getImageData` back and counts what
  was drawn, which is a measurement, not a screenshot comparison with a golden file
  to regenerate._
  - _The stage is **732×539** at 1440×900 — **57%** of the canvas region, against
    **5.5%** for the 228×168px rectangle it was — and **1033×761** at 1920×1080,
    **59%** against 2.9%. The scale went from a fixed 0.6 px/cm to a fitted 1.93 and
    2.72._
  - _An extra radish marker draws **791** stage pixels; an extra butternut squash
    draws **42,919** — 54×, from footprints of 15cm and 150cm._
  - _Three "Add to plot" presses draw ~3× the pixels one does; under the old
    behaviour every extra press drew **zero**, landing exactly on the first._
  - _Export still works, and now comes out the **same size whatever the zoom** —
    `exportPixelRatio` rasterises back to the 0.6 px/cm this phase removed, so an
    exported PNG has the dimensions it had before the canvas learned to scale._
  - _Standing bar: `npm test` **216 passing** (36 files), `npm run e2e` **18
    passing**, `npm run a11y` **0 violations across five states** (edit-shape mode
    and the clear-all confirmation got their own scans), keyboard walkthrough **all
    steps passing** — including two new ones, and the plot outline is now
    reshapeable with no pointer at all, closing the gap `docs/accessibility.md` §5
    had recorded since Stage 6.2._
  - _Two things the phase turned up rather than introduced. Making the scale live
    exposed a **drop-accuracy bug**: dnd-kit's `delta` includes a scroll adjustment
    and the palette's list auto-scrolls mid-drag, which put a drop aimed at the
    plot's centre 12cm high — invisible at 0.6 px/cm because the clamp flattened
    it. And `warnings-overlay.spec.ts` dropped two antagonists at 0.4 and 0.6 of
    the canvas width, which used to be 76cm and would have become over 250cm: past
    the rule's threshold, so the spec would have gone on passing while testing
    nothing. `e2e/drag.ts` gained `atPlotCm` so a drop point that means a distance
    says so in centimetres.)_

### Phase 3 — Palette redesign

> **Status: implemented** (2026-08-04). Compact card, chip filters and the
> details disclosure in `app/src/palette/PlantPalette.tsx` (+ its module CSS),
> the band predicate in `app/src/palette/filters.ts`, the two shared
> aria-labels in `app/src/palette/labels.ts`, the drag/click activation
> constraint in `app/src/plot/PlotDefinitionPage.tsx`. Decisions and the roads
> not taken: ADR
> [0032](./adr/0032-palette-compact-cards-and-details-on-demand.md); what
> changed and why, in `docs/architecture.md`; the tab-stop budget and the
> contrast working, measured, in `docs/accessibility.md` §8. Everything below
> is what was asked for; the notes in brackets are where the implementation
> differs.
>
> **The bit this phase had to do first, which isn't in the list below.** The
> review assumed a taller list than the workspace gives: the sidebar spent
> 442px of its 836px on chrome, leaving the crop list **394px**, in which a
> "~64px" card is six crops and not eight. So the count moved onto the
> heading's line, the filters became chips, and the intro paragraph became a
> closed disclosure directly above the list — **kept**, because "read the
> confidence and per-plant reasoning, not just the band" is the last sentence a
> phase that hides the reasoning should drop. Chrome: 442px → **249px**.

- **Compact card** (one per crop): 40px icon on a category-tinted circle, name, band
  chip. That's it — ~64px tall, or a 2-col grid of square tiles. 144 crops scan in
  seconds. _(Done, as the row rather than the tile grid: at 287px of sidebar a
  2-column grid is ~135px tiles, so two crops per ~143px row against one per
  66px — arithmetically a wash, while truncating most of the dataset's names.
  62px, and **uniform**, which matters more than the figure: a row whose height
  depends on how its name wraps makes "how many crops fit" a distribution
  rather than a number. The card also keeps the **category in words** beside
  the band chip — without it the icon disc's category tint is meaning carried
  by colour alone, and a legend doesn't fix that for the readers WCAG 1.4.1 is
  about.)_
- **Details on demand:** clicking the card (not dragging) opens a popover/expando with
  the summary, confidence, and per-dimension reasoning — the exact content currently
  inlined. Nothing is lost; it's just re-altituded. _(Done, as an expando —
  inside a scrolling list a popover has to be positioned against a scrollport
  that moves under it, and this is a paragraph and four bullets, i.e. something
  to read rather than point at. **At most one is open at a time**: the expanded
  content is ~470px, and several at once rebuilds the wall of text. Making the
  drag surface *also* a disclosure took a `PointerSensor` activation constraint
  (4px — the slop the canvas already uses to tell a pan from a deselect) so a
  click isn't a one-pixel drag, dnd-kit's `KeyboardSensor` narrowed to start on
  **Space alone** so Enter is free for the disclosure, and a renamed
  accessible name that describes both jobs. ADR 0032 §2.)_
- **Filters as chips:** category chips (colour-coded) + band filter ("Great fits" =
  excellent+good) + the existing search box and hide-unsuitable toggle, restyled.
  Sticky at the top of the sidebar. _(Done. The chips are native radios and
  checkboxes, visually hidden and styled through their labels — a radio group is
  **one** tab stop with arrow keys inside it, which matters when the palette
  already spends 288. `matchesBand` is a pure predicate in `filters.ts` beside
  `matchesSearch`/`matchesCategory`, not a condition in JSX. Nothing is
  `position: sticky`: Phase 1 already made the sidebar a flex column in which
  only the list scrolls, so the filters stay put by construction.)_
- Unsuitable crops: keep visible-but-muted (current 0.6 opacity idea, plus greyscale
  icon) — honest and tidy. _(Half done, deliberately. The greyscale icon, yes —
  on a neutral disc rather than its category tint. The **0.6 opacity, no**: over
  a white card it takes the crop's name from 14.83:1 to **4.08:1**, the category
  word to **2.49:1**, and the band chip's own text — hand-tuned to 4.64:1 in
  Phase 0 — to **2.24:1**. Three WCAG 1.4.3 failures to say "long shot", all of
  them already true of the old rows. The name steps down to `--text-muted`
  (5.58:1) instead. `docs/accessibility.md` §8.)_
- "Add to plot" becomes a small `＋` icon-button on the card (aria-label preserved);
  whole card remains the drag surface. Keep the sibling-not-nested DOM structure that
  the axe `nested-interactive` comment explains. _(Done. Both of the palette's
  aria-labels now live in `palette/labels.ts` and are **imported** by
  `e2e/drag.ts` rather than restated there as regex source — the drag label had
  to change to describe the card's second job, and that duplication rots in
  exactly one direction. The anchoring stays.)_
- A one-line legend at the sidebar top mapping category colours (matches canvas).
  _(Done **as the category chips themselves**: a chip carrying a category's own
  canvas colour and its name is that mapping, and a separate line would restate
  it for ~24px of the vertical budget the list needed.)_
- **Acceptance:** ≥8 crops visible in the sidebar without scrolling at 900px height;
  reasoning reachable in one click; drag and keyboard paths intact.
  _(Met, and measured in a real browser rather than asserted —
  `e2e/palette.spec.ts` counts the crops against the scrollport's own client
  box and reports the slack under the last one, so a regression says how close
  it came.)_
  - _**Crops visible without scrolling: 8** at 1440×900, against **0** before —
    the number this phase exists to change — and **11** at 1920×1080. The ninth
    needs 66px and the list has 65 spare, so the margin is a whole row minus a
    pixel rather than a rounding error._
  - _The row is **62px, uniform**, where it was 589–820px with a **median of
    631px**. The list box grew from 287×394 to **287×595**, and the whole list
    is **9,508px** where it was ~93,900 — a tenth._
  - _**Reasoning in one click**, and it is the same content in the same words:
    the summary, the confidence, and the four per-dimension reasons, ~470px of
    it. In the DOM only while open. From the keyboard it is one Enter._
  - _**Tab stops unchanged at 288** (144 rows × 2), plus six for the sidebar's
    chrome — 294 measured. A "why?" button per row would have made it 432, past
    the keyboard walkthrough's own 320 budget, which is why the card itself is
    the disclosure. `PlantPalette.test.tsx` asserts the two-per-row shape._
  - _The per-crop **`<h3>` is gone**, on purpose: ARIA makes a `role="button"`
    element's subtree presentational, so those headings were never reliably
    headings — while they did put 144 entries in the outline ahead of the six
    that structure the app. The ordering test reads each row's accessible name
    now._
  - _Standing bar: `npm test` **225 passing** (36 files), `npm run e2e` **22
    passing**, `npm run a11y` **0 violations across six states** (an expanded
    card got its own scan), keyboard walkthrough **all steps passing** —
    including a new step 2b for the disclosure, and with §7's friction figures
    unchanged (4 tabs to the search field, 20 from there to the canvas)._
  - _Two notes on the E2E run. The two Phase 2 pixel-differencing specs in
    `canvas-scale.spec.ts` take 33s and 39s against a 30s default timeout in
    this container and time out under load; they pass with headroom
    (`--timeout=90000`), and **the same two fail identically on the
    pre-Phase-3 commit**, so it is this machine's speed against
    `getImageData` serialisation, not a regression. Separately,
    `PlotDefinitionPage.test.tsx` got about **three times faster** — ~6s where
    it was ~18–19s — because the palette is now a fraction of the DOM it was._

### Phase 4 — Plot & conditions panel

- Shape picker → three visual tiles (rectangle / L / circle glyphs drawn with the actual
  aspect from current dimensions), selected tile highlighted; dimension inputs beneath
  with unit suffixes inside the field ("3 m"); "Use this shape" becomes a primary
  button; errors inline under the field they concern.
- Conditions: flatten the fieldset nesting to labelled groups on one card; selects
  become segmented controls where options ≤4 (light level, pH, moisture); soil group
  behind a "Describe your soil (optional)" disclosure; region picker one select.
- Warnings dock (bottom of right panel): count badge by severity ("2 ⚠ 1 ℹ"), each
  warning a small card — severity icon, reason, "show me" (existing `onFocusPlacement`)
  which selects _and pans/zooms to_ the placement. Empty state: "No problems — looking
  good 🌿".
- **Acceptance:** full tweak loop (change shape → palette re-ranks → warnings update)
  happens with zero vertical page scroll at 1440×900.

### Phase 5 — Play, persistence, delight

- **Undo/redo** for placements + plot shape (Zustand temporal middleware or a simple
  history stack in the stores); header buttons + Ctrl+Z/Ctrl+Shift+Z.
- **Persistence:** serialise plot + placements + conditions to localStorage (the
  user-crops store may already have persistence patterns to copy); restore on load;
  "New design" resets.
- **Multiple designs:** a simple named-designs switcher in the header (save/load/
  duplicate/delete from localStorage). This is the "play with different garden ideas"
  feature, and it's cheap once serialisation exists.
- **Starter template:** first-run offers "Start with an example bed" that loads a small
  pre-arranged plot — instant demonstration of what the app does.
- Micro-polish sweep: 120–200ms transitions on hover/expand/collapse, drag ghost
  slightly enlarged with shadow, `prefers-reduced-motion` honoured, favicon + header
  wordmark (the 🌱 can stay — it's charming), styled focus rings everywhere.

### Phase 6 — Nice-to-have (defer freely)

- Sun-direction indicator on the canvas tied to the light-level setting.
- Seasonal view: tint markers by whether the selected planting month is in each crop's
  sow window.
- Companion-suggestion lines drawn between markers on hover of a suggestion.
- Print stylesheet for the exported plan.

---

## Part 4 — Quick wins (if a session wants sub-day impact before Phase 1)

1. Global stylesheet with the Phase-0 tokens, page background, button/input restyle.
2. Scatter-on-add fix for centre-stacking (small pure function + tests).
3. Palette rows collapsed to compact by default with an expand toggle.
4. Raise `AppShell` max-width to ~1100px and put palette and canvas side by side with
   a two-column grid — a crude interim version of Phase 1's core benefit.
5. Scale-to-fit the canvas to its container width.

## Part 5 — Risks & regression guards for implementing sessions

- **E2E and a11y suites are the safety net — run them every phase**
  (`npm run e2e`, `npm run a11y`, plus `npm test` for component tests). Many specs
  select by heading text and aria-labels; renaming/restructuring requires updating
  specs deliberately, never deleting assertions to get green.
- **Keyboard paths are contractual** (ADR 0026): Add-to-plot button, arrow-key nudge,
  Previous/Next selection, Delete/Backspace removal, skip link. Every phase keeps them.
- **Contrast:** any new colour pairing for text must clear 4.5:1 (the band colours were
  hand-tuned for this — see `PlantPalette.tsx`'s comment for the method).
- **No CDN assets** (offline-capable PWA is a design goal): self-host fonts or use
  system stacks.
- **Konva vs DOM split** (ADR 0017): dnd-kit owns palette→canvas handoff, Konva owns
  everything after landing. The redesign doesn't change that boundary.
- Inline styles migrate to the token system as components are touched; don't leave a
  half-and-half mix within one component.
