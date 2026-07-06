import { test, expect } from '@playwright/test';

// Scaffold end-to-end test: the app shell loads and renders in a real browser.
// The core-journey (define plot → palette → drag-drop → warnings) and the
// explicit offline test are added alongside those features in later stages.
test('app shell loads in the browser', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /garden planner/i })).toBeVisible();
});
