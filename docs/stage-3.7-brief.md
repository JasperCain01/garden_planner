# Stage 3.7 brief — export the plot as an image

A finishing touch for the MVP — users can now save a picture of their plot.
Read [`DESIGN.md`](../DESIGN.md) (§1 step 5, the export is optional, not core),
[`WORKPLAN.md`](../WORKPLAN.md) (§0 ground rules and the Stage 3.7 entry), and
`docs/adr/0017-plot-canvas-konva-and-dnd-kit.md` (the canvas architecture) first;
this brief concentrates the requirements and the shape of the interface this stage
calls.

Stages 0.1–1.6, 0.3, all of Phase 2, Stages 3.1–3.6, and Stages 4.1–4.2 are
merged into `main` — **branch from `main`**.

## Goal

Let the user export a PNG image of their finished plot — the canvas, a legend
naming the placed crops, and the plot's soil/climate settings — to keep, print, or
share. A **terminal image artifact, not a re-loadable save** — no serialisation or
persistence subsystem needed.

## Where it lives

No new module needed. Changes to one existing file:

- `app/src/canvas/PlotCanvasSection.tsx` — add an "Export" button that triggers
  the render-to-image flow.

And a new small module:

- `app/src/canvas/export.ts` — the export logic: composing the legend and
  settings into the canvas, awaiting all icon loads, and calling Konva's
  `toDataURL`/`toBlob` to generate the image. See "What's already built" for
  why this is clean.

## What's already built (don't rebuild any of this)

- **The Konva canvas** (`PlotCanvas.tsx`, Stage 3.4) is fully rendered and
  interactive. Konva's `stage.toDataURL()` and `stage.toBlob()` methods
  rasterise it to a data URL or blob with zero setup — `react-konva`
  exposes `ref.getStage()` to get the raw Konva `Stage` node. No special
  layer structure needed; the canvas renders everything (outline, plants,
  badges) in one scene.
- **Icons are bundled and self-owned** (Stage 4.1, wired in Stage 4.2).
  `resolveIcon` returns Vite-bundled asset URLs (small icons as `data:` URIs,
  larger ones as same-origin file hashes). The canvas is **untainted** by
  construction: every image it draws (every icon) is same-origin, so
  `toDataURL`/`toBlob` work without triggering CORS errors. (This is the
  reason Stage 3.6's icon picker rejects user uploads — an external-URL image
  would taint the canvas and break export silently.)
- **A legend is plain text + React** — no new component needed. Render the crop
  list and the plot's resolved conditions into a simple, readable text panel,
  compose it into the Konva scene alongside the plot as a side layer
  (Konva `Group`, coordinates chosen so it doesn't overlap the plot itself),
  and include it in the export.
- **Image loading is async**, but all icons are cached bundled assets, so
  they load near-instantly. The `useIconImage` hook (Stage 4.2) handles
  individual image loading; for export, await `document.fonts.ready` (so
  exported text renders in the chosen font, not a fallback) and a small
  utility that waits for all currently-visible icons to load (since they're
  already in the DOM, just check their `complete` flag or promise their
  `onload`). Only then call `stage.toDataURL()`.

## What to build

1. **The export button** in `PlotCanvasSection.tsx`: a simple button that
   triggers the export flow. Place it next to the existing remove/select toolbar
   buttons. Keep the label short ("Export", "Download", "Save image" — pick one,
   but don't over-design; the brief leaves this open).

2. **The legend and settings composition** (`export.ts`): a function that builds
   a text representation of the plot — placed crops (one per line, in the order
   they were placed) and the current soil/climate settings (location name,
   hardiness band, soil texture, if any). Keep it simple: no fancy layout, just
   readable multiline text. Return it as a `string` (or pre-render it into a
   Konva `Text` node if the design calls for positioning).

3. **The export pipeline** (`export.ts`): a function `exportPlotImage(
stageRef, placements, conditions)` that:
   - Awaits `document.fonts.ready` (ensures exported text renders correctly).
   - Awaits all visible icons to load (simple check: wait for all `<img>` elements
     currently in the Konva scene to have `.complete === true` or promise their
     `onload`).
   - Optionally composes the legend into the Konva scene as a side `Group`
     (positioned so it doesn't overlap the plot itself).
   - Calls `stageRef.getStage().toDataURL({ pixelRatio: 2 })` to rasterise at 2x
     pixel density (ensures crispness on any screen). Konva's `toDataURL` returns
     the PNG as a base64-encoded data URL; wrap it in a `Blob` if needed for
     download.
   - Returns the image (as a data URL, blob, or already-downloaded file, per the
     design choice below).

4. **Download/open the image**: once the image data is ready, either:
   - Download it directly (create an `<a>` with `href={dataUrl}` and `download`
     attribute, then `click()` it).
   - Open it in a new tab (set `window.open(dataUrl)`).
   - Copy it to clipboard (via the Clipboard API if the browser supports it).
     Pick one, but decide and note it rather than leaving it half-implemented.
     _Recommendation: download is simplest and least surprising for users._

5. **Tests**:
   - Component test for the button (just verify it renders and its click triggers
     a callback; the callback's details are testable separately).
   - Unit test for the legend composition: pass a set of placements and conditions,
     assert the returned string contains the crop names and climate info in a
     readable order.
   - E2E test: build a small plot, place 2–3 crops, click Export, verify a
     non-empty file downloads (or a new window opened, per the design choice).
     If the repo's E2E conventions use screenshot snapshots (check before adding
     a new pattern), add a visual snapshot of the exported image to verify icons
     and legend both render.

6. **Gotchas to handle** (record in the ADR if you write one; the brief covers
   them here since they're already known):
   - **`document.fonts.ready` is critical.** Konva rasterises synchronously; if a
     font hasn't loaded yet, the text will render in a browser fallback. Always
     await it before calling `toDataURL`.
   - **All icon images must be loaded.** The canvas renders icons asynchronously
     (they're `<img>` elements inside Konva), but `toDataURL` captures the scene
     as-is. If an icon hasn't loaded yet, it will either be blank or render as the
     background circle only. The simple fix: wait for all `<img>` elements with
     `complete === false` or `pending` to have `onload` called, or check them all
     have `.complete === true` before proceeding. The `useIconImage` hook (Stage
     4.2) already handles this per-image; for export, just wait for the ones on
     screen.
   - **The canvas is sensitive to `pixelRatio`.** `toDataURL({ pixelRatio: 2 })`
     doubles the export size for crispness on modern screens. Too high a ratio can
     blow out memory; 2 is a good default. If the export is too large or too small,
     adjust here.
   - **The export is PNG only** (the brief's current decision). Konva's `toDataURL`
     defaults to PNG; there is no parameter to force JPEG. If a future stage wants
     JPEG as an option, that's fine — just add a parameter, not a design choice
     this stage should make.

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.**
- **The network is blocked** — no external image loader, no CDN, no API calls
  for the export. Everything (icons, text, fonts) is local.
- **No `.claude/` skills directory** — review your own diff.
- **No CI workflow — don't add one.**
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, `npm run format:check` from the repo root.

## Deliverables

1. `PlotCanvasSection.tsx` has an Export button.
2. `export.ts` with a legend builder and the export pipeline (await fonts,
   await icons, compose, rasterise, download).
3. Component test for the button; unit test for the legend; E2E test for the
   full export flow (verify a file downloads or opens).
4. `docs/architecture.md` updated (add a Stage 3.7 note summarizing the export
   feature); `WORKPLAN.md`'s Progress table updated; **the brief for the next
   stage written** (check the dependency map — Stage 1.7, maintainer-authored
   crops, is the natural next stage once the MVP is solid; see its own
   Progress-table note).

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
the export flow works end-to-end (test confirms a file can be downloaded or
opened); the legend is readable and complete; docs and the Progress table
updated; the next stage's brief written.

## Model

**Sonnet.** Well-scoped canvas feature; the heavy lifting (image rasterisation)
is library-provided by Konva. The main decisions are around composition (where
to place the legend, how to format it) and waiting for async (fonts, icons);
both are straightforward, no algorithmic work.

## Notes

- `DESIGN.md` describes the export as optional, not core to the loop — it closes
  Phase 3 (frontend MVP) but doesn't unblock anything later. It makes the
  app _useful_ (users can keep their work) without being a blocker for Phase 4
  (content/assets) or Phase 5 (offline/deploy).
- The legend text is meant to be **human-readable and compact**. Don't over-design
  — a simple list of crop names, the soil texture if present, the location, and
  the hardiness band is enough. The export is a snapshot, not a save file, so it
  doesn't need to be a complete record of every parameter; users print it or
  share it, so readability > completeness.
- Konva's `toDataURL` is synchronous **after** all images are loaded; it doesn't
  re-trigger downloads or network calls. The exported PNG is a self-contained,
  complete image from the instant it's called, and there is no progressive loading
  or streaming.
