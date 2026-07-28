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
  breakpoint).
- Palette (left) and canvas (centre) are now _always simultaneously visible_ → drag and
  drop becomes a short, natural gesture. Keep the dnd-kit wiring exactly as is.
- Right panel hosts: shape picker + outline editing controls, growing-conditions form,
  and the warnings list — the tweak-and-check loop sits beside the canvas it affects.
  Sections are collapsible accordions (conditions open by default).
- "Add your own crop" moves out of the flow entirely: a "+ Add your own crop" button at
  the bottom of the palette sidebar opening a modal dialog (focus-trapped, Esc to
  close). Same form inside, unchanged logic.
- The numbered "1./2./3./4." headings retire; the workspace _is_ the loop. Keep an
  `aria-label`ed landmark per region and keep the skip-to-canvas link (retargeted).
- **Acceptance:** at 1440×900 and 1920×1080 the canvas region occupies ≥50% of viewport
  area; palette→canvas drag completes without any page scroll; e2e specs updated;
  keyboard walkthrough (`keyboard-walkthrough.mjs`) still completes.

### Phase 2 — Canvas as hero

- **Scale-to-fit + zoom:** compute `pxPerCm` from the canvas container size (fit the
  padded region bounds, clamp to sane min/max), with −/＋/fit-to-screen controls and
  ctrl+scroll zoom; pan by dragging empty space when zoomed in. Kill the fixed
  `PX_PER_CM` (keep the helpers, parameterise the scale — `geometry.ts` already accepts
  `pxPerCm` as a parameter throughout).
- **Merge outline editing into the main canvas.** One plot picture, ever. An "Edit
  shape" toggle enters outline mode: corner/midpoint handles appear (port the SVG
  editor's interaction to Konva, or overlay the existing SVG at the canvas's scale);
  edge lengths render as labels while editing ("3.0 m"); exit returns to arrange mode.
  Section 1's separate mini-editor is deleted.
- **Ground the scene:** subtle grid at 50cm (fainter) / 1m (stronger) inside the plot;
  overall plot dimensions labelled outside the outline; canvas background `--soil-100`
  outside the plot, `--green-100`→soil gradient or flat tint inside; 1px inner shadow
  on the plot to lift it off the page.
- **Footprint-true markers:** marker radius = plant spacing footprint in cm × scale
  (min 12px for clickability), rendered as a soft category-coloured disc ("canopy") with
  the icon centred and a name label under it at zoom ≥ some threshold. A squash now
  visibly needs more room than a radish — spatial planning becomes visual. (Spacing data
  is already on the `Plant`; the feedback panel maths proves it.)
- **Fix centre-stacking:** "Add to plot" places at the first free position via a simple
  spiral/offset search from centre (pure function in `geometry.ts`, unit-testable).
- **Interaction feedback:** drop → 150ms scale-pop; selection → glow ring, not stroke
  tweak; hover → cursor + slight lift + tooltip (name, band, spacing); drag-over canvas
  → tint the plot interior, not the container border; deleting → fade-out.
- Canvas toolbar (top of canvas region, one row): zoom controls, Edit shape toggle,
  Clear all (confirm), Export image. Previous/Next placement buttons stay (keyboard
  path) but styled as compact icon buttons.
- **Acceptance:** default 3×2m plot fills the canvas region on first load; markers
  scale with footprint; three "Add to plot" clicks yield three visibly separate
  markers; export still works.

### Phase 3 — Palette redesign

- **Compact card** (one per crop): 40px icon on a category-tinted circle, name, band
  chip. That's it — ~64px tall, or a 2-col grid of square tiles. 144 crops scan in
  seconds.
- **Details on demand:** clicking the card (not dragging) opens a popover/expando with
  the summary, confidence, and per-dimension reasoning — the exact content currently
  inlined. Nothing is lost; it's just re-altituded.
- **Filters as chips:** category chips (colour-coded) + band filter ("Great fits" =
  excellent+good) + the existing search box and hide-unsuitable toggle, restyled.
  Sticky at the top of the sidebar.
- Unsuitable crops: keep visible-but-muted (current 0.6 opacity idea, plus greyscale
  icon) — honest and tidy.
- "Add to plot" becomes a small `＋` icon-button on the card (aria-label preserved);
  whole card remains the drag surface. Keep the sibling-not-nested DOM structure that
  the axe `nested-interactive` comment explains.
- A one-line legend at the sidebar top mapping category colours (matches canvas).
- **Acceptance:** ≥8 crops visible in the sidebar without scrolling at 900px height;
  reasoning reachable in one click; drag and keyboard paths intact.

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
