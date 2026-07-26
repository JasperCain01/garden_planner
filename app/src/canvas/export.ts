/**
 * Export the plot canvas as a PNG (Workplan Stage 3.7) — `DESIGN.md`'s
 * "beyond the core loop" capability: a terminal picture of the finished plot,
 * not a re-loadable save (no serialisation/persistence subsystem needed).
 *
 * **Why this doesn't build a Konva `Group` for the legend.** The brief
 * (`docs/stage-3.7-brief.md`) suggests composing the legend as a side Konva
 * `Group` in the stage's own scene. That would need the real `konva` runtime
 * (`new Konva.Group()`/`Konva.Text()`) imported at module scope — exactly the
 * import `app/src/test/setup.ts` documents as **crashing under Vitest**
 * (`konva`'s `main` field pulls in the native `canvas` package, which this
 * repo deliberately doesn't install; see ADR 0017). Every function here
 * instead only *calls methods on* the already-constructed `Konva.Stage`
 * instance a caller hands in (`.find()`, `.toCanvas()`) — never constructs a
 * Konva node itself — so this module needs only `import type Konva`, which
 * is erased at compile time and never touches the real package. The legend
 * is composited onto the rasterised stage with the plain 2D Canvas API
 * instead (`compositeExportCanvas` below): a second panel of `fillText` lines
 * next to the stage's own rendered image, same visual result, no Konva
 * scene-graph mutation and nothing to add and remove around the export.
 * See `docs/adr/0020-plot-export-canvas-compositing.md` for the fuller
 * reasoning and the alternatives this ruled out.
 */

import type Konva from 'konva';
import type { PlotConditions } from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';

/** Rasterisation density — doubles the export's pixel dimensions for crispness on modern (retina/HiDPI) screens without ballooning memory use. */
const EXPORT_PIXEL_RATIO = 2;

/** Legend panel width, in CSS px before `EXPORT_PIXEL_RATIO` scaling. */
const LEGEND_WIDTH_PX = 260;
/** Padding inside the legend panel, in CSS px before scaling. */
const LEGEND_PADDING_PX = 16;
/** Line height for legend text, in CSS px before scaling. */
const LEGEND_LINE_HEIGHT_PX = 20;
/** Legend font size, in CSS px before scaling. */
const LEGEND_FONT_SIZE_PX = 14;

/** Filename the exported PNG downloads as. */
const EXPORT_FILENAME = 'garden-plot.png';

/**
 * Build the legend's plain-text content: every placed crop (one per line, in
 * placement order) and the plot's growing conditions (light, soil texture if
 * known, resolved location name, hardiness band). Deliberately not a complete
 * record of every field — `docs/stage-3.7-brief.md` calls the export "a
 * snapshot, not a save file"; readable and compact beats exhaustive.
 *
 * Pure and framework-free (no Konva, no DOM) so it's unit-testable on its own.
 *
 * @param conditions - the plot's resolved conditions, or `null` if they don't
 * currently resolve (mirrors `PlotCanvasSection`'s own handling of an
 * incomplete/invalid `PlotConditionsInput` — the legend then just says so
 * rather than guessing).
 */
export function buildLegendText(
  placements: readonly PlacedPlant[],
  conditions: PlotConditions | null,
): string {
  const lines: string[] = ['Garden plot', ''];

  lines.push('Crops:');
  if (placements.length === 0) {
    lines.push('  (none placed)');
  } else {
    for (const placement of placements) {
      lines.push(`  - ${placement.plant.commonName}`);
    }
  }

  lines.push('');
  lines.push('Conditions:');
  if (conditions === null) {
    lines.push('  (not set)');
  } else {
    lines.push(`  Light: ${conditions.light.replace('-', ' ')}`);
    if (conditions.soil?.texture !== undefined) {
      lines.push(`  Soil: ${conditions.soil.texture}`);
    }
    lines.push(`  Location: ${conditions.climate.name}`);
    if (conditions.climate.hardiness.rhsRating !== undefined) {
      lines.push(`  Hardiness: ${conditions.climate.hardiness.rhsRating}`);
    }
  }

  return lines.join('\n');
}

/**
 * Wait for every currently-visible icon image in the Konva scene to finish
 * loading. `toCanvas`/`toDataURL` rasterise synchronously as-is — an icon
 * still loading when that's called renders blank (or as just the background
 * circle), so this must resolve before rasterising (`docs/stage-3.7-brief.md`'s
 * "gotchas to handle").
 *
 * In today's `PlotCanvas.tsx`, a marker's `<Image>` node is only ever added to
 * the scene *after* `useIconImage` has already resolved it (see that
 * component's render — the `<Image>` is conditional on the hook's loaded
 * image), so every `Image` node this finds should already be `.complete`.
 * This still guards the case explicitly, both because the brief asks for it
 * and so a future change to that rendering order doesn't silently reintroduce
 * blank-icon exports.
 */
function waitForIconImages(stage: Konva.Stage): Promise<void> {
  const imageNodes = stage.find<Konva.Image>('Image');
  const pendingImages = imageNodes
    .map((node) => node.image())
    .filter(
      (image): image is HTMLImageElement => image instanceof HTMLImageElement && !image.complete,
    );

  if (pendingImages.length === 0) return Promise.resolve();

  return Promise.all(
    pendingImages.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          // A failed load still resolves — the marker just stays without an
          // icon, exactly as it already renders on-screen; export must not
          // hang forever on a broken image.
          image.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/**
 * Rasterise `stage` and composite the legend beside it as a second panel on
 * one canvas — the "side Group... positioned so it doesn't overlap the plot
 * itself" the brief describes, built with the plain 2D Canvas API rather than
 * a Konva node (see this module's doc comment for why).
 */
function compositeExportCanvas(stage: Konva.Stage, legendText: string): HTMLCanvasElement {
  const stageCanvas = stage.toCanvas({ pixelRatio: EXPORT_PIXEL_RATIO });

  const legendWidthPx = LEGEND_WIDTH_PX * EXPORT_PIXEL_RATIO;
  const legendPaddingPx = LEGEND_PADDING_PX * EXPORT_PIXEL_RATIO;
  const lineHeightPx = LEGEND_LINE_HEIGHT_PX * EXPORT_PIXEL_RATIO;
  const fontSizePx = LEGEND_FONT_SIZE_PX * EXPORT_PIXEL_RATIO;

  const lines = legendText.split('\n');
  const legendHeightPx = legendPaddingPx * 2 + lines.length * lineHeightPx;

  const composite = document.createElement('canvas');
  composite.width = stageCanvas.width + legendWidthPx;
  composite.height = Math.max(stageCanvas.height, legendHeightPx);

  const ctx = composite.getContext('2d');
  if (ctx === null) throw new Error('2D canvas context unavailable — cannot export the plot');

  // White background so the legend panel (and any transparent stage margin)
  // exports as opaque, not black — a PNG's default when drawn onto nothing.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, composite.width, composite.height);
  ctx.drawImage(stageCanvas, 0, 0);

  ctx.fillStyle = '#111827';
  ctx.font = `${fontSizePx}px sans-serif`;
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => {
    ctx.fillText(line, stageCanvas.width + legendPaddingPx, legendPaddingPx + index * lineHeightPx);
  });

  return composite;
}

/** Trigger a browser download of `dataUrl` as `filename` — the brief's recommended choice over opening a new tab (simplest, least surprising). */
function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

/**
 * The export pipeline: wait for fonts and icons to be ready, build and
 * composite the legend beside the rasterised plot, and download the result as
 * a PNG.
 *
 * @param stageRef - a ref to the `PlotCanvas`'s Konva `Stage` (its `<Stage
 * ref={stageRef}>`, forwarded through `PlotCanvasSection`). A no-op if the
 * stage hasn't mounted yet.
 * @param placements - every plant currently placed, in placement order.
 * @param conditions - the plot's resolved conditions, or `null` if they don't
 * currently resolve.
 */
export async function exportPlotImage(
  stageRef: Readonly<{ current: Konva.Stage | null }>,
  placements: readonly PlacedPlant[],
  conditions: PlotConditions | null,
): Promise<void> {
  const stage = stageRef.current;
  if (stage === null) return;

  // Konva rasterises synchronously — text drawn before the chosen font has
  // loaded renders in a browser fallback font instead (the brief's other
  // "gotcha to handle").
  await document.fonts.ready;
  await waitForIconImages(stage);

  const legendText = buildLegendText(placements, conditions);
  const composite = compositeExportCanvas(stage, legendText);
  downloadDataUrl(composite.toDataURL('image/png'), EXPORT_FILENAME);
}
