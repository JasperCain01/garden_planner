import { expect, test, type Page } from '@playwright/test';

import { dragCropOntoCanvas } from './drag.ts';

/**
 * The UI redesign Phase 3 acceptance criteria, as a test
 * (`docs/ui-aesthetic-review.md` §"Phase 3 — Palette redesign"):
 *
 * > ≥8 crops visible in the sidebar without scrolling at 900px height;
 * > reasoning reachable in one click; drag and keyboard paths intact.
 *
 * The first is the number the phase exists to change — it was **0** before,
 * because the shortest row (589px) was taller than the whole list box (394px).
 * It is also the kind of number that decays silently: one more filter chip, a
 * taller heading, a card that grows by four pixels, and it is seven. So it is
 * counted here rather than eyeballed, in the browser, at the review's own
 * viewport.
 *
 * The last two are in this file because they are the same decision seen from
 * two sides: the palette card is now a disclosure *and* a drag surface, and the
 * only place that can be proved is a real browser with a real pointer (ADR
 * 0032 §2). `PlantPalette.test.tsx` covers what the disclosure contains;
 * nothing in jsdom can tell you whether dnd-kit ate the click.
 */

test.use({ viewport: { width: 1440, height: 900 } });

/** The palette's crop list, by the element that actually scrolls. */
const LIST = 'ul[class*="list"]';

/**
 * How many crop cards are wholly inside the list's scrollport, and how much
 * room is left under the last of them.
 *
 * "Inside the scrollport" is measured against the list's **client** box — a
 * scroll container clips at its padding edge, so a row that reaches into the
 * border is a row you cannot fully see. The slack figure is what makes a
 * regression legible when this fails: "7 crops, 2px of slack" says something
 * different from "7 crops, 60px of slack".
 */
async function visibleCrops(page: Page): Promise<{ count: number; slackPx: number }> {
  return page.evaluate((listSelector) => {
    const list = document.querySelector(listSelector);
    if (list === null) throw new Error('no crop list in the palette');
    const box = list.getBoundingClientRect();
    const top = box.top + list.clientTop;
    const bottom = top + list.clientHeight;

    const inside = [...list.children].filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top >= top - 0.5 && rect.bottom <= bottom + 0.5;
    });
    const last = inside.at(-1)?.getBoundingClientRect();
    return { count: inside.length, slackPx: last ? Math.round(bottom - last.bottom) : 0 };
  }, LIST);
}

test('at least eight crops are visible in the sidebar without scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel(/plot canvas/i)).toBeVisible();

  // The default, unfiltered state — all 144 shipped crops ranked, which is
  // both the common case and the worst one.
  await expect(page.getByText(/144 of 144 crops/)).toBeVisible();
  expect(await page.evaluate((s) => document.querySelector(s)?.scrollTop, LIST)).toBe(0);

  const { count, slackPx } = await visibleCrops(page);
  expect(
    count,
    `${count} crops visible, ${slackPx}px of slack under the last`,
  ).toBeGreaterThanOrEqual(8);
});

test('no card’s category word ellipsizes (post-review fix B1)', async ({ page }) => {
  // The review's live finding: at 1440×900 with default Chromium fonts, the
  // category word rendered "veget…" — worse than the measured, accepted
  // floor of "vegetab…" — on every excellent-match vegetable row, because the
  // band chip's full "Excellent match" phrase left it no room. The fix
  // shrinks the chip's *visible* text to its headline word; this checks the
  // budget that frees for the category word actually gets spent, on every
  // rendered row, not just the worst case the review happened to hit.
  await page.goto('/');
  await expect(page.getByText(/144 of 144 crops/)).toBeVisible();

  const overflowing = await page.evaluate(() => {
    const categories = document.querySelectorAll<HTMLElement>('span[class*="category"]');
    return [...categories]
      .filter((el) => el.scrollWidth > el.clientWidth)
      .map((el) => el.textContent);
  });

  expect(
    overflowing,
    `${overflowing.length} category word(s) ellipsized: ${overflowing.join(', ')}`,
  ).toEqual([]);
});

test('one click on a card opens the engine’s reasoning for that crop', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('button', { name: /^drag Onion onto the plot/i });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('aria-expanded', 'false');

  // A real pointer click on the drag surface. Without the `PointerSensor`'s
  // activation constraint this is a one-pixel drag and the click never
  // arrives — which is exactly the trap this phase had to clear.
  await card.click();

  await expect(card).toHaveAttribute('aria-expanded', 'true');
  const row = page.getByRole('listitem').filter({ has: card });
  await expect(row.getByText(/^Confidence: \d+%$/)).toBeVisible();
  // The per-dimension reasoning, in the engine's own words.
  await expect(row.getByText(/^light:/i)).toBeVisible();

  await card.click();
  await expect(card).toHaveAttribute('aria-expanded', 'false');
});

test('a drag still places a crop, and does not open its reasoning', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  // Same gesture, same element, different intent: this one travels. The two
  // are told apart by distance alone (`PlotDefinitionPage`'s sensors), so
  // "the drag didn't also expand the card" is a real assertion, not a
  // tautology — dnd-kit suppressing the trailing click is what makes it true.
  await dragCropOntoCanvas(page, 'Onion', canvas);

  await expect(page.getByText(/1 placed of/)).toBeVisible();
  await expect(page.locator('[aria-expanded="true"]')).toHaveCount(0);
});

test('the keyboard reaches both jobs of a card: Enter opens the reasoning, ＋ places the crop', async ({
  page,
}) => {
  await page.goto('/');
  const card = page.getByRole('button', { name: /^drag Onion onto the plot/i });
  await expect(card).toBeVisible();

  // Enter, because `PlotDefinitionPage`'s `KeyboardSensor` starts a drag on
  // Space alone so this key is free for the disclosure (ADR 0032 §2). A
  // `role="button"` <div> never synthesises a click from Enter by itself.
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-expanded', 'true');

  // And the placement path ADR 0026 made contractual is untouched — the
  // button's name is the same sentence it has always been, only its drawing
  // shrank to a glyph.
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute(
    'aria-label',
    /^Add Onion to the plot, without dragging$/,
  );
  await page.keyboard.press('Enter');
  await expect(page.getByText(/1 placed of/)).toBeVisible();
});
