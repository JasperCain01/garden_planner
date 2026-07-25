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

  it('renders the plot-definition page at the index route', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: /define your plot/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /use this shape/i })).toBeTruthy();
    expect(screen.getByLabelText(/light level/i)).toBeTruthy();
  });

  it('routes an unmatched path to the not-found page', () => {
    renderApp('/somewhere-that-does-not-exist');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeTruthy();
  });
});
