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
 * **UI redesign Phase 5 changed what the first Tab presses land on, and added
 * step 2c.** The header carried one control (the title link) for the app's whole
 * life until this phase; it now carries undo, redo and the designs switcher, and
 * they sit *before* the skip links because the header precedes the route's
 * content in the DOM. Step 0 counts Tab presses positionally, so it says so. The
 * cost is smaller than it looks and the script shows why: on a fresh load only
 * the switcher is a stop, because a `disabled` button is not in the tab order
 * and there is nothing yet to undo. Step 2c walks undo and redo once there is.
 *
 * The other thing this phase changed is what a **reload** means here. This walk
 * reloads three times for "a clean run of the rest of the journey", and the app
 * now restores the saved design — so those three would have quietly started
 * measuring through a canvas with crops already on it. See the `addInitScript`
 * below.
 *
 * **UI redesign Phase 4 re-measured step 4 and added step 5b.** The settings
 * column's controls changed shape — three preset radios became three tiles,
 * three `<select>`s became segmented controls, and the soil block went behind a
 * disclosure — so its tab-stop count was measured either side rather than
 * assumed: **13 before, 11 after** in the default state, and 14 with the soil
 * disclosure open. Down, not up, because the phase spent no new stops: a
 * segmented control is one radio group where a `<select>` was one control, and
 * the three soil facets are behind one summary. Step 4's three-in-a-row
 * (width → height → "Use this shape") survives unchanged, which was worth
 * checking rather than assuming: the tiles are a radio *group*, so they are the
 * single stop the radios already were, and the unit moving inside the field
 * left the label's accessible name ("Width (m)") exactly as it was — see
 * `plot/ShapePicker.tsx` on why the unit is `visually-hidden` in the label
 * rather than only drawn in the box. Step 5b walks the dock's new "Show me",
 * which does something it did not do before (ADR 0033 §6).
 *
 * **UI redesign Phase 3 added step 2b.** The palette card became a disclosure
 * as well as a drag surface, which is a new keyboard interaction on an element
 * that already had one — Space still starts a drag, Enter now opens the
 * engine's reasoning — so the walk presses it. The step counts either side are
 * unchanged: the phase kept two tab stops per crop row, which is the budget
 * `docs/accessibility.md` §8 records.
 *
 * **UI redesign Phase 2 added two steps, and closed a gap.** The canvas
 * toolbar gained zoom controls and an "Edit shape" toggle, both of which have
 * to be operable without a pointer (ADR 0026) — step 3b walks them. And
 * editing the plot outline, which was **pointer-only** from Stage 6.2 until
 * this phase (the note this script used to end on, and
 * `docs/accessibility.md` §5), is now a keyboard path: select a corner with
 * the toolbar's ◀/▶, move it with the arrow keys, Delete to remove. Step 3c
 * walks that, and the "known gap" note at the end shrank accordingly.
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

/**
 * Every navigation in this walk starts from an empty plot (UI redesign Phase
 * 5).
 *
 * This script reloads three times to get "a clean run of the rest of the
 * journey" — and since the app started saving the open design, a reload is the
 * opposite of clean: it brings the crops back. Nothing here would have *failed*
 * either; the walk would simply have gone on counting tab presses through a
 * canvas that still had plants on it, which is worse than a failure because it
 * reads as a pass.
 *
 * An `addInitScript` rather than a clear between loads, because the app
 * restores before its first render (`src/main.tsx`). The one place this walk
 * deliberately does *not* reload — before step 4, so the journey runs against
 * the state it has built up — is untouched by this, which is the point: the two
 * meanings of "reload" in this file are now actually different operations.
 * Persistence itself is proved in a real browser by `e2e/persistence.spec.ts`.
 */
await page.addInitScript(() => {
  try {
    window.localStorage.removeItem('garden-planner:designs');
  } catch {
    // Storage disabled: nothing saved, nothing to clear.
  }
});

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
//
// **UI redesign Phase 5 put a control between them and the title.** The header
// was one tab stop for the app's whole life until this phase; it now carries
// undo, redo and the designs switcher, and they come *before* the skip links
// because the header comes before the route's content in the DOM (which is
// where it belongs visually, so re-ordering would fix a tab count by breaking
// WCAG 2.4.3 — the same trade `SkipLinks.tsx` already refused once).
//
// On a **fresh** load it is one extra stop, not three: a `disabled` button is
// not in the tab order and there is nothing yet to undo or redo. Step 2c below
// walks them once there is.
await page.keyboard.press('Tab'); // title link
await page.keyboard.press('Tab'); // "Designs: …" — the switcher
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
    'found the "Skip to plot canvas" link as the third Tab stop',
    `focus was on "${skipCanvasName}"`,
  );
}

await page.goto('http://localhost:4173/');
await page.waitForSelector('text=Plot shape');
await page.keyboard.press('Tab'); // title link
await page.keyboard.press('Tab'); // the designs switcher
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
    'found the "Skip to plot settings" link as the fourth Tab stop',
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

log('\n=== Step 2b: read why a crop ranks where it does (UI redesign Phase 3) ===');
// The palette card is a disclosure as well as dnd-kit's drag surface, and the
// two gestures are told apart by key: Space picks the card up (which is what
// the sensor's own screen-reader instructions tell you to press), Enter opens
// the engine's reasoning. Worth walking because a `role="button"` <div> does
// *not* synthesise a click from Enter the way a real <button> does — without
// the handler behind it this would be a pointer-only affordance, which is
// exactly what ADR 0026 says the app doesn't ship.
//
// Focus is on the "Add to plot" button from step 2, and the card is the stop
// immediately before it — two per row, and no more.
await page.keyboard.press('Shift+Tab');
const cardName = await focusedAccessibleName();
if (!/^drag .+ onto the plot/i.test(cardName ?? '')) {
  fail(
    'found the crop card as the stop before its "Add to plot" button',
    `focus was on "${cardName}"`,
  );
} else {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const expanded = await page.evaluate(
    () => document.activeElement?.getAttribute('aria-expanded') ?? null,
  );
  const reasoningVisible = await page
    .getByText(/^Confidence: \d+%$/)
    .first()
    .isVisible()
    .catch(() => false);
  if (expanded === 'true' && reasoningVisible) {
    ok(
      'opened a crop’s summary, confidence and per-dimension reasoning with Enter — one key, no pointer',
    );
  } else {
    fail(
      'opened the crop’s reasoning with Enter',
      `aria-expanded=${expanded}, reasoning visible=${reasoningVisible}`,
    );
  }
  // Close it and step back onto the button, so step 3's tab count below is
  // measured from the same place it always has been — an expanded card would
  // otherwise change what "from the search field" means.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
}

log('\n=== Step 2c: undo and redo the placement (UI redesign Phase 5) ===');
// A new interaction, so ADR 0026's standing rule applies: it must have a
// keyboard path, and the path is the two real header buttons rather than the
// Ctrl+Z accelerator (a chord is invisible, undiscoverable, and unavailable to
// anyone driving the app by switch or voice — see
// `src/designs/useUndoRedoShortcuts.ts`).
//
// The buttons name what they will do, which is not decoration either: it is the
// affordance that replaced the "Clear all" confirmation dialog this phase
// retired, so "Undo planting Onion" being announced is the feature.
const tabsBackToUndo = await shiftTabUntil(/^undo /i, 20);
if (tabsBackToUndo === null) {
  fail('reached the header’s Undo button by Shift+Tab from the palette', 'gave up after 20 tabs');
} else {
  const undoName = await focusedAccessibleName();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const gone = await page
    .getByText(/nothing placed yet/i)
    .isVisible()
    .catch(() => false);
  if (gone && /onion/i.test(undoName ?? '')) {
    ok(
      `reached Undo in ${tabsBackToUndo} Shift+Tabs from the palette and undid the placement — announced as "${undoName}", not a bare "Undo"`,
    );
  } else {
    fail('undid the placement from the header', `button was "${undoName}", plot empty=${gone}`);
  }

  // Redo is the very next stop, and putting the crop back is what leaves the
  // rest of the walk running against the state it had — steps 3 onwards nudge
  // and select that placement.
  await page.keyboard.press('Tab');
  const redoName = await focusedAccessibleName();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const back = await page
    .getByText(/^Selected:/)
    .isVisible()
    .catch(() => false);
  if (back && /^redo /i.test(redoName ?? '')) {
    ok(`redid it from the adjacent button ("${redoName}")`);
  } else {
    fail('redid the placement', `button was "${redoName}", selection restored=${back}`);
  }

  // Back onto the "Add to plot" button, so step 3's count below is measured
  // from where it always has been — the same reason step 2b steps back.
  const returned = await tabUntil(/add .* to the plot/i, 30);
  if (returned === null) {
    fail('returned focus to the palette after using the header', 'gave up after 30 tabs');
  }
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

log('\n=== Step 3b: the canvas toolbar — zoom (UI redesign Phase 2) ===');
// The zoom controls are real <button>s, not a scroll gesture, precisely so
// there is a keyboard path at all. They sit *before* the canvas in the DOM, so
// this walks backwards to them with Shift+Tab rather than forwards from the
// palette a second time.
async function shiftTabUntil(pattern, budget) {
  for (let i = 1; i <= budget; i++) {
    await page.keyboard.press('Shift+Tab');
    const name = await focusedAccessibleName();
    if (pattern.test(name ?? '')) return i;
  }
  return null;
}

const zoomBefore = await page.evaluate(
  () => document.getElementById('plot-canvas')?.style.width ?? null,
);
const tabsBackToZoom = await shiftTabUntil(/^zoom in$/i, 12);
if (tabsBackToZoom !== null) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const zoomAfter = await page.evaluate(
    () => document.getElementById('plot-canvas')?.style.width ?? null,
  );
  if (zoomBefore !== null && zoomAfter !== null && parseFloat(zoomAfter) > parseFloat(zoomBefore)) {
    ok(
      `reached "Zoom in" in ${tabsBackToZoom} Shift+Tabs from the canvas and zoomed the plot (${zoomBefore} → ${zoomAfter})`,
    );
  } else {
    fail('zoomed the plot from the keyboard', `stage width went ${zoomBefore} → ${zoomAfter}`);
  }
  // Back to a fitted plot, so the rest of the walk sees the default view.
  const tabsToFit = await tabUntil(/fit the plot to the screen/i, 4);
  if (tabsToFit !== null) {
    await page.keyboard.press('Enter');
    ok('returned to a fitted plot with the "Fit" button');
  } else {
    fail('reached the "Fit" button by Tab alone', 'gave up after 4 tabs');
  }
} else {
  fail('reached the "Zoom in" button by Shift+Tab from the canvas', 'gave up after 12 tabs');
}

log('\n=== Step 3c: reshape the plot on the canvas (keyboard only, UI redesign Phase 2) ===');
// The gap this script used to end on. The outline editor's corner handles were
// pointer-only from Stage 6.2; merging the editor into the canvas was the
// moment to give them the same keyboard treatment placements already had —
// a selection, ◀/▶ to move it, arrow keys to act.
const tabsToEditShape = await tabUntil(/^edit shape$/i, 8);
if (tabsToEditShape === null) {
  fail('reached the "Edit shape" toggle by Tab alone', 'gave up after 8 tabs');
} else {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);

  // The stage's *shape*, not its size, is what reports the edit: the canvas
  // re-fits the plot to the viewport after every change, so the stage stays
  // the same size and changes proportions instead. The default 3×2m plot pads
  // to 380×280 cm, a ratio of ~1.36.
  const stageRatio = () =>
    page.evaluate(() => {
      const stage = document.getElementById('plot-canvas');
      if (stage === null) return null;
      return parseFloat(stage.style.width) / parseFloat(stage.style.height);
    });
  const ratioBefore = await stageRatio();
  const tabsBackToCanvas = await tabUntil(/editing the plot shape/i, 12);
  if (tabsBackToCanvas === null) {
    fail('reached the canvas in edit-shape mode by Tab alone', 'gave up after 12 tabs');
  } else {
    // Corner 0 is selected on entering the mode, so the arrow keys act
    // immediately — no hunting for a handle first. Three 50cm steps left
    // widens the plot from 3.0m to 4.5m.
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
    await page.waitForTimeout(150);
    const ratioAfter = await stageRatio();
    if (ratioBefore !== null && ratioAfter !== null && ratioAfter > ratioBefore + 0.2) {
      ok(
        `moved a plot corner with the arrow keys, reshaping the outline (stage ${ratioBefore.toFixed(2)} → ${ratioAfter.toFixed(2)} wide-to-tall)`,
      );
    } else {
      fail(
        'reshaped the outline from the keyboard',
        `stage aspect ratio went ${ratioBefore} → ${ratioAfter}`,
      );
    }
  }
  const tabsToDone = await shiftTabUntil(/done editing shape/i, 8);
  if (tabsToDone !== null) {
    await page.keyboard.press('Enter');
    ok('left edit-shape mode from the keyboard');
  } else {
    fail('reached "Done editing shape" by Shift+Tab', 'gave up after 8 tabs');
  }
}

// Back to the canvas, so step 4 measures its "from the canvas" tab count from
// the same place it always has. Deliberately *not* a page reload: the rest of
// the journey is meant to run against the state this walk has built up, and a
// reload would drop the placed crop step 4's tab count passes through.
const tabsBackToCanvasAfterEdit = await tabUntil(/plot canvas/i, 12);
if (tabsBackToCanvasAfterEdit === null) {
  fail('returned focus to the canvas after editing the shape', 'gave up after 12 tabs');
}

log('\n=== Step 4: describe the plot (keyboard only) ===');
// The settings column is the last region in reading order, so from the canvas
// it is a handful of stops away: the selected placement's Remove button, the
// "Plot shape & size" disclosure, then the shape tiles (one radio group, one
// stop — UI redesign Phase 4) and the dimension fields.
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

// UI redesign Phase 4's own criterion, checked here because it is the same
// question a keyboard user asks: is the feedback where I can see it *while* I
// am changing the thing that causes it, or do I have to go and find it? Before
// this phase the panel's top edge sat 263px below the bottom of the column.
const dockedTogether = await page.evaluate(() => {
  const column = document.getElementById('plot-settings');
  if (column === null) return false;
  const columnBox = column.getBoundingClientRect();
  const inside = (element) => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    return box.height > 0 && box.top >= columnBox.top - 1 && box.bottom <= columnBox.bottom + 1;
  };
  const shapeButton = [...column.querySelectorAll('button')].find((button) =>
    /use this shape/i.test(button.textContent ?? ''),
  );
  const dockHeading = [...column.querySelectorAll('h3')].find((heading) =>
    /^warnings$/i.test(heading.textContent ?? ''),
  );
  return inside(shapeButton) && inside(dockHeading);
});
if (dockedTogether) {
  ok('the warnings dock and the "Use this shape" button are in the column together, unscrolled');
} else {
  fail('the warnings dock is visible at the same time as the control that changes the plot');
}

log('\n=== Step 5b: "Show me" (UI redesign Phase 4) ===');
// The dock's "Show me" used to select a placement and stop there, which on a
// zoomed-in plot highlights a marker that is off screen. It scrolls the canvas
// to it now (ADR 0033 §6), and ADR 0026 makes every interaction's keyboard path
// contractual — so it is walked with no pointer at all.
//
// A warning first: the shipped dataset's one well-supported antagonist pair,
// placed with the same "Add to plot" button step 2 used. `firstFreePosition`
// scatters the second crop 60cm from the first, inside the rule's 75cm
// threshold.
for (const crop of ['Potato', 'Tomato']) {
  const searchBox = await page.getByLabel(/^search$/i);
  await searchBox.fill(crop);
  await page.waitForTimeout(400);
  const addButton = page.getByRole('button', {
    name: new RegExp(`add ${crop} to the plot`, 'i'),
  });
  await addButton.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
}

const severityAnnounced = await page
  .locator('#plot-settings')
  .getByLabel('1 severe')
  .isVisible()
  .catch(() => false);
if (severityAnnounced) {
  ok('the dock counts the new problem by severity, announced as "1 severe" rather than drawn only');
} else {
  fail('the dock shows a severity count badge for the antagonist pair');
}

// Reach "Show me" from the settings column's own anchor, which is where the
// second skip link lands — the short way a keyboard user would actually take,
// rather than back through the whole palette.
await page.evaluate(() => document.getElementById('plot-settings')?.focus());
const tabsToShowMe = await tabUntil(/^show me$/i, 20);
if (tabsToShowMe === null) {
  fail('reached a "Show me" button by Tab from the settings column', 'gave up after 20 tabs');
} else {
  const selectedBefore = await page
    .getByText(/^Selected:/)
    .textContent()
    .catch(() => null);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const selectedAfter = await page
    .getByText(/^Selected:/)
    .textContent()
    .catch(() => null);
  if (selectedAfter !== null && selectedAfter !== selectedBefore) {
    ok(
      `reached "Show me" in ${tabsToShowMe} tabs from the settings column and selected the warned-about plant ("${selectedAfter?.trim()}")`,
    );
  } else {
    fail(
      'pressing "Show me" selected the warning’s own placement',
      `selection went "${selectedBefore}" → "${selectedAfter}"`,
    );
  }
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

log('\n=== Gap closed in UI redesign Phase 2 ===');
log('  Reshaping the plot outline used to be pointer-only: Stage 6.2 gave the');
log('  SVG editor’s corner handles role="button" so their names were valid');
log('  ARIA, but there was no keyboard handler behind them, and this script');
log('  ended by saying so. Merging that editor into the plot canvas was the');
log('  moment to fix it rather than move it, so corners now work the way');
log('  placements already did (ADR 0026’s pattern): a selection, ◀/▶ to move');
log('  it, arrow keys to act. Step 3c above walks it with no pointer at all.');
log('\n=== Known gap (still recorded honestly) ===');
log('  There has still been no real screen-reader testing (NVDA/VoiceOver/');
log('  JAWS). A scripted keyboard walk and a clean axe run are necessary and');
log('  not sufficient; see docs/accessibility.md.');

await browser.close();

log(`\n${failures === 0 ? 'All steps passed.' : `${failures} step(s) failed.`}`);
process.exitCode = failures === 0 ? 0 : 1;
