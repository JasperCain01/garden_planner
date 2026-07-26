# 0022 — PWA / offline support: `vite-plugin-pwa`, `generateSW`, and confirming the "free" precache

- **Status:** Accepted
- **Date:** 2026-07-26
- **Workplan stage:** 5.1 — PWA / offline support

## Context

`WORKPLAN.md` §0.1 and `DESIGN.md` have held "the app must work offline" as a
constraint since Stage 0.1, true so far only "by construction" — the app has
no runtime backend and no runtime `fetch` calls at all: the dataset
(`app/src/dataset/shipped-plants.ts`) is a build-time JSON import, and crop
icons (`app/src/icons/resolveIcon.ts`) are Vite-bundled assets resolved via
`import.meta.glob`. Nothing was actually caching the app for offline use,
though — without a service worker, a browser with no network simply can't
load the page at all on a second visit, "no runtime fetch" or not. Stage 5.1
closes that gap and adds the explicit offline E2E test `WORKPLAN.md` §1.3 has
required since the verification strategy was written.

Two decisions this stage had to make that weren't fully settled by the brief:
which tool, and whether the dataset/icons need any bespoke caching logic
beyond the tool's defaults.

## Decision

### Tool: `vite-plugin-pwa`, `generateSW` strategy

`vite-plugin-pwa` (Workbox under the hood) is used, per `WORKPLAN.md` §0.5's
original stack proposal and the Stage 5.1 brief's own recommendation. Within
the plugin, the default **`generateSW`** strategy is used rather than
`injectManifest`: `generateSW` generates a complete service worker from a
declarative config (`workbox: {...}` in `vite.config.ts`) — precache the
build output, done. `injectManifest` requires hand-writing a service-worker
source file that the plugin only injects a precache manifest into; that's the
right tool when an app needs custom runtime-caching routes (e.g. a real API
with a network-first/stale-while-revalidate policy) or custom push-
notification/background-sync logic. This app has neither — no runtime network
calls exist at all (`WORKPLAN.md` §0.1) — so a hand-written service worker
would be pure surface area with no corresponding need. `generateSW` is the
smaller, more maintainable choice for an app whose entire offline requirement
is "cache everything I built and serve it back."

### No bespoke runtime-caching scheme for the dataset or icons

The brief flagged this as the one thing worth actually testing rather than
assuming: does the default precache-everything approach already cover the
bundled dataset and icon set "for free"? Confirmed by building the app
(`npm run build`) and inspecting both `dist/` and the generated `dist/sw.js`:

- `dist/` contains exactly one JS bundle (`assets/index-*.js`), `index.html`,
  `manifest.webmanifest`, and the two new PWA icon files
  (`pwa-icon.svg`, `maskable-icon.svg`) — **no separate crop-icon `.svg`
  files**. The dataset (a JSON module import) compiles straight into the JS
  bundle, as expected. Every crop icon also happens to be small enough
  (`app/src/icons/budget.test.ts` enforces a byte budget per icon) to fall
  under Vite's default `assetsInlineLimit`, so — despite being imported with
  an explicit `?url` query in `resolveIcon.ts` — they're inlined as `data:`
  URIs inside that same JS bundle rather than emitted as separate files.
- `dist/sw.js`'s generated `precacheAndRoute([...])` call lists exactly those
  files (`registerSW.js`, `index.html`, `manifest.webmanifest`, the two icon
  files, the one JS bundle). Nothing is missing, and nothing needed a
  bespoke runtime-caching route.

So the default `generateSW` precache-everything approach does cover the
dataset and icon set for free, exactly as the brief predicted — **today**.
That's an artifact of the icon set's current size (each icon is small and the
whole set is well under the inline threshold), not a structural guarantee.
The one change made to `workbox.globPatterns` (default
`**/*.{js,wasm,css,html}`, changed to
`**/*.{js,css,html,svg,webmanifest}`) is deliberately a safety net rather
than something the current build strictly needs: if a future icon (or any
other static asset) grows past the inline threshold and Vite starts emitting
it as a separate hashed file, `svg` in the glob means it still gets precached
without another session having to rediscover this. `docs/icon-style-guide.md`
and `app/src/icons/budget.test.ts` are the places a future session would look
if that budget were ever raised — worth a note there if it happens, so this
assumption gets re-verified rather than silently going stale.

### `clientsClaim` + `skipWaiting`, and the activation-timing gotcha

A service worker doesn't control the page that installed it until Workbox's
`clientsClaim()` runs post-activation — by default, a newly-installed worker
sits "waiting" until every open tab running the old worker (or, on first
install, until the _next_ navigation) closes. Left at defaults, the offline
E2E test (`app/e2e/offline.spec.ts`) would need an extra reload-and-hope
dance to get a controlled page. `vite.config.ts` sets both
`workbox.skipWaiting: true` (a newly-installed worker activates immediately
instead of waiting) and `workbox.clientsClaim: true` (an activated worker
immediately claims open clients, including the very page that triggered its
install) — together, `navigator.serviceWorker.controller` becomes non-null on
the _same_ page load that registered the service worker, once Workbox
finishes installing and activating (which the test still explicitly waits
for via `page.waitForFunction`, not a fixed sleep — install/activate isn't
instantaneous even with these flags).

### Manifest icons: SVG, not PNG

`app/public/pwa-icon.svg` (`purpose: "any"`, declared sizes `192x192
512x512`) and `app/public/maskable-icon.svg` (`purpose: "maskable"`, declared
size `512x512`) are both hand-derived from the existing fallback icon's
twin-leaf glyph (`app/src/icons/generic.svg`), recoloured onto a solid
vegetable-green (`#4f8a45`, the existing `CATEGORY_FILL.vegetable` token from
`tools/icons/colors.ts`) background — reusing the established icon style
(`docs/icon-style-guide.md`) rather than commissioning new art, as the brief
asked. Both are plain vector SVGs, not rasterised PNGs: the existing icon set
is 100% SVG with no PNG tooling anywhere in the repo, no image-rasterisation
library is currently a dependency, and modern installability checks (Chrome,
this project's Lighthouse target) accept `image/svg+xml` manifest icons
without a PNG fallback. Adding a rasterisation step (e.g. `sharp`, which
downloads prebuilt native binaries on install) for two icons would be new
build-time surface area for no functional gain here. The maskable variant
scales its glyph down (`transform="translate(32 32) scale(0.85)
translate(-32 -32)"`) so it stays inside the maskable-icon "safe zone" once
an OS applies its own mask shape — plain SVG transforms, no new tooling.

## Alternatives considered

- **`injectManifest` with a hand-written service worker.** Rejected — more
  code to maintain for a caching policy this app doesn't need (no runtime
  API calls, nothing to route network-first vs. cache-first beyond "cache
  it all").
- **A hand-rolled service worker with no Workbox at all.** Rejected per the
  brief's own steer: reinventing precache-manifest generation and
  cache-versioning that Workbox already solves, for an app whose needs are
  the textbook case Workbox exists for.
- **PNG manifest icons via a generator library (`sharp`, `pwa-asset-
generator`).** Rejected for now — see "Manifest icons: SVG, not PNG"
  above. If a future stage needs PNG (e.g. a platform that doesn't render
  SVG manifest icons is found in practice), regenerating from the same
  source glyph is a small, isolated addition.
- **A stale-while-revalidate runtime-caching route "just in case" a future
  stage adds a real network call.** Rejected — speculative; the app has zero
  runtime network calls today (`WORKPLAN.md` §0.1), and adding a route with
  nothing to route would be dead configuration. If Stage 5.2+ or a later
  stage adds an actual runtime fetch (e.g. optional online geocoding,
  `WORKPLAN.md` §0.1's progressive-enhancement note), that's the point to
  add a matching runtime-caching route, not before.

## Consequences

- The app is installable (a valid manifest + a registered, controlling
  service worker) and works fully offline after one online visit, confirmed
  by `app/e2e/offline.spec.ts`.
- The "dataset and icons are covered for free" property is real today but
  depends on the icon set staying under Vite's inline-asset threshold — see
  the note above about where to look if that ever changes.
- No update-available UI is wired up. `registerType: 'autoUpdate'` plus
  `skipWaiting`/`clientsClaim` means a new deployment's service worker takes
  over silently (a background refetch, then control on next load/claim)
  rather than prompting the user — the simplest option, and adequate for a
  single-maintainer static site with no versioned-content concerns. A
  "new version available, reload?" prompt is a reasonable future addition if
  the deploy cadence or user base ever makes silent updates a problem.
- `app/vite.config.ts` derives the manifest's `start_url`/`scope` from the
  same `base` the GitHub Pages env flag already sets, so Stage 5.2 doesn't
  need to touch this file to keep the manifest correct under the `/garden_planner/`
  base path — confirmed by building with `GITHUB_PAGES=true` and inspecting
  the emitted `manifest.webmanifest`.
