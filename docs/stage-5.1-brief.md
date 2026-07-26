# Stage 5.1 brief — PWA / offline support

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§0.1's "must work offline" constraint) and [`WORKPLAN.md`](../WORKPLAN.md)
(§0 ground rules, §1.3's offline-test requirement, and the Stage 5.1 entry)
first; this brief concentrates the requirements so you don't have to
reconstruct them from the diff.

Stages 0.1–1.7, all of Phase 2, all of Phase 3 (3.1–3.7), and all of Phase 4
(4.1–4.2) are merged into `main` — **branch from `main`**.

## Why this stage

`WORKPLAN.md`'s Progress table now shows every stage through Phase 4 ✅ —
Stage 1.7 (curated full-plant input) was the last data-layer gap, and it's
closed. Phase 5 (offline & deployment) is next on the critical path
(`WORKPLAN.md` §3's dependency map: `MVP ─► 5.1 ─► 5.2`), and Stage 5.1 has no
unmet dependency — it needs only "a working MVP (through Phase 3, ideally
4)", which is now true. If you'd rather start Phase 6 (community readiness,
`docs/architecture.md`/`WORKPLAN.md` note 6.1 depends on "a substantially
working app", also true) that's a reasonable alternative; this brief assumes
5.1, per the critical path WORKPLAN.md's own dependency-map section states
explicitly: "offline → deploy → docs".

## Goal

Make the app installable and fully functional **offline** — the constraint
`DESIGN.md` and `WORKPLAN.md` §0.1 have held since Stage 0.1 ("the app must
run as a fully static site and work offline"), now actually enforced by a
service worker rather than merely true by construction (no runtime fetches
exist today — see "What's already built"). Concretely: a service worker
caching the app shell, the dataset, and the icons; a web app manifest; and
confirmation (an E2E test, not just manual poking) that the app still works
with the network off.

## Where it lives

No existing module needs to change its logic — this stage is additive:

- `app/vite.config.ts` — add whatever plugin/config drives the service worker
  and manifest generation.
- `app/public/` (new, or wherever the chosen tool wants static assets) — app
  icons for the manifest (192×192, 512×512 at minimum; reuse/derive from the
  existing `app/src/icons/generic.svg` crop-icon style rather than
  commissioning new art, unless you have a good reason not to).
- A manifest file (`manifest.webmanifest` or equivalent, wherever the chosen
  tool places it).
- `app/e2e/offline.spec.ts` (new) — the offline E2E test WORKPLAN.md §1.3
  requires: load the app, go offline (Playwright's `context.setOffline(true)`
  or route interception), confirm the core journey still works.

## What's already built (don't rebuild any of this)

- **The app has no runtime network calls to begin with.** `data/plants.json`
  is loaded via a **build-time Vite JSON import**
  (`app/src/dataset/shipped-plants.ts` — read its module doc), not a `fetch`;
  it's bundled into the JS output like any other module. Icons
  (`app/src/icons/crops/*.svg`, resolved via `resolveIcon`) are Vite-bundled
  assets too (inlined as `data:` URIs when small, hashed files otherwise —
  see the Stage 4.2 brief). **This means precaching the app's own built
  output (`dist/`) via a service worker covers the dataset and icons "for
  free"** — there is no separate "cache this JSON endpoint" or "cache these
  image URLs" problem to solve; the standard `vite-plugin-pwa`
  `generateSW`/`precache` strategy over the Vite build manifest should just
  work. Confirm this rather than assuming it (it's the one thing worth
  actually testing early), but don't over-design a bespoke caching strategy
  before checking whether the default precache-everything approach already
  solves it.
- **The `base` path is already env-gated** for GitHub Pages
  (`app/vite.config.ts`, `GITHUB_PAGES` env flag) — Stage 5.2's concern, but
  worth knowing a PWA manifest/service-worker path needs to respect the same
  base, whichever it ends up being, so 5.1 and 5.2 don't fight each other
  over it.
- **Playwright is already wired** (`app/e2e/*.spec.ts`, `playwright.config.ts`)
  with existing journeys (`smoke.spec.ts`, `plot-canvas.spec.ts`,
  `warnings-overlay.spec.ts`, `add-custom-crop.spec.ts`, `plot-export.spec.ts`)
  to pattern-match for the new offline spec's structure and conventions
  (dev-server bootstrap, selectors, etc.).
- **No PWA tooling exists yet** — no `vite-plugin-pwa` dependency, no
  manifest, no service worker, no `app/public/` icons. This is a from-scratch
  addition, not wiring an existing interface (unlike, say, Stage 4.2).

## What to build

1. **Add a service-worker/PWA build plugin.** `vite-plugin-pwa` (Workbox
   under the hood) is the standard, well-supported choice for a Vite app and
   is the natural default here — it generates the manifest, the service
   worker, and handles registration with sane defaults. Using something else
   is fine if you have a concrete reason, but don't reach for a hand-rolled
   service worker without first checking whether the standard plugin's
   default `generateSW` strategy already covers this app's needs (it
   probably does, per "What's already built" above).
2. **Web app manifest**: name, short name, description, theme/background
   colour, display mode (`standalone` is the usual PWA choice), and icons at
   the sizes browsers expect (192×192, 512×512; a maskable icon is a nice-to-
   have, not a hard requirement). Base the visual style on the existing icon
   set (`docs/icon-style-guide.md`) rather than inventing an unrelated brand
   look.
3. **Offline-first data loading — confirm, don't necessarily add new code.**
   Per "What's already built", the dataset is already offline-safe by
   construction (bundled, not fetched). Verify this holds once a service
   worker is in the mix (a stale-while-revalidate or precache strategy should
   not introduce a network dependency that wasn't there before), and correct
   course if the chosen plugin's defaults somehow do add one (e.g. some PWA
   plugins default to a runtime-caching strategy for certain asset types that
   assumes network-first — make sure static built assets stay precached, not
   network-first).
4. **The offline E2E test** (`app/e2e/offline.spec.ts`) — WORKPLAN.md §1.3's
   explicit requirement: "An E2E run that loads the app, goes offline, and
   confirms it still functions". Load the app once online (so the service
   worker installs/activates), then go offline and confirm a core journey
   still works (e.g. the plot-definition page loads, the palette renders
   real crops, a plant can still be placed) — reusing existing E2E patterns
   from the specs listed above rather than inventing new ones. A service
   worker's first-load activation timing is the classic gotcha here (the SW
   isn't controlling the page until a reload after first install in many
   configurations) — read up on `vite-plugin-pwa`'s recommended Playwright
   testing pattern (or whichever tool you pick) rather than guessing.
5. **A Lighthouse PWA check**, per WORKPLAN.md's verification line. CI is
   still deferred repo-wide (§1.4 — don't add a workflow), so this is a
   locally-runnable check (e.g. `npx lighthouse` against a built-and-served
   `dist/`, or the `lighthouse-ci` CLI run manually) with instructions
   recorded in the README/docs for a contributor to re-run, not a CI gate.

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.**
- **No `.claude/` skills directory** — review your own diff.
- **No CI workflow — don't add one**, including for Lighthouse; keep it a
  documented local command per WORKPLAN.md §1.4's explicit deferral.
- **The network is blocked** beyond package installs. Adding a dependency
  (`vite-plugin-pwa` or similar) is a package install, which works.
  Installing/registering a service worker itself needs no network — it's
  build tooling, not an external service.
- **Run before finishing:** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, `npm run format:check` from the repo root, **plus**
  `npm run e2e -w @garden-planner/app` (or the repo's equivalent script) for
  the new offline spec — check `app/package.json` for the exact script name,
  since the root `npm test`/`npm run build` don't run Playwright today.
- **Don't touch `packages/engine` or `packages/etl`** — this stage is
  app-shell/build-tooling only; nothing about the schema, the dataset, or the
  merge changes.
- **One known pre-existing flake, unrelated to this stage**: `app/src/plot/PlotDefinitionPage.test.tsx`'s
  main interaction test runs close to a component-test timeout under load
  (confirmed present on `main` before Stage 1.7 too) — it already has a
  10s timeout to give it headroom; if it still flakes, that's a
  pre-existing issue to note, not something Stage 5.1 introduced.

## Deliverables

1. A service worker + web app manifest, generated via a Vite plugin
   (`vite-plugin-pwa` or an equivalent, justified choice).
2. App icons for the manifest, styled consistently with the existing icon set.
3. Confirmation (not just assumption) that the dataset and icons are
   available offline once the service worker is installed.
4. `app/e2e/offline.spec.ts`: an E2E test that loads the app, goes offline,
   and confirms the core journey still works.
5. A documented local Lighthouse PWA audit command (README or
   `docs/architecture.md`), with today's score recorded.
6. `docs/architecture.md`, `WORKPLAN.md`'s Progress table, and the app's
   README (if one documents "how to run/build the app") updated; the brief
   for the next stage written (Stage 5.2, GitHub Pages deployment — the
   natural next stage per the dependency map, since it depends on "3.x (a
   deployable app), ideally 5.1").

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests and build green from the repo root; formatting clean;
the app installs as a PWA and functions with the network off, confirmed by
the new E2E test; a Lighthouse PWA audit passes (or its current score is
honestly recorded, with any gaps explained, if a hosting-dependent check
can't fully run against a local build); docs and the Progress table updated;
the next stage's brief written.

## Model

**Sonnet.** Per `WORKPLAN.md`'s own model-tier table for this stage — a
well-scoped build-tooling addition (service worker, manifest, one new E2E
spec) against a mostly-standard recipe (`vite-plugin-pwa`), with the one
genuine design decision (does the default precache strategy actually cover
the bundled dataset/icons, and does that hold once a service worker
intercepts requests) small enough not to need Opus-level judgement.
