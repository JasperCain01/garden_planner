import { expect, test, type Page } from '@playwright/test';

import { filterPaletteTo } from './drag.ts';

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
