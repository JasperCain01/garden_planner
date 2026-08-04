import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { filterPaletteTo } from './drag.ts';

/**
 * The locally-runnable axe accessibility check (Workplan Stage 6.2). Run via
 * `npm run a11y -w app` (its own config, `playwright.a11y.config.ts` — see
 * that file's doc comment for why this isn't part of `npm run e2e`/`verify`).
 * Today's result is recorded in the root `README.md`, mirroring Stage 5.1's
 * Lighthouse audit.
 *
 * **What this can and can't catch.** axe inspects the rendered DOM against
 * WCAG 2.0/2.1 A/AA rules it can check mechanically — missing labels,
 * insufficient colour contrast, invalid ARIA, redundant/nested interactive
 * roles, and so on. Two things in this app it structurally *cannot* see:
 *
 * 1. **The Konva-rendered plot canvas** (`canvas/PlotCanvas.tsx`) draws to a
 *    single `<canvas>` element with no queryable DOM inside it — axe (like
 *    every DOM-based tool) sees one opaque node, not the placement markers,
 *    warning badges, or plot outline drawn on it. The severity-glyph and
 *    colour-contrast fixes to that badge (`warnings/severity.ts`) are
 *    reviewed and unit-tested (`severity.test.ts`), not axe-verified.
 * 2. **Keyboard operability itself** — axe checks *markup* (is there a
 *    tabindex, a role, a label), not *whether tabbing through the page
 *    actually reaches and operates every control in a sane order*. That's
 *    what the manual keyboard-only walkthrough
 *    (`docs/accessibility.md`) covers instead.
 *
 * So a clean axe run here is necessary, not sufficient — real screen-reader
 * testing (NVDA/VoiceOver/JAWS) would still be worth doing and hasn't been,
 * which `docs/accessibility.md` records honestly as a known gap.
 */

/** The WCAG rule families this check is held to — the same tag set most axe/Playwright examples use, and squarely what "an accessibility pass" means in the Stage 6.2 brief. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('the plot-definition page has no axe violations in its initial state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /plot shape/i })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('the plot-definition page has no axe violations once a plant is placed and selected', async ({
  page,
}) => {
  await page.goto('/');

  // Placed via the keyboard-operable "Add to plot" button (Workplan Stage
  // 6.2), not a pointer drag — this exercises the "Selected: ..." / Remove /
  // Previous-next-placement state (`PlotCanvasSection.tsx`) and whatever the
  // warnings panel shows for that crop, without needing the tall-viewport
  // dance `e2e/drag.ts` documents for a real pointer drag.
  //
  // Since UI redesign Phase 5 it also covers the header in its *live* state:
  // placing a crop is what turns Undo from a disabled button into one whose
  // accessible name is "Undo planting …". A label that is composed per state is
  // exactly the kind of thing that regresses to an unnamed button quietly.
  await page
    .getByRole('button', { name: /add .+ to the plot, without dragging/i })
    .first()
    .click();
  await expect(page.getByText(/^Selected:/)).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('the canvas has no axe violations in edit-shape mode', async ({ page }) => {
  // New surface in UI redesign Phase 2: "Edit shape" swaps the canvas toolbar's
  // Previous/Next *placement* buttons for Previous/Next *corner*, adds two
  // more, and re-labels the canvas itself (the arrow keys now move a corner,
  // so the label that describes them has to change with the mode). A mode that
  // rewrites a live region's accessible name and half a toolbar is exactly the
  // kind of thing that regresses quietly.
  await page.goto('/');
  await page.getByRole('button', { name: /^edit shape$/i }).click();
  await expect(page.getByLabel(/editing the plot shape/i)).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('the designs switcher has no axe violations, including mid-confirmation', async ({ page }) => {
  // This scan replaces UI redesign Phase 2's clear-all confirmation, which
  // Phase 5 retired: clearing the plot is undoable now, so a dialog asking
  // whether you meant it buys nothing (ADR 0034 §5). What took its place is
  // this — the app's third `ui/ModalDialog.tsx`, and the one with the most
  // inside it: a list whose rows carry three buttons each, an inline
  // confirmation that *replaces* those buttons in place, and a text field that
  // renames the open design.
  //
  // The in-place swap is the part worth scanning. Focus is on a button that
  // ceases to exist the moment it is pressed, and the row's remaining controls
  // change meaning around it.
  await page.goto('/');
  await page.getByRole('button', { name: /designs:/i }).click();
  await expect(page.getByRole('heading', { name: /your designs/i })).toBeVisible();

  let results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: /^delete my garden$/i }).click();
  await expect(page.getByText(/delete for good/i)).toBeVisible();

  results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('the palette has no axe violations with a card’s reasoning expanded', async ({ page }) => {
  // New surface in UI redesign Phase 3, and the one most worth scanning: the
  // palette card is now a disclosure *and* dnd-kit's drag surface, so a single
  // element carries `role="button"`, `aria-roledescription`, `aria-describedby`
  // and `aria-expanded` at once — plenty of ways to end up with an invalid
  // combination — and the `＋` button beside it went icon-only, which is a
  // `button-name` failure the moment its `aria-label` slips.
  //
  // Scanned expanded rather than collapsed because the initial-state scan above
  // already covers the compact card; this covers the state that only exists
  // after a click, including the chip filters above it.
  await page.goto('/');
  const card = page.getByRole('button', { name: /^drag .+ onto the plot/i }).first();
  await card.click();
  await expect(card).toHaveAttribute('aria-expanded', 'true');

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('the warnings dock has no axe violations with a warning in it', async ({ page }) => {
  // New surface in UI redesign Phase 4, and the one worth scanning: the
  // severity *word* became a `role="img"` with an `aria-label`, the count
  // badges carry their own `aria-label` ("1 severe") over a number and an icon
  // that are both `aria-hidden`, and both sit inside a `<details>` that is now
  // a scroll container. An icon whose label slips is invisible to a screen
  // reader and identical on screen.
  await page.goto('/');

  // The shipped dataset's one well-supported antagonist pair. Placed with the
  // keyboard-operable "Add to plot" button rather than a pointer drag —
  // `geometry.ts#firstFreePosition` scatters the second crop one footprint
  // (60cm) from the first, inside the rule's 75cm threshold.
  for (const crop of ['Potato', 'Tomato']) {
    await filterPaletteTo(page, crop);
    await page.getByRole('button', { name: new RegExp(`add ${crop} to the plot`, 'i') }).click();
  }
  await expect(page.locator('#plot-settings li[data-severity]').first()).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('the growing-conditions form has no axe violations with the soil disclosure open', async ({
  page,
}) => {
  // Also Phase 4: two more segmented controls appear here, each a `<fieldset>`
  // whose visible `<legend>` is the field's label and whose radios are visually
  // hidden but focusable. The initial-state scan above covers the third (light
  // level) and the closed disclosure; this covers what opening it reveals.
  await page.goto('/');
  await page.getByText(/describe your soil/i).click();
  await expect(page.getByLabel(/soil texture/i)).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});

test('the add-crop dialog has no axe violations while open', async ({ page }) => {
  // New surface in UI redesign Phase 1: "Add your own crop" moved out of the
  // page flow into a modal `<dialog>` (`ui/ModalDialog.tsx`). A modal is
  // exactly the kind of thing that regresses quietly — an unnamed dialog, a
  // heading order that restarts, a control the trap leaves behind — so the
  // form gets its own scan in the state a user actually meets it in. (The
  // focus trap and Esc themselves are the browser's, not ours; axe doesn't
  // check them and neither does this.)
  await page.goto('/');
  await page.getByRole('button', { name: /add your own crop/i }).click();
  await expect(page.getByRole('form', { name: 'add a crop' })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
});
