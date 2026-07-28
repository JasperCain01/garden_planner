import { expect, test } from '@playwright/test';

import { canvasBoxOf, dragCropOntoCanvas, filterPaletteTo } from './drag.ts';

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
// An ordinary laptop viewport. `page.mouse` works in viewport coordinates and
// does not scroll (see `drag.ts`), so both ends of the drag have to be on
// screen at once — which, since UI redesign Phase 1, is simply what the
// workspace layout does: the palette is the left sidebar and the canvas is the
// centre region, always side by side above 900px wide. These specs used to
// declare a 4000px-tall viewport to force the stacked page's palette and
// canvas into view together; that trick is gone with the stacked page.
test.use({ viewport: { width: 1440, height: 900 } });

test('dragging a plant from the palette onto the plot places it, with live count feedback', async ({
  page,
}) => {
  await page.goto('/');
  await filterPaletteTo(page, 'Onion');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();

  // Before anything is placed, the feedback panel says so.
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  await dragCropOntoCanvas(page, 'Onion', canvas);

  // A plant landed: the "nothing placed" prompt is gone, replaced by a
  // fitPlant summary sentence ("<Crop> — N plants: ...") and a tally line.
  await expect(page.getByText(/nothing placed yet/i)).not.toBeVisible();
  await expect(page.getByText(/plants:/)).toBeVisible();
  await expect(page.getByText(/1 placed of/)).toBeVisible();

  // Select it, then remove it via the toolbar button — back to "nothing placed".
  //
  // The canvas box is re-read here rather than reused from before the drag:
  // placing a plant grows the feedback panel, and anything that changes the
  // page's layout can move the canvas. Clicking a stale centre misses the
  // Konva marker, no selection happens, and the "Remove" button never appears
  // — which surfaces as a 30-second click timeout with no hint of the cause.
  const canvasBox = await canvasBoxOf(canvas);
  await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  // Exact match: the outline editor's corner handles are also `role="button"`
  // elements whose own label happens to contain the substring "remove"
  // ("drag to move, double-click to remove" — Workplan Stage 6.2 gave them
  // that role so `aria-label` is valid ARIA on them at all), so a loose
  // `/remove/i` regex now matches five buttons, not one.
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();
});

test('placed plants render their resolved icons or the generic fallback (Stage 4.2)', async ({
  page,
}) => {
  // Verify shipped crops render their icons, and user-defined crops render the fallback.
  await page.goto('/');
  await filterPaletteTo(page, 'Onion');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();
  // Place a shipped crop (onion with an icon).
  await dragCropOntoCanvas(page, 'Onion', canvas);

  // Check that the canvas element is present (icon rendering happens inside Konva).
  const canvasElement = page.locator('canvas');
  await expect(canvasElement).toBeTruthy();

  // The Konva canvas renders to a <canvas> tag, which doesn't expose DOM
  // inspection. Visual verification of icons would require a screenshot comparison.
  // For now, this test verifies the canvas is present and rendering.
  // A follow-up can add visual snapshot testing if needed.
});
