import { defineConfig } from '@playwright/test';

// The axe accessibility check (Workplan Stage 6.2). Runnable by hand with the
// command below, and — since Stage 6.4 — run on every push and pull request as
// its own blocking job in `.github/workflows/checks.yml` (ADR 0027 records why
// this one gates while the Lighthouse audit only reports). Its last-recorded
// result stays in README.md either way. Deliberately its own config
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
