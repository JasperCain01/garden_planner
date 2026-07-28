import { expect, test } from '@playwright/test';

import { dragCropOntoCanvas, filterPaletteTo } from './drag.ts';

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
// An ordinary laptop viewport. `page.mouse` works in viewport coordinates and
// does not scroll (see `drag.ts`), so both ends of the drag have to be on
// screen at once — which, since UI redesign Phase 1, is simply what the
// workspace layout does: the palette is the left sidebar and the canvas is the
// centre region, always side by side above 900px wide. These specs used to
// declare a 4000px-tall viewport to force the stacked page's palette and
// canvas into view together; that trick is gone with the stacked page.
test.use({ viewport: { width: 1440, height: 900 } });

test('adding a custom crop makes it appear in the palette and placeable on the canvas', async ({
  page,
}) => {
  await page.goto('/');

  // The form lives behind a modal dialog off the foot of the plants sidebar as
  // of UI redesign Phase 1 (it used to be ~800px of page between the palette
  // and the canvas), so the journey now starts by opening it. Everything after
  // this point is unchanged, which is the point: only where the form is
  // reached from moved, not the form.
  await page.getByRole('button', { name: /add your own crop/i }).click();

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

  // ... and — the actual deliverable — it appears in the ranked palette,
  // scored against the plot's (default, full-sun) conditions like any shipped
  // crop, findable by the same search box every other palette entry uses.
  // Close the dialog first: it's modal, so the sidebar behind it is inert
  // until it goes.
  await page.getByRole('button', { name: /close add your own crop/i }).click();
  await filterPaletteTo(page, 'Custom Test Crop');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  await dragCropOntoCanvas(page, 'Custom Test Crop', canvas);

  // A correct count: it landed, feedback shows a fitPlant summary and a
  // placed-vs-fits tally of 1, exactly like a shipped crop (Stage 3.4).
  await expect(page.getByText(/nothing placed yet/i)).not.toBeVisible();
  await expect(page.getByText(/plants:/)).toBeVisible();
  await expect(page.getByText(/1 placed of/)).toBeVisible();
});
