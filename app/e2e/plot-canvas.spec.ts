import { expect, test, type Page } from '@playwright/test';

// The core-journey drag-drop test WORKPLAN.md §1.3 anticipates for Stage 3.4:
// define a plot (the default one is already valid) → drag a plant from the
// palette onto the canvas → see live count feedback → move it → remove it.
//
// This is the coverage `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md`
// designates for the interaction jsdom component tests can't drive: dnd-kit's
// `PointerSensor` listens for real `pointerdown`/`pointermove`/`pointerup`
// (not the native `dragstart`/`drop` events Playwright's own `dragAndDrop`
// helper fires), and Konva renders to a `<canvas>` with no queryable DOM — so
// this drives real mouse events against a real browser and Konva scene.
//
// A tall viewport keeps both the palette entry and the canvas simultaneously
// on-screen: the unfiltered palette (160 shipped crops) makes the full page
// many times taller than a normal viewport, and a `page.mouse` drag doesn't
// auto-scroll the way a `Locator` action would. Filtering the palette by
// search narrows this further, which also happens to be realistic — a
// gardener hunting for one crop searches first.
test.use({ viewport: { width: 1024, height: 3500 } });

async function dragOntoCanvas(page: Page, sourceLabel: RegExp, targetX: number, targetY: number) {
  const source = page.getByLabel(sourceLabel).first();
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) throw new Error('drag source has no bounding box');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  // Several intermediate moves: dnd-kit's PointerSensor needs actual pointer
  // movement to register a drag as started.
  await page.mouse.move(targetX - 40, targetY - 40, { steps: 5 });
  await page.mouse.move(targetX, targetY, { steps: 5 });
  await page.mouse.up();
}

test('dragging a plant from the palette onto the plot places it, with live count feedback', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel(/^search$/i).fill('Onion');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  if (canvasBox === null) throw new Error('canvas has no bounding box');
  const canvasCentre = {
    x: canvasBox.x + canvasBox.width / 2,
    y: canvasBox.y + canvasBox.height / 2,
  };

  // Before anything is placed, the feedback panel says so.
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  await dragOntoCanvas(page, /drag .* onto the plot to place it/i, canvasCentre.x, canvasCentre.y);

  // A plant landed: the "nothing placed" prompt is gone, replaced by a
  // fitPlant summary sentence ("<Crop> — N plants: ...") and a tally line.
  await expect(page.getByText(/nothing placed yet/i)).not.toBeVisible();
  await expect(page.getByText(/plants:/)).toBeVisible();
  await expect(page.getByText(/1 placed of/)).toBeVisible();

  // Select it, then remove it via the toolbar button — back to "nothing placed".
  await page.mouse.click(canvasCentre.x, canvasCentre.y);
  await page.getByRole('button', { name: /remove/i }).click();
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();
});
