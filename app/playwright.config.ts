import { defineConfig } from '@playwright/test';

// End-to-end config. Playwright builds the app, serves the production preview,
// and drives a real browser against it. This is the layer that will host the
// core-journey and offline tests described in WORKPLAN.md §1.3.
export default defineConfig({
  testDir: './e2e',
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
