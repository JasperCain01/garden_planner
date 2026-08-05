import { expect, test, type Page } from '@playwright/test';

import { startWithNoSavedDesigns } from './storage.ts';

/**
 * The UI redesign **Phase 6** acceptance criterion, as a test.
 *
 * Phase 6 is the review's "nice-to-have (defer freely)" list and, like Phase 5
 * before it, it arrived without an acceptance criterion — so the first thing it
 * owed was one. Three of its four bullets did not survive contact with the code
 * and the data and were declined with their measurements (ADR 0035 §1–§3); this
 * is the one that was built, and this is the line it was built against:
 *
 * > At 1440×900, printing the open plan produces a **document**: every placed
 * > crop, every warning and every companion suggestion the app is showing
 * > reaches the paper in full — nothing clipped by a box that only scrolls on a
 * > screen — the plot picture fits inside the page width, and neither the
 * > 144-crop palette nor a single control prints.
 *
 * **The number this phase exists to change: sheets of A4, 9 → 2.** Measured in
 * Chromium at 1440×900 with the example bed on the plot, before and after
 * (ADR 0035 §4). The second measurement in this file is the other half of it:
 * of the warnings dock's two items, **1 of 2** reached the paper before, with
 * 114px of the dock below the fold of a box that has no fold on paper.
 *
 * **`page.pdf()` is the honest measurement and `emulateMedia` is not**, which
 * is why both appear here. `emulateMedia({ media: 'print' })` applies the print
 * stylesheet but keeps laying the page out in the *browser* viewport, so it
 * measures the styles; only a real rasterisation lays the page out at the paper
 * width and paginates it. `page.pdf()` is headless-Chromium-only, which is what
 * this suite runs (`playwright.config.ts` sets no `headless: false`).
 */

/** A4 with `@page`'s 12mm margins, at CSS's 96dpi: (210 − 24)mm and (297 − 24)mm. */
const A4_PRINTABLE_PX = { width: 703, height: 1032 };

/** How many sheets `pdf` is. Page objects in the PDF's own catalogue — `/Pages` is the tree node and does not count. */
function sheetCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
}

/** Load the app at 1440×900 with the starter bed placed — five crops, and two companion suggestions in the dock. */
async function openThePlanWithSomethingOnIt(page: Page): Promise<void> {
  await startWithNoSavedDesigns(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();
  await page.getByRole('button', { name: 'Start with an example bed' }).click();
  await expect(page.getByText(/Carrot:/)).toBeVisible();
}

test('the plan prints as a document rather than as the app', async ({ page }) => {
  await openThePlanWithSomethingOnIt(page);

  const sheets = sheetCount(await page.pdf({ format: 'A4', printBackground: true }));
  // Before the print stylesheet this was 9, five of them palette. The bound is
  // deliberately loose either side of the measured 2: this asserts "a plan, not
  // a catalogue", and a plan whose problems list grows is allowed a third sheet.
  expect(sheets).toBeGreaterThan(0);
  expect(sheets).toBeLessThanOrEqual(3);

  await page.emulateMedia({ media: 'print' });

  // The palette is a catalogue of what you *could* plant, which is the one
  // thing a finished plan is not about — and it was most of those nine sheets.
  await expect(page.getByRole('region', { name: 'Plants' })).toBeHidden();

  // Rule 3 of the print block: a control is an affordance and paper has none.
  // The single exception is the header's designs button, which is the only
  // place the open design's name is written.
  const visibleButtons = await page.evaluate(
    () =>
      [...document.querySelectorAll('button')].filter(
        (button) => button.getBoundingClientRect().width > 0,
      ).length,
  );
  expect(visibleButtons).toBe(1);
  await expect(page.getByRole('button', { name: /Designs:/ })).toBeVisible();
});

test('nothing the app is showing is clipped off the sheet', async ({ page }) => {
  await openThePlanWithSomethingOnIt(page);
  await page.emulateMedia({ media: 'print' });

  const measured = await page.evaluate(() => {
    const panel = [...document.querySelectorAll('summary')]
      .find((summary) => summary.textContent?.trim().startsWith('Problems'))
      ?.closest('details');
    if (panel === null || panel === undefined) throw new Error('no problems & suggestions panel');
    const panelBox = panel.getBoundingClientRect();
    const items = [...panel.querySelectorAll('li')];
    return {
      clippedPx: panel.scrollHeight - panel.clientHeight,
      items: items.length,
      // "Inside the panel's own box" rather than "inside the viewport": paper
      // pages itself, so being below the fold is fine — being inside a box that
      // scrolls is not.
      itemsWhole: items.filter((item) => {
        const box = item.getBoundingClientRect();
        return box.top >= panelBox.top - 1 && box.bottom <= panelBox.bottom + 1;
      }).length,
    };
  });

  expect(measured.items).toBeGreaterThan(0);
  // 114px, and 1 of 2 items, before this phase — the dock's 45% cap is a
  // property of a column that does not exist on paper.
  expect(measured.clippedPx).toBe(0);
  expect(measured.itemsWhole).toBe(measured.items);

  // The crop key: one line per crop, the same shape the PNG legend uses.
  for (const crop of ['Carrot', 'Onion', 'Radish', 'Beet', 'Spinach']) {
    await expect(page.getByText(new RegExp(`${crop}:`))).toBeVisible();
  }
});

test('the plot picture fits inside the page width', async ({ page }) => {
  await openThePlanWithSomethingOnIt(page);
  await page.emulateMedia({ media: 'print' });
  // Narrower than the stage was fitted to on screen, which is the case that
  // matters: nothing re-measures the plot for print (see
  // `canvas/useCanvasScale.ts#isPrintLayout`), so a stage fitted to a wide
  // window has to be scaled down by the stylesheet or the right of the plot is
  // cut off at the paper's edge.
  await page.setViewportSize(A4_PRINTABLE_PX);

  const fits = await page.evaluate(() => {
    const stage = document.querySelector('#plot-canvas');
    const canvas = document.querySelector('#plot-canvas canvas');
    if (stage === null || canvas === null) throw new Error('no plot canvas');
    return {
      canvasWidth: canvas.getBoundingClientRect().width,
      pageWidth: document.documentElement.clientWidth,
      // A canvas taken out of flow would let the crop key print on top of the
      // plot; the wrapper wrapping it is what proves it is still in flow.
      wrapperHeight: Math.round(stage.getBoundingClientRect().height),
      canvasHeight: Math.round(canvas.getBoundingClientRect().height),
    };
  });

  expect(fits.canvasWidth).toBeLessThanOrEqual(fits.pageWidth);
  expect(fits.wrapperHeight).toBe(fits.canvasHeight);
});

test('printing leaves the plot on screen exactly as it was', async ({ page }) => {
  await openThePlanWithSomethingOnIt(page);

  const stageSize = () =>
    page.evaluate(() => {
      // The backing-store size, not the CSS box: this is the number the fit
      // decided, which is what the observer loop would move.
      const canvas = document.querySelector<HTMLCanvasElement>('#plot-canvas canvas');
      if (canvas === null) throw new Error('no plot canvas');
      return [canvas.width, canvas.height];
    });

  const before = await stageSize();

  /*
   * The regression guard for ADR 0035 §5. The print layout makes the canvas's
   * viewport element as tall as its contents, and its contents are the plot —
   * so a `ResizeObserver` left running under print media feeds the fit a height
   * derived from the thing being fitted, and the stage walks down towards
   * nothing (measured 582 → 487 → 387px on successive frames). Rasterising a
   * PDF never sees it, because that snapshot is synchronous; a user holding
   * **print preview** open does, because the page stays live.
   *
   * So this waits, on purpose, and it is one of the few places a fixed wait is
   * the right instrument rather than a smell: the assertion is that something
   * does **not** happen, and `expect.poll` would pass on the first frame — the
   * frame before the first observer callback — every time.
   */
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(1_500);
  expect(await stageSize()).toEqual(before);

  await page.emulateMedia({ media: 'screen' });
  expect(await stageSize()).toEqual(before);
});
