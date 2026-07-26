# 0020 — Plot export: 2D-canvas legend compositing instead of a Konva `Group`, and how the stage ref reaches it

- **Status:** Accepted
- **Date:** 2026-07-26
- **Workplan stage:** 3.7 — export the plot as an image

## Context

Stage 3.7 (`docs/stage-3.7-brief.md`) lets the user export a PNG of the
finished plot: the canvas plus a legend naming the placed crops and the
plot's soil/climate settings. Konva's `stage.toDataURL()`/`toCanvas()` do the
actual rasterisation for free (`WORKPLAN.md` §0.5's original design already
assumed this). Two things needed deciding that the brief left open: how the
legend actually gets into the exported image, and how `PlotCanvasSection.tsx`
(which owns the Export button) gets hold of the Konva `Stage` instance that
lives inside `PlotCanvas.tsx`.

## Decision

### The legend is composited with the plain 2D Canvas API, not a Konva `Group`

The brief's suggested shape was a Konva `Group`/`Text` node added to the
scene alongside the plot. That would require constructing real Konva nodes —
`new Konva.Group()`, `new Konva.Text()` — which means importing the `konva`
package's runtime at module scope, not just its types. `app/src/test/setup.ts`
and ADR 0017 already document why that's a trap in this repo: `konva`'s
`package.json` points `main` at `lib/index-node.js`, which `require`s the
native `canvas` package this project deliberately doesn't install; Vitest
runs under Node and resolves `main`, so merely importing the real `konva`
package crashes any test file that imports `export.ts` — including the
legend-builder unit test and the button's component test, neither of which
has anything to do with Konva.

Instead, `canvas/export.ts` only ever _calls methods on_ the already-
constructed `Konva.Stage` instance a caller hands it (`.find()`, `.toCanvas()`)
— it never constructs a Konva node. That means the module needs only
`import type Konva from 'konva'`, which is erased at compile time and never
touches the real package, so it's safe to import from any test. The legend is
rendered as a second panel on a plain `<canvas>`: `stage.toCanvas({
pixelRatio: 2 })` rasterises the plot, a new canvas sized to fit both the
stage's image and a fixed-width side panel is created, the stage's canvas is
drawn onto the left with `drawImage`, and the legend's lines are drawn with
`fillText` on the right — the same visual result (a side panel that doesn't
overlap the plot) the brief describes, with no Konva scene-graph mutation and
nothing to add and remove around the export.

### `PlotCanvasSection.tsx` gets the stage via a forwarded ref, not `PlotCanvas.tsx` reaching for export logic

The brief names `PlotCanvasSection.tsx` as the only existing file this stage
touches, but the Konva `Stage` instance is created inside `PlotCanvas.tsx`,
one level down. `PlotCanvas.tsx` gained one small addition: an optional
`stageRef` prop forwarded straight onto react-konva's `<Stage ref={stageRef}>`
(react-konva forwards the ref directly to the underlying `Konva.Stage`
instance — no `.getStage()` indirection needed). `PlotCanvas.tsx` still knows
nothing about exporting; it only exposes the ref, exactly as it already
exposes `severityByPlacementId` without knowing anything about the warnings
engine that computes it.

### Conditions are resolved in `PlotCanvasSection.tsx`, mirroring the form's own pattern

The legend needs the plot's resolved conditions (location name, hardiness
band), not the raw, possibly-unresolved `PlotConditionsInput` the store
holds. `PlotCanvasSection.tsx` calls `resolvePlotConditions` itself — the same
call `PlotConditionsForm.tsx` already makes to validate the form — wrapped in
a try/catch that returns `null` on failure (mirroring that form's own
resolution check). `buildLegendText` takes the resolved `PlotConditions |
null` directly, so it stays a pure function with no knowledge of the input
schema or how resolution can fail.

### Download, not open-in-a-tab

Per the brief's own recommendation: an `<a href={dataUrl} download>` clicked
programmatically. Simplest, least surprising, and the one Playwright can
observe directly via `page.waitForEvent('download')`.

## Alternatives considered

- **A real Konva `Group`/`Text` node**, added to the stage just before export
  and removed after. Rejected: needs the real `konva` runtime import this ADR's
  first section explains is unsafe to have at module scope; the temporary
  add/remove dance around the stage's existing layer is also more moving parts
  than compositing a second canvas.
- **Rendering the legend permanently as part of `PlotCanvas.tsx`'s own JSX**
  (a Konva `Group` always in the scene, positioned to the side, using
  react-konva components already imported and mocked in tests). Rejected: it
  would change the interactive canvas's on-screen size and appearance for
  every user, not just the exported image, and the brief's own "where it
  lives" section names `PlotCanvas.tsx` as untouched by this stage.
- **A second, entirely separate off-screen Konva stage** built just for the
  legend panel, then composited via the canvas API anyway. Rejected as
  needless indirection once the legend is plain text — a 2D-canvas `fillText`
  loop does the same job with far less code and no extra Konva instance to
  manage.
- **Opening the image in a new tab** instead of downloading. Rejected per the
  brief's own recommendation — a download is simpler to verify (a real
  browser download event) and less surprising for a user expecting to keep a
  picture.

## Consequences

- `app/src/canvas/export.ts` is the new module: `buildLegendText` (pure,
  unit-tested in `export.test.ts`), and `exportPlotImage` (the pipeline —
  await fonts, await icons, composite, download — exercised only by the E2E
  spec, per ADR 0017's precedent for anything actually touching the Konva
  scene or a real `<canvas>`).
- `app/src/canvas/PlotCanvas.tsx` gained one optional `stageRef` prop. This is
  the one piece of this stage that touches a file the brief didn't name;
  it's a single forwarded ref with no export-specific logic in the component.
- `app/src/canvas/PlotCanvasSection.tsx` owns the Export button, the
  `stageRef`, and resolving conditions for the legend — the same "compose
  already-tested pieces" role it already played for the remove button and
  the feedback panel.
- `app/e2e/plot-export.spec.ts` is the only place `exportPlotImage`'s real
  pipeline runs; `PlotCanvasSection.test.tsx` mocks `export.ts` entirely, the
  same boundary ADR 0017 draws between pure-logic unit tests and Konva/DOM
  E2E coverage.
- A future stage adding a second export format (e.g. JPEG) or a richer legend
  layout should extend `compositeExportCanvas`/`buildLegendText` directly
  rather than introducing a Konva-node-based legend — the module-scope
  `konva` import trap this ADR avoided is still there for anyone who does.
