import { defineConfig } from '@playwright/test';

// The locally-runnable axe accessibility check (Workplan Stage 6.2). Run **by
// hand**: there is no `.github/workflows/` directory yet (WORKPLAN.md §1.4),
// so this mirrors Stage 5.1's Lighthouse audit — a documented command whose
// result is recorded in README.md, not a CI gate. Deliberately its own config
// (same pattern as `playwright.pages.config.ts`) rather than folded into
// `playwright.config.ts`'s `testDir`, so `npm run e2e`/`verify` never runs it
// by accident:
//
//   npm run a11y -w app
//
// Unlike the deployed-smoke config, this *does* need a `webServer` — it scans
// the local production preview, not a live deployed site.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/a11y.spec.ts',
  use: {
    baseURL: 'http://localhost:4173',
    ...(process.env.PW_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } }
      : {}),
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
