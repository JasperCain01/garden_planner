# Stage 6.4 brief — continuous integration (the deferred automation, finally)

A tight starting point for a fresh session. Read [`WORKPLAN.md`](../WORKPLAN.md)
(§0 ground rules, §1.4, and the Stage 6.4 entry) before starting — §1.4 in
particular, since this stage's entire job is finally lifting the constraint
it has held since Stage 0.1.

Everything through Stage 6.3 is merged into `main` (once this stage's PR
lands) — **branch from `main`**.

## Why this stage now

`WORKPLAN.md`'s dependency map is `6.0 ─► 6.1, 6.2, 6.3 ─► 6.4`, and 6.4 is
explicitly last: §1.4 says CI is "deliberately deferred until the project is
complete," and 6.0 through 6.3 are now all ✅. There is nothing left to
confirm before automating the checks — 6.3 just finished doing exactly that
confirmation by hand. This is the last stage in the plan.

## What Stage 6.3 leaves you that's relevant here

- **Every check this stage automates already has a known-good, by-hand
  baseline to match.** `npm run verify` (lint → typecheck → format:check →
  test → build → e2e) passed clean at Stage 6.3: 372 engine tests, 276 etl
  tests, 166 app tests, a clean build, and **7/7 E2E specs** in
  `app/e2e/`. The three manual checks §1.4 also names all have current,
  recorded results to reproduce: `npm run a11y -w app` — **0 axe violations**
  (both scanned states); `npm run keyboard-walkthrough -w app` — all steps
  pass; `npx lighthouse@11 … --only-categories=pwa` — **0.88/1.00**, unchanged
  since Stage 5.1 (one accepted failing audit — the PNG splash-screen
  requirement; this project ships SVG icons only, see `README.md`). If the
  workflow you write produces materially different numbers on the same code,
  suspect the workflow (missing browser install, wrong working directory,
  wrong Node version) before suspecting a regression.
- **`plot-export.spec.ts` has a known, harmless flake under parallel
  workers.** Observed to fail once and pass on retry or standalone, across
  multiple sessions now (Stage 6.2's brief noted it too). If your CI run
  shows this specific spec flaking, that's the known issue — Playwright's own
  retry config (`app/playwright.config.ts`) is the right fix if it isn't
  already set to retry at least once in CI mode, not a workflow-level hack.
- **`docs/qa-checklist.md` is the by-hand release checklist** Stage 6.3 wrote
  — it is not something to automate (a checklist that includes "does the
  exported PNG actually look legible" by design), but its §4 table is the
  exact list of automated-but-manual commands this stage's workflow should
  run, with the exact invocations already worked out (including the
  `PW_EXECUTABLE_PATH` question — a real CI runner installs its own browser
  via `npx playwright install --with-deps chromium` and won't need the
  override this sandbox does).
- **The coverage audit (`WORKPLAN.md`'s Stage 6.3 entry) did not add a
  coverage-percentage gate.** `@vitest/coverage-v8` was installed
  `--no-save` for the audit itself and is **not** a committed dependency —
  don't assume it's present. If this stage wants a coverage report in CI
  (not required by §1.4's "automate exactly `npm run verify`... and nothing
  else" instruction — coverage reporting wasn't part of any prior stage's
  verification bar), that's a new decision to make and document, not
  something to silently carry over from the audit.

## What Stage 6.4 actually asks for

`WORKPLAN.md`'s entry (already fairly complete — this brief doesn't repeat
every word of it, read it directly):

- **A `.github/workflows/` directory** with a checks workflow running exactly
  `npm run verify` plus the offline, a11y and Lighthouse runs — on push and
  pull request. §1.4 is explicit: "automate exactly that list and nothing
  else." Don't add checks CI could run but a contributor can't reproduce
  locally.
- **Optionally, deploy-on-merge**, building on Stage 5.2's manual `gh-pages`
  deploy path — a separate decision from the checks workflow, and the manual
  `npm run deploy` command must keep working either way.
- **Gotchas the workplan entry already names:** Node 20+ (check `engines` in
  the root `package.json`), `npx playwright install --with-deps chromium` for
  the E2E/a11y/keyboard-walkthrough jobs, and caching `~/.npm` plus the
  Playwright browser cache so the E2E job doesn't dominate run time.

## Traps and constraints (don't rediscover these)

- **`npm install` first**, then confirm `npm run verify` still passes locally
  before writing the workflow — you want a known-good baseline to compare the
  first CI run against, exactly as Stage 6.3 recorded one.
- **`format:check` covers Markdown.** Run `npm run format` after any doc
  edits (including this brief's own successor, if this stage reorders
  anything).
- **This is the one stage allowed to add `.github/workflows/`.** Every prior
  stage was told not to; §1.4's constraint lifts exactly here, not before.
- **Prove the gate actually gates**, per the workplan's own verification
  bar: green on a real PR, red on a deliberately-broken one (break a test,
  confirm red, revert) — the same standard Stage 1.5 set for the dataset
  validation gate.
- **Don't touch `packages/engine/`/`packages/etl/`/`app/` application logic**
  — this stage is CI plumbing, not a feature or a bugfix. If the first real
  CI run surfaces an environment-only failure (e.g. a flaky test that only
  fails under a runner's resource constraints), fix the flake narrowly and
  say so, rather than opening scope to "while I'm in here."

## Definition of done (WORKPLAN §0.3)

A `.github/workflows/` checks workflow running exactly `npm run verify` plus
offline/a11y/Lighthouse, green on push/PR; proven to fail on a
deliberately-broken change and pass again once reverted; `WORKPLAN.md`'s
Progress table records Stage 6.4; an ADR if the workflow structure involves a
genuinely non-obvious call (e.g. how deploy-on-merge interacts with the
manual `gh-pages` path, if you build it) — a standard Node-workspace Actions
recipe probably doesn't need one; and, since this is explicitly the **last**
stage in `WORKPLAN.md`'s plan, no next brief is required — instead, close the
loop: update the root `README.md`'s status/intro if it still frames CI as
"deferred," and note in the Progress table's narrative that the plan is
complete.

## Model

**Sonnet**, or **Haiku** if following a standard Node-workspace GitHub
Actions recipe verbatim. The judgement call is scope discipline — resisting
the pull to add checks CI could run but a contributor can't, exactly as
§1.4 warns.
