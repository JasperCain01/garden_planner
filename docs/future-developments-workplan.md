# Future developments workplan

**Origin.** The 2026-08-04 review of the UI-redesign branch proposed nine candidate
features. Seven were selected for implementation — all of them, eventually — so this
plan orders them for **total-cost efficiency**: the sequence that minimises rework
given that everything below will be built. (Dark mode and the sun-direction indicator
were not selected; the latter stays declined per ADR 0035 §1 until the conditions model
has an orientation for it to mean anything.)

**This plan does not start until
[`post-review-fixes-workplan.md`](./post-review-fixes-workplan.md) is done** and the
branch has merged to `main`.

## Why this order

The review's per-feature effort/complication ranking is not the build order, because
three of the seven change _models_ that the other four sit on:

- **Multi-bed (G4)** changes the deepest assumption in the codebase — one design, one
  region. Everything spatial is downstream of it. Every feature built before it against
  the single-region model is rework waiting to happen — so the features that _precede_
  it are only those that either (a) feed it (freehand drawing becomes its bed-creation
  gesture; the migration machinery becomes its schema bump), or (b) live in shared
  helpers it inherits unchanged (snapping).
- **Multi-select (G5)** changes the selection model (`selectedId` → a set), which
  row/block planting (G6) then reuses as its "act on a whole group" machinery.
- **The storage schema** bumps at G4 and again (minor) at G6. Export/import (G1) is
  therefore first: it establishes the migration policy _before_ any bump exists, and
  gives users a backup path before the riskiest phases touch their saved designs.
- **The calendar (G7)** is the one feature with no spatial dependencies at all, so it
  goes last, where it is built once against the final model and reworked never. It is
  also the only phase that can be freely re-slotted earlier if product priorities
  demand it — at the cost of one small selector-level rework after G4/G6.

```
G1 export/import ──► establishes migration policy ─────────┐
G2 snap-to-grid ──► shared conversion helpers ──► inherited by G3/G5/G6
G3 freehand draw ──► becomes "draw a new bed" ──► G4 multi-bed (schema v2)
                                                     │
                              G5 multi-select ◄──────┘ (built once, multi-bed-aware)
                                    │
                              G6 row/block planting (schema v2.x, reuses G5)
                                    │
                              G7 calendar (reads the settled model)
```

**Ground rules for every phase** — the same bar the redesign phases carried: keyboard
path and ARIA structure for every new interaction; axe green with new states scanned;
unit + E2E tests in the same change; no engine code unless a phase explicitly says
otherwise and records it; an ADR per phase recording the decisions and the roads not
taken; a measurable acceptance criterion stated _before_ the phase is built.

---

## G1 — Export & import a design as a file

_(review feature #1 · effort S · complications low)_

**Goal.** A design leaves the browser as a JSON file and comes back intact — sharing,
backup, and de-risking localStorage loss before later phases touch the stored format.

**Spec.**

- "Export design" in the designs switcher (`DesignsDialog.tsx`): serialise the active
  design via `design-codec.ts#toStoredDesign` wrapped in the same
  `{version, designs: [...]}` envelope `localStorage` uses — **one format, not two**.
  Download via a Blob anchor; filename from the design name, slugified.
- "Import design" beside it: `<input type="file">`, read as text, parse through
  `parseLibrary` — the identical trust boundary a page load uses, so a malformed or
  malicious file gets the identical skip-and-report treatment, and there is no second
  validator to keep honest. Imported designs get a **fresh id** (never adopt the
  file's — two imports of the same file are two designs) and load as the active design.
  Surface `parseLibrary`'s problems through the existing `restoreNotice` path.
- **The decision this phase exists to make: migration policy.** `parseLibrary`
  currently _rejects_ any version it doesn't recognise. That was right when the only
  writer was the same build; it is wrong once files outlive builds. Restructure to a
  migration ladder: `migrate(stored): StoredLibrary` stepping vN→vN+1, applied before
  validation, with unknown _future_ versions still rejected with the existing message.
  It is a refactor of shape, not behaviour (there is only v1 today) — but G4 and G6
  will each add a rung, and adding the ladder now means they add _a rung_, not the
  ladder under pressure.

**Touches.** `design-codec.ts`, `designs-store.ts`, `DesignsDialog.tsx` (+ CSS), new
unit tests, one E2E round-trip spec.

**Acceptance.** E2E: build a design (plants + reshaped outline + a user-defined crop),
export, wipe storage, import the file — the same design renders, the user crop
included; a tampered file (bad outline) imports as a reported skip, not a crash.
Unit: migration ladder passes v1 through untouched; rejects v99 with the existing
wording.

---

## G2 — Snap-to-grid

_(review feature #3 · effort S · complications low)_

**Goal.** A toolbar toggle that snaps placements and outline corners to the grid the
canvas already draws — tidy layouts on purpose rather than by pixel-hunting.

**Why second.** Trivial on its own, but its home matters: put the rounding in the
**shared conversion path**, and every later pointer feature — freehand corners (G3),
multi-drag (G5), block placement (G6) — inherits snapping for free instead of each
reimplementing it.

**Spec.**

- Pure helper in `canvas/geometry.ts`: `snapCm(point, stepCm)` (suggested step: the
  minor grid's 50 cm, falling back to 10 cm when zoomed past a threshold — decide by
  feel, record the number). Unit-tested, including the identity case when snapping is
  off.
- Apply at the **commit points**, not during visual drag: `useCanvasDropHandler` (drop
  position), `handlePlantDragEnd`, `moveCorner`/`nudgeSelectedCorner` (outline), and
  `firstFreePosition`'s result. The mid-drag ghost stays free-moving; the landing
  snaps — cheaper than live snap feedback and reads as intentional.
- Toggle in the canvas toolbar (a labelled pressed-state button, one tab stop),
  persisted in `canvas-view-store` — deliberately **not** part of a design (it is a
  view/editing preference, same reasoning as zoom; record beside `zoomFactor`).
  Keyboard nudges are already 10/50 cm steps, so they compose with snapping naturally.

**Acceptance.** Unit: snapped drop lands on an exact multiple; nudge from a snapped
position stays on-grid. E2E: with snap on, two separate drops at nearby points land at
identical y; with snap off, behaviour is byte-identical to today (regression guard).

---

## G3 — Freehand plot drawing

_(review feature #2 · effort M · complications low upstream, medium downstream)_

**Goal.** Draw an outline corner-by-corner on the canvas — the missing entry path
between "pick a preset" and "edit a preset's corners". **In G4 this same mode becomes
"draw a new bed", which is why it precedes it.**

**Spec.**

- A "Draw shape" mode alongside "Edit shape" (toolbar toggle; a fourth
  `canvas-view-store` mode flag beside `editingOutline`, mutually exclusive with it).
  Clicks append vertices to a draft polyline rendered with the existing draft-vertex
  styling; a click on the first vertex — or an explicit "Close shape" button, which is
  also the keyboard path — attempts to close.
- Closing runs `validateOutlineEdit`, exactly like corner edits: valid → `setRegion`
  and drop into ordinary edit mode with the new shape selected; invalid → the draft
  stays on screen with the engine's own message, the standing rule since
  `PlotOutlineEditor`.
- **Keyboard path (the accessibility bar is not optional):** in draw mode the arrow
  keys move a crosshair cursor (rendered on the scene, position in the view store),
  Enter/Space drops a vertex at it, "Close shape" closes. Same nudge steps as
  everything else; snapping (G2) applies to dropped vertices. Announce mode entry via
  the canvas's existing mode-sensitive `aria-label`, which already switches for edit
  mode.
- Replacing a non-empty plot's outline keeps placements (the standing reshape
  behaviour) — and the B3 stranded-placement affordance from the fixes plan is what
  makes that survivable, which is one more reason the fixes plan runs first.
- True freehand _tracing_ (smooth a scribble into a polygon) stays out of scope; note
  it in the ADR as the declined stretch — click-to-place is the whole value at a
  third of the cost.

**Touches.** `canvas-view-store.ts`, a new `useOutlineDrawing.ts` beside
`useOutlineEditing.ts`, `PlotCanvas.tsx` (crosshair + draft polyline + click handling),
`PlotCanvasSection.tsx` (toolbar), keyboard walkthrough (+ a new step), a11y scan of
draw mode, E2E spec.

**Acceptance.** E2E: draw a pentagon by pointer, close, plot commits and placements
survive; draw and close a triangle **from the keyboard alone**; an invalid
(self-intersecting) close leaves the draft and the message on screen. Walkthrough and
axe green.

---

## G4 — Multiple beds in one design

_(review feature #8 · effort XL · complications high — the model phase)_

**Goal.** A design holds several beds — separate outlines, one shared conditions input,
one palette, one warnings dock — arranged in one scene. **The deepest change in this
plan; everything after it is built against its model, which is the entire argument for
its position.**

**The model decision, stated before anything is built.** A design becomes:

```
Design { conditionsInput, beds: [{ id, name, region, offset }], placements }
Placement { id, plantId → plant, x, y, bedId }
```

- Placements stay **one flat list** with a `bedId` — not nested per bed — so
  `placements-store`'s API, the history's identity-comparison change detection, and
  every `placements.map(...)` consumer survive with minimal edits, and cross-bed
  operations (G5 multi-select, the calendar) never have to walk a tree.
- Each bed's `region` stays in its own local coordinate frame with a scene `offset`
  (beds don't share a frame, so a bed can be moved without rewriting its vertices —
  and single-bed designs migrate with `offset: (0,0)` untouched).
- Conditions stay design-level in this phase. Per-bed conditions are a real future
  want (a shady bed beside a sunny one) — declare it out of scope in the ADR rather
  than half-shipping it; the model leaves room (`conditionsInput` moves onto the bed
  in some later vN with a migration rung).

**Spec, by concern.**

- **Storage v2** — the second rung on G1's ladder. v1→v2: wrap the single region as
  `beds: [{id, name: 'Bed 1', region, offset: {x:0, y:0}}]`, stamp `bedId` onto every
  placement. Round-trip tests both ways; an exported v1 file (from before G4) imports
  cleanly forever.
- **Stores.** `plot-store` holds the beds array + an `activeBedId`; `setRegion`
  becomes per-bed. The design history spans it unchanged _in principle_ (it compares
  whole designs), but `isContinuation` and `describeEdit` need bed-aware cases
  ("moving Bed 2", "reshaping Bed 1") — extend their unit tests first, TDD-style;
  they are pure functions and this is the cheap moment.
- **Scene.** One stage; each bed drawn at its offset (outline, grid clipped per bed,
  dimension labels per bed). Scale-to-fit fits the union of padded bed bounds.
  Drop resolution: point-in-which-bed (B3's containment helper, reused) → that bed's
  frame; a drop on no bed is refused with the existing not-over-canvas behaviour.
  "Add bed" = G3's draw mode, or a preset stamped beside the last bed; beds get
  move (drag its outline in edit mode) / rename / delete (confirm through
  `ModalDialog`, undoable as one named step via `recordAs`).
- **Engine boundary.** `evaluateCanvasWarnings` runs **per bed** over that bed's
  placements, results merged for the dock (cards gain a "Bed 2" prefix only when
  bed count > 1). Cross-bed antagonist checking is explicitly out of scope (beds are
  physically separate ground — that is the _point_ of beds); record it.
- **Everything that says "the plot":** export legend (per-bed sections), print, the
  feedback panel (per-bed tallies or active-bed tallies — decide, record), "Show me"
  (pan to a marker in any bed — works free if pan stays native scroll), skip links,
  canvas aria-labels ("Bed 1 of 2…").
- **UI restraint.** With one bed, **nothing visibly changes** — no bed chrome, no
  names on screen, no prefixes. The single-bed experience is the one six phases
  polished; multi-bed reveals itself the moment a second bed exists.

**Acceptance** (each measured, per the house rule): a v1 library and a v1 export file
both migrate losslessly; with one bed the app is pixel-comparable to pre-G4 (reuse the
`getImageData` technique); two beds → warnings computed independently (an antagonist
pair split across beds raises nothing; the same pair in one bed still warns); drag from
palette into each bed lands in that bed's frame; full round trip (build 2 beds →
reload → same scene); keyboard walkthrough gains "create and reshape a second bed";
axe green across the new states.

---

## G5 — Multi-select, marquee, copy & paste

_(review feature #6 · effort M–L · complications medium)_

**Goal.** Select several placements (marquee-drag on empty ground, shift-click,
keyboard), then move, delete, copy or paste them as one action — and one undo step.

**Why here.** Built once against the settled multi-bed model (a marquee can span beds;
paste targets the active bed), and G6 then _reuses_ the whole apparatus as its
group-manipulation surface instead of building its own.

**Spec.**

- `placements-store`: `selectedId: string | null` → `selectedIds: ReadonlySet<string>`,
  with `selectedId` kept as a derived "primary" (last-added) so every existing
  single-selection consumer — history's per-step selection restore, warnings "Show
  me", the feedback panel, Previous/Next buttons, arrow-key nudge — migrates
  mechanically. Grep-driven sweep; each call site is a decision (nudge moves _all_
  selected; Delete removes all — one history step, `recordAs('removing 4 plants')`).
- Marquee: pointer-drag on empty ground **conflicts with pan** (same gesture,
  `PlotCanvas.tsx`). Resolution: marquee is a _mode_ — hold Shift to marquee, plain
  drag still pans — matching how Shift already modifies (extends) click-select.
  Record the alternative (a toolbar mode toggle) in the ADR.
- Keyboard: Shift+Previous/Next extends the selection; Ctrl/Cmd+A selects all in the
  active bed; Esc clears to primary-only.
- Copy/paste: internal clipboard (module state, not the OS clipboard — no permissions,
  no serialisation), Ctrl+C/Ctrl+V + toolbar buttons; paste offsets by one snap step
  (G2) into the active bed, entire paste one history step.
- Rendering: the existing selection glow on every selected marker; primary
  distinguished (slightly stronger ring) since arrow-nudge anchors announcements to it.

**Acceptance.** Marquee over three markers selects three (E2E); arrow key moves all
three, **one** Ctrl+Z returns all three (unit + E2E); copy/paste of a pair lands
offset, selected, and undoes as one step; every pre-existing single-selection
behaviour (Show me, feedback panel, walkthrough steps) passes unmodified except where
specs were deliberately extended.

---

## G6 — Row & block planting

_(review feature #7 · effort L · complications medium-high)_

**Goal.** Place N of a crop as an arranged row or block in one gesture — the engine's
`fitPlant` maths ("5 rows of 12 at 25 × 38 cm") made drawable instead of read-out.

**The model decision.** A group is **N ordinary placements sharing a `groupId`** — not
a new placement kind. The canvas, warnings, history, persistence and multi-select all
keep working on placements untouched; the group is a selection/labelling concern.
Storage bumps v2→v2.1 (one optional field — a minor rung on G1's ladder; v2 designs
load with `groupId` absent). This is the cheap model _because_ G5 exists: "select the
whole group" is set-selection with the set derived from a shared id.

**Spec.**

- Palette card's expando (and/or the ＋ button's long-press… no — keyboard first: an
  explicit control in the expanded card): "Plant a row/block…" opens a small form —
  count or length/area, row vs. grid — pre-filled from `fitPlant`'s lattice for the
  active bed. Placement positions computed by a pure `layoutBlock(plant, origin,
count, mode)` in `geometry.ts` using `resolveLatticeSpacing` — the same figures the
  feedback panel prints, so what is drawn is what the engine already claimed fits.
- The whole block lands as **one** history step (`recordAs('planting 12 Onions')`),
  selected as a group (G5's set), snapped (G2), origin found by `firstFreePosition`
  scaled up to the block's bounding box.
- Clicking any member selects the group (plain click) or the individual
  (double-click/modifier — decide, record); group drag moves all members rigidly;
  group delete is one step.
- Feedback panel already tallies per crop — gains "(12 in a row)" style annotation
  only; warnings unchanged (members are ordinary placements, and intra-group spacing
  is by construction the engine's own lattice, so a block never warns against
  itself — assert that in a test, it is the phase's honesty check).

**Acceptance.** Unit: `layoutBlock` produces the lattice `fitPlant` describes for
known crops; a block of the engine's own spacing raises zero spacing warnings.
E2E: plant "2 rows of 5" onions → ten markers in the stated lattice, one undo removes
all ten, reload restores the group (still group-selectable). Keyboard: the whole flow
— open expando, request a row, nudge the landed group — pointer-free.

---

## G7 — Planting calendar

_(review feature #4 · effort M · complications low)_

**Goal.** A time view of the open design: for each placed crop, its sowing/planting
window across the months, against the plot's region/hardiness — the spatial plan made
temporal.

**Why last.** Zero spatial coupling — it _reads_ placements and plant data — so
building it after G4/G5/G6 means it is written once against the final model. (The
inverse is also recorded here on purpose: if priorities change, this phase can be
pulled forward at the cost of a one-file rework of its data selector after G4 and G6.
It is the plan's designated flex point.)

**Spec.**

- Data: a pure selector `plantingCalendar(design, conditions)` — distinct crops from
  placements (grouped, post-G6, by crop not by placement), each with the sowing-window
  data the ranking already uses (`season` scoring reads it today; reuse that path, no
  engine changes) resolved against the region's workable window.
- View: a second route (`/calendar`) sharing `AppShell` — the router seam ADR 0030
  built is exactly for this. Months across, crops down, window bars in the crop's
  category colour; "now" line; each row named and iconed like the palette. Print
  stylesheet treats it as a document (the Phase 6 print machinery generalises).
- A header/nav affordance to switch views; canvas remains the default route. The
  calendar is read-only in this phase — no drag-to-reschedule, no per-placement
  sowing dates (both recorded as future wants; per-placement dates would be the next
  schema rung, and nothing in this phase forecloses it).
- Empty state with the same warmth the canvas got ("Nothing planted yet — your
  calendar fills in as your plot does").

**Acceptance.** Unit: selector output pinned for a known design (crops, windows,
dedup). E2E: place three crops → calendar lists exactly three rows with bars matching
their dataset windows; a design with none shows the empty state; axe green on the new
route in both states; print of the calendar page fits the sheet.

---

## Standing risks, carried across phases

- **Schema rungs accumulate** (v1 → v2 → v2.1). Every rung keeps its migration test
  forever; `parseLibrary`'s round-trip suite is append-only. An exported file from any
  released version must import in every later one — G1's E2E round-trip spec grows a
  fixture per version.
- **The keyboard walkthrough is the canary.** G3, G4, G5 and G6 each add steps; if its
  tab-stop budget (320) comes under pressure, that is a design smell to fix in the
  phase that caused it, not a number to raise — the Phase 3 precedent.
- **The pixel-differencing E2E technique** (canvas-scale, and A1/G4's reuse of it) is
  the slowest thing in the suite. If suite time becomes a tax, consolidate baselines
  before adding more specs of that shape.
- **G4 is the phase most likely to slip.** Its position assumes it lands before G5/G6;
  if it stalls, do **not** reorder G5/G6 ahead of it — build G7 (the flex point) while
  G4 recovers. Building selection or grouping against the single-region model and
  migrating after is the exact rework this ordering exists to avoid.
