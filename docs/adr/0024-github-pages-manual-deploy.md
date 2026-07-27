# 0024 — GitHub Pages deployment: `gh-pages`, script placement, and a manual post-deploy smoke check

- **Status:** Accepted
- **Date:** 2026-07-27
- **Workplan stage:** 5.2 — GitHub Pages deployment

## Context

`WORKPLAN.md` §1.4 defers all GitHub Actions automation until Stage 6.4 — no
`.github/workflows/` directory exists, and this stage must not add one. Stage
5.2's job is therefore not "wire up CI/CD" but "give a maintainer with real
repo-admin and push access a documented, repeatable command they run by
hand." `app/vite.config.ts` already env-gates the Pages base path
(`GITHUB_PAGES=true` → `/garden_planner/`, Stage 0.1/5.1) and it needed no
change — confirmed again by building with the flag and inspecting
`dist/index.html` and `dist/manifest.webmanifest` (both correctly carry the
`/garden_planner/` prefix on the JS bundle, the manifest link, and
`start_url`/`scope`).

Three things needed a decision this stage's brief left open:

1. Which tool builds and publishes `gh-pages` branch content.
2. Where the deploy script lives — root `package.json` or `app/package.json`.
3. How to verify a live deployment without either a CI job or asserting
   something this sandboxed session couldn't actually observe.

## Decision

### Tool: `gh-pages` (npm package)

`gh-pages` is a small, widely-used CLI that builds (or is pointed at) a
directory and force-pushes it to a branch (`gh-pages` by default) on the
current `origin`. It needs no GitHub API token beyond the ambient git
credentials a maintainer's machine already has for `git push`, and it's a
plain `devDependency` install — which works even in a sandbox where the
network is otherwise blocked, unlike the actual push this stage can't
complete here (see "What could and couldn't be verified" below).

**Alternative considered:** a hand-rolled `git worktree`/orphan-branch push
script. Rejected — `gh-pages` is exactly this, already tested and maintained,
and re-implementing it would be surface area with no benefit, the same
reasoning ADR 0022 used to reject a hand-rolled service worker.

### Script placement: the wrapper lives at the root, same as `e2e`/`preview`

Root `package.json` already wraps workspace-specific commands
(`"preview": "npm run preview -w app"`, `"e2e": "npm run e2e -w app"`) rather
than asking a maintainer to `cd app` first. `deploy` follows that convention:

```json
"deploy": "GITHUB_PAGES=true npm run build -w app && gh-pages -d app/dist"
```

`gh-pages` itself is a root `devDependency` (alongside the repo's other
tooling — `eslint`, `prettier`, `vite`, `vitest`) rather than an `app`-level
one, since the command that invokes it lives at the root.

### Post-deploy smoke check: a separate Playwright config, run by hand

`app/playwright.config.ts` (the one `npm run e2e`/`verify` use) must keep
working with **no network dependency beyond `localhost`** — that's what
makes it safe to run in CI later (Stage 6.4) and in any sandbox today. A
check against the real, already-deployed Pages URL is a genuinely different
thing: different `baseURL`, no local `webServer` to boot, and it can only
ever be run by a maintainer who has actually completed a deploy.

So it's a second config (`app/playwright.pages.config.ts`) and a dedicated
spec (`app/e2e/deployed-smoke.spec.ts`), wired to a separate script
(`smoke:deployed`, at both `app/package.json` and root) rather than a flag on
the existing config. `playwright.config.ts` explicitly `testIgnore`s the new
spec so a plain `npm run e2e` never tries to hit the network by accident, and
the new config has no `webServer` block at all — it points straight at
`DEPLOYED_URL` (defaulting to the real Pages URL,
`https://jaspercain01.github.io/garden_planner/`, confirmed via the GitHub
API against the actual `JasperCain01/garden_planner` repo rather than
guessed).

The spec itself reuses the shared `dragCropOntoCanvas` helper (`e2e/drag.ts`,
introduced in the pre-deployment review to fix the flaky export spec) for the
same core plot→palette→canvas journey the other specs check, plus two things
only a real deployment can prove: that `page.goto('./')` — not `'/'`, which
would resolve against the origin and silently drop the `/garden_planner/`
base path per the WHATWG URL rules Playwright's `baseURL` follows — lands on
a working app, and that the service worker actually registers and takes
control under the deployed scope (mirroring `offline.spec.ts`'s
`waitForFunction` wait, not a fixed sleep).

**Alternative considered:** a single config with an env-var-driven `baseURL`
override and no `testIgnore`. Rejected — that would make `npm run e2e`'s
behaviour depend on whether `DEPLOYED_URL` happens to be set in the
environment it's invoked from, which is exactly the kind of accidental
network dependency §1.4 wants `verify` to never have.

## What could and couldn't be verified from this sandboxed session

- **Could:** `npm install`; `GITHUB_PAGES=true npm run build -w app`
  (inspected `dist/index.html` and `dist/manifest.webmanifest` by hand — both
  correct); the full `npm run verify` (lint → typecheck → format:check →
  test → build → e2e), green; confirming via the GitHub API that the repo is
  `JasperCain01/garden_planner` with `has_pages: false` today (i.e. Pages
  genuinely isn't on yet — not a sandbox artifact).
- **Could not:** actually running `npm run deploy` for real. That would force-push
  a `gh-pages` branch to the maintainer's real, public GitHub repository —
  a shared-state action with a real (if reversible) footprint that isn't this
  session's call to make unprompted, and separately, `has_pages: false` means
  the branch wouldn't be served yet regardless. Also could not reach a live
  `https://jaspercain01.github.io/garden_planner/` URL, since nothing has been
  published there. `smoke:deployed` is therefore documented and written, but
  has never actually run against a real deployment — the next thing to happen
  is a maintainer running `npm run deploy` once (after enabling Pages in the
  repo settings, a manual prerequisite no session can do — see README.md),
  then `npm run smoke:deployed` to confirm it worked.

## Consequences

- No `.github/workflows/` directory was added — §1.4 holds.
- A maintainer with real push access can publish with one command
  (`npm run deploy`) after a one-time, out-of-band Settings → Pages step.
- The smoke spec exists and is correct by construction (it reuses the same
  drag helper and assertions as the specs `verify` already runs green), but
  its first real run is still owed by whoever completes the actual deploy —
  recorded plainly rather than asserted.
- If the real repo is ever renamed away from `garden_planner`, three places
  need the new name together: `app/vite.config.ts`'s `base`, the default
  `DEPLOYED_URL` in `app/playwright.pages.config.ts`, and the README's deploy
  section.
