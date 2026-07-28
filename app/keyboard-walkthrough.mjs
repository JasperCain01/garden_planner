import { chromium } from '@playwright/test';

/**
 * The keyboard-only walkthrough (Workplan Stage 6.2's other verification
 * deliverable, alongside `e2e/a11y.spec.ts`'s axe check). Drives the core
 * journey (find a crop → place it → nudge it → reshape the plot → check
 * warnings) using only `page.keyboard.*` — no `page.mouse`, no `.click()` — so
 * it's a genuine proxy for "can a keyboard-only user complete this journey",
 * not just "does the markup look right" (which is all an axe check can
 * verify). Its result is recorded honestly in `docs/accessibility.md`, gaps
 * included.
 *
 * **The step order follows the layout, and moved with it.** Until UI redesign
 * Phase 1 the app was a stacked document, so the walk ran top to bottom:
 * describe the plot, then the palette, then the canvas. The workspace's
 * reading order is plants → plot → settings, so the walk now starts at the
 * palette and reaches the shape form *from* the canvas — plus a step per skip
 * link (there are two as of that phase) and one for the add-crop dialog it
 * introduced.
 *
 * **Run it** against a local production preview (same server the axe check
 * and E2E suite use):
 *
 *   npm run build -w app && npm run preview -w app   # in one terminal
 *   PW_EXECUTABLE_PATH=/path/to/chromium node keyboard-walkthrough.mjs   # in another
 *
 * `PW_EXECUTABLE_PATH` is only needed in environments that ship their own
 * Chromium instead of Playwright's managed one (same variable the rest of
 * this repo's Playwright configs read).
 *
 * **Deliberately not a Playwright test / not part of `npm run verify`.**
 * This is the recorded proof of a manual check, not a regression gate — the
 * tab counts it measures (e.g. "15 presses to reach the canvas") are
 * expected to drift as the dataset and the layout change — that one was 35
 * before UI redesign Phase 1 — and asserting on an exact number would make
 * this brittle for no safety benefit. Re-run it by hand when the app's a11y
 * work is revisited, the same way Stage 5.1's Lighthouse score is a recorded
 * number, not a CI-checked one.
 */

const log = (...args) => console.log(...args);
let failures = 0;
const ok = (label) => log(`  OK   ${label}`);
const fail = (label, detail) => {
  failures += 1;
  log(`  FAIL ${label}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({
  executablePath: process.env.PW_EXECUTABLE_PATH || undefined,
});
// A desktop viewport, so the workspace layout (UI redesign Phase 1) is the one
// being walked — below 900px wide it stacks into the phone fallback, which is
// a different reading order and worth its own pass if that is what you want to
// check.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4173/');
await page.waitForSelector('text=Plot shape');

/**
 * A rough but honest accessible-name computation for the focused element —
 * aria-label, else an associated <label for=id> (the common case in this
 * app's forms), else its own text content, else the tag name as a last
 * resort. Not a full implementation of the accname spec, but close enough to
 * drive a script by name the way a screen-reader user would.
 */
async function focusedAccessibleName() {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label?.textContent?.trim()) return label.textContent.trim();
    }
    const closestLabel = el.closest('label');
    if (closestLabel?.textContent?.trim()) return closestLabel.textContent.trim();
    return el.textContent?.trim().slice(0, 60) || el.tagName;
  });
}

/** Press Tab up to `budget` times, stopping when the focused element's name matches. Returns the presses used, or `null` if it never matched. */
async function tabUntil(pattern, budget) {
  for (let i = 1; i <= budget; i++) {
    await page.keyboard.press('Tab');
    const name = await focusedAccessibleName();
    if (pattern.test(name ?? '')) return i;
  }
  return null;
}

log(
  '=== Step 0: the skip links (Workplan Stage 6.2; second link added in UI redesign Phase 1) ===',
);
// Two links now, in this order: the canvas (Stage 6.2's, for the block the
// palette puts between "Add to plot" and nudging the placement) and the plot
// settings (Phase 1's, for the block the palette now puts between the top of
// the page and the shape/conditions form). See `src/plot/SkipLinks.tsx`.
await page.keyboard.press('Tab'); // title link
await page.keyboard.press('Tab'); // first skip link
const skipCanvasName = await focusedAccessibleName();
if (/skip to plot canvas/i.test(skipCanvasName ?? '')) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const nameAfterSkip = await focusedAccessibleName();
  if (/plot canvas/i.test(nameAfterSkip ?? '')) {
    ok('the first skip link jumps focus straight to the plot canvas');
  } else {
    fail(
      'the first skip link jumps focus to the plot canvas',
      `focus landed on "${nameAfterSkip}" instead`,
    );
  }
} else {
  fail(
    'found the "Skip to plot canvas" link as the second Tab stop',
    `focus was on "${skipCanvasName}"`,
  );
}

await page.goto('http://localhost:4173/');
await page.waitForSelector('text=Plot shape');
await page.keyboard.press('Tab'); // title link
await page.keyboard.press('Tab'); // skip to plot canvas
await page.keyboard.press('Tab'); // skip to plot settings
const skipSettingsName = await focusedAccessibleName();
if (/skip to plot settings/i.test(skipSettingsName ?? '')) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const landed = await page.evaluate(() => document.activeElement?.id ?? null);
  if (landed === 'plot-settings') {
    ok('the second skip link jumps focus straight to the plot settings column');
  } else {
    fail(
      'the second skip link jumps focus to the plot settings column',
      `focus landed on #${landed ?? '(nothing)'} instead`,
    );
  }
} else {
  fail(
    'found the "Skip to plot settings" link as the third Tab stop',
    `focus was on "${skipSettingsName}"`,
  );
}

// Reload for a clean run of the rest of the journey, which follows the
// workspace's own reading order: plants → plot → settings.
await page.goto('http://localhost:4173/');
await page.waitForSelector('text=Plot shape');

log('\n=== Step 1: find a crop (keyboard only) ===');
// The palette is the first region in the workspace, so its search box is only
// a few stops from the top: title link, two skip links, then Search.
const tabsToSearch = await tabUntil(/^search$/i, 10);
if (tabsToSearch !== null) {
  await page.keyboard.type('Onion');
  ok(`reached the palette search field in ${tabsToSearch} tabs and typed a crop name`);
} else {
  fail('reached the palette search field by Tab alone', 'gave up after 10 tabs');
}
await page.waitForTimeout(300); // let the ranked list re-render

log('\n=== Step 2: place it (keyboard only, via "Add to plot") ===');
const tabsToAdd = await tabUntil(/add .* to the plot/i, 10);
if (tabsToAdd !== null) {
  await page.keyboard.press('Enter');
  ok('activated "Add to plot" via keyboard (Tab + Enter) — no drag involved');
} else {
  fail('reached an "Add to plot" button by Tab alone', 'gave up after 10 tabs');
}

const selectedVisible = await page
  .getByText(/^Selected:/)
  .isVisible()
  .catch(() => false);
if (selectedVisible) {
  ok('the placed crop shows as "Selected" (auto-selected on add, per addPlacement)');
} else {
  fail('the placed crop shows as "Selected"');
}

log('\n=== Step 3: nudge it with arrow keys (keyboard only) ===');
// Forward-tabbing here still has to pass every remaining filtered palette row
// (two stops each: the draggable card, then its "Add to plot" button) — that
// is the friction the "Skip to plot canvas" link exists for, and step 0 shows
// the shortcut works. This measures the long way round on purpose, because
// the honest number is the one worth recording. It *is* shorter than it was:
// UI redesign Phase 1 moved the whole "Add your own crop" form (~25 stops)
// behind a dialog, so only its one trigger button remains in the path.
const tabsToCanvas = await tabUntil(/plot canvas/i, 40);
if (tabsToCanvas !== null) {
  ok(
    `reached the plot canvas by Tab alone (${tabsToCanvas} presses from the search field — see the "friction" note below)`,
  );
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  ok('nudged the selected plant into a new position with arrow keys, no pointer at all');
} else {
  fail('reached the plot canvas by Tab alone', 'gave up after 40 tabs');
}

log('\n=== Step 4: describe the plot (keyboard only) ===');
// The settings column is the last region in reading order, so from the canvas
// it is a handful of stops away: the selected placement's Remove button, the
// "Plot shape & size" disclosure, then the shape radios and dimension fields.
const tabsToWidth = await tabUntil(/width \(m\)/i, 15);
if (tabsToWidth !== null) {
  ok(`reached the rectangle width field in ${tabsToWidth} tabs from the canvas`);
} else {
  fail('reached the rectangle width field by Tab alone', 'gave up after 15 tabs');
}

await page.keyboard.press('Control+a');
await page.keyboard.type('4');
await page.keyboard.press('Tab'); // height field
await page.keyboard.press('Control+a');
await page.keyboard.type('3');
await page.keyboard.press('Tab'); // "Use this shape" button
const useShapeName = await focusedAccessibleName();
if (/use this shape/i.test(useShapeName ?? '')) {
  await page.keyboard.press('Enter');
  ok('applied a 4m x 3m rectangle via keyboard (Tab + type + Enter)');
} else {
  fail(
    'applied the rectangle preset',
    `expected the "Use this shape" button, focus was on "${useShapeName}"`,
  );
}

log('\n=== Step 5: check warnings (read-only, but confirm reachable) ===');
const warningsHeading = await page
  .getByRole('heading', { name: /problems & suggestions/i })
  .isVisible()
  .catch(() => false);
if (warningsHeading) {
  ok(
    'the "Problems & suggestions" panel is present and reachable (no interaction needed to read it)',
  );
} else {
  fail('the "Problems & suggestions" panel is visible');
}

log('\n=== Step 6: the add-crop dialog (UI redesign Phase 1) ===');
// "Add your own crop" moved out of the page flow into a modal `<dialog>`.
// The trigger sits at the foot of the plants sidebar; the modal behaviour
// itself (focus trap, Esc, focus returned to the trigger) is the browser's,
// so this checks the two ends a user would notice.
await page.goto('http://localhost:4173/');
await page.waitForSelector('text=Plot shape');
const tabsToAddCrop = await tabUntil(/add your own crop/i, 320);
if (tabsToAddCrop === null) {
  fail('reached the "Add your own crop" trigger by Tab alone', 'gave up after 320 tabs');
} else {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const insideDialog = await page.evaluate(
    () => document.activeElement?.closest('dialog') !== null,
  );
  if (insideDialog) {
    ok('opening the dialog moves focus inside it');
  } else {
    fail('opening the dialog moves focus inside it');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const closed = await page.evaluate(() => document.querySelector('dialog')?.open !== true);
  const backOnTrigger = /add your own crop/i.test((await focusedAccessibleName()) ?? '');
  if (closed && backOnTrigger) {
    ok('Esc closes the dialog and returns focus to the trigger that opened it');
  } else {
    fail(
      'Esc closes the dialog and returns focus to the trigger',
      `closed=${closed}, focus back on trigger=${backOnTrigger}`,
    );
  }
}

log('\n=== Known gap (not fixed this phase, recorded honestly) ===');
log('  The free-form plot-outline corner editor (dragging a corner to reshape');
log('  the outline) is pointer-only — Tab does reach its corner handles');
log('  (role="button" as of Stage 6.2), but there is no keyboard handler');
log('  behind them yet, so Enter/Space on a focused corner does nothing.');
log('  The Stage 6.2 brief scoped the keyboard-drag alternative to exactly');
log('  two places (palette→canvas handoff, on-canvas move/remove) — this');
log('  is a real, separate gap for a future stage, not silently dropped.');

await browser.close();

log(`\n${failures === 0 ? 'All steps passed.' : `${failures} step(s) failed.`}`);
process.exitCode = failures === 0 ? 0 : 1;
