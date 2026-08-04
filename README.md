# Garden Planner 🌱

[![checks](https://github.com/JasperCain01/garden_planner/actions/workflows/checks.yml/badge.svg)](https://github.com/JasperCain01/garden_planner/actions/workflows/checks.yml)

An offline-capable, statically-hosted planner for **edible** gardens and
allotments. Describe your plot (size, light/shade, location — default Britain),
and the app helps you work out which crops will thrive, how many fit at proper
spacing, and how to arrange them — with drag-and-drop and live warnings. You can
also **add your own crops** from a seed packet and **export a picture** of the
finished plot.

> **Status: v1 — the build plan is complete.** Every stage in
> [`WORKPLAN.md`](./WORKPLAN.md) is done, through the last one (6.4, CI). The
> data pipeline, the framework-free suitability/spacing/warnings engine, and
> the full drag-and-drop React UI (plot definition, ranked palette, canvas,
> warnings overlay, user-defined crops, plot-image export, a bundled SVG icon
> set) are built and green, the app installs and works offline (Stage 5.1),
> there is a documented GitHub Pages deploy path (Stage 5.2), the shipped
> dataset is curated for British outdoor growing at **144 crops** (Stage 6.0),
> and every check is now automated on push and pull request (Stage 6.4 — the
> badge above). See `WORKPLAN.md`'s Progress table for the stage-by-stage
> detail, and its closing section for what is deliberately **not** in v1 and
> where each of those gaps is tracked.

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

### Continuous integration

Every push to `main` and every pull request runs
[`.github/workflows/checks.yml`](./.github/workflows/checks.yml): `npm run
verify` and `npm run a11y -w app` as **blocking** checks, plus an
**informational** job that reports the Lighthouse PWA score and the
keyboard-only walkthrough into the run summary without blocking a merge.
Everything CI runs is a command you can run locally, unchanged — that is a
deliberate constraint (`WORKPLAN.md` §1.4), so a red check always means "run
this exact command and you will see the same failure". The blocking-vs-
informational split is reasoned out in
[ADR 0027](./docs/adr/0027-ci-checks-workflow-and-blocking-policy.md).

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

### Lighthouse PWA audit (run in CI as an informational check, and by hand with the command below)

```bash
npm run build -w app && npm run preview -w app   # serve the production build at :4173, in one terminal
# in another terminal:
npx lighthouse@11 http://localhost:4173/ --only-categories=pwa \
  --chrome-flags="--headless=new" --view
```

**Today's recorded score: 0.88 / 1.00** (7 of 8 weighted points; re-confirmed
unchanged at Stage 6.3, and again by the first CI run of Stage 6.4's `audits`
job, 2026-07-27 — see [`docs/qa-checklist.md`](./docs/qa-checklist.md)).
Breakdown:

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

## Accessibility & responsive design

The app has a keyboard-operable alternative to every drag-and-drop
interaction, a colour-contrast/ARIA pass, and a responsive layout fix so the
plot canvas doesn't render thousands of pixels down the page on a phone —
Workplan Stage 6.2. Full writeup, including what's still a known gap (the
free-form outline-corner editor stays pointer-only): [`docs/accessibility.md`](./docs/accessibility.md).

### Accessibility (axe check) — a blocking CI check, and runnable by hand

```bash
npm run build -w app && npm run preview -w app   # serve the production build at :4173, in one terminal
# in another terminal:
npm run a11y -w app
```

Runs `app/e2e/a11y.spec.ts` (its own Playwright config,
`app/playwright.a11y.config.ts`, so it's never part of `npm run e2e`/`verify`)
against the plot-definition page in six states — a fresh load, after placing a
crop via the keyboard-operable "Add to plot" button, in the canvas's
edit-shape mode, with the clear-all confirmation open, with a palette card's
reasoning expanded, and with the "Add your own crop" modal dialog open (each
arrived with the surface it scans: the dialog in UI redesign Phase 1, the two
canvas states in Phase 2, the expanded card in Phase 3) — checking the
`wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` rule tags with
[`@axe-core/playwright`](https://www.npmjs.com/package/@axe-core/playwright).

**Today's recorded result: 0 violations, in all six states** (re-confirmed
unchanged at Stage 6.3 and after each of the UI redesign's phases; the canvas
phase added two states and the palette phase a sixth, and the whole run is
enforced on every push and pull request by the `a11y` job in
[`.github/workflows/checks.yml`](./.github/workflows/checks.yml) — a new
violation fails the build).

```
Running 6 tests using 1 worker

  ✓  1 e2e/a11y.spec.ts:36:1 › the plot-definition page has no axe violations in its initial state
  ✓  2 e2e/a11y.spec.ts:44:1 › the plot-definition page has no axe violations once a plant is placed and selected
  ✓  3 e2e/a11y.spec.ts:64:1 › the canvas has no axe violations in edit-shape mode
  ✓  4 e2e/a11y.spec.ts:79:1 › the clear-all confirmation has no axe violations while open
  ✓  5 e2e/a11y.spec.ts:96:1 › the palette has no axe violations with a card’s reasoning expanded
  ✓  6 e2e/a11y.spec.ts:116:1 › the add-crop dialog has no axe violations while open

  6 passed
```

What this can't check: the plot canvas renders to a single opaque
`<canvas>` element (react-konva), so axe — like any DOM-based tool — can't
see the placement markers or severity badges drawn on it. Those are covered
by unit tests (`app/src/warnings/severity.test.ts`) and manual review
instead. See `e2e/a11y.spec.ts`'s own doc comment, and
[`docs/accessibility.md`](./docs/accessibility.md), for the fuller picture —
including a scripted keyboard-only walkthrough of the core journey and its
honestly-recorded findings.

## Deployment (GitHub Pages)

The app is a fully static build (`app/dist/`), so hosting it is "build with
the right base path and publish `dist/`" — no server, no environment
variables the deployed app reads at runtime. Deploying stays a **manual,
maintainer-run command**. That was originally because `WORKPLAN.md` §1.4
forbade workflows; since Stage 6.4 lifted that rule it is a deliberate choice,
reasoned out in
[ADR 0028](./docs/adr/0028-deploy-on-merge-not-automated.md) — which also
carries a ready-to-adopt deploy-on-merge workflow for whoever wants it.

### The order matters: deploy first, then change the Pages setting

`npm run deploy` is what **creates** the `gh-pages` branch. Until that branch
exists, the Settings → Pages branch dropdown has nothing to offer, so "turn
Pages on first" cannot work — which is how the original Stage 5.2 instructions
had it, and why they were unfollowable.

1. **Run `npm run deploy`** (below). The `gh-pages` package publishes
   `app/dist` to the `gh-pages` branch, creating it if it doesn't exist.
   ✅ **Done once already** (Stage 6.4, 2026-07-27): the branch exists, with
   `index.html`, `assets/`, `manifest.webmanifest` and `sw.js` at its root and
   the `/garden_planner/` base path correctly baked in.
2. **Point Pages at it** (repo-admin only, no script can do this):
   **Settings → Pages → Build and deployment → Source: "Deploy from a branch" →
   Branch: `gh-pages` / `(root)`.** ⬅️ **this is the outstanding step.**
3. **Then run `npm run smoke:deployed`** to confirm the live site works.

⚠️ **Pages is currently serving the wrong branch.** The repository's
[Actions history](https://github.com/JasperCain01/garden_planner/actions)
shows successful `pages build and deployment` runs against **`main`**, so Pages
is on — but it is serving the repository's own files, not the built app.
Step 1 didn't disturb that; step 2 is what switches it over.

Two things the first real deploy turned up, neither yet fixed:

- **`gh-pages` leaves root dotfiles behind.** `.gitignore`, `.prettierignore`
  and `.prettierrc.json` are on the `gh-pages` branch even though `app/dist/`
  contains none of them — the package's default removal glob doesn't match
  dotfiles. Harmless (they are already public in `main`, and Pages just serves
  them as static files), but untidy.
- **There is no `.nojekyll` file.** GitHub Pages runs Jekyll over
  branch-served content, and Jekyll skips paths beginning with `_`. Today's
  Vite output has no such paths, so nothing is lost — but a build that emitted
  one would silently 404. An empty `app/public/.nojekyll`, which Vite copies
  into `dist/`, is the standard guard.

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

Expected at **<https://jaspercain01.github.io/garden_planner/>** once step 2
above is done. **Nobody has yet loaded the app from that URL.** The honest
state, as of Stage 6.4 (2026-07-27):

- **Pages is enabled**, but on the **`main`** branch rather than `gh-pages` —
  see the warning above. This corrects ADR 0024's `has_pages: false`, which
  was accurate when it was written and is not any more.
- **The `gh-pages` branch now exists, and carries a correct build.**
  `npm run deploy` was run for real at Stage 6.4 — the first time in this
  project's history. The branch's contents were checked against the remote
  (`index.html`, `assets/`, `manifest.webmanifest`, `sw.js`, both icons at the
  root) and the `/garden_planner/` base path is right in both `index.html` and
  the manifest's `start_url`/`scope`. What it has **not** had is a browser
  pointed at it.
- **The live URL has never been reached from any of these sessions.** Every
  session that has worked on this repository has run behind an egress proxy
  that blocks `jaspercain01.github.io` outright (a `curl` returns no response
  at all) and now blocks `api.github.com` too, so `npm run smoke:deployed`
  has never actually run against a deployment — including from the session
  that pushed the branch.

So the remaining work is one person, once: switch the Pages source to
`gh-pages`, run `npm run smoke:deployed`, and update this section with what
they see.

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

## Documentation

[`docs/README.md`](./docs/README.md) is the docs index — "where do I look for
X?" for everything from how-to guides (add a crop, add an icon, run the ETL)
to the architecture overview, the ADRs, and where the data actually came
from.

## Licensing

- **Code:** MIT (see [`LICENSE`](./LICENSE)).
- **Dataset (`/data`):** **CC0-1.0** — public domain. Take it and do whatever you
  like with it; no attribution required. See
  [`docs/data-provenance-and-licensing.md`](./docs/data-provenance-and-licensing.md)
  for the full sourcing/licensing picture, or [`NOTICE`](./NOTICE) and
  [ADR 0023](./docs/adr/0023-dataset-licence-cc0.md) directly.
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
