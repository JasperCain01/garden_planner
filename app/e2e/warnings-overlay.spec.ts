import { expect, test } from '@playwright/test';

import { atPlotCm, canvasBoxOf, dragCropOntoCanvas, filterPaletteTo } from './drag.ts';

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
// An ordinary laptop viewport. `page.mouse` works in viewport coordinates and
// does not scroll (see `drag.ts`), so both ends of the drag have to be on
// screen at once — which, since UI redesign Phase 1, is simply what the
// workspace layout does: the palette is the left sidebar and the canvas is the
// centre region, always side by side above 900px wide. These specs used to
// declare a 4000px-tall viewport to force the stacked page's palette and
// canvas into view together; that trick is gone with the stacked page.
test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The default plot (`state/plot-store.ts`), which every drop point below is
 * expressed relative to.
 */
const PLOT_CM = { width: 300, height: 200 };

/**
 * How far apart the two antagonists are planted, in centimetres.
 *
 * This is the number the whole spec turns on, so it is written down rather
 * than implied by a pair of canvas fractions. `adjacencyThresholdCm` takes the
 * larger of the two crops' between-row figures — potato 75 cm, tomato 60 cm,
 * so 75 — and compares it against the edge-to-edge distance between the crops'
 * footprint squares, which are 75 and 60 cm across. At 60 cm centre to centre
 * the squares overlap outright, which is comfortably inside the rule and
 * nowhere near its boundary: this spec is checking that a warning appears at
 * all, not calibrating the threshold (`adjacency.test.ts` does that).
 */
const CLOSE_APART_CM = 60;

test('placing an antagonist pair close together warns, and moving one away clears it', async ({
  page,
}) => {
  await page.goto('/');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();

  // Potato just left of the plot's middle, tomato just right of it — close
  // enough that the antagonist-adjacency rule should fire.
  //
  // Said in *plot centimetres*, not as a fraction of the canvas box. Before UI
  // redesign Phase 2 the two were interchangeable because the stage was a
  // fixed ~228px wide; now the stage fills the region, and the same fractions
  // would be over 250 cm apart — far outside the rule, so this spec would
  // stop testing anything while still looking like it did. See `atPlotCm`.
  const midY = PLOT_CM.height / 2;
  const potatoAt = { x: PLOT_CM.width / 2 - CLOSE_APART_CM / 2, y: midY };
  const tomatoAt = { x: PLOT_CM.width / 2 + CLOSE_APART_CM / 2, y: midY };

  await filterPaletteTo(page, 'Potato');
  await dragCropOntoCanvas(page, 'Potato', canvas, atPlotCm(potatoAt, PLOT_CM));
  await expect(page.getByText(/1 placed of/)).toBeVisible();

  await filterPaletteTo(page, 'Tomato');
  await dragCropOntoCanvas(page, 'Tomato', canvas, atPlotCm(tomatoAt, PLOT_CM));

  // The warnings dock reports the antagonist pairing. (The just-dropped tomato
  // is also auto-selected — `placements-store.ts`'s `addPlacement` — so
  // `PlotCanvasSection`'s own inline "selected placement's warnings" block
  // shows the same reason a second time; `.first()` picks either, since both
  // are the deliverable we're checking for.)
  await expect(page.getByText(/grow poorly together/i).first()).toBeVisible();

  // Severity, which UI redesign Phase 4 turned from the uppercase word "SEVERE"
  // into an icon (`warnings/SeverityIcon.tsx`) whose accessible name is the
  // word. Asserted **in the dock specifically**, and on the count badge rather
  // than on any occurrence of the mark: `.first()` on a page-wide locator would
  // have been satisfied by the canvas's own selected-placement readout, so this
  // spec would have gone on passing while the dock showed nothing — the same
  // trap the `atPlotCm` note above records for the drop points.
  await expect(page.locator('#plot-settings').getByLabel('1 severe')).toBeVisible();

  // Resolve it: drag the tomato marker to the far corner of the plot, well
  // past the antagonist threshold. The canvas box is re-read here rather than
  // reused from the drop above: no further search filtering happens after this
  // point, so its position is stable, but reading it fresh keeps this step
  // independent of how the drop above was expressed.
  //
  // Both ends are in plot centimetres for the same reason the drops are: the
  // grab point has to be where the tomato actually *is*, and the destination
  // has to be a real distance away from the potato — ~190 cm centre to centre
  // here, which leaves ~105 cm between the two footprint squares against a
  // 75 cm threshold — rather than a fraction that used to be one.
  const canvasBox = await canvasBoxOf(canvas);
  const tomatoMarker = atPlotCm(tomatoAt, PLOT_CM)(canvasBox);
  const farCorner = atPlotCm({ x: PLOT_CM.width - 10, y: PLOT_CM.height - 10 }, PLOT_CM)(canvasBox);
  await page.mouse.move(tomatoMarker.x, tomatoMarker.y);
  await page.mouse.down();
  await page.mouse.move(farCorner.x, farCorner.y, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByText(/grow poorly together/i)).not.toBeVisible();
  // The empty state, reworded by Phase 4 from "No problems detected with what's
  // currently placed." — and still proving the same thing: the warning did not
  // merely stop being rendered, the dock positively says there is nothing
  // wrong. The severity badge is gone with it, which is the other half.
  await expect(page.getByText(/no problems — looking good/i)).toBeVisible();
  await expect(page.locator('#plot-settings').getByLabel('1 severe')).toHaveCount(0);
});
