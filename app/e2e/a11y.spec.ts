import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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
  await page
    .getByRole('button', { name: /add .+ to the plot, without dragging/i })
    .first()
    .click();
  await expect(page.getByText(/^Selected:/)).toBeVisible();

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
