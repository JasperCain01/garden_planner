import { defineConfig } from '@playwright/test';

// Post-deploy smoke check — run **by hand**, after `npm run deploy` (repo
// root) and after a maintainer has enabled GitHub Pages in the repo settings
// (see README.md). This is deliberately *not* part of `npm run e2e` or
// `npm run verify`: those must stay reproducible with no network dependency
// beyond `localhost`, which is what lets them run unchanged in CI (Stage 6.4's
// `.github/workflows/checks.yml`). A check against the live deployed site is a
// different thing, and stays a by-hand step a maintainer runs after a deploy.
// Run with:
//
//   npm run smoke:deployed -w app
//   DEPLOYED_URL=https://<owner>.github.io/<repo>/ npm run smoke:deployed -w app   # override
//
// Unlike `playwright.config.ts`, there is no `webServer` block here — this
// hits the real, already-deployed site, not a locally-built preview.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/deployed-smoke.spec.ts',
  use: {
    baseURL: process.env.DEPLOYED_URL ?? 'https://jaspercain01.github.io/garden_planner/',
    ...(process.env.PW_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } }
      : {}),
  },
});
