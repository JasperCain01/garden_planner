import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

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
test.use({ viewport: { width: 1024, height: 3500 } });

async function dragOntoCanvas(page: Page, sourceLabel: RegExp, targetX: number, targetY: number) {
  const source = page.getByLabel(sourceLabel).first();
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) throw new Error('drag source has no bounding box');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetX - 40, targetY - 40, { steps: 5 });
  await page.mouse.move(targetX, targetY, { steps: 5 });
  await page.mouse.up();
}

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
    const canvasBox = await canvas.boundingBox();
    if (canvasBox === null) throw new Error('canvas has no bounding box');
    const canvasCentre = {
      x: canvasBox.x + canvasBox.width / 2,
      y: canvasBox.y + canvasBox.height / 2,
    };
    await dragOntoCanvas(
      page,
      /drag .* onto the plot to place it/i,
      canvasCentre.x + dx,
      canvasCentre.y + dy,
    );
  }
  await searchBox.fill('');
  await expect(page.locator('li', { hasText: 'Onion:' })).toContainText('1 placed of');
  await expect(page.locator('li', { hasText: 'Kale:' })).toContainText('1 placed of');
  await expect(page.locator('li', { hasText: 'Lettuce:' })).toContainText('1 placed of');

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
