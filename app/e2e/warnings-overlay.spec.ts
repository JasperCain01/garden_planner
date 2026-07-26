import { expect, test } from '@playwright/test';

import { canvasBoxOf, dragCropOntoCanvas } from './drag.ts';

// The warnings-overlay journey WORKPLAN.md names for Stage 3.5: place an
// antagonist pair close together → a warning appears; resolve it (move one
// away) → the warning clears. Potato/tomato is the shipped dataset's one
// `well-supported` antagonist pair (`data/plants.json`), so it's also the
// most severe warning today's rules can produce — a good, unambiguous case
// for "a warning appeared" versus "nothing happened".
//
// Same real-mouse-event approach as `plot-canvas.spec.ts`, for the same
// reason (dnd-kit's `PointerSensor` needs genuine pointer events, and Konva
// renders to a `<canvas>` jsdom-style locators can't drive) — see that spec's
// own comment and `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md`.
// A very tall viewport keeps the palette entry and the canvas on-screen at
// once: `page.mouse` works in viewport coordinates and does not scroll (see
// `drag.ts`). 4000 is deliberate headroom over the ~3700 a filtered palette
// plus the canvas actually needs today — at 3500 the canvas sat just below
// the fold and drags intermittently did nothing. `drag.ts` asserts both ends
// are in view, so if this ever stops being enough the failure says so.
test.use({ viewport: { width: 1024, height: 4000 } });

test('placing an antagonist pair close together warns, and moving one away clears it', async ({
  page,
}) => {
  await page.goto('/');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();

  // Drag potato onto the left of the canvas, tomato onto the right — close
  // enough together (well within the crops' own spacing-derived threshold)
  // that the antagonist-adjacency rule should fire.
  await page.getByLabel(/^search$/i).fill('Potato');
  await dragCropOntoCanvas(page, 'Potato', canvas, (box) => ({
    x: box.x + box.width * 0.4,
    y: box.y + box.height * 0.5,
  }));
  await expect(page.getByText(/1 placed of/)).toBeVisible();

  await page.getByLabel(/^search$/i).fill('Tomato');
  await dragCropOntoCanvas(page, 'Tomato', canvas, (box) => ({
    x: box.x + box.width * 0.6,
    y: box.y + box.height * 0.5,
  }));

  // The "4. Check for problems" section reports the antagonist pairing. (The
  // just-dropped tomato is also auto-selected — `placements-store.ts`'s
  // `addPlacement` — so `PlotCanvasSection`'s own inline "selected placement's
  // warnings" block shows the same reason a second time; `.first()` picks
  // either, since both are the deliverable we're checking for.)
  await expect(page.getByText(/grow poorly together/i).first()).toBeVisible();
  await expect(page.getByText('SEVERE').first()).toBeVisible();

  // Resolve it: drag the tomato marker to the opposite corner of the plot, far
  // past the antagonist threshold. The canvas box is re-read here rather than
  // reused from the drop above: no further search filtering happens after this
  // point, so its position is stable, but reading it fresh keeps this step
  // independent of how the drop above was expressed.
  const canvasBox = await canvasBoxOf(canvas);
  const tomatoMarker = {
    x: canvasBox.x + canvasBox.width * 0.6,
    y: canvasBox.y + canvasBox.height * 0.5,
  };
  const farCorner = {
    x: canvasBox.x + canvasBox.width * 0.95,
    y: canvasBox.y + canvasBox.height * 0.95,
  };
  await page.mouse.move(tomatoMarker.x, tomatoMarker.y);
  await page.mouse.down();
  await page.mouse.move(farCorner.x, farCorner.y, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByText(/grow poorly together/i)).not.toBeVisible();
  await expect(page.getByText(/no problems detected/i)).toBeVisible();
});
