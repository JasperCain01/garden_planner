import { defineConfig } from '@playwright/test';

// End-to-end config. Playwright builds the app, serves the production preview,
// and drives a real browser against it. This is the layer that will host the
// core-journey and offline tests described in WORKPLAN.md §1.3.
//
// `deployed-smoke.spec.ts` is deliberately excluded: it targets the live
// GitHub Pages URL, not this local preview server, and runs under its own
// config (`playwright.pages.config.ts`, `npm run smoke:deployed`) — a manual,
// by-hand check per WORKPLAN.md §1.4, not part of `npm run e2e`/`verify`.
//
// `a11y.spec.ts` is excluded for a related reason (Workplan Stage 6.2): it has
// its own config (`playwright.a11y.config.ts`, `npm run a11y`) so it can be run
// on its own, and Stage 6.4's CI workflow gives it its own job for the same
// reason — an accessibility failure says something different from a broken
// unit test. It is still a blocking check, just not one `npm run e2e` runs.
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/deployed-smoke.spec.ts', '**/a11y.spec.ts'],
  // `plot-export.spec.ts` has been observed to fail once and pass on retry
  // under the default two-worker parallelism, across several sessions (see
  // `docs/qa-checklist.md` §4). One retry in CI is the honest fix for a known
  // flake: the spec still has to pass, and a genuinely broken export fails
  // both attempts — unlike a workflow-level `continue-on-error`, which would
  // let a real failure through silently. Locally the default of 0 stands, so a
  // flake stays visible to whoever is working on the code.
  retries: process.env.CI ? 1 : 0,
  // A stray `test.only` reduces the suite to one spec while still reporting
  // success. On a developer's machine that's a convenience; in CI it is a gate
  // that silently stops gating, so CI refuses the run instead.
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: 'http://localhost:4173',
    // Escape hatch for environments that ship a pre-installed browser whose
    // build differs from this Playwright version: set PW_EXECUTABLE_PATH to that
    // binary. In normal setups (and CI, which runs `playwright install`) this is
    // unset and Playwright uses its own managed browser.
    ...(process.env.PW_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } }
      : {}),
  },
  webServer: {
    // Build then preview, so E2E runs against the real production bundle.
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
