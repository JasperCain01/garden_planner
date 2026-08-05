import { expect, test, type Page } from '@playwright/test';

import { filterPaletteTo } from './drag.ts';
import { startWithNoSavedDesigns } from './storage.ts';

/**
 * The UI redesign Phase 2 acceptance criteria, as a test
 * (`docs/ui-aesthetic-review.md` §"Phase 2 — Canvas as hero"):
 *
 * > default 3×2m plot fills the canvas region on first load; markers scale
 * > with footprint; three "Add to plot" clicks yield three visibly separate
 * > markers; export still works.
 *
 * (The last is `plot-export.spec.ts`, which was already the export journey's
 * home and now also proves it survived the canvas learning to scale.)
 *
 * **Measuring what Konva painted.** The other three are all claims about
 * pixels on a `<canvas>`, which has no DOM to query — the limitation ADR 0017
 * records as the reason this component has no component test. So these read
 * the stage's own image data back with `getImageData` and count how many
 * pixels changed against a baseline taken before anything was placed. That is
 * a *measurement*, not a screenshot comparison: nothing here compares against
 * a stored image, so there is no golden file to regenerate and no
 * anti-aliasing sensitivity beyond "did this pixel change at all". This repo
 * has no screenshot-snapshot convention and this is deliberately not the spec
 * that introduces one.
 */

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Every `goto` here means an empty plot (UI redesign Phase 5).
 *
 * `pixelsDrawnByExtraPlacements` below reloads the app between the two crops it
 * compares, and the app saves the open design now — so without this the second
 * measurement would start from a plot that still had the first crop's markers
 * on it, and the difference being counted would be the wrong difference. See
 * `storage.ts`.
 */
test.beforeEach(async ({ page }) => {
  await startWithNoSavedDesigns(page);
});

/** How long to wait for the drop "pop" (150ms, `PlotCanvas.tsx`) to finish before measuring. */
const SETTLE_MS = 400;

/**
 * The stage's rendered size, read off the canvas element Konva paints into.
 *
 * Konva renders at `devicePixelRatio`, so the backing store can be larger than
 * the CSS box; the element's `clientWidth`/`clientHeight` is the size the user
 * sees, which is what "fills the region" is a claim about.
 */
async function stageSize(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#plot-canvas canvas');
    if (canvas === null) throw new Error('no Konva canvas inside #plot-canvas');
    return { width: canvas.clientWidth, height: canvas.clientHeight };
  });
}

/** The stage's pixels, as a plain array, for differencing. */
async function stagePixels(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#plot-canvas canvas');
    if (canvas === null) throw new Error('no Konva canvas inside #plot-canvas');
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('no 2D context on the Konva canvas');
    return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
  });
}

/**
 * The Konva canvas's **backing store** size — `canvas.width`/`canvas.height`,
 * not the CSS `clientWidth`/`clientHeight` {@link stageSize} reads. `stagePixels`
 * indexes `getImageData` by the backing store, which is `clientWidth *
 * devicePixelRatio`; a test that needs to address a *particular* pixel (rather
 * than just count how many changed, as {@link changedPixels} does) has to use
 * the same frame `stagePixels` did or it addresses the wrong ones whenever
 * `devicePixelRatio !== 1`.
 */
async function stagePixelSize(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#plot-canvas canvas');
    if (canvas === null) throw new Error('no Konva canvas inside #plot-canvas');
    return { width: canvas.width, height: canvas.height };
  });
}

/** How many pixels differ between two same-sized readings — i.e. how much of the scene a change actually drew. */
function changedPixels(before: readonly number[], after: readonly number[]): number {
  expect(
    after.length,
    'the stage resized between the two readings, so they cannot be differenced — ' +
      'something changed the canvas viewport (most likely the dock below it growing)',
  ).toBe(before.length);
  let changed = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (
      before[i] !== after[i] ||
      before[i + 1] !== after[i + 1] ||
      before[i + 2] !== after[i + 2] ||
      before[i + 3] !== after[i + 3]
    ) {
      changed += 1;
    }
  }
  return changed;
}

/**
 * Place `cropName` once, take a baseline, place it `extra` more times, and
 * report how many stage pixels those extra markers drew.
 *
 * **Why the baseline has a plant on it already.** The dock under the canvas
 * (selection readout + count feedback) is empty until something is placed, and
 * grows when it isn't — which shrinks the canvas viewport, which re-fits the
 * scale, which changes the stage's pixel dimensions. Two readings taken either
 * side of the *first* placement therefore aren't the same size and can't be
 * differenced at all. Placing one first gets the dock to its settled size;
 * placing more of the **same crop** keeps it there, because the tally is one
 * row per distinct crop.
 *
 * The keyboard-operable "Add to plot" button rather than a drag, deliberately:
 * it is the path the centre-stacking bug lived on, and it needs no pointer, so
 * the measurement isn't entangled with where a drag happened to land.
 */
async function pixelsDrawnByExtraPlacements(
  page: Page,
  cropName: string,
  extra: number,
): Promise<number> {
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();
  await filterPaletteTo(page, cropName);
  // Park the pointer somewhere harmless: a marker under it would draw a hover
  // tooltip and count as "drawn by placing".
  await page.mouse.move(0, 0);

  const addButton = page.getByRole('button', {
    name: new RegExp(`^Add ${cropName} to the plot, without dragging$`, 'i'),
  });
  await addButton.click();
  await expect(page.getByText(/1 placed of/)).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);

  const before = await stagePixels(page);
  for (let i = 0; i < extra; i += 1) {
    await addButton.click();
  }
  await expect(page.getByText(new RegExp(`${extra + 1} placed of`))).toBeVisible();

  // Put the selection back on the first plant, so its glow ring is present in
  // *both* readings and cancels out of the difference. Without this the
  // measurement is dominated by the glow moving — a blurred 16px halo around
  // one marker changed ~11,000 pixels, several times what an extra lettuce
  // marker draws, which swamped the thing being measured. "Next placement"
  // wraps from the last placement round to the first, so one press does it
  // however many were added.
  await page.getByRole('button', { name: /next placement/i }).click();
  await page.waitForTimeout(SETTLE_MS);

  return changedPixels(before, await stagePixels(page));
}

test('the default 3×2m plot fills the canvas region on first load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  const region = await page.getByRole('region', { name: 'Your plot' }).boundingBox();
  if (region === null) throw new Error('the "Your plot" region has no bounding box');
  const stage = await stageSize(page);

  // Before this phase the stage was a fixed ~228×168px in an ~820×836px
  // region: 5.6% of it by area, which is the finding ("a pale green postage
  // stamp"). Fitted, it is ~732×539 — 58% of the region, with the rest being
  // the toolbar, the hint line, the dock, and the padding the dimension labels
  // are drawn in.
  //
  // Both a share and a shape are asserted. The plot fits to whichever axis
  // runs out first (here the height, since the toolbar and dock take from it),
  // so a stage that filled the width while collapsing to a sliver would still
  // pass an area check and would look absurd.
  expect((stage.width * stage.height) / (region.width * region.height)).toBeGreaterThan(0.5);
  expect(stage.width / region.width).toBeGreaterThan(0.85);
  expect(stage.height / region.height).toBeGreaterThan(0.5);
  // ...and the plot's aspect ratio is intact: the padded 3×2m box is 380×280.
  expect(stage.width / stage.height).toBeCloseTo(380 / 280, 1);
});

test('a squash marker claims far more of the bed than a radish marker', async ({ page }) => {
  // The review's own acceptance wording: "markers scale with footprint — a
  // squash visibly needs more room than a radish". The two crops' spacing
  // footprints (`data/plants.json`) are 150 cm and 15 cm, so the canopy discs
  // differ by 10× in radius and ~100× in area. A generous factor is asserted
  // rather than the exact ratio, because the icon and name label are drawn at
  // a capped size and contribute a fixed amount to both counts.
  //
  // `test.slow()` (post-review fix C3): two full page loads, two production
  // builds' worth of app boot, and settle waits either side of each — this
  // spec's own timeout budget rather than a run flag the qa-checklist has to
  // remember to pass.
  test.slow();
  const radish = await pixelsDrawnByExtraPlacements(page, 'Radish', 1);
  const squash = await pixelsDrawnByExtraPlacements(page, 'Butternut Squash', 1);

  expect(radish).toBeGreaterThan(0);
  expect(squash).toBeGreaterThan(radish * 10);
});

test('three "Add to plot" clicks yield three visibly separate markers', async ({ page }) => {
  // The review's "single worst first-run bug-that-isn't-a-bug": every press
  // placed at the region centre, so three markers stacked into one and the
  // plot appeared to eat two of them.
  //
  // Measured as "how much does the 2nd press draw" against "how much do the
  // 2nd, 3rd and 4th draw" (see `pixelsDrawnByExtraPlacements` for why the
  // baseline has one plant on it). With the old behaviour *both* numbers would
  // be ~0, because every extra marker landed exactly on top of the first and
  // changed no pixels at all — so the first assertion alone catches the bug,
  // and the second says the markers keep separating rather than filling one
  // shared clump.
  //
  // `test.slow()` (post-review fix C3) — see the squash-vs-radish spec above.
  test.slow();
  const oneMore = await pixelsDrawnByExtraPlacements(page, 'Lettuce', 1);
  const threeMore = await pixelsDrawnByExtraPlacements(page, 'Lettuce', 3);

  expect(oneMore).toBeGreaterThan(0);
  expect(threeMore).toBeGreaterThan(oneMore * 2);
});

test('zoom controls scale the plot, and Fit puts it back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  const fitted = await stageSize(page);
  expect(await page.getByText('100%').isVisible()).toBe(true);

  await page.getByRole('button', { name: /zoom in/i }).click();
  const zoomedIn = await stageSize(page);
  expect(zoomedIn.width).toBeGreaterThan(fitted.width);
  expect(await page.getByText('125%').isVisible()).toBe(true);

  await page.getByRole('button', { name: /fit the plot to the screen/i }).click();
  const refitted = await stageSize(page);
  expect(refitted.width).toBeCloseTo(fitted.width, 0);
});

test('an oversize canopy does not flood the soil surround (post-review fix A1)', async ({
  page,
}) => {
  // The review's own repro: an Apple's 360×450 cm spacing dwarfs the default
  // 3×2 m plot, so its canopy disc — drawn at true scale — is bigger than the
  // plot. Before the fix that disc's *fill* painted straight through the plot
  // edge onto the soil surround and the dimension labels; the fix clips the
  // fill to the plot outline (`PlotCanvas.tsx`) so it cannot.
  //
  // This reads a **single** settled snapshot rather than diffing two, unlike
  // this file's other pixel checks: the dock beneath the canvas grows a row
  // the moment a crop's tally first appears (see `pixelsDrawnByExtraPlacements`
  // for why that couples into the stage's own pixel dimensions), so a "before
  // Apple / after Apple" pair can never be the same size to difference. What's
  // asserted instead is that the padding band — known, from `geometry.ts`, to
  // be nothing but the flat soil-coloured `Rect` this far from the plot edge
  // or any canvas corner — is still exactly that colour with the Apple placed.
  // Before the fix this probe point would have read back translucent red.
  await page.goto('/');
  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();

  await filterPaletteTo(page, 'Apple');
  await page.mouse.move(0, 0); // no stray hover tooltip in the reading
  await page.getByRole('button', { name: /^Add Apple to the plot, without dragging$/i }).click();
  await expect(page.getByText(/1 placed of/)).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);

  const size = await stagePixelSize(page);

  // The padded canvas is the plot's bounding box plus `CANVAS_PADDING_CM`
  // (40 cm) on every side; the default plot is 300×200 cm, so the padding is
  // 40/380 of the canvas's width and 40/280 of its height.
  const paddingYPx = (size.height * 40) / 280;

  // A probe rectangle in the **top** padding band — label-free (the width
  // label lives in the bottom band, the height label in the left band; see
  // `PlotCanvas.tsx`), centred horizontally so it is far from the extreme
  // corners the canopy's honestly-unclipped *ring* is allowed to reach (its
  // radius is just under the padded canvas's own half-diagonal for this
  // crop/plot pairing — a small arc into the corners is the fix working as
  // intended, not the flood it replaced), and kept clear of both the canvas's
  // own top edge and the outline's drop-shadow bleed near the plot edge.
  const probe = {
    x: Math.round(size.width * 0.4),
    y: Math.round(paddingYPx * 0.35),
    width: Math.round(size.width * 0.2),
    height: Math.max(1, Math.round(paddingYPx * 0.2)),
  };
  expect(probe.y, 'the padding band is too thin to probe safely at this viewport').toBeGreaterThan(
    4,
  );

  const pixels = await page.evaluate((rect) => {
    const canvasEl = document.querySelector<HTMLCanvasElement>('#plot-canvas canvas');
    if (canvasEl === null) throw new Error('no Konva canvas inside #plot-canvas');
    const context = canvasEl.getContext('2d');
    if (context === null) throw new Error('no 2D context on the Konva canvas');
    return Array.from(context.getImageData(rect.x, rect.y, rect.width, rect.height).data);
  }, probe);

  // `SCENE_COLORS['soil-100']`, the ground `Rect`'s flat fill — see `scene.ts`.
  const SOIL_100_RGB = [0xef, 0xe6, 0xdc];
  for (let i = 0; i < pixels.length; i += 4) {
    expect(
      [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]],
      `padding-band pixel at offset ${i / 4} was not plain soil — the canopy fill reached ` +
        'outside the plot outline',
    ).toEqual([...SOIL_100_RGB, 255]);
  }
});

test('"Edit shape" reshapes the plot from the keyboard alone', async ({ page }) => {
  // The gap `docs/accessibility.md` §5 had recorded since Stage 6.2: the
  // outline editor's corner handles were pointer-only. Merging the editor into
  // the canvas closed it, and this is the proof — no `page.mouse`, and the
  // plot's own dimension label is what reports the result, because it is what
  // a user would read.
  await page.goto('/');
  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();

  await page.getByRole('button', { name: /^edit shape$/i }).click();
  await expect(page.getByLabel(/editing the plot shape/i)).toBeVisible();

  // The stage's shape is the observable: it is sized from the plot's padded
  // bounding box, so widening the plot widens the stage relative to its
  // height. The default 3×2m plot pads to 380×280 cm — an aspect ratio of
  // ~1.36.
  const before = await stageSize(page);
  expect(before.width / before.height).toBeCloseTo(380 / 280, 1);

  // Corner 0 (the outline's top-left) is selected on entering edit mode, so
  // the arrow keys have something to act on immediately — no pointer, and no
  // hunting for a handle first.
  await canvas.focus();
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Shift+ArrowLeft');
  }

  // Four 50cm steps: the plot is now 500 cm across and still 200 deep, which
  // pads to 580×280 and an aspect ratio of ~2.07.
  await expect
    .poll(async () => {
      const after = await stageSize(page);
      return after.width / after.height;
    })
    .toBeGreaterThan(1.8);

  await page.getByRole('button', { name: /done editing shape/i }).click();
  await expect(page.getByLabel(/drag plants here to place them/i)).toBeVisible();
});
