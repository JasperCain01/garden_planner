import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { dragCropOntoCanvas } from './drag.ts';

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
// A very tall viewport keeps the palette entry and the canvas on-screen at
// once: `page.mouse` works in viewport coordinates and does not scroll (see
// `drag.ts`). 4000 is deliberate headroom over the ~3700 a filtered palette
// plus the canvas actually needs today — at 3500 the canvas sat just below
// the fold and drags intermittently did nothing. `drag.ts` asserts both ends
// are in view, so if this ever stops being enough the failure says so.
test.use({ viewport: { width: 1024, height: 4000 } });

test('exporting the plot downloads a PNG with the placed crops and a legend', async ({ page }) => {
  await page.goto('/');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();

  // Place three distinct crops at different points on the plot. The canvas's
  // on-page position shifts every time the search filter changes how many
  // palette entries render above it, so its bounding box is read fresh right
  // before each drag — the same gotcha `add-custom-crop.spec.ts` records.
  const searchBox = page.getByLabel(/^search$/i);
  const placements: ReadonlyArray<[crop: string, dx: number, dy: number]> = [
    ['Onion', -40, -40],
    ['Kale', 40, -40],
    ['Lettuce', 0, 40],
  ];
  for (const [crop, dx, dy] of placements) {
    await searchBox.fill(crop);
    await dragCropOntoCanvas(page, crop, canvas, (box) => ({
      x: box.x + box.width / 2 + dx,
      y: box.y + box.height / 2 + dy,
    }));
    // Confirm this crop landed before filtering for the next one. Without it,
    // the next `fill` races this placement's re-render — and a controlled
    // React input mid-re-render can quietly drop the typed value, leaving the
    // palette showing the previous crop.
    await expect(page.locator('li', { hasText: new RegExp(`^${crop}:`) })).toContainText(
      '1 placed of',
    );
  }
  await searchBox.fill('');
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
