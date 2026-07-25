import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { appRoutes } from './routes/router.tsx';

// Component smoke test (Workplan Stage 3.1 deliverable): the app shell
// renders, the engine wiring works end-to-end, and the bundled dataset loads
// without throwing. Uses `createMemoryRouter` rather than mounting `<App />`
// directly — that keeps the test independent of the browser History API and
// of `import.meta.env.BASE_URL`, which is exactly what Stage 3.1's brief warns
// varies between dev and a GitHub Pages build; the base-path wiring itself is
// verified separately against a built preview (see docs/stage-3.1-brief.md).
function renderApp(initialPath = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialPath] });
  return render(<RouterProvider router={router} />);
}

describe('App shell', () => {
  it('renders the title', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: /garden planner/i })).toBeTruthy();
  });

  it('shows the engine status (cross-workspace wiring works)', () => {
    renderApp();
    expect(screen.getByText(/engine scaffold ready/i)).toBeTruthy();
  });

  it('loads the bundled dataset and renders a plant count', () => {
    renderApp();
    expect(screen.getByText(/plant list loaded/i)).toBeTruthy();
    // The shipped dataset alone is 160 crops (data/README.md); asserting ">
    // some floor" rather than the exact figure keeps this test from being an
    // accidental regression check on the ETL's own record count.
    expect(screen.getByText(/\d+ crops/)).toBeTruthy();
  });

  it('routes an unmatched path to the not-found page', () => {
    renderApp('/somewhere-that-does-not-exist');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeTruthy();
  });
});
