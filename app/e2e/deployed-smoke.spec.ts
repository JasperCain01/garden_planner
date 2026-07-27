import { expect, test } from '@playwright/test';

import { dragCropOntoCanvas } from './drag.ts';

// Post-deploy smoke check — confirms the *actually hosted* GitHub Pages build
// serves correctly (right base path, assets resolve, service worker installs)
// and that the core journey still works against real production assets, not
// just the local preview server `smoke.spec.ts` and friends test against. Run
// by hand via `npm run smoke:deployed -w app` (see `playwright.pages.config.ts`
// and README.md) — never part of `npm run e2e` or `verify` (WORKPLAN.md §1.4:
// no CI, and those must stay reproducible with no network dependency beyond
// `localhost`).
//
// Tall viewport for the same reason as `plot-canvas.spec.ts`/`offline.spec.ts`:
// keeps the palette entry and the canvas on-screen at once for `page.mouse`,
// which works in viewport coordinates and does not scroll.
test.use({ viewport: { width: 1024, height: 4000 } });

test('the deployed app loads under its Pages base path and the core drag journey works', async ({
  page,
}) => {
  // `page.goto('/')` would resolve against the *origin*, dropping the
  // `/garden_planner/` base path — a leading slash overrides the base's own
  // path per the WHATWG URL rules Playwright's `baseURL` option follows.
  // `'./'` is relative, so it resolves against the full `baseURL` (path
  // included) instead — exactly the regression this check exists to catch.
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /garden planner/i })).toBeVisible();

  // The service worker registering (and this navigation ending up controlled
  // by it) is itself part of what "deployed correctly" means — see
  // `docs/adr/0022-pwa-offline-support.md` for why `clientsClaim`/`skipWaiting`
  // make this same-load rather than needing a second reload, and why it's a
  // wait, not an instant check.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 30_000,
  });

  await page.getByLabel(/^search$/i).fill('Onion');

  const canvas = page.getByLabel(/plot canvas/i);
  await expect(canvas).toBeVisible();
  await expect(page.getByText(/nothing placed yet/i)).toBeVisible();

  await dragCropOntoCanvas(page, 'Onion', canvas);

  await expect(page.getByText(/nothing placed yet/i)).not.toBeVisible();
  await expect(page.getByText(/1 placed of/)).toBeVisible();
});
