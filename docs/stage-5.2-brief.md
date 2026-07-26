# Stage 5.2 brief — GitHub Pages deployment

A tight starting point for a fresh session. Read [`WORKPLAN.md`](../WORKPLAN.md)
(§0 ground rules — **especially §1.4's "no CI workflow" deferral, which
overrides this stage's original GitHub-Actions-shaped description in §2**,
see "The one thing to get right" below) and the Stage 5.2 entry first; this
brief concentrates the requirements so you don't have to reconstruct them
from the diff.

Stages 0.1–1.7 (**except 1.2, which is still ⚠️ partial — OpenFarm only**),
all of Phase 2, all of Phase 3 (3.1–3.7), all of Phase 4 (4.1–4.2), and Stage
5.1 (PWA/offline support) are merged into `main` — **branch from `main`**.

**Read [`docs/review-pre-deployment.md`](./review-pre-deployment.md) first.**
A full review of Stages 0.1–5.1 landed just before this stage. Everything it
found has been fixed, but two of its conclusions bear directly on 5.2:

- `npm run verify` now exists and is the check to run (see "Constraints"
  below).
- §3.9 records that the shipped dataset only feeds one of the suitability
  engine's four dimensions, and the README now says so publicly. If you add a
  live-site link, don't oversell what a visitor will see.

## Why this stage

`WORKPLAN.md`'s dependency map: `MVP ─► 5.1 ─► 5.2`. Stage 5.1 (this session's
predecessor) added a service worker and web app manifest and confirmed the
app is installable and works offline; the only thing left before "a hosted,
always-current working version" is actually hosting it. Nothing about this
stage's own logic depends on 5.1 having landed first, but 5.1 first means the
manifest/service-worker `base`-path question (below) is already answered
rather than something 5.2 has to work out from scratch.

## The one thing to get right: no GitHub Actions workflow

`WORKPLAN.md` §1.4 says, in plain terms: **"Automating them in GitHub Actions
is deliberately deferred until the project is complete. There is no
`.github/workflows/` directory, and stages should not add one — that
includes the Pages deploy in Stage 5.2, which stays a manual deploy until
then."** This repo has no `.github/workflows/` directory today — keep it
that way.

This directly contradicts the _original_ wording of the Stage 5.2 entry
further down `WORKPLAN.md` (§2, "Deliverables: A GitHub Actions workflow
building the static site and deploying to Pages..."), which predates the §1.4
ground rule being written down. That entry has already been corrected
in-place to say "a **manual** deploy path" instead, precisely so a fresh
session reading only the Stage 5.2 entry doesn't get steered wrong — but if
you're reading an older checkout or a cached copy of this file, trust §1.4,
not the older per-stage wording. **Do not add a `.github/workflows/*.yml`
file for this stage.** "Deploy-on-merge" (the older wording's phrase) is out
of scope until CI lands project-wide; what this stage owes instead is a
**documented, repeatable command a maintainer runs by hand** to publish a
build to Pages.

## Where it lives

- `app/package.json` (or the repo root `package.json`) — a new `deploy`
  script.
- Possibly a new devDependency (e.g. the `gh-pages` npm package — a small,
  widely-used tool that builds a `gh-pages` branch from a local directory
  and pushes it; using it is a package install, which works even with the
  network otherwise blocked — see "Gotchas" below).
- `README.md` — the documented deploy command, and (once a real deployment
  exists) a live-site link/badge.
- No app source code needs to change. `app/vite.config.ts`'s `base` (Stage
  0.1, extended in Stage 5.1 for the PWA manifest's `start_url`/`scope`) is
  already env-gated correctly — see "What's already built."

## What's already built (don't rebuild any of this)

- **The `base` path is already env-gated for GitHub Pages**
  (`app/vite.config.ts`): `process.env.GITHUB_PAGES === 'true'` switches
  `base` to `/garden_planner/` (the repo name — GitHub Pages project sites
  are served from `https://<owner>.github.io/<repo>/`); otherwise it's `/`
  for local dev/preview/E2E. Building with `GITHUB_PAGES=true npm run build
-w app` produces a `dist/` whose asset URLs, manifest `start_url`, and
  manifest `scope` all correctly point at `/garden_planner/...` — confirmed
  during Stage 5.1 by building with that flag and inspecting the emitted
  `dist/manifest.webmanifest` and `dist/index.html`. You should not need to
  touch this file at all for 5.2 unless the actual GitHub repo name differs
  from `garden_planner` (check before assuming).
- **The app is a fully static build** (`app/dist/` after `npm run build -w
app`) with a service worker and manifest (Stage 5.1) — nothing server-side
  to provision, no environment variables the deployed app reads at runtime.
- **Playwright is already wired** (`app/e2e/*.spec.ts`,
  `app/playwright.config.ts`) with a `baseURL` pointed at a local preview
  server. A post-deploy smoke check against the _live_ URL is a small
  variation on this — see "What to build."

## What to build

1. **A deploy script.** The standard, low-ceremony option: add `gh-pages` as
   a devDependency and a script like
   `"deploy": "GITHUB_PAGES=true npm run build -w app && gh-pages -d app/dist"`
   (adjust paths/flags to whatever actually works once you try it — `gh-pages`
   needs a git remote with push access, which a maintainer running this
   locally will have and a sandboxed session may not; if you can't actually
   push in this environment, that's expected — document the command
   precisely enough that a maintainer can run it, and say so rather than
   pretending it ran here). Either `app/package.json` or the repo root
   `package.json` is a reasonable home for the script — check which existing
   scripts (`e2e`, `preview`) live at which level and follow that convention.
2. **Enabling GitHub Pages itself is a repository-settings action, not a code
   change** — a maintainer (with repo admin access) needs to set Pages'
   source to the `gh-pages` branch (or whichever branch/folder the deploy
   script targets) in the repo's Settings → Pages UI once, out of band. No
   session running in this sandboxed environment can do this step; document
   it clearly as a manual prerequisite rather than attempting an API call
   that will fail or silently no-op.
3. **README updates**: the documented deploy command (mirroring how Stage 5.1
   documented its Lighthouse command), and — once you know the real URL
   (`https://<owner>.github.io/garden_planner/`, confirm the owner from the
   actual repo remote rather than guessing) — a link/badge to the live site.
   If you cannot actually complete a real deploy in this environment (see
   point 2), say so explicitly in the brief/PR rather than asserting the
   link works; a maintainer completing the manual Pages-settings step and
   running the deploy script once is what makes the link real.
4. **A post-deploy smoke check**, per this stage's verification line — a
   small Playwright config/spec (or a variation on an existing one) that can
   be pointed at the live URL (e.g. via a `baseURL` override or an env var)
   to confirm the deployed app actually loads and passes a basic journey.
   This is explicitly **not** a CI job (§1.4) — it's a script/spec a
   maintainer runs by hand after deploying, the same way the Lighthouse
   check from Stage 5.1 is a manual command, not a gate.

## Constraints & gotchas already solved — don't rediscover them

- **`npm install` first.**
- **No `.github/workflows/` directory — do not add one.** See "The one thing
  to get right" above; this is the single most important constraint for this
  stage.
- **No `.claude/` skills directory** — review your own diff.
- **The network is blocked beyond package installs.** Adding `gh-pages` (or
  an equivalent) is a package install, which works. Actually pushing to a
  remote branch or reaching the live GitHub Pages URL from within this
  sandboxed session may not work depending on the environment's network
  policy — verify what's actually reachable before claiming a live deploy
  succeeded; if it can't be verified from here, say so and describe the
  command a maintainer needs to run instead.
- **Don't touch `packages/engine` or `packages/etl`** — this stage is
  deploy-tooling only.
- **`app/vite.config.ts`'s `base` logic is already correct** (see "What's
  already built") — don't rewrite it; if it needs a tweak (e.g. the actual
  repo name differs from `garden_planner`), that's a one-line change, not a
  redesign.
- **Run before finishing: `npm run verify`** from the repo root. That is new
  since this brief was first written — it runs lint → typecheck →
  format:check → test → build → **e2e** in one command, and §1.4 now names it
  explicitly. Don't substitute `npm test`: it covers only the unit and
  component suites, and running it alone is how a racy E2E spec previously
  reached `main` unnoticed. If Playwright can't find a browser, set
  `PW_EXECUTABLE_PATH` (see the README).
- **Also run `GITHUB_PAGES=true npm run build -w app`** specifically, and
  check `app/dist/index.html` and `app/dist/manifest.webmanifest` by hand for
  the `/garden_planner/` prefix. Confirmed working as recently as the
  pre-deployment review: asset URLs, `start_url` and `scope` all come out
  correct.

## Deliverables

1. A documented, repeatable deploy command (npm script + README
   instructions) that builds with `GITHUB_PAGES=true` and publishes `dist/`
   to whatever Pages reads from.
2. Confirmation that the base-path config (Stage 5.1's own concern too,
   since the PWA manifest depends on it) is correct for the real deployed
   URL.
3. A documented manual post-deploy smoke check.
4. `README.md` updated with the deploy command and (once real) a live-site
   link/badge; `docs/architecture.md` and `WORKPLAN.md`'s Progress table
   updated; the brief for the next stage written (check the dependency map —
   Phase 6, community readiness, is the natural next phase once the app is
   both offline-capable and deployable; `WORKPLAN.md`'s own dependency notes
   for 6.1/6.2/6.3 say what each needs).

## Definition of done (WORKPLAN §0.3)

Lint, typecheck, tests, build (including a `GITHUB_PAGES=true` build) and
`format:check` all green from the repo root; **no `.github/workflows/`
directory added**; the deploy path is documented precisely enough for a
maintainer with real push/Pages-settings access to complete it end to end;
docs and the Progress table updated; the next stage's brief written.

## Model

**Sonnet**, or **Haiku if following a standard Vite-to-Pages recipe
closely** — per `WORKPLAN.md`'s own model-tier table for this stage. The
one judgement call worth Sonnet-level care is faithfully documenting what
actually could and couldn't be verified from within a sandboxed session
(pushing to a remote, reaching a live Pages URL) rather than asserting
success that wasn't actually observed.
