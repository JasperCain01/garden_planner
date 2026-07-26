/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Vite config for the front-end.
//
// `base`: on GitHub Pages a project site is served from `/<repo>/`, but locally
// (and in Playwright preview) we serve from `/`. We switch on an env flag so
// both work. Deployment is finalized in Stage 5.2; this keeps builds correct in
// the meantime. The PWA plugin below reads this same `base` (it derives
// `start_url`/`scope` from Vite's resolved config), so 5.1's manifest and 5.2's
// Pages path don't fight each other.
const base = process.env.GITHUB_PAGES === 'true' ? '/garden_planner/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    // Stage 5.1: installability + offline. `generateSW` (the default
    // strategy, via Workbox) precaches the built output — see the
    // `workbox.globPatterns` comment below for why the default pattern isn't
    // quite enough on its own, and `docs/adr/0022-pwa-offline-support.md` for
    // the full reasoning (why this plugin, why `generateSW` over
    // `injectManifest`, and how the dataset/icons end up covered).
    VitePWA({
      // Precache-and-refresh: a new build's service worker activates and
      // takes over immediately (`clientsClaim`/`skipWaiting` below) rather
      // than waiting for every tab to close, and re-fetches in the
      // background. No update-available UI is wired up (out of scope for
      // this stage) — this is the closest zero-config match to that
      // behaviour.
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg', 'maskable-icon.svg'],
      manifest: {
        name: 'Garden Planner',
        short_name: 'Garden Planner',
        description: 'Offline-capable planner for edible gardens and allotments.',
        theme_color: '#4f8a45',
        background_color: '#f4f7f1',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'maskable-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The default `globPatterns` (`**/*.{js,wasm,css,html}`) would miss
        // two things this app actually ships: the crop icon set, and — in
        // principle — any future non-JS static asset. The shipped *dataset*
        // (`app/src/dataset/shipped-plants.ts`) needs no extra entry here: a
        // JSON module import compiles straight into the JS bundle, so it's
        // already covered by `.js`. Crop icons
        // (`app/src/icons/resolveIcon.ts`) are different — they're imported
        // with Vite's `?url` query, which always emits a separate hashed
        // asset file rather than inlining, regardless of size — so `dist/`
        // ends up with real `.svg` files the default pattern doesn't match.
        // Confirmed by inspecting a production build's `dist/` output and
        // the generated `sw.js` precache manifest (see the ADR).
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        // Take over existing clients as soon as the new service worker
        // activates, instead of the default "wait until every tab with the
        // old SW closes". Also what lets an E2E test (`e2e/offline.spec.ts`)
        // observe `navigator.serviceWorker.controller` on the very first load
        // without a second manual reload beyond the one that lets the SW
        // finish installing.
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  // Vitest configuration lives here so it shares Vite's transforms. Component
  // tests need a DOM, hence jsdom. `globals: true` exposes a global `afterEach`,
  // which React Testing Library uses to auto-unmount between tests (without it,
  // rendered DOM leaks from one test into the next). Unit tests elsewhere
  // (engine/etl) run in Node.
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
