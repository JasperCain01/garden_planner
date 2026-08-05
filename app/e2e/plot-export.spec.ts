import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { atPlotCm, dragCropOntoCanvas, filterPaletteTo } from './drag.ts';

// The export journey WORKPLAN.md §1.3 names for Stage 3.7: build a small
// plot, place a few crops, click Export, and confirm a real PNG downloads.
//
// Same real-pointer-event drag as `plot-canvas.spec.ts` and
// `add-custom-crop.spec.ts` (dnd-kit's `PointerSensor` needs genuine pointer
// events) — see those specs' comments and
// `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md`. The export itself (Konva's
// `toCanvas`/2D-canvas compositing, `docs/adr/0020`) only runs in a real
// browser, so this is the one place it's actually exercised — no component
// test drives the real pipeline (`PlotCanvasSection.test.tsx` mocks it).
// An ordinary laptop viewport. `page.mouse` works in viewport coordinates and
// does not scroll (see `drag.ts`), so both ends of the drag have to be on
// screen at once — which, since UI redesign Phase 1, is simply what the
// workspace layout does: the palette is the left sidebar and the canvas is the
// centre region, always side by side above 900px wide. These specs used to
// declare a 4000px-tall viewport to force the stacked page's palette and
// canvas into view together; that trick is gone with the stacked page.
test.use({ viewport: { width: 1440, height: 900 } });

test('exporting the plot downloads a PNG with the placed crops and a legend', async ({ page }) => {
  await page.goto('/');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();

  // Place three distinct crops at three corners of the plot. The canvas's
  // bounding box is read fresh right before each drag (`drag.ts` does it) —
  // less critical since the workspace layout decoupled the canvas's position
  // from the palette's length, but still right: placing a crop grows the dock
  // beneath the canvas and re-centres the stage.
  //
  // Positions are in plot centimetres (`atPlotCm`) rather than pixel offsets
  // from the canvas's centre. Since UI redesign Phase 2 the stage fills the
  // region and each marker is drawn at its crop's real footprint — kale wants
  // 75 cm — so a pixel offset that used to spread three crops out now piles
  // three overlapping canopies on the middle of the bed. The exported PNG is
  // supposed to look like a plan of a garden.
  const placements: ReadonlyArray<[crop: string, x: number, y: number]> = [
    ['Onion', 60, 50],
    ['Kale', 240, 50],
    ['Lettuce', 150, 160],
  ];
  for (const [crop, x, y] of placements) {
    await filterPaletteTo(page, crop);
    await dragCropOntoCanvas(page, crop, canvas, atPlotCm({ x, y }, { width: 300, height: 200 }));
    // Confirm this crop landed before filtering for the next one, so each
    // iteration starts from a settled page. The controlled-input race this
    // used to be the only guard against — a `fill` dropped by a React
    // re-render, leaving the palette on the previous crop — is now handled at
    // source by `filterPaletteTo`, which re-types rather than waiting harder.
    await expect(page.locator('li', { hasText: new RegExp(`^${crop}:`) })).toContainText(
      '1 placed of',
    );
  }
  await page.getByLabel(/^search$/i).fill('');
  // Anchored, so "Onion:" can't also match a "Green Onion:" tally row if a
  // future change to the drag ever places the wrong crop — the assertion has
  // to name the same exact crop the drag did for it to mean anything.
  await expect(page.locator('li', { hasText: /^Onion:/ })).toContainText('1 placed of');
  await expect(page.locator('li', { hasText: /^Kale:/ })).toContainText('1 placed of');
  await expect(page.locator('li', { hasText: /^Lettuce:/ })).toContainText('1 placed of');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /export image/i }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('garden-plot.png');

  const path = await download.path();
  if (path === null) throw new Error('download has no local path');
  const bytes = readFileSync(path);

  // A real, non-trivial PNG: the magic bytes, and comfortably more than a
  // blank canvas would compress to (confirms the plot outline, the three
  // markers, and the legend text all actually rendered, without needing a
  // full visual snapshot — this repo has no screenshot-snapshot convention
  // yet, so this is deliberately not the one to introduce it).
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  expect(bytes.length).toBeGreaterThan(2000);
});
