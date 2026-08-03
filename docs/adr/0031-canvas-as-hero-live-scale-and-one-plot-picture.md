# 0031 — The canvas as hero: a live scale, footprint-true markers, and one picture of the plot

- **Status:** Accepted
- **Date:** 2026-08-03
- **Phase:** UI redesign Phase 2 — canvas as hero
  ([`docs/ui-aesthetic-review.md`](../ui-aesthetic-review.md))

## Context

Phase 1 gave the plot canvas the middle of the workspace — 53% of the viewport
at 1440×900 — and then, deliberately, stopped. ADR 0030's own consequences say
so: "The canvas has the space but does not yet use it. The Konva stage is still
drawn at the fixed `PX_PER_CM`, so the default 3×2m plot is a small rectangle
centred in a large region."

It was a **228×168px** rectangle in an **820×844px** region: 5.5% of the space
it had been given. The review's second finding is about exactly this ("a pale
green postage stamp"), and three more findings hang off it:

- markers were uniform 16px circles, so "a squash and a radish read identical,
  and spatial planning gets no visual support even though the engine computes
  spacing precisely";
- "Add to plot" placed every crop at the plot's centre, so three presses
  produced one visible marker — the review's "single worst first-run
  bug-that-isn't-a-bug";
- the plot was drawn **twice**, at two different scales, in two different
  columns: the Konva canvas, and `plot/PlotOutlineEditor.tsx`'s SVG editor
  under the shape picker. "Users must mentally reconcile them."

Five questions needed answering. None of them is "what should it look like" —
the review drew that.

1. Where does a live scale live, given four consumers in three subtrees?
2. What does "the footprint" mean, given the engine already has two answers?
3. Where does "Add to plot" put a crop, if not at the centre?
4. Konva or SVG for the merged outline editor — and what does that do to ADR
   0016, which chose SVG for it deliberately?
5. Do the outline's corner handles stay pointer-only?

## Decision

### 1. `pxPerCm` is a required parameter everywhere, and lives in a store

`geometry.ts`'s `canvasSizePx`/`cmToPx`/`pxToCm` already **took** `pxPerCm` —
they just defaulted it to `PX_PER_CM = 0.6`, and every caller took the default.
The constant is gone and the parameter is now **required**, which is the part
worth recording: it is a deliberate ergonomic cost paid to convert a class of
silent bugs into compile errors.

Two callers make the case. `canvas/drop.ts` converts a drop point, and
`canvas/export.ts` rasterises the stage. Both are easy to miss, and both fail
_quietly_ when they use a scale the stage isn't drawn at — a plant lands
somewhere the user didn't drop it; an export changes size — with every existing
test still green. A defaulted parameter would have let both compile.

The value itself lives in `state/canvas-view-store.ts` (measured viewport +
zoom factor, combined by `canvas/useCanvasScale.ts`) rather than in component
state, because of one consumer: `useCanvasDropHandler` is called by
`PlotDefinitionPage`, which owns the `DndContext` and sits _above_ the canvas
region, so it cannot see a size measured two components below it. Lifting the
measurement to that page would have put the canvas's layout state in the
component that most wants not to know about it. This is the same reasoning
ADR 0015 already applies — one small store per concern, read where needed.

The zoom is stored as a **factor over fit**, not an absolute scale, so
resizing the window or applying a new shape re-fits the plot and _keeps_ the
user's zoom intent instead of stranding them at a number that no longer relates
to anything.

### 2. An export is rasterised at a fixed density, not at the on-screen one

Making the on-screen scale live would otherwise make every exported PNG a
different size — the same plot at 456px wide on a laptop and 1,500px on a
desktop, for a reason nothing on screen explains. `export.ts#exportPixelRatio`
scales Konva's `pixelRatio` to bring the rasterisation back to a fixed
0.6 px/cm, which is the constant this phase removed: **exports keep exactly the
dimensions they had before the canvas learned to scale.** The ratio is bounded,
so a very large plot (fitted near `MIN_PX_PER_CM`) doesn't ask the browser for
a canvas of tens of megapixels; past that point the export's absolute size does
track the fit again, which is the honest trade against an allocation failure.

### 3. The footprint is the one the warnings engine already uses

`warnings/placement-derivation.ts` already models a placement's personal space
as a square of side `max(inRowCm, betweenRowCm)`, resolved through
`resolveLatticeSpacing(…, 'auto')` — "a reasonable, conservative stand-in for a
full per-plant canopy shape". `canvas/footprint.ts` reuses **that** definition
rather than inventing a second one for drawing, so the disc a user sees is the
same footprint `antagonistWarnings` reasons about: a marker that looks like it
is crowding its neighbour is one the engine agrees is crowding its neighbour.

A marker is three concentric pieces, and needs to be: the **canopy** at true
footprint × scale (a butternut squash claims half a 3m bed; a radish claims a
thumbprint), a **core** capped at a legible size — which is what the old 16px
marker was, and is still what you click — and the icon on it. Letting the icon
grow with the canopy would make one pumpkin the only thing on the plot.

Two floors keep it usable rather than merely correct: a canopy is never drawn
below 12px (the review's "min 12px for clickability" — below that a radish on a
zoomed-out allotment is sub-pixel and unhittable by Konva's hit graph too), and
the name label only appears once the canvas is zoomed in far enough for the
text to be shorter than the plant.

### 4. "Add to plot" searches outward from the centre for a free spot

`geometry.ts#firstFreePosition` walks square (Chebyshev) rings around the
plot's centre, each ring's candidates ordered by true distance so the result
grows outward as a rough spiral, and takes the first candidate inside the
bounding box that is at least the crop's own footprint from every placed plant.

Three choices inside that are worth recording. The separation is **one number**
— the incoming plant's footprint — not a per-pair calculation: this function's
job is "somewhere visibly free", not optimal packing, and `fitPlant` already
answers the latter and prints it under the canvas. A crop with a genuinely tiny
spacing is separated by a floor of 20cm instead, because a marker is never
drawn smaller than 12px however little ground the plant needs, and scattering
closer than the markers are drawn looks exactly like the bug this fixes. And
when the plot is genuinely full the **centre comes back** — the old behaviour,
stacking and all — because that is the honest answer: there is nowhere free,
and the count feedback already says so. Placing it outside the outline instead
would be worse.

### 5. The outline editor moves onto the Konva canvas, and ADR 0016 gets an addendum

The review's option was "port the SVG editor's interaction to Konva, or overlay
the existing SVG at the canvas's scale". Konva, because an overlay is a second
coordinate system to keep in sync with the first and an element that sits over
the stage intercepting its events — two pictures again, just stacked.

**This contradicts ADR 0016's premise, which is why that ADR now carries a
dated addendum rather than being silently overruled.** Its reasoning was sound
and is still sound _for what it decided_: in Stage 3.2 the editor was a
standalone component, "a handful of draggable points on a static background,
not a canvas scene", and Konva would have been a dependency pulled in a stage
before it was earned. What changed is not the judgement but the situation — the
editor is no longer standalone. It is a mode of a scene that already exists, and
that scene is Konva's.

Two of ADR 0016's specifics survive the move intact, which is worth saying
because they were the load-bearing parts: the per-edit re-validation through
`safeValidatePlotRegion` (now `canvas/outline-edit.ts`, pure and unit-tested),
and the vertex operations themselves (`plot/outline-ops.ts`, untouched, still
with their own tests). What did _not_ survive is the hand-tracked
`pointermove`-delta drag maths, and it didn't need to: that existed to avoid
`getScreenCTM` under jsdom, and a Konva node reports its position in stage
coordinates directly.

Because the outline being edited can be momentarily invalid and `plot-store`
holds validated regions only, the canvas draws from a **draft** while an edit
doesn't validate (`canvas-view-store`'s `draftVertices`). That is
`PlotOutlineEditor`'s own draft state, kept for its own reason: without it a
corner dragged into a self-intersection snaps back under the pointer mid-drag
and the error message describes a shape no longer on screen.

### 6. The corner handles get a keyboard path, closing a recorded gap

`docs/accessibility.md` §5 has recorded since Stage 6.2 that the outline
editor's corner handles are pointer-only — Tab reached them, nothing was behind
them. ADR 0026 scoped the keyboard-drag alternative to exactly two places and
said so honestly rather than pretending otherwise.

Merging the editor into the canvas is the moment to fix that rather than move
it, and the answer is the one ADR 0026 already established for placements,
because it is the same constraint (Konva shapes are painted pixels and cannot
be focused): a corner has a **selection**, the toolbar's ◀/▶ buttons move that
selection, and the canvas's arrow keys act on it — the same keys, the same
Shift-for-further, the same Delete, aimed at a corner instead of a plant
depending on the mode. Entering edit mode selects corner 0, so the keys work
immediately instead of after a hunt.

### 7. Every new interaction is a button first

Zoom is three real `<button>`s plus an `aria-live` readout, not only a
ctrl+scroll gesture; "Edit shape" is a toggle with `aria-pressed`; "Clear all"
opens `ui/ModalDialog.tsx` rather than calling `window.confirm`. Gestures were
added where they help — dragging empty ground pans a zoomed-in plot — but never
as the _only_ way to do something, because ADR 0026 makes the keyboard path
contractual.

The pan gesture shares its button with "click empty ground to deselect", and
the two are told apart the only way they can be: by whether the pointer
actually moved (4px of slop). It scrolls the viewport element rather than
translating the stage, because that viewport already scrolls natively — which
is what gives keyboard users and trackpads a pan for free, and means there is
one notion of "where the plot is" rather than two that can disagree.

## Alternatives considered

- **Keeping `pxPerCm` defaulted, for a smaller diff.** Rejected in §1: the
  default is what made `drop.ts` and `export.ts` wrong without saying so.
- **Overlaying the existing SVG editor on the canvas at the canvas's scale.**
  The review offers it, and it would have left ADR 0016 untouched. Rejected in
  §5 — a second coordinate system and an element over the stage swallowing its
  events is two pictures with extra steps.
- **A `Konva.Tween` with an easing curve for the drop pop.** Rejected because
  `konva`'s Node entry point crashes under Vitest (ADR 0017,
  `src/test/setup.ts`), so this codebase's rule is to call methods on
  already-constructed Konva objects and never construct one. `node.to()` is a
  method; `Konva.Easings` is an import. Linear over 150ms is not worth breaking
  that rule for.
- **An exit fade when a placement is deleted** (the review lists it alongside
  the drop pop). Not done, and not for want of a technique: the store removes a
  placement synchronously, so animating its exit means the canvas holding a
  copy of something the store has already forgotten. That is history state, and
  Phase 5 is building history state (undo/redo) properly. Recorded rather than
  hacked.
- **Turning off dnd-kit's autoscroll** to fix the drop-accuracy bug in §8
  below. It would have worked — the palette list auto-scrolling under the
  pointer is what corrupts `delta` — and it is one line. Rejected because it
  would also remove the autoscroll that the narrow (stacked) breakpoint still
  wants, to fix a problem that has a direct answer.
- **A fixed marker size with a footprint ring drawn around it.** Half the
  benefit for the same work: the point of the review's criterion ("a squash
  visibly needs more room than a radish") is that the _marker_ is the
  footprint, so a bed of squash looks full and a bed of radishes doesn't.

## Consequences

- **The plot fills the space Phase 1 gave it.** At 1440×900 the stage is
  **732×539** — 57% of the canvas region, against 5.5% before — and at
  1920×1080 it is **1033×761**, 59% against 2.9%. The scale went from a fixed
  0.6 px/cm to a fitted 1.93 and 2.72 respectively.
  `e2e/canvas-scale.spec.ts` measures it rather than describing it.
- **A drag now lands where the pointer is, which it did not before.** Making
  the scale live exposed a pre-existing bug: `resolveDrop` used the dragged
  card's translated rect as the drop point, and dnd-kit's `delta` is a
  transform that includes a _scroll adjustment_ so the card stays under the
  pointer while its scroll container moves — which the palette's crop list does,
  during exactly this drag. Measured in a real browser, a drop aimed at the
  plot's centre landed 12cm high, with the horizontal axis (which doesn't
  scroll) exact. At 0.6 px/cm the same error converted to a distance wider than
  the plot and was flattened by the clamp; fitted, it is visible against a grid
  that shows the user precisely how far off it was. `useCanvasDropHandler`
  tracks the real pointer and passes it in; the card-rect path stays for
  keyboard drags, which never had a pointer.
- **A marker's drawn area is now a fact about the crop.** Measured on the
  default plot: an extra radish draws **791** stage pixels, an extra butternut
  squash **42,919** — 54×, from footprints of 15cm and 150cm.
- **`plot/PlotOutlineEditor.tsx` is deleted**, with its stylesheet and its
  component test. `plot/outline-ops.ts` and its tests are untouched; the
  validation rule moved to `canvas/outline-edit.ts` with tests of its own. The
  "Plot shape & size" panel keeps `ShapePicker` and points at the canvas.
- **The keyboard journey grew by five stops and gained two capabilities.**
  Reaching the canvas from the palette search is 20 tab presses where Phase 1
  measured 15 — the canvas toolbar's new buttons are in the path, which is the
  cost of them being real buttons. "Zoom in" is 7 Shift+Tabs back from the
  canvas, and the outline is reshapeable with no pointer at all
  (`docs/accessibility.md` §7).
- **axe covers two more states.** Edit-shape mode rewrites the canvas's
  accessible name and half the toolbar, and the clear-all confirmation is the
  app's second dialog; both get their own scan, following Phase 1's precedent
  with the add-crop dialog.
- **`styles/tokens.test.ts` guards a third mapping, and a stricter one.**
  `canvas/scene.ts`'s keys _are_ token names, so the test asserts the Konva
  scene is painted with values `tokens.css` declares — not merely that two
  colour families agree. Adding a scene colour means picking a token, not
  picking a colour.
- **`e2e/drag.ts` gained `atPlotCm`.** A drop point expressed as a fraction of
  the canvas box used to be interchangeable with a distance, because the box was
  a fixed ~228px wide. It isn't any more: `warnings-overlay.spec.ts` dropped
  two antagonists at 0.4 and 0.6 of the width, which was 76cm and would silently
  have become over 250cm — past the rule's 75cm threshold, so the spec would
  have gone on passing while testing nothing. Drop points that mean a distance
  now say so in centimetres.
