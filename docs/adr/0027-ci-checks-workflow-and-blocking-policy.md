# 0027 — CI: what the checks workflow runs, and which checks gate a merge

- **Status:** Accepted
- **Date:** 2026-07-27
- **Workplan stage:** 6.4 — continuous integration (the last stage in the plan)

## Context

`WORKPLAN.md` §1.4 has deferred GitHub Actions since Stage 0.1: "automating
them in GitHub Actions is deliberately deferred until the project is complete
… there is no `.github/workflows/` directory, and stages should not add one."
Stage 0.1 originally shipped a CI workflow and it was **removed** to keep that
rule. Stage 6.4 is the stage that lifts it, and §1.4 is also the specification:

> automate exactly `npm run verify` plus the offline, a11y and Lighthouse runs
> the later stages describe — nothing that isn't already a check a contributor
> can run by hand.

Mechanically wiring those commands into a workflow needs no ADR — it is a
standard Node-workspace Actions recipe. Two things about it are genuinely
non-obvious, and this ADR records them:

1. **Which of these checks _gate_ a merge, and which only report.** §1.4 says
   what to run, not what a failure means. "Every check is blocking" and "the
   soft ones are advisory" are both defensible, and picking one silently would
   be exactly the kind of undocumented call §0.2 asks for an ADR about. A
   Lighthouse score dropping from 0.88 to 0.85: red build, or a note?
2. **Whether the offline check needs a job of its own**, given §1.4 names it
   separately from `npm run verify`.

## Decision

### 1. Three jobs, not one

`.github/workflows/checks.yml`, triggered on `pull_request` and on `push` to
`main`:

| Job      | Runs                                                                                       | Merge-blocking? |
| -------- | ------------------------------------------------------------------------------------------ | --------------- |
| `verify` | `npm run verify` — lint → typecheck → format:check → test → build → e2e (offline included) | **Yes**         |
| `a11y`   | `npm run a11y -w app` — the axe check                                                      | **Yes**         |
| `audits` | Lighthouse PWA score; the keyboard-only walkthrough                                        | No — reported   |

`push` is scoped to `main` rather than to every branch so a branch with an open
pull request doesn't run the whole suite twice per commit; between the two
triggers, every commit that can reach `main` is still checked.

### 2. The offline check rides along in `npm run e2e` — no job of its own

Checked rather than assumed: `app/e2e/offline.spec.ts` is an ordinary spec in
`app/e2e/`, and `app/playwright.config.ts` only `testIgnore`s
`deployed-smoke.spec.ts` and `a11y.spec.ts`. So `npm run e2e` — and therefore
`npm run verify` — already runs it, as the local baseline for this stage
confirms (7/7 specs, `offline.spec.ts` among them). §1.4 names it separately
because it names it as a _requirement_, not because it is a separate command.
Giving it its own job would run the same spec twice and imply a second,
independent source of truth that doesn't exist.

### 3. `verify` and `a11y` block. The Lighthouse audit and the keyboard walkthrough report.

**`verify` blocks** because it is the project's own definition of done (§0.3),
already binding on every contributor by hand. Automating it changes who runs
it, not what it means.

**The axe check blocks.** It is deterministic, it runs entirely against a local
production preview with no network dependency, it is currently at 0 violations
in both scanned states, and any violation it reports is a real, reproducible,
locally-fixable regression in the markup. There is no honest reason to let a
new accessibility violation through with a shrug, and Stage 6.2 left it as a
runnable command specifically so this stage could wire it in.

**The Lighthouse PWA audit does not block**, for three specific reasons, not
out of squeamishness:

- **The property it approximates is already gated for real.** What the PWA
  score actually protects is "the app installs and works offline". That is
  asserted directly, and blockingly, by `app/e2e/offline.spec.ts` inside
  `npm run verify` — load online, `context.setOffline(true)`, re-run the core
  journey. The Lighthouse number is a second, weaker measurement of the same
  property; gating on both means the weaker one decides.
- **The tool is externally fetched, and on a deprecated major.** The scored PWA
  category was removed from Lighthouse's current major entirely (README.md
  records this), so the documented command pins `lighthouse@11` and `npx`
  fetches it from the network on every run. A registry hiccup, or a change in
  the runner's browser, would turn an unrelated pull request red. A gate whose
  red builds are usually not about the change under test trains people to
  ignore it, which is worse than no gate.
- **The score has a known, permanent shortfall.** 0.88/1.00 with one failing
  audit — the legacy "custom splash screen" check hard-requires a PNG icon
  ≥512px and this project ships SVG only (ADR 0022). A threshold gate at 0.88
  would sit permanently one accepted-gap away from red, which is not a
  meaningful signal.

Instead of a shrug, the audit **reports**: `.github/scripts/report-lighthouse-pwa.mjs`
writes the score, the baseline, and the list of failing audits into the run
summary, and raises a `::warning::` annotation if the score has slipped below
the recorded 0.88 — **or if the audit produced no score at all**. That last
case matters: an informational check that is green whether or not it measured
anything is a check that has silently stopped working, which is the real risk
with soft gates. The three outcomes (at baseline / below baseline / could not
measure) are distinguished explicitly and all three are visible.

**The keyboard-only walkthrough does not block either**, and here the decision
was already made by an earlier stage. `app/keyboard-walkthrough.mjs`'s own doc
comment (Stage 6.2) says it is "deliberately not a Playwright test / not part
of `npm run verify` … the recorded proof of a manual check, not a regression
gate", because the tab counts it measures "are expected to drift as the dataset
and page grow". That reasoning is still correct: the script gives up after 40
tab presses, and the palette's length is a function of how many crops match a
search. Turning it into a gate would re-open a decision Stage 6.2 closed
deliberately. Running it on every push and reporting its full output into the
run summary gets the visibility without the brittleness.

### 4. Nothing else is added

No coverage-percentage gate (Stage 6.3 audited coverage without one, and
`@vitest/coverage-v8` is deliberately not a committed dependency). No bundle-size
budget, no dependency-review action, no scheduled runs, no matrix across Node
versions or operating systems. Each of those is a check a contributor cannot
reproduce with a documented command today, which is precisely what §1.4's
"nothing else" clause forbids. The workflow's value is that a red check means
"run this exact command locally and you will see the same thing".

### 5. Supply-chain hygiene in the workflow itself

- Every third-party action is pinned to a **commit SHA**, with the release
  recorded in a trailing comment. Tags are mutable and can be repointed at new
  code by whoever controls the action's repository.
- `permissions: contents: read` at the top level. The checks workflow reads
  code and nothing else; it never needs to write to the repository, publish, or
  comment. Deployment stays a separate, manual path with no workflow at all —
  see ADR [0028](./0028-deploy-on-merge-not-automated.md) for why this stage
  declined the optional deploy-on-merge, and what it would take to add it.
- No secrets are referenced, so there is nothing for a fork's pull request to
  reach. `pull_request` (not `pull_request_target`) is the trigger, so a fork's
  code runs without repository write access by construction.
- `forbidOnly` is set in `app/playwright.config.ts` under `CI`, so a stray
  `test.only` cannot reduce the E2E suite to a single spec while still
  reporting success. A gate that silently stops gating is the failure mode this
  whole workflow exists to avoid.

### 6. Node is pinned to the declared floor, not the maintainer's version

The workflow pins Node **20**, the minimum the root `package.json`'s
`"engines": { "node": ">=20" }` promises, even though local development happens
on Node 22. If a change quietly needs a newer Node, it fails in CI rather than
on a contributor who took the README at its word. Keeping the two in step is a
one-line change in both places if the floor ever moves.

### 7. The known `plot-export.spec.ts` flake is fixed in Playwright, not in YAML

`app/playwright.config.ts` now sets `retries: process.env.CI ? 1 : 0`. The spec
still has to pass — a genuinely broken export fails both attempts — which is
what separates this from a workflow-level `continue-on-error` that would let a
real failure through. Locally, retries stay at 0 so a flake stays visible to
whoever is working on the code.

## Alternatives considered

- **One job running everything sequentially.** Simpler to read, and it would
  make "blocking" uniform. Rejected: it forces the Lighthouse and walkthrough
  decisions to be the same as the `verify` decision, and it serialises three
  independent things that each need their own browser install.
- **Gate on the Lighthouse score at the recorded 0.88 baseline.** The strongest
  counter-proposal, and the one a future maintainer is most likely to revisit —
  it is a real regression gate, not a vacuous one. Rejected for the three
  reasons in §3; if it is ever revisited, the honest form is a committed
  expected-score file plus a pinned Lighthouse install, not a threshold
  hard-coded in YAML.
- **`continue-on-error: true` on the soft jobs.** The one-line way to make a
  job non-blocking. Rejected because it is indistinguishable from a job that
  broke: it reports green whether the audit measured 0.88, measured 0.40, or
  never ran. The explicit reporter script costs a few lines and says which.
- **Adding a Node version matrix (20 and 22).** Tempting, and cheap. Rejected
  under §1.4's "nothing else": a matrix is a check no contributor runs by hand,
  and its failures would be about the runner rather than the change.
- **Making the E2E job serial (`workers: 1` in CI) to dodge the export flake.**
  Would work, but it slows every run to fix one spec's race and hides the flake
  rather than surviving it. One retry is the narrower fix, and it is what the
  Stage 6.4 brief points at.

## Consequences

- A red `checks` run means one of two things, both reproducible locally with a
  documented command: `npm run verify` failed, or `npm run a11y -w app` failed.
- A Lighthouse regression or a broken keyboard path shows up as a warning
  annotation and a run-summary entry, not a blocked merge. Someone has to
  **read** it. That is a real, accepted cost of this decision, and the reason
  the reporter writes the number into the summary on every run rather than only
  when it is bad.
- The recorded baselines (0.88 Lighthouse, 0 axe violations) now live in three
  places that must move together if they ever change: `README.md`,
  `docs/qa-checklist.md` §4, and the `LIGHTHOUSE_BASELINE` value in
  `.github/workflows/checks.yml`.
- Pinning actions by SHA means Dependabot-style updates are a deliberate,
  reviewable commit rather than something that happens silently. That is the
  point, and the cost is that the pins do have to be updated by hand.
