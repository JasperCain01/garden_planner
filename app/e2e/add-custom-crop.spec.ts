import { expect, test } from '@playwright/test';

import { dragCropOntoCanvas } from './drag.ts';

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
// A very tall viewport keeps the palette entry and the canvas on-screen at
// once: `page.mouse` works in viewport coordinates and does not scroll (see
// `drag.ts`). 4000 is deliberate headroom over the ~3700 a filtered palette
// plus the canvas actually needs today — at 3500 the canvas sat just below
// the fold and drags intermittently did nothing. `drag.ts` asserts both ends
// are in view, so if this ever stops being enough the failure says so.
test.use({ viewport: { width: 1024, height: 4000 } });

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
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  await dragCropOntoCanvas(page, 'Custom Test Crop', canvas);

  // A correct count: it landed, feedback shows a fitPlant summary and a
  // placed-vs-fits tally of 1, exactly like a shipped crop (Stage 3.4).
  await expect(page.getByText(/nothing placed yet/i)).not.toBeVisible();
  await expect(page.getByText(/plants:/)).toBeVisible();
  await expect(page.getByText(/1 placed of/)).toBeVisible();
});
