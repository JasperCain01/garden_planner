import { expect, type Locator, type Page } from '@playwright/test';

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
 * **viewport** coordinates and does not scroll. The palette is long, so these
 * specs use a very tall viewport to keep the palette entry and the canvas
 * on-screen at once — but "tall enough" is a moving target: it was set when
 * the dataset was smaller, and a filtered palette that renders one more row
 * than it used to pushes the canvas below the fold. The drag then silently
 * does nothing and the spec fails somewhere later with a confusing message
 * ("nothing placed yet" is still visible). {@link assertInViewport} turns that
 * into an immediate, self-explaining failure instead.
 */

/**
 * Fail with a useful message if `box` isn't fully inside the viewport.
 *
 * Without this the symptom of an off-screen drop target is a mouse event that
 * lands nowhere and an assertion failure several lines further on, which says
 * nothing about the actual cause.
 */
async function assertInViewport(page: Page, box: BoundingBox, what: string): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('no viewport size — these specs set one explicitly');
  const bottom = box.y + box.height;
  const right = box.x + box.width;
  if (box.y < 0 || box.x < 0 || bottom > viewport.height || right > viewport.width) {
    throw new Error(
      `${what} is outside the ${viewport.width}×${viewport.height} viewport ` +
        `(x ${box.x.toFixed(0)}–${right.toFixed(0)}, y ${box.y.toFixed(0)}–${bottom.toFixed(0)}). ` +
        'page.mouse uses viewport coordinates and does not scroll, so the drag would ' +
        'silently do nothing. Raise the viewport height in this spec.',
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
 * Its on-page position moves whenever the palette's filtered result count
 * changes, so a box captured once up front goes stale the moment a search
 * narrows the list. Always call this immediately before the drag that uses it.
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
 * Drag the palette entry for exactly `cropName` onto the canvas.
 *
 * **The canvas box is read here, not by the caller**, and only *after* the
 * palette entry is visible. That ordering is the point: filtering the palette
 * changes how many rows render above the canvas, which moves the canvas on the
 * page. A caller that reads the box immediately after `searchBox.fill(...)`
 * captures the position from *before* the filter applied, and then drops in the
 * wrong place — a stale-target twin of the stale-source bug in the module doc
 * above. Waiting for the entry first means the re-render has already happened.
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
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) throw new Error(`no bounding box for the "${cropName}" palette entry`);

  const target = dropPoint(await canvasBoxOf(canvas));

  await assertInViewport(page, sourceBox, `the "${cropName}" palette entry`);
  await assertInViewport(page, { ...target, width: 0, height: 0 }, 'the drop target');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  // Several intermediate moves: dnd-kit's PointerSensor needs actual pointer
  // movement to register a drag as started.
  await page.mouse.move(target.x - 40, target.y - 40, { steps: 5 });
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
}
