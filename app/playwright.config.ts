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
// `a11y.spec.ts` is excluded for the same reason (Workplan Stage 6.2): it's a
// locally-runnable axe check (`playwright.a11y.config.ts`, `npm run a11y`),
// not a CI gate — §1.4 holds until Stage 6.4, so this stays a documented
// manual command whose result is recorded in README.md, same shape as Stage
// 5.1's Lighthouse audit.
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/deployed-smoke.spec.ts', '**/a11y.spec.ts'],
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
