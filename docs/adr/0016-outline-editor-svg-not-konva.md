# 0016 — Outline editor: plain SVG + pointer events, not react-konva yet

## Status

Accepted (Stage 3.2).

## Context

Stage 3.2 (`docs/stage-3.2-brief.md`) builds the free-form plot-outline
editor: drag an existing corner, add a corner on an edge, remove a corner,
re-validating via `safeValidatePlotRegion` (`packages/engine/src/spacing/region.ts`)
after every edit. `WORKPLAN.md` §0.5 already ratifies **react-konva** as the
project's 2D canvas library, for Stage 3.4's drag-and-drop plot canvas — but
the brief is explicit that _when_ to adopt it is this stage's one open call,
not a foregone conclusion: "Whether to pull it in now for the outline editor,
or ship a simpler drag-corners interaction (plain SVG + pointer events) and
let 3.4 be the first real react-konva work, is this stage's one open design
call. Either is defensible."

The two real options:

1. **react-konva now.** A `<Stage>`/`<Layer>` with draggable `<Circle>`
   handles and a `<Line>` for the outline, using Konva's own `dragBoundFunc`
   and drag events.
2. **Plain SVG + native pointer events.** `<svg>` with `<circle>` handles and
   a `<polygon>`, driven by `onPointerDown`/window-level `pointermove`/`pointerup`
   listeners and ordinary React state.

## Decision

**Plain SVG + pointer events**, deferring react-konva to Stage 3.4.

- **This stage's interaction is a handful of draggable points on a static
  background, not a canvas scene.** There's no sprite compositing, no
  z-ordering of many moving icons, no need for a retained render tree that
  redraws at 60fps under many simultaneous drags — the things Konva's
  `Stage`/`Layer`/hit-graph model earns its keep for. Stage 3.4's actual job
  (dozens of plant icons, placed, dragged, layered over the plot, redrawn on
  every density recalculation) is that scene; a 3–20-vertex polygon editor is
  not.
- **SVG elements are ordinary DOM nodes.** `<circle>`/`<polygon>` render
  through React's normal reconciliation and take normal DOM event listeners
  (`onPointerDown`, `onDoubleClick`, `onClick`), so `safeValidatePlotRegion`'s
  per-edit re-validation loop, the inline error message, and the add/remove
  handles are all plain React state and JSX — nothing Konva-specific to learn
  or test around. `PlotOutlineEditor.test.tsx` renders the component with
  `@testing-library/react` and drives real DOM events directly; a Konva
  `<Stage>` renders to an HTML5 `<canvas>`, which has no DOM structure to
  query or click at all — component tests for it would have to drive Konva's
  own synthetic event system or fall back to pixel-level assertions, which is
  strictly more test infrastructure for strictly less interaction surface
  than this stage needs.
- **No dependency pulled in a stage before it's earned.** Every dependency is
  a maintenance and bundle-size cost from the moment it's added (`WORKPLAN.md`
  §0.5 notes react-konva's own trade-off already, for the canvas that
  actually needs it). Introducing it here would mean Stage 3.4 inherits both
  "the canvas" and "whatever conventions the outline editor happened to
  establish for it" as a package deal, rather than designing the canvas
  cleanly against its own real requirements when that stage starts.
- **Nothing here forecloses Stage 3.4.** `PlotRegion` (the data) has no
  rendering opinion baked in — react-konva can read the same `region.vertices`
  the SVG editor does. The outline editor and the future canvas are separate
  components reading the same plot store (`state/plot-store.ts`); adopting
  Konva in 3.4 does not require revisiting this stage's SVG editor at all
  (though a later stage could choose to unify them onto one canvas — not
  decided here, and not necessary for either stage to work).

### The drag math, and why it needs no DOM measurement

The natural way to convert a pointer's screen position into the outline's
own coordinate space is `getScreenCTM()`/`getBoundingClientRect()` — but
`getScreenCTM` isn't implemented under jsdom (the component test environment,
per `vite.config.ts`) and `getBoundingClientRect` returns an all-zero rect
there by default, which would make the very re-validation-on-drag behaviour
this stage most needs to test (`PlotOutlineEditor.test.tsx`'s
self-intersection case) impossible to drive deterministically.

Instead, the SVG's `width`/`height` attributes are set to exactly
`viewBox width/height * PX_PER_CM`, a ratio the component already knows —
so the browser's own viewBox-to-viewport scaling _is_ the pixel-to-centimetre
conversion, with no runtime DOM query involved. A drag then tracks each
`pointermove`'s `clientX`/`clientY` against the previous event's own
`clientX`/`clientY` (not the native `movementX`/`movementY` — jsdom's event
implementation doesn't populate that field, confirmed empirically while
writing the test) and divides the pixel delta by `PX_PER_CM`. Move/up
listeners are attached to `window`, not the dragged circle, so a fast drag
that carries the pointer outside the small hit-target circle doesn't drop
the gesture.

## Alternatives considered

- **react-konva now.** Rejected for this stage — see "This is a handful of
  draggable points" above. Revisit at Stage 3.4 on its own merits; nothing
  here argues against Konva in general, only against adopting it a stage
  before its first real use case.
- **dnd-kit for the corner drag.** `WORKPLAN.md` §0.5 also ratifies dnd-kit,
  but for palette-to-canvas drag-and-drop (Stage 3.4) — dragging a discrete
  item between drop zones. Dragging a vertex is closer to "resize a shape by
  its handles," a continuous coordinate update rather than a drop-target
  handoff, which is exactly what dnd-kit doesn't model any more directly than
  raw pointer events do. Not adopted here for the same "not the problem it
  solves" reason as Konva.
- **`getScreenCTM`/`getBoundingClientRect`-based coordinate conversion.**
  The textbook-correct way to map a pointer event onto an arbitrarily
  transformed/scaled SVG, but unusable under jsdom (see above) and unneeded
  here since this editor controls its own `width`/`height`/`viewBox`
  relationship directly rather than being embedded in an arbitrary,
  externally-scaled layout.

## Consequences

- `app/src/plot/PlotOutlineEditor.tsx` has a hard-coded `PX_PER_CM` constant
  governing both its rendered size and its drag sensitivity; a future stage
  wanting a zoomable/pannable editor (not asked for here) would need to
  generalise this rather than reuse it as-is.
- Stage 3.4 is genuinely the first react-konva work in this codebase — its
  brief should not assume any existing Konva conventions exist yet to follow.
- The outline editor and the future plot canvas are two independent
  components against the same `PlotRegion` data; there is no shared
  rendering code between them today, by choice, not oversight.
