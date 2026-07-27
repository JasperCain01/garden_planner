# Security review (Workplan Stage 6.4, 2026-07-27)

A closing review scoped to what this application actually is: a **fully
static, client-side site** with no server, no accounts, no authentication, no
network calls at runtime, and no data belonging to anyone but the person
sitting in front of it (`WORKPLAN.md` §0.1, ADR
[0003](./adr/0003-static-client-side-architecture.md)). That scope removes most
of the usual web threat model — there is no session to hijack, no API to
authorise, no other user's data in reach — and leaves three things worth
checking properly: the dependency tree, user-authored text reaching the DOM,
and the new CI workflow's own privileges.

**Result: one real, cheap fix applied (a `postcss` patch bump); one genuine
advisory triaged as not applicable and deliberately not "fixed"; no XSS vector
found, confirmed by execution rather than by reading.** Everything below is
what was actually run, including the parts that found nothing.

## 1. `npm audit` across the workspaces

`npm audit` from the repo root covers all three workspaces (one hoisted
lockfile). It reported **14 high-severity advisories**, all of which resolve
into three groups:

### Fixed: `postcss` path traversal (GHSA-r28c-9q8g-f849)

`postcss` 8.5.16 → **8.5.23**, a lockfile-only patch bump with no API change
(`npm audit fix`, no `--force`). PostCSS auto-loads a previous source map from
a `sourceMappingURL` comment, and a crafted comment can read an arbitrary
`.map` file.

**Was it exploitable here? Almost certainly not** — postcss runs at build time
inside Vite's CSS pipeline, over this repository's own stylesheets, on a
machine that already has the files. But it is a genuine path-traversal bug, the
fix is a patch version, and "not exploitable in our configuration" is a weaker
guarantee than "not present". Fixed. The same `npm audit fix` run also picked
up patch bumps for `brace-expansion`, `minimatch`, `eslint` and `nanoid`.

### Not fixed, and deliberately: `react-router` RSC-mode CSRF (GHSA-qwww-vcr4-c8h2)

This is the only advisory touching a dependency that actually **ships to the
browser**, so it got the closest look. The advisory covers react-router
7.12.0–8.2.0 (this app is on 7.18.1) and describes a CSRF bypass in **RSC
mode**, where a server executes a route action before returning a 400.

**It does not apply.** This app uses `createBrowserRouter` for client-side
routing on a static site (`app/src/routes/router.tsx`). There is no server, no
React Server Components, no route actions, and nothing to forge a request
against — the deployed app makes no calls to anything at runtime by design.

Critically, **there is no fixed version to move to**: 7.18.1 is the latest
release, and `npm audit fix --force` resolves this by _downgrading_ to 7.11.0,
throwing away seven minor versions of fixes to dodge a server-side issue in an
app with no server. That is a worse security position, not a better one. Left
as-is, recorded here so the next person doesn't have to re-derive it.

### Triaged as noise: the build-time glob/template chain

`brace-expansion` → `minimatch` → `filelist`/`jake`/`ejs` →
`@trickfilm400/rollup-plugin-off-main-thread` → `workbox-build` →
`vite-plugin-pwa`, plus the same `brace-expansion` root under `eslint` and
`@typescript-eslint`. The underlying advisories are **denial of service via
pathological glob patterns** (exponential expansion / unbounded memory).

Every one of these packages runs at build time only — none is in the shipped
bundle — and the only glob patterns they ever see come from this repository's
own configuration files. A DoS against a developer's own build, triggered by a
pattern that developer wrote, is not a threat. The remaining transitive fixes
need major-version bumps of `vite-plugin-pwa`/`eslint` that buy nothing here,
so they are not taken.

## 2. User-authored text reaching the DOM

Two places take text from the user: **custom crop names** (Stage 3.6's
add-crop form) and **the plot-export legend** (Stage 3.7). Both were checked,
and the crop-name path was checked by actually attacking it rather than by
reasoning about React's defaults.

### The probe

Against the real production preview (`npm run build -w app && npm run preview
-w app`), a custom crop was added through the ordinary form with the name:

```
<img src=x onerror="window.__xss=1">Sneaky Kale
```

with a **positive control** — the crop had to genuinely be created and
rendered, so that a null result couldn't just mean "the form rejected it".
Result:

| Check                                              | Result                        |
| -------------------------------------------------- | ----------------------------- |
| Crop was actually added and appears in the palette | ✅ yes (positive control)     |
| Payload rendered as **literal visible text**       | ✅ yes — escaped, as intended |
| `onerror` handler fired (`window.__xss`)           | ❌ no                         |
| Payload parsed into a real `<img>` element         | ❌ no (0 found)               |
| Any `<script>` containing the payload              | ❌ no (0 found)               |
| Uncaught page errors                               | none                          |

So React's default escaping does hold on this path — now confirmed, not
assumed. Supporting this structurally: a repo-wide search finds **no**
`dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`,
`document.write`, `eval`, or `new Function` anywhere in `app/`,
`packages/engine/` or `packages/etl/`.

### The export legend

`app/src/canvas/export.ts` draws the legend with `ctx.fillText` onto a 2D
canvas. Text drawn to a canvas is rasterised to pixels; there is no markup
parser in that path, so a crop name cannot become an element however it is
spelled. The one URL in the export path (`link.href = dataUrl`) is a
`data:image/png;base64,…` string the browser itself produced from
`canvas.toDataURL('image/png')`, and the filename is a module constant — no
user text reaches either.

### Icon resolution, checked because it looks like a URL sink

`PlantPalette.tsx` renders `<img src={icon.url}>`, and `plant.icon` is a
user-settable field. `resolveIcon` (`app/src/icons/resolveIcon.ts`) is a
**Map lookup with a fallback**, not string interpolation: an unrecognised key
— including anything a user could type — returns the bundled generic icon.
A `javascript:` or `data:` string can never become an `src`.

## 3. The CI workflow's own privileges

Reviewed as part of writing it; the reasoning is in ADR
[0027](./adr/0027-ci-checks-workflow-and-blocking-policy.md) §5.

- **Actions pinned by commit SHA**, not by tag, with the release in a trailing
  comment. A tag is mutable and can be repointed at new code by whoever
  controls the action's repository — the standard Actions supply-chain risk.
- **`permissions: contents: read`** at the top level. The workflow reads code
  and nothing else; it cannot push, publish, or comment. This is the reason
  deploy-on-merge is not folded into the same workflow (ADR
  [0028](./adr/0028-deploy-on-merge-not-automated.md)) — that would hand a
  repository-write token to every test run, including pull requests.
- **No secrets are referenced**, so a fork's pull request has nothing to reach.
  The trigger is `pull_request`, not `pull_request_target`, so a fork's code
  runs against a read-only token by construction.
- **Nothing is logged that shouldn't be.** The jobs print test output, an axe
  result, a Lighthouse score and a keyboard-walkthrough transcript. There are
  no environment secrets in scope to leak.
- **The gate can't silently stop gating.** `forbidOnly` under `CI`
  (`app/playwright.config.ts`) rejects a stray `test.only`, and the Lighthouse
  reporter distinguishes "measured and fine" from "could not measure" instead
  of reporting green for both.

## What this review did not cover

- **No penetration testing of a deployed site**, because there isn't one yet
  (README.md's "Live site"). When the app is deployed, the only server-side
  surface is GitHub Pages' own static hosting.
- **No supply-chain audit of the bundled dataset**, which is committed, plain
  JSON, schema-validated at build time by the Stage 1.5 hard-fail gate, and
  re-validated by the app when it loads (`app/src/dataset/shipped-plants.ts`).
- **No review of `gh-pages`' credential handling** beyond noting that it uses
  the maintainer's ambient git credentials and no API token (ADR 0024). This
  would need doing properly if the deploy is ever automated.

## Related

- [ADR 0027](./adr/0027-ci-checks-workflow-and-blocking-policy.md) — the CI
  workflow's structure and its least-privilege posture.
- [ADR 0028](./adr/0028-deploy-on-merge-not-automated.md) — why the deploy is
  not automated, including the permissions argument.
- [`WORKPLAN.md`](../WORKPLAN.md) — the closing section lists the post-v1
  backlog, including the two advisories left in place above.
