# 0034 — What a design is: named designs in storage, and one undo history over two stores

- **Status:** Accepted
- **Date:** 2026-08-04
- **Phase:** UI redesign Phase 5 — play, persistence, delight
  ([`docs/ui-aesthetic-review.md`](../ui-aesthetic-review.md))

## Context

The review's §2.7 lists what makes the app hard to play with: "No undo/redo… no
localStorage persistence of the arrangement (refresh loses the design)." Phase 5
is the phase that fixes both, plus a designs switcher, a starter bed and a
micro-polish sweep.

**This phase had no acceptance criterion.** Phases 0–4 each carry a testable
line in the review; Phase 5 is five bullets and a polish list, with no number in
it. That is not licence to skip the measurement step, so the criterion was
stated before anything was built:

> At 1440×900, a design built in the browser survives a **full round trip** —
> place → undo → redo → **reload** → the same design — with every restored value
> passing the engine's own validators rather than a cast.

And the number this phase exists to change, in the way Phase 4's was 590px of
internal overflow → 0: **placements surviving a reload: 0 → all of them.**
`app/e2e/persistence.spec.ts` holds both.

**Three phases deferred work here explicitly, and it is collected rather than
rediscovered.** ADR 0030 §consequences: a dragged palette card is clipped at the
sidebar's edge, and "the fix is a dnd-kit `DragOverlay`, which is what Phase 5's
drag ghost is". ADR 0031 §alternatives: the exit fade on delete was declined
because "that is history state, and Phase 5 is building history state (undo/redo)
properly". `canvas/PlotCanvasSection.tsx`: "Clear all" confirms "because it
throws away every placement and there is no undo until Phase 5".
`state/placements-store.ts`: `clearPlacements` is "destructive and, for now,
unrecoverable — undo is Phase 5's job". Each gets an answer below, including the
one that turns out to be "no".

Seven questions needed answering. The first is not in the review's bullet list,
for the same reason the vertical budget was not in Phases 3 and 4's: everything
else either writes it or reads it.

1. What **is** a design?
2. What happens when a saved design names a crop that no longer exists?
3. What may undo touch, given ADR 0015's one-store-per-concern thesis?
4. How is restored state trusted, and does restore work offline?
5. Does "Clear all" keep its confirmation dialog?
6. Where does the switcher go, in a header that is the app's first tab stop?
7. Which micro-polish items are actually outstanding?

## Decision

### 1. A design is the plot, the conditions and the planting — stored by reference

`state/design.ts` defines it: `plot-store`'s `region` and `conditionsInput`, plus
`placements-store`'s `placements`. It is a _derived view_ over stores that
already exist, not a fifth store — ADR 0015's rule is about where state is
**owned**, and this owns none.

Three omissions are decisions:

- **`canvas-view-store` is not in a design.** Zoom, the outline draft, the corner
  selection and Phase 4's `revealRequest` are how the plot is being _looked at_.
  Scrolling the plot is not an edit, so it must not land in the history; and a
  saved design that restored someone else's zoom would be restoring a window,
  not a garden.
- **`user-plants-store` is not in a design** — see §2, where a design carries the
  crops it _references_ without the store becoming persistent.
- **`selectedId` is not in a design.** Which marker is highlighted is view state.
  (It is carried per _history step_ — see §3 — which is a different claim.)

**Stored placements hold a `plantId`, not a `Plant`, and that reverses nothing.**
`placements-store` deliberately holds a whole `Plant` per placement and its
reasons are good — for memory: the canvas needs the name and category to render
and `fitPlant` needs the record anyway. Written down, the arithmetic is
different. Measured against the shipped dataset:

|                                            |                                                |
| ------------------------------------------ | ---------------------------------------------- |
| a serialised `Plant` (potato)              | **3,223 bytes** (89% provenance + antagonists) |
| a stored placement `{ id, plantId, x, y }` | **104 bytes**                                  |
| a 20-placement design, by reference        | **2,050 bytes**                                |
| the same design with plants embedded       | **73,610 bytes**                               |
| designs that fit a ~5 MiB origin quota     | **~2,557** vs **~71**                          |

`state/design-codec.ts` owns the translation in both directions, so the
in-memory shape and the stored shape are each right for their own job and
neither leaks into the other.

### 2. A user crop travels with the design; a deleted shipped crop is dropped by name

A `plantId` can dangle, and not hypothetically. ADR 0025 **deleted 24 crops**
from the shipped dataset on purpose, and that dataset is a build artifact that
changes between deploys. User-defined crops are worse: they are session-scoped by
explicit design, stated in three places (`state/user-plants-store.ts`'s doc,
`docs/stage-3.1-brief.md`, `WORKPLAN.md` Stage 3.1 — "User crops live only for
the session; there is no persistence layer"), so a design mentioning one would
dangle the moment the tab closed.

Two different problems, and they get different answers rather than one
compromise:

- **A user crop travels _with_ the design**, as the `UserPlantInput` the add-crop
  form produced. `user-crops/plant-to-input.ts` is the projection and it already
  existed, for editing; restoring runs it back through `createUserPlant`, the
  same trust boundary the form uses, so no new validator appears anywhere.

  This is deliberately **narrower than persisting the store**, which is what
  makes the three written statements still true: `user-plants-store` writes
  nothing, has no rehydration step, and is still session-scoped. A crop outlives
  the tab only for as long as a design that uses it does — which is the honest
  reading of what those statements were protecting, namely that a stray crop
  should not accumulate in a user's browser forever.

- **A shipped crop that is gone is gone.** Its placement is dropped and the load
  says which: "'Old garden' lost 1 plant: sea-buckthorn is no longer in the crop
  list." A **tombstone** was considered and rejected: a marker's size _is_ the
  crop's footprint and its colour is its category (ADR 0031), so a placement
  whose record no longer exists is one the canvas cannot draw honestly — it would
  be a grey square of arbitrary size, sitting in the middle of a bed, changing
  every `fitPlant` figure around it.

### 3. One history over the two stores a design spans, and nothing else

The review offers "Zustand temporal middleware or a simple history stack in the
stores". Per-store history is the option that cannot work: a real edit loop
reshapes the plot and then moves a plant, crossing `plot-store` and
`placements-store`, so per-store stacks give a Ctrl+Z that sometimes undoes a
shape change and sometimes a placement depending on which store was touched last
— and no way at all to undo "Clear all" once the pointer has been near the shape
form.

`state/design-history.ts` therefore holds one stack of whole `Design` values.
This does not contradict ADR 0015: its thesis is that each store _owns_ one
concern, and this file owns none. Four things make it work:

- **Edits are noticed by subscription, not by call site.** Every action in both
  stores would otherwise have to remember to record, and the one that forgot
  would be a silent hole in the one feature whose whole promise is that it covers
  everything.
- **Change detection is three `===` comparisons.** Both stores build a new object
  for the field they change and leave the others alone, so identity changes
  exactly when the design does — and `selectPlacement`, which is not an edit,
  changes none of them. Exact, not approximate, and cheap enough for every write.
- **A gesture is one step.** Dragging a corner calls `setRegion` on every pointer
  move; without coalescing, one drag would cost dozens of presses of Ctrl+Z to
  undo. Two consecutive changes merge only if they are within 600ms **and** the
  design has the same _structure_ — same placement ids in order, same corner
  count, identical conditions — **and** the previous step was itself a movement.
  That last clause is what keeps "place a crop, then nudge it" as two steps: the
  pair passes the structure test, and merging it would make one Ctrl+Z remove a
  plant the user never asked to remove.
- **A step carries the selection it happened in.** Not because a selection is
  part of a design — it is not, and selecting still costs no step — but because
  the canvas's arrow keys act on the selected placement. The keyboard walkthrough
  caught this: a redo that put a plant back without selecting it left a keyboard
  user pressing arrows at nothing.

Deliberately outside the history: the canvas view (zoom, pan, edit-shape mode,
"Show me"), the crop library (`user-plants-store` — undoing a plot edit must not
take a crop away, least of all while a placement points at it), and design
switches (loading, duplicating or deleting clears both stacks, because an undo
across a switch would splice two gardens together). The stacks are memory and do
not survive a reload, which is what every editor does.

### 4. Restored state is untrusted input, and the engine's own validators are the gate

The review says "the user-crops store may already have persistence patterns to
copy". It has not: before this phase `grep -rn "localStorage" app/src` returned
nothing outside comments. What existed was a decision _against_ persistence, so
this phase reverses a design choice rather than extending one — which is why §2
has to answer three written statements rather than cite them.

Two things follow, and the engine anticipated both. `climate/schema.ts` already
names "a malformed `lat`/`lng` from, say, a corrupted `localStorage`" as a reason
its schema exists, and `suitability/conditions.ts` says `PlotConditionsInput` is
a separate schema partly so the UI keeps "a shape that round-trips cleanly
through URL/`localStorage` state". So nothing is cast:

| restored value      | gate                                  |
| ------------------- | ------------------------------------- |
| `region`            | `safeValidatePlotRegion`              |
| `conditionsInput`   | `PlotConditionsInputSchema.safeParse` |
| a user crop         | `createUserPlant`                     |
| a placement's plant | resolved against the live plant list  |

A design that fails a gate is **skipped, not repaired and not fatal**: the rest
of the library loads and the switcher says what went. Mending a corrupt outline
would put a shape on screen the user never drew; throwing would lose every other
design to one bad one.

**Restore is synchronous and happens before the first render.** `main.tsx` calls
`restoreDesigns()` before `createRoot().render()`, so the first paint is the
user's garden rather than the default bed replaced a frame later. It can be
synchronous because everything it needs is local — `localStorage` is a
synchronous API and the crop list is a bundled import — which is also why it
works **offline**, as the service worker means a reload frequently has no network
(`e2e/offline.spec.ts`).

**There is no "Save" button.** The open design autosaves on every edit, debounced
200ms so a corner drag is one write rather than sixty, and flushed on `pagehide`
and on `visibilitychange` — the events that cover the reload the acceptance
criterion turns on. A save _command_ only earns its place when unsaved work can
exist, and the criterion is a promise that it cannot. (`beforeunload` is
deliberately not used: it is the listener that disqualifies a page from the
back/forward cache.)

### 5. "Clear all" loses its confirmation, and Delete keeps one

The dialog's own comment gave its reason: clearing "throws away every placement
and there is no undo until Phase 5". With undo, the justification is gone, and a
confirmation for a reversible action is a click that buys nothing.

**What replaced it is a better affordance, not nothing.** The header's Undo
button names what it will undo — `aria-label="Undo clearing the plot"`, derived
from `design.ts`'s `describeEdit` — so a user who has just emptied their plot is
told the way back exists and what it will bring. A dialog asked a question; this
answers one.

The rule is **reversibility, not destructiveness**, and it is applied twice:
deleting a saved design still confirms, inline in the switcher, because the
history is per-design and cannot reach it. The confirmation is inline rather than
a second `<dialog>`, because a modal inside a modal is a focus trap inside a
focus trap and the browser owns both.

### 6. The switcher is one header button, and the header's cost is what it earns

`routes/AppShell.tsx` was an `<h1>` wrapping a `<Link>` — the whole header, and
the app's **first tab stop**, immediately followed by the two skip links that
bypass the palette. Anything added here lands _between_ them and is paid by every
keyboard user on every load.

So the review's "save/load/duplicate/delete from localStorage" is **one** button
opening `designs/DesignsDialog.tsx`, not four controls in the band. That also
buys the switcher room to say which design is open, how many plants are on it and
when it was last edited — none of which fits on a chip in a 56px band.

Measured in Chromium, the header costs **one** extra stop on a fresh load, **two**
once there is something to undo, and **three** only after an undo has made a redo
available. That is better than the design intended and it falls out of the
buttons being honest rather than out of a trick: a `disabled` button is not in the
tab order, so a keyboard user pays for reach they actually have.

**The skip links were not moved above the header** to compensate. They point at
`#plot-canvas` and `#plot-settings`, which exist only on the workspace route, and
`NotFound` renders through the same shell — links to absent targets on that page
would be a worse fault than three stops. The chrome instead renders itself away
off the workspace route, so `NotFound`'s header is exactly what it always was.

**One row at 390px.** `AppShell.module.css` keeps `flex-wrap` at its default and
lets both children shrink; the design name truncates with an ellipsis (which
keeps it in the accessibility tree, where `display: none` would not) and the
wordmark drops to the body scale below 600px. A second header row is height taken
out of the canvas region `e2e/workspace-layout.spec.ts` measures.

**The starter bed is a toolbar button, not a first-run modal.**
`keyboard-walkthrough.mjs` waits on `text=Plot shape` four times as the whole
app's readiness signal, and `e2e/a11y.spec.ts` and `App.test.tsx` reach for the
header heading immediately on load — a dialog covering the workspace on first
paint would race all of them. The button occupies exactly the space "Clear all"
and the selection arrows take once something _is_ placed, so the toolbar's
busiest state is unchanged, and it comes back whenever the plot is emptied, which
a once-only prompt would not.

### 7. The sweep was audited, not redone — two items were outstanding

Of the review's micro-polish list, four were **already done** and re-doing them
is how a phase regresses one:

- **120–200ms transitions** exist as `--motion-fast`/`--motion-medium` (Phase 0)
  and are spent throughout.
- **`prefers-reduced-motion`** is honoured globally in `global.css` _and_ in JS
  for the canvas (`ui/usePrefersReducedMotion.ts`, because a stylesheet cannot
  reach inside Konva).
- **Styled focus rings** were Phase 0's, and are moved onto the visible element
  wherever a control is visually hidden (ADR 0032 §6, ADR 0033 §2).
- **The header wordmark**, including the 🌱 the review says can stay.

Two were genuinely outstanding:

- **The drag ghost**, deferred here by three ADRs. `palette/PlantPalette.tsx`'s
  `PaletteDragGhost` renders inside a dnd-kit `<DragOverlay>` at
  `PlotDefinitionPage`, so it is outside the crop list's clipping box entirely.
  The source card stops carrying an inline transform and dims in place instead.
  Two things nearby are load-bearing and were left alone: the `PointerSensor`'s
  4px activation distance (ADR 0032 §2 — a press that never travels is a click,
  which is what makes the card a disclosure as well as a drag source), and
  `resolveDrop`'s pointer-first drop point (ADR 0031 §consequences — dnd-kit's
  `delta` carries a scroll adjustment that once put a drop 12cm off target). The
  keyboard-drag fallback still works because dnd-kit computes
  `active.rect.current.translated` from the measured rect and the transform
  whether or not anything renders that transform.
- **The favicon.** `app/index.html` declared no `<link rel="icon">` at all. It is
  `pwa-icon.svg` — the manifest's own icon, already precached by the service
  worker — at `%BASE_URL%pwa-icon.svg`, so the mark in the tab is the mark on the
  home screen and it works on GitHub Pages' `/garden_planner/` base.

## Alternatives considered

- **Storing whole `Plant` records in a design.** Simplest, and it is what the
  in-memory store does. Rejected in §1 on measurement: 73,610 bytes for a
  twenty-placement design against 2,050, or ~71 designs in the quota rather than
  ~2,557, for data the app already ships in its bundle. It would also freeze a
  copy of each crop at save time, so a dataset correction would never reach a
  saved design.
- **Persisting `user-plants-store` outright**, which would also solve the
  dangling `user-` reference. Rejected in §2 because it contradicts three
  explicit written statements for more than the problem needs: carrying the crops
  _inside the design that uses them_ fixes the same dangle while leaving the store
  session-scoped, and it disposes of an unused crop automatically when the last
  design referencing it is deleted.
- **A tombstone placement for a crop the dataset no longer has.** Rejected in §2:
  a marker's size is the crop's footprint and its colour is its category, so
  there is nothing honest to draw. Naming it in a restore notice says the same
  thing without putting a lie on the canvas.
- **Per-store history, or `zundo`'s temporal middleware.** Rejected in §3: a
  design spans two stores, so a per-store stack gives an undo whose meaning
  depends on which store was touched last.
- **Time-only coalescing** for undo steps. One line simpler, and wrong: two crops
  placed half a second apart are two edits, and merging them would make one
  Ctrl+Z remove a plant the user never asked to remove. Structure is checked as
  well as the clock.
- **Making Ctrl+Z the primary undo path.** Rejected: ADR 0026 makes every
  interaction's keyboard path contractual, and a chord is invisible,
  undiscoverable and unavailable to anyone driving the app by switch or voice.
  The shortcut is an accelerator over two real buttons — and it stands down
  entirely inside a text field, where Ctrl+Z means the browser's own text undo.
- **Keeping the "Clear all" confirmation** and adding a line about undo to it.
  Rejected in §5: a dialog that tells you the action is reversible is a dialog
  arguing against its own existence.
- **A first-run modal for the example bed**, which is what "first-run offers"
  most directly suggests. Rejected in §6 for a concrete reason rather than a
  stylistic one: three test surfaces treat first paint as the app's readiness
  signal, and a dialog over the workspace races all of them.
- **An exit fade when a placement is deleted** — ADR 0031 declined it and pointed
  at this phase, on the grounds that animating an exit means "the canvas holding
  a copy of something the store has already forgotten. That is history state, and
  Phase 5 is building history state properly." Re-derived here, and **still not
  done**, because the premise turned out not to hold: the history is a stack of
  whole design snapshots, not a per-placement lifecycle, so a fade would still
  need its own "recently removed" list in the canvas — and that list now has a
  new way to be wrong, since an undo can put the placement back while its ghost
  is still fading and draw the same crop twice. Recorded rather than quietly
  dropped, and the honest version of the deferral is: undo was never the thing
  that unblocked this.
- **Restoring in a `useEffect` instead of before `render`.** Rejected in §4: it
  paints the default 3×2m bed and replaces it a frame later, which is a visible
  flash on every load of a saved design.
- **Four switcher controls in the header**, as the review sketches. Rejected in
  §6 on the tab-stop budget, which is the same argument ADR 0032 used to hold the
  palette to two focusable controls per row.

## Consequences

- **The number this phase exists to change: placements surviving a reload,
  0 → all of them**, with the design's outline and conditions alongside them and
  the engine's warnings recomputed from the restored state.
  `e2e/persistence.spec.ts` builds a design, undoes, redoes, reloads, and asserts
  the stored design is byte-identical either side.
- **A placement costs 104 bytes of storage rather than 3,223**, and a
  twenty-placement design 2,050 bytes rather than 73,610 — ~2,557 designs in a
  5 MiB origin quota rather than ~71.
- **The header is no longer one tab stop.** One extra at rest, two with
  something to undo, three with a redo available; the skip links still follow it.
  `docs/accessibility.md` §10 has the table.
- **`e2e/a11y.spec.ts` still scans eight states**, with the clear-all
  confirmation replaced by the designs switcher — scanned twice over, since its
  inline delete confirmation replaces the focused button in place.
- **A spec that loads the app twice now sees its own earlier work.** Playwright
  gives each _test_ a fresh context, not each navigation, and
  `canvas-scale.spec.ts`'s pixel-differencing helper reloads between the two crops
  it compares — so its second measurement started from a plot that still had a
  radish on it. `e2e/storage.ts`'s `startWithNoSavedDesigns` is the answer, and
  the same trap is disarmed in `keyboard-walkthrough.mjs`, which reloads three
  times for "a clean run of the rest of the journey" and would have gone on
  measuring tab counts through a canvas with crops on it without failing.
- **The walkthrough gained step 2c** (undo and redo from the header, by keyboard)
  and its step 0 counts one more Tab press. Its friction figures move by exactly
  that one: **5** tabs to the palette search field where it was 4; 20 from there
  to the canvas and 4 from the canvas to the width field, both unchanged.
- **`clearPlacements` is documented as recoverable**, and
  `PlotCanvasSection.module.css` lost the confirmation's button row.
- **`state/plot-store.ts` exports its defaults.** "New design" means _this_ plot,
  and a second 300×200 written in the designs store would be a second definition
  of the app's starting point.
- **`PaletteDragData` carries the suitability band** as well as the plant, so the
  overlay can draw the card the user picked up from the active drag's data alone.
  Nothing in `drop.ts` reads it.
- **Four new state modules and two new components**, with a test file each: the
  design shape and its two pure questions, the codec, the history, the library,
  and the header chrome. `npm test` goes 244 → **304**, `npm run e2e` 27 → **35**.
