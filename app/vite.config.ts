/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for the front-end.
//
// `base`: on GitHub Pages a project site is served from `/<repo>/`, but locally
// (and in Playwright preview) we serve from `/`. We switch on an env flag so
// both work. Deployment is finalized in Stage 5.2; this keeps builds correct in
// the meantime.
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/garden_planner/' : '/',
  plugins: [react()],
  // Vitest configuration lives here so it shares Vite's transforms. Component
  // tests need a DOM, hence jsdom. `globals: true` exposes a global `afterEach`,
  // which React Testing Library uses to auto-unmount between tests (without it,
  // rendered DOM leaks from one test into the next). Unit tests elsewhere
  // (engine/etl) run in Node.
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
