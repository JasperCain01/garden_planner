# 0028 — Deploy-on-merge: the constraint lifted, and we still didn't automate it

- **Status:** Accepted
- **Date:** 2026-07-27
- **Workplan stage:** 6.4 — continuous integration

## Context

Stage 5.2 shipped a **manual** GitHub Pages deploy (`npm run deploy`, ADR
[0024](./0024-github-pages-manual-deploy.md)) — not because a manual deploy was
better, but because `WORKPLAN.md` §1.4 forbade `.github/workflows/` until the
project was complete. The Stage 6.4 entry is explicit that this changes here:

> **Optionally, deploy-on-merge.** Stage 5.2 ships a _manual_ Pages deploy only
> because §1.4 forbade the workflow. That constraint lifts here … but it is a
> separate decision from automating the checks, and the manual command must
> keep working either way.

So the question is live for the first time, and "optional" means it needs an
answer either way rather than being quietly skipped.

## Decision

**No deploy workflow is added.** Deployment stays exactly as ADR 0024 left it:
a maintainer runs `npm run deploy` by hand, then `npm run smoke:deployed`.
`.github/workflows/` contains the checks gate (ADR
[0027](./0027-ci-checks-workflow-and-blocking-policy.md)) and nothing else.

Three reasons, in order of weight.

### 1. GitHub Pages is still not enabled, so an auto-deploy would publish into the void

ADR 0024 recorded `has_pages: false` on the real repository, verified against
the GitHub API rather than assumed. Nothing since has changed that — enabling
Pages is a repo-admin Settings action no automated session can perform, and
this stage could not perform it either (see §3). A workflow that force-pushes
`gh-pages` on every merge to a repository that serves nothing from that branch
is an automation that appears to work — green check, "deployed" in the log —
while publishing to a URL that 404s. That is a worse state than an honest
manual step.

### 2. The right shape of the workflow depends on a setting only a repo admin can see

There are two legitimate designs, and they need **different, incompatible**
repository configuration:

- **Branch-based** (matching what README.md documents today): a workflow that
  builds with `GITHUB_PAGES=true` and pushes `app/dist` to the `gh-pages`
  branch. Needs `permissions: contents: write` — a token that can write to the
  repository, held by a workflow that has just run `npm ci` over the full
  dependency tree.
- **Actions-based** (`actions/configure-pages` → `actions/upload-pages-artifact`
  → `actions/deploy-pages`): no branch push, and a narrower
  `pages: write` + `id-token: write` instead of blanket write access. But it
  requires the repository's Pages **source** to be switched from "Deploy from a
  branch" to "GitHub Actions" — which silently breaks the branch-based manual
  `npm run deploy` path that Stage 5.2 built and README.md documents.

Picking between them blind — without being able to read or change the Pages
setting — means either granting `contents: write` to a never-executed workflow,
or changing a deployment mode this session cannot observe and cannot test. The
constraint that "the manual command must keep working either way" makes the
second option actively risky.

### 3. Nothing about it could be verified from this session

Stage 6.4 proved the checks workflow really gates by running it green, then red
on a deliberately broken commit, then green again on a real pull request. No
equivalent proof is available for a deploy workflow here:

- The GitHub REST API is not reachable from this session — `api.github.com`
  returns HTTP 403 at the egress proxy ("GitHub access is not enabled for this
  session"), so Pages cannot be enabled or even re-checked programmatically.
  Repository access is limited to the tools that proxy it, which expose pull
  requests, workflow runs and file contents, but no Pages endpoints.
- `https://jaspercain01.github.io/garden_planner/` is not reachable either —
  `curl` gets no response at all (exit before any HTTP status), so even after a
  successful publish nothing here could confirm the site was live.

Committing an unverifiable deploy automation would be exactly the kind of
asserted-but-unproven claim ADRs 0022 and 0024 went out of their way not to
make.

## The recipe, ready to adopt

This is the whole cost of the decision: a maintainer who enables Pages later
should not have to re-derive the workflow. Once
**Settings → Pages → Source** is set to `Deploy from a branch` → `gh-pages` /
`(root)` (README.md's existing prerequisite), the branch-based form is:

```yaml
name: deploy
on:
  push:
    branches: [main]
permissions:
  contents: write # needed to push the gh-pages branch — the whole reason this is opt-in
concurrency:
  group: deploy-pages
  cancel-in-progress: false # never cancel a half-finished publish
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: GITHUB_PAGES=true npm run build -w app
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          npx gh-pages -d app/dist -u "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>"
```

Two things a future maintainer should keep if they adopt it:

- **Keep it a separate file from `checks.yml`.** The checks gate must stay at
  `permissions: contents: read`; merging the two would hand a repository-write
  token to every test run, which is the supply-chain exposure ADR 0027 §5 is
  avoiding.
- **Gate it on the checks passing** (`needs:` across workflows isn't available,
  so the usual form is a `workflow_run` trigger on `checks` completing
  successfully on `main`). Deploying a commit whose tests never ran is a
  regression in safety over today's manual path, where a maintainer runs
  `npm run verify` first.

## Alternatives considered

- **Add the workflow anyway, `workflow_dispatch`-only.** It would exist, be
  harmless (never fires by itself), and be ready to switch on. Rejected: a
  maintainer who can dispatch a workflow can equally run `npm run deploy`, so
  it adds a `contents: write` surface for no capability that doesn't already
  exist — and it would still be untested.
- **Switch to the Actions-based Pages source and use `deploy-pages`.** The
  better long-term design (no branch push, narrower permissions). Rejected for
  now because it silently invalidates the documented manual path, which the
  stage brief requires to keep working, and because the switch is a repo
  setting this session cannot make or verify.
- **Deploy from the checks workflow on `main` only.** Fewer files. Rejected for
  the permissions reason above: it would raise the checks workflow's token from
  read to write for every run, including pull requests.

## Consequences

- Deployment remains a deliberate, human act. For a project whose live site is
  a static build of a data artifact, that is a small ongoing cost, and it keeps
  the "what is live" question answerable by asking who last ran the command.
- `npm run deploy` and `npm run smoke:deployed` are unchanged, as required.
- `WORKPLAN.md`'s closing backlog lists this as an explicit post-v1 item with
  its unblocker named (enable Pages, then adopt the recipe above), rather than
  leaving "should we automate the deploy?" as an open question.
- If the repository is ever renamed, ADR 0024's three-places note still
  applies; the recipe above adds no fourth place, since it reads the base path
  from `app/vite.config.ts` via `GITHUB_PAGES=true`.
