import type { Page } from '@playwright/test';

import { DESIGNS_STORAGE_KEY } from '../src/state/design-codec.ts';

/**
 * Make every navigation in this page start from an empty plot (UI redesign
 * Phase 5).
 *
 * **Why any spec needs this now.** Until this phase a `page.goto('/')` was a
 * fresh start by construction — nothing was written down, so nothing came back.
 * The app saves the open design now, and Playwright's per-test isolation does
 * not help: a context is fresh per *test*, not per navigation, so a test that
 * loads the app twice sees its own earlier work on the second load. That is
 * correct behaviour and the whole point of the phase; it is also a silent trap
 * for a spec that was written when it could not happen.
 *
 * `canvas-scale.spec.ts` is the one it actually caught. Its pixel-differencing
 * helper reloads the app between the two crops it compares, and with the
 * placements restored the second measurement started from a plot that already
 * had a radish on it.
 *
 * An `addInitScript` rather than a `localStorage.clear()` between navigations,
 * because the app restores **before the first render** (`src/main.tsx`) — a
 * clear that ran after the page had loaded would be clearing storage the app
 * had already read.
 *
 * Specs that are *about* persistence deliberately do not call this: see
 * `persistence.spec.ts`, whose entire subject is what survives a reload.
 */
export async function startWithNoSavedDesigns(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // A browser with storage disabled has nothing to clear, and the app
      // itself already tolerates that (`state/designs-store.ts`).
    }
  }, DESIGNS_STORAGE_KEY);
}
