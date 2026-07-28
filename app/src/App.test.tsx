import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { appRoutes } from './routes/router.tsx';

// Component smoke test (Workplan Stage 3.1 deliverable, content updated for
// Stage 3.2): the app shell renders and the router actually routes. Uses
// `createMemoryRouter` rather than mounting `<App />` directly — that keeps
// the test independent of the browser History API and of
// `import.meta.env.BASE_URL`, which is exactly what Stage 3.1's brief warns
// varies between dev and a GitHub Pages build; the base-path wiring itself is
// verified separately against a built preview (see docs/stage-3.1-brief.md).
//
// The engine-status/dataset-loaded smoke checks Stage 3.1 ran through `Home`
// moved with it: `Home` now renders the real plot-definition page (Stage
// 3.2), and "the engine package is wired in" / "the bundled dataset loads" are
// exercised by their own unit tests (`dataset/shipped-plants.test.ts`,
// `state/use-plant-list.test.ts`) rather than by this shell-level test.
function renderApp(initialPath = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialPath] });
  return render(<RouterProvider router={router} />);
}

describe('App shell', () => {
  it('renders the title', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: /garden planner/i })).toBeTruthy();
  });

  // Mounts the real, unfiltered palette (~130+ shipped crops match the
  // default full-sun conditions), and Workplan Stage 6.2 gave every row a
  // second interactive control (the "Add to plot" button, alongside the
  // existing draggable region) for its keyboard-operable placement path —
  // genuinely more DOM per row, and jsdom mounts that measurably slower than
  // this test's previous ~1.5s. Longer timeout, not a regression to chase.
  it('renders the plot-definition page at the index route', () => {
    renderApp();
    // The workspace's three regions (UI redesign Phase 1) — the numbered
    // "1. Define your plot" heading this used to assert on retired with the
    // stacked document it belonged to.
    expect(screen.getByRole('heading', { name: /plot shape/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /use this shape/i })).toBeTruthy();
    expect(screen.getByLabelText(/light level/i)).toBeTruthy();
  }, 15_000);

  // The three labelled `region` landmarks are how the workspace replaced the
  // numbered headings as the structure a screen-reader user navigates by
  // (`docs/accessibility.md`), so they're worth asserting rather than assuming.
  it('exposes the workspace as three labelled regions', () => {
    renderApp();
    for (const name of [/^plants$/i, /^your plot$/i, /plot settings and checks/i]) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
  }, 15_000);

  it('routes an unmatched path to the not-found page', () => {
    renderApp('/somewhere-that-does-not-exist');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeTruthy();
  });
});
