import { expect, test, type Locator, type Page } from '@playwright/test';

// The user-defined-crop journey WORKPLAN.md §1.3 names for Stage 3.6: add a
// custom crop through the "Add your own crop" form → it appears in the
// "Discover suitable plants" palette (Stage 3.3), scores against the plot
// like any shipped crop, and drags onto the canvas (Stage 3.4) with a
// correct count — confirming, rather than assuming, that neither the palette
// nor the canvas needed any change to pick up a user-defined `Plant`
// (`docs/architecture.md`'s Stage 3.6 note).
//
// Same real-pointer-event approach as `plot-canvas.spec.ts` and
// `warnings-overlay.spec.ts`, for the same reason (dnd-kit's `PointerSensor`
// needs genuine pointer events; Konva renders to a `<canvas>` with nothing
// for a jsdom-style locator to query) — see those specs' own comments and
// `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md`.
test.use({ viewport: { width: 1024, height: 3500 } });

/**
 * Read fresh, right before the drag that needs it: the unfiltered palette
 * (160 shipped crops plus the one custom crop this test adds) makes the page
 * many times taller than the viewport, and the search filter narrowing the
 * palette to one result moves the canvas's on-page position — a `canvasBox`
 * captured once up front would go stale the moment the filter changes (the
 * exact gotcha `plot-canvas.spec.ts` and `warnings-overlay.spec.ts` both
 * record).
 */
async function canvasBoxOf(canvas: Locator) {
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('canvas has no bounding box');
  return box;
}

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

test('adding a custom crop makes it appear in the palette and placeable on the canvas', async ({
  page,
}) => {
  await page.goto('/');

  // Fill in the add-crop form with a full-sun vegetable no shipped crop is
  // named after, so the later palette search matches only this one entry.
  // Scoped to the form itself (`aria-label="add a crop"`) since "Category" is
  // also a label the palette's own filter uses.
  const addCropForm = page.getByRole('form', { name: 'add a crop' });
  await addCropForm.getByLabel(/name \(from the packet\)/i).fill('Custom Test Crop');
  await addCropForm.getByLabel(/^category$/i).selectOption('vegetable');
  await addCropForm.getByLabel(/light requirement/i).selectOption('full-sun');
  await addCropForm.getByLabel(/in-row spacing/i).fill('10');
  await addCropForm.getByLabel(/between-row spacing/i).fill('30');
  await addCropForm.getByRole('button', { name: /add crop/i }).click();

  // It lands in "Your added crops" ...
  await expect(
    page.getByRole('heading', { name: /your added crops/i }).locator('xpath=following::li[1]'),
  ).toContainText('Custom Test Crop');

  // ... and — the actual deliverable — it appears in the ranked palette above,
  // scored against the plot's (default, full-sun) conditions like any shipped
  // crop, findable by the same search box every other palette entry uses.
  await page.getByLabel(/^search$/i).fill('Custom Test Crop');
  const paletteEntry = page.getByLabel(/^drag custom test crop onto the plot to place it$/i);
  await expect(paletteEntry).toBeVisible();

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();
  const canvasBox = await canvasBoxOf(canvas);
  const canvasCentre = {
    x: canvasBox.x + canvasBox.width / 2,
    y: canvasBox.y + canvasBox.height / 2,
  };

  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  await dragOntoCanvas(
    page,
    /^drag custom test crop onto the plot to place it$/i,
    canvasCentre.x,
    canvasCentre.y,
  );

  // A correct count: it landed, feedback shows a fitPlant summary and a
  // placed-vs-fits tally of 1, exactly like a shipped crop (Stage 3.4).
  await expect(page.getByText(/nothing placed yet/i)).not.toBeVisible();
  await expect(page.getByText(/plants:/)).toBeVisible();
  await expect(page.getByText(/1 placed of/)).toBeVisible();
});
