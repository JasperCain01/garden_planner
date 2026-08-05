# 0035 — Printing the plan, and three nice-to-haves declined with their measurements

- **Status:** Accepted
- **Date:** 2026-08-04
- **Phase:** UI redesign Phase 6 — nice-to-have (defer freely)
  ([`docs/ui-aesthetic-review.md`](../ui-aesthetic-review.md))

## Context

Phase 6 is the last phase and the only one the review marks optional. "Defer
freely" is in its heading, and it changes what the phase's deliverable is.

The other five phases each had a finding behind them — a 640px column, a
228×168px canvas, a palette with no crops visible, 590px of overflow, a refresh
that lost your garden. Phase 6 has none. It is four ideas, and **three of them
rest on premises this repo contradicts**:

- there is **no notion of compass direction anywhere** in `app/src` or
  `packages/engine/src` — the only hits for north/orientation are the L-shape's
  single offered rotation and `spacing/packing.ts`'s row orientation — and light
  level is not a direction but one of `full-sun | partial-shade | full-shade`
  for the whole plot;
- **8 of 144 shipped crops (5.6%) carry a `seasons` block at all**, and
  `plantingMonth` is optional and absent from `DEFAULT_CONDITIONS_INPUT`;
- a `CompanionSuggestion` names a crop that by construction is **not on the
  plot** (`warnings/companions.ts`: "a candidate already among the placements is
  skipped"), so there is no second marker for a line to reach;
- and the exported plan is a **PNG**, not a page (ADR 0020), while
  `grep -rn "@media print" app/src` returned nothing at all.

So the deliverable is not "four features". It is each bullet investigated
against the code and the data, built if it survives contact, and recorded with
its reasoning if it does not. **One was built; three were declined.** This ADR
is mostly the three, because a bullet declined without a reason is
indistinguishable from a bullet forgotten.

**This phase had no acceptance criterion either**, which is the same hole Phase
5 found and answered the same way — state one first, and enforce it in a spec
(`e2e/print.spec.ts`, alongside `workspace-layout.spec.ts`,
`canvas-scale.spec.ts`, `palette.spec.ts` and `plot-settings.spec.ts`):

> At 1440×900, printing the open plan produces a **document**: every placed
> crop, every warning and every companion suggestion the app is showing reaches
> the paper in full — nothing clipped by a box that only scrolls on a screen —
> the plot picture fits inside the page width, and neither the 144-crop palette
> nor a single control prints.

And the number it exists to change, in the way Phase 4's was 590px → 0 and
Phase 5's was 0 placements surviving a reload → all of them: **sheets of A4,
9 → 2.**

## Decision

### 1. No sun-direction indicator — the app has no direction to point in

**Declined, and it cannot be built as written.** "Tied to the light-level
setting" reads as though light level implied a direction. It does not: `light`
is a single `LightRequirement` for the whole plot, deliberately the same enum a
plant's requirement uses so `lightRequirementRank` can measure the distance
between them (ADR 0004 §4). Nothing in the plot's description — outline,
conditions, climate — says which way it faces.

Three options were weighed:

- **Invent an orientation input.** This is the one that would actually make a
  north arrow honest, and it is much larger than a nice-to-have. Orientation
  would be part of a **design** rather than view state (`state/design.ts`),
  which means a stored-format change and a `DESIGNS_STORAGE_VERSION` bump with
  its "an unrecognised version is a fresh start, not a repair job" rule
  (`state/design-codec.ts`); plus a new control in the 300px column whose
  vertical budget is the whole subject of ADR 0033 §1; plus a decision about
  what the engine should then _do_ with it, which is engine work this phase is
  explicitly barred from. A field the app stores and nothing reads is worse than
  no field.
- **Draw the light level on the canvas without pretending to be a compass** — a
  sun glyph, say, captioned "Full sun". Declined as redundant: the light level
  is already permanently on screen, 300px away, as a segmented control that
  names all three options and shows which is chosen (ADR 0033 §2). Restating it
  on the stage buys nothing and costs a third meaning on a scene whose marker
  colour already carries category (ADR 0032) and whose badges carry severity
  (ADR 0026).
- **Decline.** Taken.

The thing not to ship was an arrow that looks like it knows where south is, and
the honest resolution is that the app never lacked the light level — it lacked a
compass, and a compass needs data that does not exist. `canvas/grid.ts`'s doc
quotes the review's §2.5 ("No grid, no ruler, no north/sun indicator"); Phase 2
answered the first two, and this ADR is the answer to the third. The one place
the light level was genuinely missing is the _printed_ plan, and §4 puts it
there.

### 2. No seasonal tint — the dataset would tint 6% of markers and 0% of the starter bed

**Declined on a measurement, and the measurement is the finding.** Counted
against `data/plants.json` at this commit:

|                                               |                     |
| --------------------------------------------- | ------------------- |
| Crops with a `seasons` block                  | **8 of 144** (5.6%) |
| Crops with a `seasons.sow` window             | **8 of 144**        |
| Crops in the example bed with either          | **0 of 5**          |
| `plantingMonth` in `DEFAULT_CONDITIONS_INPUT` | **absent**          |

The eight are apple, broad bean, Brussels sprouts, Jerusalem artichoke, pear,
pumpkin, raspberry and swede — the curated set, and only those.
`suitability/season.ts` says so in its own module doc, and `PlantPalette.tsx`'s
disclosure already tells the user in so many words that "most of today's dataset
has no hardiness, soil or season data".

Three things follow, and any one of them would be enough:

1. **The honest version needs three states, not two.** "In its sow window",
   "outside it" and "no sow data at all" are different claims, and 136 crops are
   the third. A two-state tint would assert "out of season" about 136 crops the
   dataset says nothing about — which is precisely the failure mode
   `suitability/conditions.ts` avoids by never defaulting `plantingMonth` to the
   current month.
2. **The default plot has no planting month**, so the feature's input is unset
   until the user goes and picks one. The starter bed the app offers on first
   run would show nothing whatever this was built as.
3. **It would be a third meaning in colour on a 40px disc** that already carries
   category as its fill and severity as a badge, and `docs/accessibility.md` §2's
   standing rule is that colour is never the only signal — so it would need a
   non-colour channel too, on a canvas axe cannot see.

Note also that the app **already visualises the planting month**, in the place
that has room for words: the palette re-ranks on it, because the season
dimension scores it and `scoreSowingMonth` returns a sentence ("March falls
inside its February–May sowing window"). That is an argument against the tint
rather than for it — the same information, on 8 crops, is already legible as
text.

**The finding this bullet produces is a data finding, not a UI one — and it
lands on a row that already exists.** `WORKPLAN.md` §5.2's backlog has
"Hardiness/season data covers 8 of 144 crops", disposed as a data gap the engine
already reports per crop with a confidence figure, and unblocked "only by a new,
freely-licensed source with cultivar-level data" — Stage 1.2 is still ⚠️ partial
and its PFAF/Permapeople adapters are **not planned** (ADR 0006's dated note,
ADR 0023's context), so this will not arrive by ingesting another source. What
this phase adds to that row is that it is now blocking a **UI** feature as well
as an engine dimension, and the three-state requirement above is the design
brief for the day it clears. Saying that is more use than a tint that 94% of the
dataset cannot participate in.

### 3. No companion lines — the engine emits no pair to draw one between

**Declined because the bullet is false as written**, and the engine says so
explicitly. `warnings/companions.ts`: "for each crop already placed, what else
the dataset says grows well beside it **and isn't already on the plot** … a
candidate already among the placements is skipped: there's nothing to suggest
about a crop the user has already put in the ground." A `CompanionSuggestion` is
`{ forPlacementId, suggestedPlantId, … }` — one end is a marker, the other end
is a crop that is guaranteed _not_ to be one.

Verified against the starter bed rather than taken on trust. Carrot and onion —
the dataset's one `well-supported` companion pair — are both planted, and the
dock's two suggestions are **Lettuce** (for carrot) and **Watermelon Radish**
(for beet), neither of which is on the plot. There is no line to draw.

That leaves two things the review might have been reaching for, and both were
weighed:

- **"These two belong together" feedback for a pair already planted.** This is a
  real gap — placing two antagonists produces a warning, placing two companions
  produces silence — but it is a _different feature_, and the engine's exclusion
  of it is a decision with `DESIGN.md` §1 step 4 behind it, not an oversight.
  Building it in `app/src` to avoid touching engine code would put a second,
  contradicting definition of "companion" one directory away from the first.
  Declined: inventing a feature the engine deliberately declines to emit is the
  exact shape of forcing a bullet that the phase's own "defer freely" heading
  warns against.
- **A better way to show where a suggestion attaches.** "Show me" already
  selects `forPlacementId` and pans the viewport to it (ADR 0033 §6), so
  anything here has to be more than that — and the suggestion's own sentence
  already names the placed crop it is for ("Gardeners traditionally say Carrot
  grows well alongside lettuce…"). Declined as already answered.

**And hover is pointer-only**, which is the other reason to leave this. ADR 0026
makes every interaction's keyboard path contractual; a hover-only affordance is
the exact shape of thing that rule exists to catch, and a keyboard equivalent
for "hover a suggestion" would be a fourth control in a dock ADR 0033 §1 fought
for the height of.

### 4. A print stylesheet for the app, not a better PNG — and what the sheet is

**Built.** Two different features were hiding in one bullet, and they are not
the same work:

- **Make the app printable.** There was no `@media print` anywhere in `app/src`,
  so printing the workspace printed the workspace: measured in Chromium at
  1440×900 with the example bed on the plot, **9 sheets of A4**, of which five
  were the 144-crop palette, with 159 controls on them and the warnings dock
  still capped at 45% of a column that does not exist on paper — 114px of it,
  one of its two items, below the fold of a box nobody can scroll.
- **Improve the exported PNG.** Not done, and the reason is that it is not
  broken. ADR 0020's export is a deliberate snapshot: the rasterised stage plus a
  plain-text key of the crops and the conditions, at a fixed density so the same
  plot always exports the same size. Its known limits are all _"a snapshot, not
  a save file"_ choices, not defects. Between a feature with a 9-sheet defect
  behind it and one with none, the phase went where the defect was.

The sheet is the workspace turned into a document, and three rules shape every
rule in it — they are written out at the top of `styles/global.css`'s print
block, which is the hub the per-component halves point back at:

1. **No print-only DOM.** Everything on the sheet is content the screen already
   shows. This is what makes the change provably free of accessibility cost:
   nothing is added to the accessibility tree, no tab stop moves, and there is
   no invisible-on-screen text that axe cannot see and a screen reader can.
2. **A pane that scrolls on screen must not be a box that clips on paper.**
   Every viewport-height frame, cap and scrollport is released.
3. **A control is an affordance, and paper has none.** `button { display: none }`,
   with exactly one documented exception.

What that leaves, in order: the wordmark and the open design's name as a title
block; the plot picture; the crop key; the growing conditions; the problems and
suggestions. Four omissions are decisions rather than side effects:

- **The plants column does not print.** It is the single biggest thing on the
  sheet and it is a catalogue of what you _could_ plant, which is the one thing a
  finished plan is not about. What is actually planted is drawn on the plot and
  listed in the key beneath it.
- **Neither does the shape panel** — the one `Panel` that carries a class of its
  own, purely so the stylesheet can find it. Its tiles, number fields and Apply
  button are how you _change_ the plot; what they say is already on the picture,
  where Phase 2 put the dimension labels. Its one line of prose ("Fine-tune the
  outline with Edit shape on the plot") is an instruction for a control that is
  not there. **"Growing conditions" is kept for the opposite reason**: it is the
  only place on the sheet that says what kind of plot this is a plan _for_ — and
  it is where the light level from §1 lands.
- **The selected-placement readout and the tally's headline sentence go.** Both
  are screen states — "the selected placement's plant, or the most recently
  placed one" — and on paper there is no selection and no most-recent, so they
  read as one crop out of five singled out for a reason the sheet cannot explain.
- **The header's designs button is the one `button` that prints**, flattened to
  text. It is the only place in the app the open design's _name_ is written, and
  a plan with no idea which plan it is is not a plan. Undo and redo go: a control
  whose entire meaning is "the state you were in a moment ago" says nothing about
  a plan printed from the state you are in now.

Two smaller ones, both about colour and both from `docs/accessibility.md` §2's
standing rule. The severity-coloured borders and the evidence chips are left
alone, because their glyph and their word already carry the meaning without the
colour (ADR 0026) — but the **segmented control's selected option gets
`print-color-adjust: exact`**, because there the fill is the only thing
distinguishing "Full sun" from the two options beside it, and a browser drops
background colours when printing by default. That component's own stylesheet had
already reasoned about this medium — "the fill inverts rather than merely
tinting, which survives a greyscale print" — which is true only if the fill
prints at all.

### 5. The print layout and the canvas's `ResizeObserver` are a loop, and the observer stands down

This is the one thing in the phase that is not CSS, and it was found by
measurement rather than by reasoning.

On screen the canvas viewport is a fixed-height pane and `useCanvasScale.ts`
fits the plot to it. Under the print layout that pane becomes an ordinary block
as tall as its contents — and its contents are the plot, whose size the observer
decides. Measured in Chromium: the stage went **582 → 487 → 387px** on
successive frames, on its way to nothing.

Rasterising a PDF never triggers it — that snapshot is synchronous and the
observer's callback never gets a turn — which is exactly what makes it the
dangerous kind of bug. The path that _does_ trigger it is a real user holding
**print preview** open, where the page stays live and print styles stay applied
for as long as the dialog is up.

`useMeasuredViewport` therefore ignores a measurement taken while
`matchMedia('print').matches`, guarded for jsdom exactly as
`ui/usePrefersReducedMotion.ts` is. **Freezing it is the right answer rather than
a workaround for one**: the picture on the sheet should be the picture that was
on the screen, and if it is wider than the paper, `styles/global.css` scales it
down in CSS — where no observer can see it happen. That scaling is also the only
place in this codebase that overrides an inline style with `!important`, because
the sizes it is overriding are ones Konva writes inline and a stylesheet cannot
out-specify any other way.

## Alternatives considered

- **Building all four bullets anyway.** Rejected as the worst available outcome
  short of skipping them silently: three of the four would have shipped
  something that asserts more than the data supports (a compass with no
  orientation, a tint on 6% of crops, a line between a marker and a crop that is
  not on the plot).
- **Adding an orientation field to `state/design.ts`** so §1 could be built.
  Rejected in §1 — a stored-format change, a `DESIGNS_STORAGE_VERSION` bump, a
  new control in the tightest column in the app, and engine work this phase may
  not do, for a nice-to-have.
- **A two-state seasonal tint**, ignoring the "no data" case. Rejected in §2: it
  asserts "out of season" about 136 crops the dataset says nothing about.
- **Deriving placed companion pairs in `app/src`** so §3 could draw lines.
  Rejected in §3: a second definition of "companion" one directory from the
  engine's, for a feature the engine excludes on purpose.
- **Improving the exported PNG instead of the print path.** Rejected in §4 on
  where the defect was: 9 sheets versus a PNG whose limits are all recorded
  choices.
- **Print-only DOM** — a title block, a conditions summary sentence, a colour
  legend for the canvas's category fills. Rejected in §4 as rule 1: content the
  screen never shows is content no keyboard, screen reader or axe run in this
  repo can check, and everything it would have added is already on the page.
  (The category legend is the one real casualty, and it is the same limit the
  PNG legend has had since ADR 0020: the markers label themselves with the crop's
  name at any scale past 0.9 px/cm and the default plot fits at ~1.9, so the
  picture and the key name the same crops either way.)
- **Forcing every `<details>` open for print**, so a collapsed "Describe your
  soil" would still print. Rejected: there is no cross-engine way to do it in
  CSS, and the honest reading is that a disclosure the user closed is one they
  chose not to look at. A plan is a snapshot of the workspace as it stands.
- **Forcing `@page { size: A4 }`.** Rejected: it mis-scales every US-Letter
  printer, and the sheet has no fixed geometry that needs a particular size — it
  reflows. Only the margin is set.

## Consequences

- **The number this phase exists to change: sheets of A4, 9 → 2**, at 1440×900
  with the example bed placed. Alongside it: **159 printed controls → 1**, the
  palette's **144 rows → 0**, and the warnings dock's **114px of clipped content
  → 0**, which is **1 of its 2 items reaching the paper → 2 of 2**.
  `e2e/print.spec.ts` holds all of it, and rasterises a real PDF for the page
  count because `emulateMedia({ media: 'print' })` applies the print stylesheet
  but keeps laying the page out in the browser's viewport — it measures the
  styles, not the pagination.
- **Nothing on screen changed.** Every rule this phase added is inside `@media
print`, so `e2e/workspace-layout.spec.ts`, `e2e/canvas-scale.spec.ts`,
  `e2e/plot-settings.spec.ts` and `e2e/a11y.spec.ts` are untouched — including
  the pixel-differencing specs, which count changed pixels between two readings
  of the stage and would have noticed anything drawn on it. The three declined
  bullets are the reason the stage was not drawn on.
- **The header's tab stops are unchanged** — 1 at rest, 2 with something to
  undo, 3 with a redo available (`docs/accessibility.md` §10). Rule 1 is what
  guarantees it: there is no new DOM to be a stop.
- **`app/src/plot/PlotDefinitionPage.tsx` gained one `className`** and nothing
  else. It is the only TSX change in the phase besides `useCanvasScale.ts`'s
  four-line guard.
- **`useMeasuredViewport` now has a media query in it**, which is the second
  place in `app/src` that reads one in JavaScript rather than in CSS. The first,
  `usePrefersReducedMotion`, is there because a stylesheet cannot reach inside a
  canvas; this one is there because a stylesheet's medium can reach a
  `ResizeObserver`. Both are noted in each other's docs.
- **`npm test` is unchanged at 304** — the phase adds no unit-testable pure
  function, which is itself a fact about it: a stylesheet's assertions are
  browser measurements. `npm run e2e` goes 35 → **39**.
- **The dataset finding in §2 stands as work, not as a decline.**
  `WORKPLAN.md` §5.2's "Hardiness/season data covers 8 of 144 crops" row gains a
  Phase 6 addendum: it is now blocking a UI feature as well as an engine
  dimension, and the seasonal view becomes buildable the day it clears — at
  which point this ADR's three-state requirement is the design brief for it.
