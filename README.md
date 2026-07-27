# Garden Planner 🌱

An offline-capable, statically-hosted planner for **edible** gardens and
allotments. Describe your plot (size, light/shade, location — default Britain),
and the app helps you work out which crops will thrive, how many fit at proper
spacing, and how to arrange them — with drag-and-drop and live warnings. You can
also **add your own crops** from a seed packet and **export a picture** of the
finished plot.

> **Status: Phases 1–4 complete; Phase 5 (offline & deployment) complete.**
> The data pipeline, the framework-free suitability/spacing/warnings engine,
> and the full drag-and-drop React UI (plot definition, ranked palette,
> canvas, warnings overlay, user-defined crops, plot-image export, a bundled
> SVG icon set) are all built and green — see [`WORKPLAN.md`](./WORKPLAN.md)'s
> Progress table for the stage-by-stage detail. Stage 5.1 added **PWA /
> offline support** (installs, works with the network off — see below); Stage
> 5.2 adds a **manual GitHub Pages deploy path** (see "Deployment" below —
> deliberately a hand-run command, not CI: see `WORKPLAN.md` §1.4). Phase 6
> (community readiness) is under way: Stage 6.0 has now curated the crop list
> itself — six British staples added, 24 crops that can't be grown outdoors
> here removed — leaving **144 crops** in the shipped dataset.

### A caveat worth knowing before you judge the rankings

The suitability engine scores four dimensions — **light, hardiness, soil and
season** — and the shipped dataset feeds them very unevenly. Of **144 crops**,
all carry light (in only two values: 133 full-sun, 11 partial-shade), **80 carry
a soil-moisture preference**, and just **8 carry hardiness or season data**.

In practice that means:

- **Describe your plot's soil moisture and the ranking does real work.** On dry
  ground, rosemary and carrots rise above peas and celery, with the reason given
  in plain English.
- **The top of the list is now decided by data, not the alphabet.** The eight
  hand-curated crops — broad bean, Jerusalem artichoke, apple, pear, raspberry,
  Brussels sprouts, swede and pumpkin — are scored on all four dimensions, so
  they sort above the rest on merit. Pumpkin sits below the others because it is
  genuinely tender, which is the engine working rather than a gap in the data.
- **Below those eight, you are still close to a two-tier sort on light**, because
  most gardens are sunny and most records say nothing else.

The app says so rather than hiding it: every result carries a confidence figure
and a note explaining what could and couldn't be assessed. The remaining gap is
**data, not engine**. Stage 6.0 fixed the crop list — the shipped catalogue is
now curated for British outdoor growing, with the 24 crops that can't be grown
here removed (see ADR
[0025](./docs/adr/0025-uk-outdoor-crop-exclusions.md), which records why they
were deleted rather than flagged, and why you can always add any of them back
in the app) — but hardiness and season coverage stays thin at 8/144, and
closing that would take a new data source rather than more curation. See
[`WORKPLAN.md`](./WORKPLAN.md) for what's left.

## Why this exists

A free, open, easy-to-clone tool for planning a productive garden, built to run
entirely in the browser so it works offline (in the garden, with no signal) and
can be hosted for free on GitHub Pages. See [`DESIGN.md`](./DESIGN.md) for the
concept and the data/architecture reasoning, and [`WORKPLAN.md`](./WORKPLAN.md)
for the staged build plan.

## Quick start

Requires Node.js 20+ (Node 22 recommended).

```bash
npm install        # install all workspaces
npm run dev        # start the app locally (Vite dev server)
```

Other useful commands (run from the repo root):

```bash
npm run build       # build every workspace
npm test            # run unit/component tests across workspaces
npm run typecheck   # type-check every workspace
npm run lint        # lint the whole repo
npm run format      # auto-format with Prettier
npm run e2e         # run Playwright end-to-end tests (builds + previews the app)
npm run verify      # all of the above, in the order WORKPLAN.md §1.4 requires
```

Use `npm run verify` before calling any change done. `npm test` deliberately
covers only the unit and component suites — Playwright is a separate command,
so `npm test` alone never exercises the end-to-end journeys.

> **If Playwright can't find a browser** (`Executable doesn't exist at …`),
> you're likely in a sandbox or container that ships its own Chromium rather
> than Playwright's managed one. Point Playwright at it instead of running
> `npx playwright install`:
>
> ```bash
> PW_EXECUTABLE_PATH=/path/to/chromium npm run verify
> ```
>
> `app/playwright.config.ts` reads that variable and is otherwise unaffected.

## Progressive Web App / offline support

The app is installable and works fully offline after one online visit — a
service worker (`vite-plugin-pwa`, `app/vite.config.ts`) precaches the whole
build, and the bundled dataset and crop icon set are covered by that same
precache with no extra runtime-caching logic needed (see
[`docs/adr/0022`](./docs/adr/0022-pwa-offline-support.md) for how that was
confirmed rather than assumed). `app/e2e/offline.spec.ts` is the automated
proof: it loads the app once online, goes offline
(`context.setOffline(true)`), and confirms the core plot → palette → drag-a-
crop-onto-the-canvas journey still works with no network at all.

To try it by hand: `npm run build -w app && npm run preview -w app`, open
the printed local URL, reload once (so the service worker installs), then
disconnect from the network (or use your browser devtools' "Offline"
throttling) and reload again — the app keeps working.

### Lighthouse PWA audit (manual — no CI workflow exists yet, per `WORKPLAN.md` §1.4)

```bash
npm run build -w app && npm run preview -w app   # serve the production build at :4173, in one terminal
# in another terminal:
npx lighthouse@11 http://localhost:4173/ --only-categories=pwa \
  --chrome-flags="--headless=new" --view
```

**Today's recorded score: 0.88 / 1.00** (7 of 8 weighted points). Breakdown:

| Audit                      | Result  | Notes                                                                                                                                                                            |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installable manifest       | ✅ Pass | Manifest + service worker meet installability requirements.                                                                                                                      |
| Viewport meta tag          | ✅ Pass |                                                                                                                                                                                  |
| Content sized for viewport | ✅ Pass |                                                                                                                                                                                  |
| Maskable icon              | ✅ Pass | `app/public/maskable-icon.svg`.                                                                                                                                                  |
| Themed address bar         | ✅ Pass | `<meta name="theme-color">` in `app/index.html`.                                                                                                                                 |
| Custom splash screen       | ❌ Fail | This specific legacy audit hard-requires a **PNG** icon ≥512px; this project's icons are all SVG (see ADR 0022's "why SVG" reasoning) — a known, accepted gap rather than a bug. |

Why `lighthouse@11` and not plain `npx lighthouse`: the `lighthouse` npm
package's current major version has **removed the scored "PWA" category
entirely** (`npx lighthouse --only-categories=pwa` now errors with
"unrecognized category") — a real, upstream tooling change, not something
this project's build broke. Pinning the last major version that still has
the category is the honest way to get a runnable, numeric PWA audit locally
until an equivalent replacement exists. `--view` opens the HTML report in a
browser; drop it (and add `--output=json --output-path=<file>` instead) for
a scriptable result.

## Deployment (GitHub Pages)

The app is a fully static build (`app/dist/`), so hosting it is "build with
the right base path and publish `dist/`" — no server, no environment
variables the deployed app reads at runtime. Per `WORKPLAN.md` §1.4, this
stays a **manual, maintainer-run command**; there is no
`.github/workflows/` directory and this stage does not add one — CI/CD
automation (including "deploy on merge") is deliberately deferred to Stage
6.4.

### One-time prerequisite (repo-admin only)

GitHub Pages must be turned on once, in the repo's own settings — no script
or session without repo-admin access can do this step:

**Settings → Pages → Build and deployment → Source: "Deploy from a branch" →
Branch: `gh-pages` / `(root)`.**

### Deploy command

From the repo root, with git push access to `origin`:

```bash
npm run deploy
```

This is exactly `GITHUB_PAGES=true npm run build -w app && gh-pages -d app/dist`
— a production build with the Pages base path (`/garden_planner/`) baked in,
published to the `gh-pages` branch via the [`gh-pages`](https://www.npmjs.com/package/gh-pages)
package (a `devDependency`, wired in Stage 5.2 — see
[ADR 0024](./docs/adr/0024-github-pages-manual-deploy.md)). Re-run it after
every change you want live; there is no deploy-on-merge.

### Post-deploy smoke check (manual — not a CI gate)

After a deploy, confirm the live site actually works with a small Playwright
check against the real URL (not the local preview server the rest of the
E2E suite uses):

```bash
npm run smoke:deployed
# or, to point at a different URL (e.g. before Pages is enabled on a fork):
DEPLOYED_URL=https://<owner>.github.io/garden_planner/ npm run smoke:deployed
```

It loads the deployed app under its real base path, confirms the service
worker registers, and repeats the core plot → palette → drag-a-crop-onto-
the-canvas journey against production assets. Deliberately excluded from
`npm run e2e`/`verify` (see `app/playwright.config.ts`'s `testIgnore`) so
those stay reproducible with no network dependency beyond `localhost`.

### Live site

Expected at **<https://jaspercain01.github.io/garden_planner/>** once a
maintainer has completed the two steps above. **Not yet confirmed live from
this repository** — Stage 5.2 was built and verified (build output inspected
by hand for the correct base path; see ADR 0024) from a sandboxed session
whose outbound network is blocked beyond package installs and the GitHub
API, so neither the actual `gh-pages` push nor a request to the live URL
could be completed or observed here. The GitHub API confirms Pages is not
yet enabled on the real repo (`has_pages: false` as of this writing). Update
this line once a real deploy has been run and the URL checked by hand.

## Repository layout

This is an npm-workspaces monorepo. The split reflects a deliberate design
choice (see [`WORKPLAN.md`](./WORKPLAN.md) §0.1 and `docs/adr/`): the app is
**fully static and client-side**, and the data pipeline is a **build-time
developer tool** that is never shipped.

| Path               | What it is                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `app/`             | The React + Vite front-end. The only thing deployed to GitHub Pages.                                                     |
| `packages/engine/` | Framework-free horticultural logic (suitability scoring, spacing/density). Unit-testable in isolation; no UI dependency. |
| `packages/etl/`    | Build-time data pipeline. Ingests external plant sources and emits the static dataset. **Not part of the deployed app.** |
| `data/`            | The committed static dataset artifact the app loads at runtime.                                                          |
| `docs/`            | Architecture notes and Architecture Decision Records (`docs/adr/`).                                                      |

## Licensing

- **Code:** MIT (see [`LICENSE`](./LICENSE)).
- **Dataset (`/data`):** **CC0-1.0** — public domain. Take it and do whatever you
  like with it; no attribution required. See [`NOTICE`](./NOTICE) and
  [ADR 0023](./docs/adr/0023-dataset-licence-cc0.md).
- **Crop icons (`app/src/icons/`):** MIT, original work — generated from an
  in-repo shape library, not adapted from any third-party set.

Everything here is meant to be cloned, forked and learned from. Sources are
credited in [`NOTICE`](./NOTICE) and per-record in the dataset itself, because
knowing where a spacing figure came from is what makes it checkable — not
because a licence demands it.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). In short: keep code clearly
commented, record non-obvious decisions as ADRs, and leave the repo green
(`lint`, `typecheck`, `test`, `build` all passing).
