/**
 * Route configuration for the app shell (Workplan Stage 3.1).
 *
 * `appRoutes` is a plain `RouteObject[]`, kept separate from the
 * `createBrowserRouter` call that consumes it so a test can hand the same tree
 * to `createMemoryRouter` instead — a real browser history object is neither
 * needed nor wanted under jsdom (see `App.test.tsx`).
 *
 * `Home` (Stage 3.2) renders the real plot-definition page
 * (`../plot/PlotDefinitionPage.tsx`) as the index route — Stage 3.1 left it a
 * placeholder specifically so this stage could replace its content in place,
 * rather than adding a second nav link and leaving the placeholder at `/`.
 * `NotFound` demonstrates the router actually routes (an unmatched path
 * renders something, rather than a blank screen).
 */

import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell.tsx';
import { Home } from './Home.tsx';
import { NotFound } from './NotFound.tsx';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

/**
 * Vite sets `import.meta.env.BASE_URL` to the configured `base`
 * (`vite.config.ts`) — `/` in dev/preview, `/garden_planner/` when built with
 * `GITHUB_PAGES=true`. React Router's `basename` is conventionally written
 * without a trailing slash, so strip one if present; an all-slash result (the
 * `/` case) falls back to `/` rather than the empty string, which
 * `createBrowserRouter` would treat as "no basename" but reads oddly as a
 * literal value.
 */
export function normalizeBasename(baseUrl: string): string {
  const stripped = baseUrl.replace(/\/$/, '');
  return stripped === '' ? '/' : stripped;
}

/** Build the app's real browser router, basename derived from Vite's `base`. */
export function createAppRouter() {
  return createBrowserRouter(appRoutes, { basename: normalizeBasename(import.meta.env.BASE_URL) });
}
