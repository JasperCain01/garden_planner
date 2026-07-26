import { expect, test } from '@playwright/test';

import { dragCropOntoCanvas } from './drag.ts';

// The offline E2E test WORKPLAN.md §1.3 requires: "An E2E run that loads the
// app, goes offline, and confirms it still functions." Stage 5.1 adds the
// service worker and manifest (`app/vite.config.ts`'s `VitePWA` plugin,
// `docs/adr/0022-pwa-offline-support.md`); this is the test that proves the
// offline constraint `DESIGN.md`/`WORKPLAN.md` §0.1 have held by construction
// (no runtime fetches) is now also enforced by a service worker.
//
// The classic gotcha (also flagged in `docs/stage-5.1-brief.md`): a service
// worker doesn't control the page that installed it until Workbox's
// `clientsClaim` runs, which only happens once the worker has *activated* —
// there's an install → activate handoff, not an instant one. `vite.config.ts`
// sets `clientsClaim: true` and `skipWaiting: true` specifically so that
// handoff happens automatically, without a human (or a second manual reload)
// forcing it — but the test still has to *wait* for it rather than assuming
// it's instantaneous, hence `waitForFunction` below instead of a fixed sleep.
//
// Tall viewport for the same reason as `plot-canvas.spec.ts`: the unfiltered
// palette makes the page much taller than a normal viewport, and a
// `page.mouse` drag doesn't auto-scroll the way a `Locator` action would.
// A very tall viewport keeps the palette entry and the canvas on-screen at
// once: `page.mouse` works in viewport coordinates and does not scroll (see
// `drag.ts`). 4000 is deliberate headroom over the ~3700 a filtered palette
// plus the canvas actually needs today — at 3500 the canvas sat just below
// the fold and drags intermittently did nothing. `drag.ts` asserts both ends
// are in view, so if this ever stops being enough the failure says so.
test.use({ viewport: { width: 1024, height: 4000 } });

test('the app works with the network off, once the service worker has installed', async ({
  page,
  context,
}) => {
  // First load, online: this is what registers the service worker and lets
  // Workbox precache the app shell (`registerSW.js` fires on `window.load`).
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /garden planner/i })).toBeVisible();

  // Wait for the service worker to finish installing *and* activating, then
  // claim this page as its client — `navigator.serviceWorker.controller` is
  // non-null only once that's happened.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 30_000,
  });

  // A reload while still online lets this navigation itself be served from
  // the now-controlling service worker (belt-and-braces alongside
  // `clientsClaim`), so every asset the core journey below needs is already
  // in the Cache Storage the next, offline load will read from.
  await page.reload();
  await expect(page.getByRole('heading', { name: /garden planner/i })).toBeVisible();

  await context.setOffline(true);

  // The core journey (mirroring `plot-canvas.spec.ts`): reload with the
  // network off, the plot-definition page still loads, the palette still
  // renders real (bundled, not fetched) crops, and a plant can still be
  // placed on the canvas with live count feedback.
  await page.reload();
  await expect(page.getByRole('heading', { name: /garden planner/i })).toBeVisible();

  await page.getByLabel(/^search$/i).fill('Onion');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  await dragCropOntoCanvas(page, 'Onion', canvas);

  // Placed entirely offline: a fitPlant summary and tally appear, exactly as
  // they would online.
  await expect(page.getByText(/nothing placed yet/i)).not.toBeVisible();
  await expect(page.getByText(/plants:/)).toBeVisible();
  await expect(page.getByText(/1 placed of/)).toBeVisible();
});
