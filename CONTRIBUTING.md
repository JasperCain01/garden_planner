# Contributing to Garden Planner

Thanks for helping! This project is built to be **easy to clone, understand, and
extend**, so a few conventions matter more here than in a typical repo.

## Ground rules (from the workplan)

These come from [`WORKPLAN.md`](./WORKPLAN.md) §0.2 and apply to every change:

1. **Comment code clearly.** Every non-trivial function gets a docstring saying
   what it does and _why it exists_. Prefer comments that explain intent and
   reasoning over comments that restate the code.
2. **Explain non-obvious design choices as ADRs.** If you make a decision a
   newcomer might question (a library choice, an algorithm, a data trade-off),
   add a short Architecture Decision Record in `docs/adr/NNNN-title.md`. See
   `docs/adr/README.md` for the format.
3. **Prefer clarity over cleverness.** This is a teaching-friendly codebase.
4. **Keep the engine and data layers framework-free.** `packages/engine` and
   `packages/etl` must not import from the UI. This keeps them testable and
   reusable.
5. **Update docs as part of your change**, not afterwards.

## Definition of done

A change is ready when all of these pass from a clean clone:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run them yourself before opening a pull request. Since Workplan Stage 6.4,
[`.github/workflows/checks.yml`](./.github/workflows/checks.yml) also runs them
on every pull request — `npm run verify` (which is the list above _plus_
`format:check` and the Playwright end-to-end suite) and the axe accessibility
check as blocking checks, with the Lighthouse PWA audit and the keyboard-only
walkthrough reported but not gated ([ADR
0027](./docs/adr/0027-ci-checks-workflow-and-blocking-policy.md)).

CI deliberately runs **nothing you can't run yourself** with a documented
command (`WORKPLAN.md` §1.4), so a red check always reproduces locally. Running
`npm run verify` before you push is still the fastest way to find out.

## Development workflow

```bash
npm install        # once, from the repo root
npm run dev        # iterate on the app
npm test           # unit/component tests (Vitest)
npm run e2e        # end-to-end tests (Playwright)
```

## The architecture in one paragraph

The deployed app is **100% static and client-side** (it runs on GitHub Pages and
works offline). The plant "database" is a static artifact under `/data`, produced
at build time by the `packages/etl` pipeline from external sources — that
pipeline is a developer tool and is never shipped. The `packages/engine` package
holds all the horticultural logic as pure, framework-free functions. See
[`DESIGN.md`](./DESIGN.md), [`WORKPLAN.md`](./WORKPLAN.md), and `docs/adr/` for
the full reasoning.

## Adding things

Start at [`docs/README.md`](./docs/README.md) — the docs index links every
how-to guide (adding a curated crop, a spacing figure, a moisture row, an
exclusion, a companion relationship, a data source, or a crop icon) to where
it actually lives (`packages/etl/README.md` and `docs/icon-style-guide.md`),
rather than duplicating them here.
