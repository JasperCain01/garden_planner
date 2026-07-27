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
        // Widened from the default (`**/*.{js,wasm,css,html}`) as a **safety
        // net**, not because today's build needs it. What a production build
        // actually emits (verified against `dist/` and the generated
        // `sw.js` precache manifest — see ADR 0022):
        //
        //  - The shipped *dataset* (`app/src/dataset/shipped-plants.ts`) is a
        //    JSON module import, so it compiles straight into the JS bundle
        //    and is already covered by `.js`.
        //  - Every crop icon (`app/src/icons/resolveIcon.ts`) is *also* in
        //    that bundle. `?url` does **not** opt out of Vite's
        //    `assetsInlineLimit` — only `?no-inline` does — and every icon is
        //    comfortably under it (`app/src/icons/budget.test.ts` holds them
        //    there), so they inline as base64 `data:` URIs rather than being
        //    emitted as separate `.svg` files. `dist/` contains no crop SVGs
        //    at all.
        //
        // So `svg` here currently matches only `public/`'s two PWA manifest
        // icons, which `includeAssets` above already covers. It earns its
        // place by covering the day an icon (or any other static asset) grows
        // past the inline threshold and Vite starts emitting it as a separate
        // hashed file — at which point precaching it must not depend on
        // another session rediscovering all of the above.
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
  build: {
    // A deliberate, recorded budget on the shipped bundle rather than a
    // warning everyone learns to scroll past.
    //
    // Today's build is ~1,109 kB raw / ~264 kB gzipped in one chunk, and that
    // is *by design*: §0.1 says everything the app needs must ship with it, so
    // the 144-crop dataset (a JSON module) and the whole icon set (inlined as
    // base64 `data:` URIs — see the workbox comment above) are both in there
    // alongside React and Konva. Splitting them into separate chunks would not
    // speed up first paint, because the palette needs the dataset and the
    // canvas needs the icons: it would just trade one request for several.
    //
    // So the limit is set a little above where we actually are. Vite stays
    // quiet at the known-good size, and crossing ~1,200 kB means something
    // genuinely new arrived in the bundle and is worth a look — which is what
    // a budget is for. Raise it only with a reason, not to silence it.
    chunkSizeWarningLimit: 1200,
  },
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
