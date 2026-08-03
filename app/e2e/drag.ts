import { expect, type Locator, type Page } from '@playwright/test';

import { CANVAS_PADDING_CM } from '../src/canvas/geometry.ts';

/**
 * The one way these specs drag a crop from the palette onto the plot canvas.
 *
 * Five specs need this interaction and four of them had grown their own
 * near-identical copy, which is how the two bugs below ended up fixed in some
 * copies and not others. It lives here now so a fix lands once.
 *
 * ## Why a real pointer drag
 *
 * dnd-kit's `PointerSensor` listens for genuine
 * `pointerdown`/`pointermove`/`pointerup` — not the native `dragstart`/`drop`
 * events Playwright's own `dragAndDrop` helper fires — and Konva renders to a
 * `<canvas>` with no queryable DOM. So this drives real mouse events against a
 * real browser and a real Konva scene. See
 * `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md`.
 *
 * ## The two traps this helper exists to close
 *
 * **1. The locator must name the crop.** A wildcard like
 * `/drag .* onto the plot to place it/i` plus `.first()` is satisfied by
 * *whatever entry is currently rendered* — including a stale one from the
 * previous search term, before React has finished re-ranking 144 plants. The
 * drag then places the previous crop a second time and the intended one not at
 * all. (That is a real failure, not a hypothetical: it is how
 * `plot-export.spec.ts` intermittently reported "Kale: 2 placed" and no
 * lettuce.) Naming the crop means the locator resolves to nothing until the
 * filter has actually applied, so Playwright's auto-waiting does the
 * synchronising. It is also unambiguous where a wildcard is not — "Onion"
 * matches six shipped crops and "Kale" four, so `.first()` would silently
 * depend on the suitability ranking's order.
 *
 * **2. Both ends must be inside the viewport.** `page.mouse` works in
 * **viewport** coordinates and does not scroll.
 *
 * Until UI redesign Phase 1 this was the hard part: the palette and the canvas
 * were stacked ~1,500px apart in one column, so every spec that dragged had to
 * declare a 4,000px-tall viewport and hope it stayed tall enough — a moving
 * target, since a filtered palette that renders one more row than it used to
 * pushes the canvas below the fold, the drag silently does nothing, and the
 * spec fails several lines later with a confusing message ("nothing placed
 * yet" is still visible). The workspace layout retires the trick outright: the
 * palette sidebar and the canvas are side by side and both on screen at any
 * ordinary desktop size, so the specs now use ordinary desktop viewports.
 * {@link assertInViewport} stays for the drop target, because "the mouse can
 * reach it" is still a precondition worth failing loudly on rather than
 * mysteriously.
 *
 * **3. The palette scrolls inside itself, so "on-screen" isn't automatic, and
 * a single entry can be taller than its own scrollport.** The crop list is a
 * bounded box with its own scrollbar (`palette/PlantPalette.module.css` — it
 * fills the sidebar's height and scrolls the crops past the filters), so a
 * matching entry can be laid out below that box's own fold: rendered, reported
 * visible, and yet nowhere the mouse can reach it. Worse, a palette row still
 * renders the engine's full per-dimension reasoning, which for some crops is
 * ~560px tall — more than the whole list box — so "scroll it into view" cannot
 * make *all* of it reachable, only some of it. Hand-computing a press point
 * from `boundingBox()` gets this wrong (it aims at the centre of a box whose
 * centre is off-screen); `locator.hover()` gets it right, because scrolling
 * the element into view and picking a point on it that actually receives
 * events is exactly Playwright's actionability check. So the source end of the
 * drag is a `hover()` and only the *target* end is measured by hand — the
 * canvas has no such problem, and the specs need to aim at particular points
 * on it.
 *
 * **4. A fraction of the canvas box is not a distance.** See
 * {@link atPlotCm} — since UI redesign Phase 2 the stage fills the region, so
 * the same fraction of it means a very different number of centimetres than it
 * used to, and any spec whose *point* is a distance (two crops close enough to
 * warn about) has to say so in the plot's own units.
 */

/**
 * Type `cropName` into the palette's search box and wait until that crop's
 * entry is actually on screen, **re-typing if the value doesn't stick**.
 *
 * This closes the flake `playwright.config.ts` and `docs/qa-checklist.md` §4
 * have carried as "`plot-export.spec.ts` fails once in a while and passes on
 * retry". Instrumenting a failing run showed exactly what the specs' own
 * comments guessed at: the assertion fails with the search box still holding
 * the *previous* term (`searchValue="Potato"` while the spec had filled
 * "Tomato"), so no Tomato entry ever renders.
 *
 * The cause is the classic controlled-input race. `fill()` sets the value and
 * fires one `input` event; React's `onChange` updates state and re-renders —
 * and re-ranking 144 crops is slow enough that a render already in flight with
 * the old state can commit afterwards and write the old value straight back
 * onto the DOM node. No amount of waiting fixes that, because nothing further
 * is coming: the keystroke is simply gone.
 *
 * So this retries the fill rather than waiting harder on one. `toPass` re-runs
 * the whole block, which is what makes the difference between "wait longer for
 * something that will never happen" and "type it again".
 */
export async function filterPaletteTo(page: Page, cropName: string): Promise<void> {
  const searchBox = page.getByLabel(/^search$/i);
  const entry = page.getByLabel(new RegExp(`^drag ${cropName} onto the plot to place it$`, 'i'));

  await expect(async () => {
    await searchBox.fill(cropName);
    await expect(searchBox).toHaveValue(cropName, { timeout: 1_000 });
    await expect(entry).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Fail with a useful message if the drop point isn't inside the viewport.
 *
 * Without this the symptom of an off-screen drop target is a mouse event that
 * lands nowhere and an assertion failure several lines further on, which says
 * nothing about the actual cause.
 */
function assertInViewport(page: Page, point: { x: number; y: number }, what: string): void {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('no viewport size — these specs set one explicitly');
  if (point.x < 0 || point.y < 0 || point.x > viewport.width || point.y > viewport.height) {
    throw new Error(
      `${what} is outside the ${viewport.width}×${viewport.height} viewport ` +
        `(${point.x.toFixed(0)}, ${point.y.toFixed(0)}). ` +
        'page.mouse uses viewport coordinates and does not scroll, so the drag would ' +
        'silently do nothing. Give this spec a larger viewport — or check the workspace ' +
        'layout still puts the palette and the canvas side by side at this size ' +
        '(below 900px wide it stacks them, and then they are not both in view).',
    );
  }
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The canvas's bounding box, read **fresh**.
 *
 * In the stacked layout this was load-bearing: the canvas sat below the
 * palette, so its on-page position moved whenever a search changed how many
 * rows rendered above it, and a box captured up front went stale the moment a
 * filter applied. The workspace layout makes the canvas's position independent
 * of the palette — but it is still not *fixed* (placing a crop grows the dock
 * beneath the canvas, which re-centres the stage inside its viewport), so the
 * rule stands: read it immediately before the drag that uses it.
 */
export async function canvasBoxOf(canvas: Locator): Promise<BoundingBox> {
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('canvas has no bounding box');
  return box;
}

/** Where on the canvas to drop, given its (freshly-read) box. Defaults to the centre. */
export type DropPoint = (canvasBox: BoundingBox) => { x: number; y: number };

/** The canvas's centre — what almost every spec wants. */
const CANVAS_CENTRE: DropPoint = (box) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

/**
 * A drop point expressed in **plot centimetres** rather than as a fraction of
 * the canvas box.
 *
 * This exists because of what UI redesign Phase 2 did to the canvas, and it is
 * worth spelling out. Until that phase the stage was drawn at a fixed
 * 0.6 px/cm, so the default 3×2m plot was a ~228×168px rectangle and "40% of
 * the way across the canvas" happened to be a small number of centimetres. The
 * stage now fills the region — the same plot is ~790px wide at 1440×900 — so
 * the *same fraction* is more than three times the distance in the units the
 * engine reasons in. A spec that drops two antagonists at 0.4 and 0.6 of the
 * width was asserting "these are 76 cm apart" and would silently start
 * asserting "these are 250 cm apart", where the antagonist rule correctly says
 * nothing at all.
 *
 * The fix is to say what was meant. The conversion is `geometry.ts#cmToPx`,
 * turned into a fraction of the padded box so it holds at any scale:
 *
 *     fraction = (cm - min + padding) / (extent + 2 * padding)
 *
 * `CANVAS_PADDING_CM` is imported from the app rather than restated here, so a
 * change to the canvas's padding moves these specs with it instead of leaving
 * them quietly aiming somewhere else.
 *
 * @param plotSizeCm - the plot's own dimensions. A spec has to know these to
 * mean anything by a centimetre position; the default plot is 300 × 200
 * (`state/plot-store.ts`).
 */
export function atPlotCm(
  point: { x: number; y: number },
  plotSizeCm: { width: number; height: number },
): DropPoint {
  const fraction = (value: number, extent: number) =>
    (value + CANVAS_PADDING_CM) / (extent + CANVAS_PADDING_CM * 2);
  return (box) => ({
    x: box.x + box.width * fraction(point.x, plotSizeCm.width),
    y: box.y + box.height * fraction(point.y, plotSizeCm.height),
  });
}

/**
 * Drag the palette entry for exactly `cropName` onto the canvas.
 *
 * **The canvas box is read here, not by the caller**, and only *after* the
 * palette entry is visible. That ordering was originally about the canvas
 * moving when a filter changed the row count above it; the workspace layout
 * removed that particular coupling, but the ordering is still what keeps the
 * source and the target measured in the same, settled frame — waiting for the
 * entry first means the re-ranking re-render has already happened before
 * anything is measured.
 *
 * @param cropName - the crop's `commonName`, matched exactly against the
 * palette entry's `aria-label` (`drag <name> onto the plot to place it`).
 * @param canvas - the plot canvas locator.
 * @param dropPoint - where on the canvas to drop; defaults to its centre.
 */
export async function dragCropOntoCanvas(
  page: Page,
  cropName: string,
  canvas: Locator,
  dropPoint: DropPoint = CANVAS_CENTRE,
): Promise<void> {
  const source = page.getByLabel(new RegExp(`^drag ${cropName} onto the plot to place it$`, 'i'));
  await expect(source).toBeVisible();

  // Put the pointer on the entry. `hover()` rather than a hand-computed
  // `boundingBox()` centre: it scrolls the palette's own list until the entry
  // is reachable *and* picks a point on it that receives events, which is the
  // difference between working and not for a row taller than the list box
  // (trap 3 in the module doc). It leaves the canvas exactly where it was —
  // the list is a fixed region of the sidebar.
  await source.hover();

  const target = dropPoint(await canvasBoxOf(canvas));
  assertInViewport(page, target, 'the drop target');

  await page.mouse.down();
  // Several intermediate moves: dnd-kit's PointerSensor needs actual pointer
  // movement to register a drag as started.
  await page.mouse.move(target.x - 40, target.y - 40, { steps: 5 });
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
}
