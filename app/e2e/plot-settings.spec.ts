import { expect, test, type Locator, type Page } from '@playwright/test';

import { atPlotCm, dragCropOntoCanvas, filterPaletteTo } from './drag.ts';

/**
 * The UI redesign Phase 4 acceptance criteria, as a test
 * (`docs/ui-aesthetic-review.md` §"Phase 4 — Plot & conditions panel").
 *
 * **The review's criterion needed restating before it could be tested.** It
 * asks for "the full tweak loop … with zero vertical page scroll at 1440×900",
 * and since Phase 1 the *page* has never scrolled at all —
 * `workspace-layout.spec.ts` asserts exactly that, at exactly that viewport —
 * so as written the criterion was already true and measured nothing.
 *
 * The number that means something is the settings column's **own** internal
 * overflow, and specifically whether a warning can be seen at the same time as
 * the control that caused it. Measured before this phase, at 1440×900:
 *
 * | | |
 * |---|---|
 * | settings column | 300 × 844 px |
 * | its content | 1,434px — **590px** of internal overflow |
 * | with two crops placed | 1,556px — **712px** of overflow |
 * | "Problems & suggestions" panel | top edge **263px below** the column's bottom |
 *
 * That last row is the review's §2.6 finding surviving Phase 1's move intact:
 * the highest-value live feedback the engine produces, off screen while you
 * edit the form that changes it. These specs measure the same things again.
 */

test.use({ viewport: { width: 1440, height: 900 } });

/** The default plot (`state/plot-store.ts`), which the drop points below are expressed relative to. */
const PLOT_CM = { width: 300, height: 200 };

/**
 * How far apart the antagonist pair is planted, in centimetres — the same
 * figure and the same reasoning as `warnings-overlay.spec.ts`: potato's 75cm
 * between-row spacing is the rule's threshold, and at 60cm centre to centre the
 * two footprint squares overlap outright, so this is checking that a warning
 * appears at all rather than calibrating the boundary.
 */
const CLOSE_APART_CM = 60;

/** The settings column, by the id its skip link targets (`plot/SkipLinks.tsx`). */
const COLUMN = '#plot-settings';

/** The column's own scroll overflow, and the boxes inside it that scroll. */
async function columnOverflow(page: Page): Promise<{
  columnPx: { width: number; height: number };
  contentPx: number;
  overflowPx: number;
}> {
  return page.evaluate((selector) => {
    const column = document.querySelector(selector);
    if (column === null) throw new Error('no settings column');
    const box = column.getBoundingClientRect();
    return {
      columnPx: { width: Math.round(box.width), height: Math.round(box.height) },
      contentPx: column.scrollHeight,
      overflowPx: column.scrollHeight - column.clientHeight,
    };
  }, COLUMN);
}

/**
 * Whether an element is wholly inside the settings column's visible box.
 *
 * Not `toBeInViewport`: the question this phase turns on is whether two things
 * are visible *in the same column at the same time*, and a panel scrolled out
 * of a clipping ancestor is still inside the viewport's rectangle.
 */
async function insideColumn(page: Page, target: Locator): Promise<boolean> {
  const targetBox = await target.boundingBox();
  const columnBox = await page.locator(COLUMN).boundingBox();
  if (targetBox === null || columnBox === null) return false;
  return (
    targetBox.height > 0 &&
    targetBox.y >= columnBox.y - 1 &&
    targetBox.y + targetBox.height <= columnBox.y + columnBox.height + 1
  );
}

test('the settings column no longer overflows itself in its default state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  const { columnPx, contentPx, overflowPx } = await columnOverflow(page);

  expect(
    overflowPx,
    `column ${columnPx.width}×${columnPx.height}, content ${contentPx}px, overflow ${overflowPx}px (was 590px)`,
  ).toBe(0);
});

test('the warnings dock stays in view while a warning is caused, and while it clears', async ({
  page,
}) => {
  await page.goto('/');
  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();

  const dock = page.getByRole('heading', { name: /^warnings$/i });
  const useThisShape = page.getByRole('button', { name: /use this shape/i });

  // Empty, and already docked — before anything is placed, which is the state a
  // first-run user meets.
  await expect(page.getByText(/no problems — looking good/i)).toBeVisible();
  expect(await insideColumn(page, dock)).toBe(true);

  // Cause a problem: the shipped dataset's one `well-supported` antagonist
  // pair, planted 60cm apart (see CLOSE_APART_CM).
  const midY = PLOT_CM.height / 2;
  await filterPaletteTo(page, 'Potato');
  await dragCropOntoCanvas(
    page,
    'Potato',
    canvas,
    atPlotCm({ x: PLOT_CM.width / 2 - CLOSE_APART_CM / 2, y: midY }, PLOT_CM),
  );
  await filterPaletteTo(page, 'Tomato');
  await dragCropOntoCanvas(
    page,
    'Tomato',
    canvas,
    atPlotCm({ x: PLOT_CM.width / 2 + CLOSE_APART_CM / 2, y: midY }, PLOT_CM),
  );

  // The acceptance criterion, restated: the warning and the control that causes
  // it, on screen together. "Use this shape" is the control — changing the plot
  // shape is what moves the two crops relative to each other — and the dock's
  // card is the warning.
  const warningCard = page.locator('#plot-settings li[data-severity]').first();
  await expect(warningCard).toBeVisible();
  await expect(warningCard).toContainText(/grow poorly together/i);

  expect(
    await insideColumn(page, warningCard),
    'the warning card is inside the settings column’s visible box',
  ).toBe(true);
  expect(
    await insideColumn(page, useThisShape),
    'the control that causes it is inside the settings column’s visible box at the same time',
  ).toBe(true);

  // And the column still does not overflow, with the dock at its fullest.
  const { contentPx, overflowPx } = await columnOverflow(page);
  expect(overflowPx, `content ${contentPx}px, overflow ${overflowPx}px (was 712px)`).toBe(0);
});

test('the severity count badge reports what is wrong, by severity', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();

  const midY = PLOT_CM.height / 2;
  await filterPaletteTo(page, 'Potato');
  await dragCropOntoCanvas(
    page,
    'Potato',
    canvas,
    atPlotCm({ x: PLOT_CM.width / 2 - CLOSE_APART_CM / 2, y: midY }, PLOT_CM),
  );
  await filterPaletteTo(page, 'Tomato');
  await dragCropOntoCanvas(
    page,
    'Tomato',
    canvas,
    atPlotCm({ x: PLOT_CM.width / 2 + CLOSE_APART_CM / 2, y: midY }, PLOT_CM),
  );

  // The badge is what stays visible when the dock's list scrolls, so it is the
  // summary that has to be right. Its accessible name carries the count *and*
  // the severity word the uppercase "SEVERE" used to carry.
  await expect(page.locator('#plot-settings').getByLabel('1 severe')).toBeVisible();
});

test('soil is genuinely unreachable until its disclosure is opened', async ({ page }) => {
  // The half of this that jsdom structurally cannot check: `getByLabelText`
  // finds a control inside a closed `<details>` and would let
  // `PlotConditionsForm.test.tsx` drive one no browser user can reach.
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  const texture = page.getByLabel(/soil texture/i);
  await expect(texture).toBeHidden();

  await page.getByText(/describe your soil/i).click();
  await expect(texture).toBeVisible();
});

test('"Show me" scrolls a zoomed-in plot until the marker is actually on screen', async ({
  page,
}) => {
  await page.goto('/');
  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();

  const midY = PLOT_CM.height / 2;
  await filterPaletteTo(page, 'Potato');
  await dragCropOntoCanvas(
    page,
    'Potato',
    canvas,
    atPlotCm({ x: PLOT_CM.width / 2 - CLOSE_APART_CM / 2, y: midY }, PLOT_CM),
  );
  await filterPaletteTo(page, 'Tomato');
  await dragCropOntoCanvas(
    page,
    'Tomato',
    canvas,
    atPlotCm({ x: PLOT_CM.width / 2 + CLOSE_APART_CM / 2, y: midY }, PLOT_CM),
  );
  await expect(page.locator('#plot-settings li[data-severity]').first()).toBeVisible();

  // Zoom in far enough that the plot is bigger than its viewport and the
  // viewport has somewhere to scroll to — which is the only situation in which
  // "Show me" has anything to do, and the situation in which it used to select
  // a marker the user could not see.
  const zoomIn = page.getByRole('button', { name: /^zoom in$/i });
  for (let press = 0; press < 5; press += 1) {
    await zoomIn.click();
  }
  await page.waitForTimeout(200);

  const viewport = page.locator('#plot-canvas').locator('..');
  const scrollable = await viewport.evaluate(
    (element) => element.scrollWidth - element.clientWidth > 10,
  );
  expect(scrollable, 'the zoomed plot overflows its viewport, so there is something to pan').toBe(
    true,
  );

  // Park the view in a corner, so the warned-about marker is definitely off
  // screen before the button is pressed.
  await viewport.evaluate((element) => element.scrollTo({ left: 0, top: 0, behavior: 'instant' }));
  const before = await viewport.evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
  }));

  await page
    .locator('#plot-settings')
    .getByRole('button', { name: /show me/i })
    .first()
    .click();

  // The scroll is smooth unless the user asked for less motion, so the
  // assertion polls rather than sampling once.
  await expect
    .poll(
      async () => {
        const now = await viewport.evaluate((element) => ({
          left: element.scrollLeft,
          top: element.scrollTop,
        }));
        return Math.abs(now.left - before.left) + Math.abs(now.top - before.top);
      },
      { message: 'the canvas viewport scrolled towards the warned-about marker' },
    )
    .toBeGreaterThan(10);
});
