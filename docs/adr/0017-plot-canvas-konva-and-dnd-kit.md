# 0017 — Plot canvas: react-konva's scene, dnd-kit's handoff, and how (little) it's component-tested

- **Status:** Accepted
- **Date:** 2026-07-26
- **Workplan stage:** 3.4 — drag-and-drop plot canvas

## Context

Stage 3.4 (`docs/stage-3.4-brief.md`) builds the app's signature interaction:
drag plants from the palette (Stage 3.3) onto a canvas representation of the
plot, see live density/count feedback from `fitPlant` as each lands, and
select/move/remove what's placed. `WORKPLAN.md` §0.5 ratifies both
**react-konva** (the plot canvas) and **dnd-kit** (drag-and-drop) up front,
and ADR 0016 deferred react-konva specifically to this stage — this is
genuinely the first real react-konva work in the codebase, with no existing
`<Stage>`/`<Layer>` convention to follow. Three things needed deciding:
how the two drag-and-drop libraries divide the interaction, how coordinates
convert between the plot's centimetre frame and the canvas's pixels, and —
the one that turned out non-obvious enough to justify this ADR on its own —
how (or whether) any of it gets component-test coverage.

## Decision

### Division of labour: dnd-kit for the handoff, Konva for the scene

**dnd-kit owns exactly one thing: a palette entry crossing into the canvas.**
Every `PlantPalette.tsx` entry is a `useDraggable` source carrying its `Plant`
as drag data; `PlotCanvas.tsx`'s wrapping `<div>` is a single `useDroppable`
target (`canvas/drop.ts`'s `CANVAS_DROPPABLE_ID`). A shared `DndContext` lives
in `PlotDefinitionPage.tsx`, the one place both features are already composed
(see that file's own module doc). Once `resolveDrop` (`canvas/drop.ts`) turns
a `DragEndEvent` into a plant and a centimetre position, dnd-kit is out of the
picture entirely — **Konva's own `draggable` prop and `onDragEnd` own moving a
placed plant around the canvas**, because that's a continuous in-scene
coordinate update, not another drop-zone handoff. This mirrors ADR 0016's own
distinction ("dragging a vertex is closer to resize-a-shape-by-its-handles,
not a drop-target handoff") applied the other way round: the _first_ leg of a
plant's journey (palette → canvas) is a handoff dnd-kit models directly; every
leg after that (canvas → canvas) isn't, and reaching for dnd-kit there would
be solving a problem Konva's own drag support already solves better.

### Coordinate conversion: the same fixed-scale trick, a new scale

`canvas/geometry.ts` reuses `PlotOutlineEditor`'s ADR-0016 trick — the
canvas's rendered pixel size is set to exactly `(region bounds + padding) *
PX_PER_CM`, so pixel↔centimetre conversion is pure arithmetic needing no
`getBoundingClientRect`/`getScreenCTM` call. It does **not** import
`PlotOutlineEditor`'s `PX_PER_CM` constant: the two components have different
legibility needs (a handful of corner handles vs. plant markers that have to
stay readable), and the brief was explicit that picking an independent scale
is fine. The drop point itself (`canvas/drop.ts`'s `resolveDrop`) is read off
dnd-kit's own `active.rect.current.translated` (the dragged card's rect after
dnd-kit's translate) rather than hand-recovering a client point from
`activatorEvent`, which would otherwise need branching over pointer/touch/
keyboard event shapes — the palette entry visually follows the pointer via
that same translate (a CSS transform, `PlantPalette.tsx`), so the two
coincide by construction.

### Test strategy: pure logic is tested directly; the Konva scene is not — and needs a build-time workaround to even mount

ADR 0016 already flagged the shape of this problem: "a Konva `<Stage>` renders
to an HTML5 `<canvas>`, which has no DOM structure to query or click at all."
Stage 3.4 confirms it's worse than that under this project's tooling
specifically:

- **`konva` cannot even be _imported_ under Vitest without a workaround.**
  `konva`'s `package.json` points `main` at `lib/index-node.js` (which
  `require`s the optional native `canvas` package, for server-side rendering)
  and `browser` at `lib/index.js`. A real Vite build always resolves
  `browser`; Vitest runs under Node, so — without intervention — it follows
  `main` and throws `Cannot find module 'canvas'` the instant anything
  imports `react-konva`, before any component even renders. Installing
  `canvas` (a native addon needing system libraries — cairo, pango, etc.) to
  route around this would cut against "easy to clone and build"
  (`WORKPLAN.md` §0.2) for a capability nothing here needs, so it isn't done.
- **Even with that solved, jsdom still can't back a `<canvas>` element or let
  a test meaningfully assert on what's drawn to it.** This is the same
  limitation ADR 0016 named for the outline editor's Konva-vs-SVG choice,
  now actually reached.

The resolution, in `app/src/test/setup.ts`: a global Vitest `vi.mock('react-konva', ...)`
replacing `Stage`/`Layer`/`Group`/`Line`/`Circle`/`Text` with trivial
`<div>`-wrapping stand-ins. This exists **only** so a test that renders a page
_containing_ the canvas (`PlotDefinitionPage.test.tsx`, which renders the
whole page end-to-end) doesn't crash on import — it is not, and is not meant
to be, a test of the Konva scene itself. `PlotCanvas.tsx` has **no dedicated
component test**, by design, matching ADR 0016's own precedent rather than
inventing a new rule.

What **is** tested, directly and without any Konva involvement:

- `state/placements-store.ts` — add/move/remove/select, a plain Zustand
  store (`placements-store.test.ts`).
- `canvas/geometry.ts` — the pixel⟷centimetre conversion and bounding-box
  clamp (`geometry.test.ts`).
- `canvas/drop.ts` — resolving a `DragEndEvent` to a plant-and-position,
  built and tested against a plain object shaped like dnd-kit's event, no
  `DndContext` or DOM involved (`drop.test.ts`).
- `canvas/feedback.ts` — the per-crop placed-vs-fits tally, built directly on
  `fitPlant`'s own golden figures (`feedback.test.ts`).
- `canvas/PlacementFeedbackPanel.tsx` — the live density/count feedback UI is
  **ordinary DOM/JSX, no Konva**, so unlike `PlotCanvas.tsx` it _is_
  component-tested with `@testing-library/react`
  (`PlacementFeedbackPanel.test.tsx`).

Together these cover every piece of Stage 3.4's logic that isn't "does Konva
draw the right pixels" — which is what's left for the layer below.

### What covers the Konva scene itself: a real-browser E2E test

`app/e2e/plot-canvas.spec.ts` drives an actual Chromium browser (via
Playwright, already wired up per `WORKPLAN.md` §1.3) through the full
journey: drag a plant from the palette onto the canvas, see the live
`fitPlant` summary and tally appear, select the placed plant, remove it via
the toolbar button, see the feedback panel return to its empty state. This
is deliberately real mouse events (`page.mouse.move/down/up`), **not**
Playwright's `dragAndDrop()` helper — dnd-kit's `PointerSensor` listens for
genuine `pointerdown`/`pointermove`/`pointerup`, not the native
`dragstart`/`drop` events `dragAndDrop()` fires, so the helper would silently
not trigger a dnd-kit drag at all. One test-authoring gotcha worth recording:
the unfiltered palette renders all 160 shipped crops, making the full page
many times taller than a normal viewport (tens of thousands of pixels) — a
`page.mouse` drag doesn't auto-scroll the way a `Locator` action would, so
the spec filters the palette by search first (also realistic — a gardener
hunting one crop searches) and uses a generously tall fixed viewport so both
the drag source and the drop target are simultaneously on-screen.

## Alternatives considered

- **dnd-kit for in-canvas moves too**, keeping every drag on one library.
  Rejected: a placed plant moving within the canvas is a continuous
  Konva-scene update (position, z-order, redraw), not a discrete item
  crossing into a new drop zone — dnd-kit doesn't model that any more
  directly than Konva's own `draggable`/`onDragEnd` already does, and routing
  it through dnd-kit would mean reading Konva's rendered position back out
  through a second library's coordinate system for no benefit.
- **Installing the native `canvas` package** so Vitest could resolve
  `konva`'s Node build and, in principle, render something to a real (if
  headless) canvas surface. Rejected on two grounds: it's a native addon with
  system-library build requirements this project has otherwise avoided
  entirely, and even a working canvas backend wouldn't solve the harder
  problem — jsdom/Testing Library still can't query pixels or dispatch
  meaningful pointer gestures against a `<canvas>`, so the investment
  wouldn't buy real coverage.
- **Pixel-level snapshot testing** (e.g. rendering to a canvas and diffing
  images) for the Konva scene. Rejected as disproportionate to this stage's
  actual risk: the scene is a thin, mechanical render of already-tested data
  (`positions` from `fitPlant`, `placements` from the store) — the risk lives
  in the logic feeding it, which is unit-tested directly, not in whether
  Konva itself draws a circle correctly.
- **Reusing `PlotOutlineEditor`'s `PX_PER_CM` constant** for the canvas.
  Rejected per the brief's own note — the two components have independent
  legibility requirements and no shared rendering code by ADR 0016's own
  design; importing across them would recreate a coupling that stage
  deliberately avoided.

## Consequences

- `app/src/canvas/` holds the new feature: `PlotCanvas.tsx` (the Konva
  scene, untested directly), `PlotCanvasSection.tsx` (the page section
  wrapping it — canvas, remove toolbar, feedback panel), `geometry.ts`,
  `drop.ts`, `feedback.ts`, `useCanvasDropHandler.ts`, and
  `PlacementFeedbackPanel.tsx` (each with its own test except the two thin
  React-wiring files, `PlotCanvas.tsx` and `useCanvasDropHandler.ts`, which
  have no logic of their own beyond calling already-tested functions).
- `app/src/state/placements-store.ts` is the new per-concern Zustand store
  (ADR 0015's convention) holding what's placed.
- `app/src/test/setup.ts` is a new global Vitest setup file
  (`vite.config.ts`'s `test.setupFiles`) whose only job today is the
  `react-konva` mock above. Any future stage adding more Konva-rendered
  components inherits this for free; any future stage needing to actually
  assert on Konva's rendered output will need to revisit this ADR rather
  than assume the mock covers it.
- A future contributor adding a second Konva scene should read this ADR
  before writing its component test — the `react-konva` mock exists
  precisely so "the page still renders" tests keep working, not to imply the
  new scene is under real test coverage by default.
