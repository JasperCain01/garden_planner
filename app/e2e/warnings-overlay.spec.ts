import { expect, test, type Locator, type Page } from '@playwright/test';

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
test.use({ viewport: { width: 1024, height: 3500 } });

/**
 * The canvas's bounding box moves whenever the palette's *filtered* result
 * count changes — the unfiltered palette (160 crops) makes the page many
 * times taller than the viewport (`plot-canvas.spec.ts`'s own note), and
 * "Potato" and "Tomato" each narrow it to a different number of results. So
 * this is read **fresh, after the search filter has settled**, right before
 * each drag that needs it — a `canvasBox` captured once up front (before any
 * filtering) would go stale the moment the first search narrows the list.
 */
async function canvasBoxOf(canvas: Locator) {
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('canvas has no bounding box');
  return box;
}

/**
 * `plantName` is matched **exactly** (`^drag <name> onto…$`), not merely
 * "whichever result renders first": searching "Potato" also surfaces "Sweet
 * Potato", and "Tomato" also surfaces "Cherry Tomato"/"Heirloom
 * Tomato"/"Green Zebra Tomato" — only the plain "Potato"/"Tomato" records
 * carry the shipped antagonist link this test relies on.
 */
async function dragOntoCanvas(page: Page, plantName: string, targetX: number, targetY: number) {
  const source = page.getByLabel(new RegExp(`^drag ${plantName} onto the plot to place it$`, 'i'));
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
  const potatoCanvasBox = await canvasBoxOf(canvas);
  await dragOntoCanvas(
    page,
    'Potato',
    potatoCanvasBox.x + potatoCanvasBox.width * 0.4,
    potatoCanvasBox.y + potatoCanvasBox.height * 0.5,
  );
  await expect(page.getByText(/1 placed of/)).toBeVisible();

  await page.getByLabel(/^search$/i).fill('Tomato');
  const tomatoCanvasBox = await canvasBoxOf(canvas);
  const tomatoMarker = {
    x: tomatoCanvasBox.x + tomatoCanvasBox.width * 0.6,
    y: tomatoCanvasBox.y + tomatoCanvasBox.height * 0.5,
  };
  await dragOntoCanvas(page, 'Tomato', tomatoMarker.x, tomatoMarker.y);

  // The "4. Check for problems" section reports the antagonist pairing. (The
  // just-dropped tomato is also auto-selected — `placements-store.ts`'s
  // `addPlacement` — so `PlotCanvasSection`'s own inline "selected placement's
  // warnings" block shows the same reason a second time; `.first()` picks
  // either, since both are the deliverable we're checking for.)
  await expect(page.getByText(/grow poorly together/i).first()).toBeVisible();
  await expect(page.getByText('SEVERE').first()).toBeVisible();

  // Resolve it: drag the tomato marker (still where it landed — no further
  // search filtering happens after this point, so `tomatoCanvasBox` is still
  // current) to the opposite corner of the plot, far past the antagonist
  // threshold.
  const farCorner = {
    x: tomatoCanvasBox.x + tomatoCanvasBox.width * 0.95,
    y: tomatoCanvasBox.y + tomatoCanvasBox.height * 0.95,
  };
  await page.mouse.move(tomatoMarker.x, tomatoMarker.y);
  await page.mouse.down();
  await page.mouse.move(farCorner.x, farCorner.y, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByText(/grow poorly together/i)).not.toBeVisible();
  await expect(page.getByText(/no problems detected/i)).toBeVisible();
});
