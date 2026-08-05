import { expect, test, type Page } from '@playwright/test';

import { dragCropOntoCanvas } from './drag.ts';

/**
 * The UI redesign Phase 1 acceptance criteria, as a test
 * (`docs/ui-aesthetic-review.md` §"Phase 1 — Workspace layout"):
 *
 * > at 1440×900 and 1920×1080 the canvas region occupies ≥50% of viewport
 * > area; palette→canvas drag completes without any page scroll
 *
 * Both are the kind of thing that decays silently — a sidebar that creeps
 * wider, a stray `margin` on the workspace, a region that starts scrolling the
 * page again — so they are measured rather than eyeballed. The numbers below
 * are the review's, not this file's.
 *
 * The third test covers the *reason* the layout changed at all: the palette
 * and the canvas being on screen together is what turns "drag a plant onto the
 * plot" from a ~1,500px scroll journey into a short gesture.
 */

/** The three regions the workspace is made of, by their landmark names (`plot/PlotDefinitionPage.tsx`). */
const CANVAS_REGION = 'Your plot';

/** The measured area of a labelled region, and of the viewport it sits in. */
async function regionShare(page: Page, name: string): Promise<number> {
  const box = await page.getByRole('region', { name }).boundingBox();
  if (box === null) throw new Error(`the "${name}" region has no bounding box`);
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('no viewport size — this spec sets one explicitly');
  return (box.width * box.height) / (viewport.width * viewport.height);
}

/** True when the document is taller than the viewport, i.e. the page itself scrolls. */
function pageScrolls(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test(`the canvas takes at least half the viewport at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

    expect(await regionShare(page, CANVAS_REGION)).toBeGreaterThanOrEqual(0.5);
  });

  test(`the page itself does not scroll at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

    // The palette is the tallest thing in the app by a wide margin (144 crops,
    // unfiltered, is the default state) — if anything is going to push the
    // document past the viewport it is this, so no filter is applied first.
    expect(await pageScrolls(page)).toBe(false);
  });
}

test('a palette→canvas drag completes without the page scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  // No search filter, deliberately: in the stacked layout this drag was only
  // reachable by filtering the palette down and using a 4,000px-tall viewport
  // (see `drag.ts`). Doing it from the unfiltered default state at an ordinary
  // laptop size is the thing that used to be impossible.
  await dragCropOntoCanvas(page, 'Onion', canvas);

  await expect(page.getByText(/1 placed of/)).toBeVisible();
  expect(await pageScrolls(page)).toBe(false);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('below the narrow breakpoint the workspace stacks back into a scrolling page', async ({
  page,
}) => {
  // The other half of the layout contract: Workplan Stage 6.2 tuned this app
  // for phones, and Phase 1 must not have taken that away. Below 900px the
  // three regions stack and the page scrolls normally — three pinned
  // scrollports on a short viewport would be much worse than one long page.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  expect(await pageScrolls(page)).toBe(true);
  // Stacked, not side by side: the plants region starts above the canvas one.
  const plants = await page.getByRole('region', { name: 'Plants' }).boundingBox();
  const plot = await page.getByRole('region', { name: CANVAS_REGION }).boundingBox();
  if (plants === null || plot === null) throw new Error('a workspace region has no bounding box');
  expect(plot.y).toBeGreaterThan(plants.y);
  // And nothing pushes the document sideways (Stage 6.2's other responsive
  // rule — the canvas scrolls inside its own box instead).
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test('the phone header shows the full wordmark and design name, neither ellipsised (post-review fix B4)', async ({
  page,
}) => {
  // The review's finding at this exact viewport: "Garden Plan… / Designs:
  // M…" — both halves of the one-row header truncating at once, because the
  // switcher's own fixed "Designs:" text was competing with the wordmark for
  // the same shrinking row before either got to spend anything on the name.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  // Rename to a genuine 10-character name — the default "My garden" is one
  // short of the acceptance's own figure, and this is a case worth measuring
  // in its own right, not the easiest one available.
  await page.getByRole('button', { name: /designs:/i }).click();
  const renameField = page.getByRole('textbox');
  await renameField.fill('Allotment1');
  await renameField.blur();
  await page.keyboard.press('Escape');

  const wordmarkLink = page.getByRole('heading', { level: 1 }).getByRole('link');
  const switcher = page.getByRole('button', { name: /^designs: allotment1$/i });
  await expect(switcher).toBeVisible();

  expect(
    await wordmarkLink.evaluate((el) => el.scrollWidth <= el.clientWidth),
    'the brand wordmark renders without ellipsis',
  ).toBe(true);

  const designName = switcher.locator('span').last();
  expect(
    await designName.evaluate((el) => el.scrollWidth <= el.clientWidth),
    'the design name renders without ellipsis',
  ).toBe(true);
  await expect(designName).toHaveText('Allotment1');

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'no horizontal page scroll',
  ).toBe(true);
});
