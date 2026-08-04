import { expect, test, type Page } from '@playwright/test';

import { atPlotCm, dragCropOntoCanvas, filterPaletteTo } from './drag.ts';

/**
 * The UI redesign **Phase 5** acceptance criteria, as a test.
 *
 * ## This phase had no acceptance criterion, so the first thing it owes is one
 *
 * Phases 0–4 each carry a testable line in `docs/ui-aesthetic-review.md`. Phase
 * 5 is five bullets and a polish sweep, with nothing to measure — which is not
 * permission to skip the measurement, only an obligation to state the criterion
 * first. It is:
 *
 * > At 1440×900, a design built in the browser survives a **full round trip** —
 * > place → undo → redo → **reload** → the same design — with every restored
 * > value passing the engine's own validators rather than a cast.
 *
 * And the number the phase exists to change, in the way Phase 4's was 590px of
 * overflow → 0: **placements surviving a reload: 0 → all of them**, at a
 * storage cost of **104 bytes** per placement rather than the 3,223 a
 * serialised potato record would have cost (ADR 0034 §1).
 *
 * ## Why the reload has to be a real one
 *
 * `state/designs-store.test.ts` covers the library's behaviour against jsdom's
 * `localStorage` and can call the same `restoreDesigns()` the app calls — but it
 * cannot destroy and rebuild the JavaScript heap, which is the one thing a
 * reload actually does and the only way to prove that nothing survives in a
 * module-level variable by accident. That is this file's job.
 */

test.use({ viewport: { width: 1440, height: 900 } });

/** The default plot (`state/plot-store.ts`), which the drop points below are expressed relative to. */
const PLOT_CM = { width: 300, height: 200 };

/** The `localStorage` key the library lives under (`state/design-codec.ts`). */
const STORAGE_KEY = 'garden-planner:designs';

/**
 * The saved library's shape, as this spec needs to read it.
 *
 * The design *is* what is written down, so comparing this before and after a
 * reload is the strongest available statement of "the same design" — stronger
 * than any set of visible assertions, which can only sample it. Restated here
 * rather than imported from `state/design-codec.ts` on purpose: a test that
 * asserts a stored format should not take its idea of that format from the code
 * that writes it, or a rename would move both together and prove nothing.
 */
interface StoredLibrary {
  activeId: string | null;
  designs: {
    id: string;
    name: string;
    placements: { id: string; plantId: string; x: number; y: number }[];
    region: { vertices: { x: number; y: number }[] };
    conditionsInput: unknown;
  }[];
}

/**
 * Wait until every pending save has landed, and return what is stored.
 *
 * Saves are debounced by 200ms so that a corner drag is one write rather than
 * sixty (`state/designs-store.ts`), which makes "the last edit is in storage"
 * something to wait for rather than to assume — and waiting for a *count* is
 * not enough, because a read can find the right number of placements from an
 * earlier write while a later edit (the plot's shape, say) is still in flight.
 *
 * So this waits for the stored value to stop changing: two identical reads
 * 300ms apart cannot straddle a write that is at most 200ms away. It is also
 * the honest test of the debounce itself — if it ever stopped firing on its own,
 * leaving the app dependent on the `pagehide` flush, this is where that would
 * surface.
 */
async function settledLibrary(page: Page): Promise<StoredLibrary> {
  let previous: string | null = null;
  await expect
    .poll(
      async () => {
        const now = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
        const settled = previous !== null && now === previous;
        previous = now;
        return settled;
      },
      { intervals: [300], message: 'the open design stopped being written to' },
    )
    .toBe(true);
  return JSON.parse(previous ?? 'null');
}

/** Everything about a design except when it was touched — `updatedAt` moves on every save and is not part of the garden. */
function contentOf(library: StoredLibrary): unknown {
  return library.designs.map(({ id, name, placements, region, conditionsInput }) => ({
    id,
    name,
    placements,
    region,
    conditionsInput,
  }));
}

/** Plant two crops the shipped dataset has a `well-supported` antagonist link between, 60cm apart — the same pair and figure the Phase 4 specs use. */
async function plantTheAntagonistPair(page: Page): Promise<void> {
  const canvas = page.getByLabel(/plot canvas/i);
  const midY = PLOT_CM.height / 2;
  await filterPaletteTo(page, 'Potato');
  await dragCropOntoCanvas(
    page,
    'Potato',
    canvas,
    atPlotCm({ x: PLOT_CM.width / 2 - 30, y: midY }, PLOT_CM),
  );
  await filterPaletteTo(page, 'Tomato');
  await dragCropOntoCanvas(
    page,
    'Tomato',
    canvas,
    atPlotCm({ x: PLOT_CM.width / 2 + 30, y: midY }, PLOT_CM),
  );
}

test('the acceptance criterion: place → undo → redo → reload → the same design', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  await plantTheAntagonistPair(page);
  await expect(page.getByText(/potato:.*1 placed of/i)).toBeVisible();
  await expect(page.getByText(/tomato:.*1 placed of/i)).toBeVisible();

  // A shape change too, so the round trip covers both stores a design spans.
  await page.getByLabel(/width \(m\)/i).fill('4');
  await page.getByRole('button', { name: /use this shape/i }).click();

  const undo = page.getByRole('button', { name: /^undo /i });
  const redo = page.getByRole('button', { name: /^redo /i });

  // Undo names what it will undo — the affordance that replaced the clear-all
  // confirmation dialog (ADR 0034 §5).
  await expect(undo).toHaveAccessibleName(/undo that change to the plot shape/i);
  await undo.click();
  await expect(redo).toHaveAccessibleName(/redo that change to the plot shape/i);
  await redo.click();

  const before = await settledLibrary(page);
  expect(before.designs[0].placements).toHaveLength(2);
  // The shape change is in there too, so the round trip below covers both
  // stores a design spans rather than only the placements.
  expect(Math.max(...before.designs[0].region.vertices.map((vertex) => vertex.x))).toBe(400);

  await page.reload();
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  // Visible first: the garden is on screen, not merely in a string.
  await expect(page.getByText(/potato:.*1 placed of/i)).toBeVisible();
  await expect(page.getByText(/tomato:.*1 placed of/i)).toBeVisible();
  // Including the engine's live opinion of it, recomputed from restored state.
  await expect(page.locator('#plot-settings li[data-severity]').first()).toContainText(
    /grow poorly together/i,
  );

  const after = await settledLibrary(page);
  expect(contentOf(after), 'the design after a reload is the design before it').toEqual(
    contentOf(before),
  );
  expect(after.activeId).toBe(before.activeId);
});

test('a placement costs a reference, not a plant record', async ({ page }) => {
  // The decision ADR 0034 §1 turns on, measured rather than asserted: potato's
  // own record is 3,223 bytes, and a twenty-placement design that embedded
  // whole plants measures 73,610 bytes against 2,050 — ~71 designs in a 5 MiB
  // origin quota rather than ~2,557, for data the app already ships in its
  // bundle.
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();
  await plantTheAntagonistPair(page);

  const library = await settledLibrary(page);
  expect(library.designs[0].placements).toHaveLength(2);
  const bytesPerPlacement = Math.max(
    ...library.designs[0].placements.map((placement) => JSON.stringify(placement).length),
  );

  expect(
    bytesPerPlacement,
    `${bytesPerPlacement} bytes per stored placement (a serialised potato is 3,223)`,
  ).toBeLessThan(128);
  // And the reference really does resolve to the crop, not to a copy of it.
  expect(library.designs[0].placements.map((placement) => placement.plantId).sort()).toEqual([
    'potato',
    'tomato',
  ]);
});

test('"Clear all" clears at once, and the header brings it back by name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();
  await plantTheAntagonistPair(page);

  await page.getByRole('button', { name: /^clear all$/i }).click();

  // No confirmation dialog any more: the reason it existed was that clearing
  // could not be undone, and it can.
  await expect(page.getByRole('button', { name: /clear all plants/i })).toHaveCount(0);
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  const undo = page.getByRole('button', { name: /^undo /i });
  await expect(undo).toHaveAccessibleName(/undo clearing the plot/i);
  await undo.click();
  await expect(page.getByText(/potato:.*1 placed of/i)).toBeVisible();
});

test('Ctrl+Z undoes, and stands down inside a text field', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  await filterPaletteTo(page, 'Onion');
  await page.getByRole('button', { name: /add onion to the plot/i }).click();
  await expect(page.getByText(/onion:.*1 placed of/i)).toBeVisible();

  // In the search box, Ctrl+Z belongs to the browser's own text undo — a
  // keystroke that removed a plant from the plot while the caret was in a field
  // would be astonishing.
  const search = page.getByLabel(/^search$/i);
  await search.focus();
  await page.keyboard.press('Control+z');
  await expect(page.getByText(/onion:.*1 placed of/i)).toBeVisible();

  await page.getByLabel(/plot canvas/i).focus();
  await page.keyboard.press('Control+z');
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByText(/onion:.*1 placed of/i)).toBeVisible();
});

test('the example bed is offered on an empty plot, loads, and undoes as one step', async ({
  page,
}) => {
  // Deliberately a toolbar button and not a first-run modal: `text=Plot shape`
  // is the whole app's readiness signal in `keyboard-walkthrough.mjs` and two
  // specs reach for the header heading on load, all of which a dialog covering
  // the workspace would race (`designs/example-bed.ts`).
  await page.goto('/');
  const start = page.getByRole('button', { name: /start with an example bed/i });
  await expect(start).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await start.click();
  await expect(page.getByText(/carrot:.*1 placed of/i)).toBeVisible();
  await expect(start, 'the offer withdraws once there is something on the plot').toHaveCount(0);
  // It demonstrates the dock as well as the canvas: no warnings at all, and
  // companion suggestions the engine derived from what was planted. (The
  // suggestions name crops *not yet* on the plot, so carrot's well-supported
  // partner does not appear — onion is already in the bed.)
  await expect(page.locator('#plot-settings')).toContainText(/no problems — looking good/i);
  await expect(
    page
      .locator('#plot-settings')
      .getByRole('button', { name: /show me/i })
      .first(),
  ).toBeVisible();

  await page.getByRole('button', { name: /^undo starting from the example bed$/i }).click();
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();
});

test('designs: a new one resets, the old one comes back, and the reload opens the last one', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  await filterPaletteTo(page, 'Onion');
  await page.getByRole('button', { name: /add onion to the plot/i }).click();
  await expect(page.getByText(/onion:.*1 placed of/i)).toBeVisible();

  await page.getByRole('button', { name: /designs:/i }).click();
  await page.getByRole('button', { name: /new design/i }).click();
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  await page.getByRole('button', { name: /designs:/i }).click();
  await page.getByRole('button', { name: /open my garden/i }).click();
  await expect(page.getByText(/onion:.*1 placed of/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/onion:.*1 placed of/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /designs:/i })).toContainText('My garden');
});

test('the dragged card is no longer clipped at the sidebar edge', async ({ page }) => {
  // The fix ADR 0030, 0031 and 0032 each deferred to this phase. The crop list
  // scrolls, which makes it a clipping box on both axes, so a card that
  // followed the pointer *in place* was cut off the moment the drag headed for
  // the canvas. A `<DragOverlay>` ghost is rendered outside that box entirely.
  await page.goto('/');
  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();
  await filterPaletteTo(page, 'Onion');

  const sidebar = await page.getByRole('region', { name: 'Plants' }).boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (sidebar === null || canvasBox === null) throw new Error('no layout to measure');

  await page.getByLabel(/^drag onion onto the plot/i).hover();
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, {
    steps: 8,
  });

  const ghost = page.locator('[class*="ghost"]');
  await expect(ghost).toBeVisible();
  const ghostBox = await ghost.boundingBox();
  if (ghostBox === null) throw new Error('the drag ghost has no bounding box');

  expect(
    ghostBox.x,
    'the ghost is out over the canvas, past the sidebar that used to clip it',
  ).toBeGreaterThan(sidebar.x + sidebar.width);
  // Whole, not a sliver: the clipped card showed whatever fraction of itself
  // was still inside the sidebar.
  expect(ghostBox.width).toBeGreaterThan(200);

  await page.mouse.up();
  await expect(page.getByText(/onion:.*1 placed of/i)).toBeVisible();
});

/** The accessible names of the first `count` tab stops from the top of the document. */
async function firstTabStops(page: Page, count: number): Promise<string[]> {
  const names: string[] = [];
  for (let press = 0; press < count; press += 1) {
    await page.keyboard.press('Tab');
    names.push(
      await page.evaluate(() => {
        const element = document.activeElement;
        if (element === null) return '';
        return (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();
      }),
    );
  }
  return names;
}

test('the header costs the stops it has earned, and the skip links still follow them', async ({
  page,
}) => {
  // This is the first phase to *add* chrome rather than reshape it, and the
  // header is the app's first tab stop — so the count is a regression guard,
  // not a note (ADR 0034 §6).
  //
  // The measured answer is better than the designed one, and it falls out of
  // the buttons being honest rather than out of a trick: a `disabled` button is
  // not in the tab order, so the header costs **one** extra stop on a fresh
  // page, **two** once there is something to undo, and **three** only after an
  // undo has made a redo available. A keyboard user pays for reach they have.
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  const atRest = await firstTabStops(page, 4);
  expect(atRest[0]).toMatch(/garden planner/i);
  expect(atRest[1]).toMatch(/designs:/i);
  expect(atRest[2]).toMatch(/skip to plot canvas/i);
  expect(atRest[3]).toMatch(/skip to plot settings/i);

  await filterPaletteTo(page, 'Onion');
  await page.getByRole('button', { name: /add onion to the plot/i }).click();
  await expect(page.getByText(/onion:.*1 placed of/i)).toBeVisible();

  // Placing a crop leaves focus on the palette's button, and a browser resumes
  // tabbing from wherever focus is — so the sequence is restarted from the
  // header's own link, which the pass above has just shown is stop one.
  await page.getByRole('link', { name: /garden planner/i }).focus();
  const withHistory = await firstTabStops(page, 4);
  expect(withHistory[0]).toMatch(/^undo planting onion/i);
  expect(withHistory[1]).toMatch(/designs:/i);
  expect(withHistory[2]).toMatch(/skip to plot canvas/i);
  expect(withHistory[3]).toMatch(/skip to plot settings/i);

  // Two edits and one undo, so that both buttons are live at once — after a
  // single edit an undo empties the stack and it is redo that is the only stop.
  await filterPaletteTo(page, 'Carrot');
  await page.getByRole('button', { name: /add carrot to the plot/i }).click();
  await expect(page.getByText(/carrot:.*1 placed of/i)).toBeVisible();
  await page.getByRole('button', { name: /^undo planting carrot$/i }).click();

  await page.getByRole('link', { name: /garden planner/i }).focus();
  const withRedo = await firstTabStops(page, 5);
  expect(withRedo[0]).toMatch(/^undo planting onion/i);
  expect(withRedo[1]).toMatch(/^redo planting carrot/i);
  expect(withRedo[2]).toMatch(/designs:/i);
  expect(withRedo[3]).toMatch(/skip to plot canvas/i);
  expect(withRedo[4]).toMatch(/skip to plot settings/i);
});
