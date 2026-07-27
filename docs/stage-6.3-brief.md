# Stage 6.3 brief — final validation & coverage pass

A tight starting point for a fresh session. Read [`WORKPLAN.md`](../WORKPLAN.md)
(§0 ground rules, and the Stage 6.3 entry) before starting; this brief
concentrates what that entry leaves implicit, and records what Stage 6.2 just
changed underneath it.

Everything through Stage 6.2 is merged into `main` — **branch from `main`**.

## Why this stage now

`WORKPLAN.md`'s dependency map is `6.0 ─► 6.1, 6.2, 6.3 ─► 6.4`. 6.0, 6.1 and
6.2 are all done now. 6.3 is what's left before 6.4 (CI, deliberately last),
and it was always meant to run after the others for the reason its own
brief-writing predecessors gave: **it's a confirmation pass, and confirming
before 6.1/6.2 landed would have meant confirming something about to
change.** That reasoning no longer applies to anything — there's nothing
else queued ahead of it — so 6.3 is the only reasonable next pick. If you
find a reason to reorder anyway, say so in the Progress table.

## What Stage 6.2 leaves you that's relevant here

- **Two new locally-runnable commands exist**: `npm run a11y` (axe check,
  `app/e2e/a11y.spec.ts` + `app/playwright.a11y.config.ts`) and
  `npm run keyboard-walkthrough` (`app/keyboard-walkthrough.mjs`, a scripted
  keyboard-only Playwright drive of the core journey — not a Playwright
  _test_, a plain Node script; see its own doc comment for why and how to run
  it). Neither is part of `npm run verify` (same "manual, not a gate" shape
  as Stage 5.1's Lighthouse audit, per §1.4). **This stage's "plus the
  offline, a11y and Lighthouse runs, all run by hand" verification bullet
  means re-running both of these**, not just the offline test and Lighthouse
  — read them as the a11y half of that list, now that they exist.
- **Two component tests carry longer explicit timeouts than the vitest
  default**, and it's expected, not a regression to chase:
  `app/src/App.test.tsx`'s "renders the plot-definition page at the index
  route" (15s) and `app/src/plot/PlotDefinitionPage.test.tsx`'s full
  DOM-driven test (30s). Both comments explain why (mounting a second
  interactive control — the new "Add to plot" button — on every one of
  ~130+ unfiltered palette rows measurably slows jsdom). If `npm test` ever
  times out on either again, check whether _you_ made rendering slower
  before assuming these numbers need raising again.
- **A recorded, honest list of known a11y gaps** lives in
  [`docs/accessibility.md`](./accessibility.md)'s "findings worth carrying
  forward" section — most importantly: the free-form plot-outline corner
  editor (`app/src/plot/PlotOutlineEditor.tsx`) is still pointer-only (no
  keyboard handler behind its corner handles, though they're now valid
  `role="button"` elements per ADR
  [0026](./adr/0026-keyboard-placement-and-severity-glyphs.md)), reaching the
  canvas after a keyboard placement takes ~35 tab presses in a filtered
  search match, and no real screen-reader (NVDA/VoiceOver/JAWS) testing has
  been done. **Don't silently fix these as part of "final validation"** —
  they're real, scoped-out gaps from a stage that named its own scope
  explicitly (palette→canvas handoff, on-canvas move/remove); if this
  stage's coverage pass or manual QA checklist turns up more like them,
  record them the same honest way, but closing them is a decision for
  whoever picks it up next, not something to absorb quietly into a
  "validation" stage.
- **The dataset's long-standing coverage gap is unchanged and not this
  stage's job either**: hardiness/season data is still 8/144 crops (Stage 6.0
  closed the crop-list and soil-moisture gaps, not this one — see that
  stage's entry and `docs/data-provenance-and-licensing.md`). "Fill
  test-coverage gaps on engine and data" in this stage's own deliverable
  list means gaps in _test coverage of existing logic_, not gaps in the
  _dataset's own fields_ — don't conflate the two.

## What Stage 6.3 actually asks for

`WORKPLAN.md`'s entry:

- **Fill test-coverage gaps on engine and data.** Audit `packages/engine/`
  and `packages/etl/` for undertested logic — edge cases, error paths,
  property-based test opportunities the existing suite (362 engine + 230 etl
  tests as of the last count in `docs/review-pre-deployment.md`) might be
  missing. This is a genuine coverage audit, not a rewrite: don't touch
  `packages/engine/`/`packages/etl/` beyond what closing a real gap
  requires, per the same constraint 6.2 followed.
- **A full E2E regression run.** `npm run e2e` (7 specs today) plus the
  manual-by-hand checks: offline (`app/e2e/offline.spec.ts`'s automated half
  already covers this, but the brief's own framing wants a confirmed-by-hand
  pass too), the axe check, the keyboard walkthrough, and a Lighthouse PWA
  audit re-run (`README.md`'s existing section has the command; re-run it
  and note whether the score changed from 0.88/1.00).
- **A documented manual QA checklist for release.** This is the one
  genuinely new artifact this stage adds — a checklist a maintainer (or a
  future session) can run through by hand before calling this v1: the core
  journey, each of the app's "beyond the core loop" capabilities (add a
  custom crop, export a plot image), offline behaviour, and a pointer at the
  known a11y gaps above so a release note doesn't have to be invented from
  scratch. Where this lives is your call — a new `docs/qa-checklist.md` is
  probably right (indexed from `docs/README.md`, same convention as every
  other doc this project has added), but a section in an existing doc is
  defensible too if you have a reason.

## Traps and constraints (don't rediscover these)

- **`npm install` first**, then `npm run verify` from the repo root before
  finishing. `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium` if this
  environment's Playwright can't find a browser. One E2E test
  (`plot-export.spec.ts`) has been observed to flake once under the default
  2-worker parallelism and pass standalone/on retry — unrelated to any
  particular stage's changes; retry before assuming you broke something.
- **`format:check` covers Markdown.** Run `npm run format` after any doc
  edits.
- **No `.github/workflows/` directory** — §1.4 holds until Stage 6.4. Every
  check this stage runs (`npm run a11y`, `npm run keyboard-walkthrough`, the
  Lighthouse command, `smoke:deployed` if you touch deployment at all) stays
  a documented, by-hand command.
- **Don't touch `packages/engine/`/`packages/etl/` for anything beyond
  closing a real, specific coverage gap** — same discipline 6.2 held for a
  different reason (UI-only scope there; here it's "confirmation pass,
  not a rewrite").

## Definition of done (WORKPLAN §0.3)

`npm run verify` green; the coverage gaps you found (if any) closed with new
tests, not loosened assertions; a full E2E regression confirmed (automated
suite plus the by-hand offline/a11y/keyboard-walkthrough/Lighthouse checks,
each result recorded); a manual QA checklist written and indexed from
`docs/README.md`; `WORKPLAN.md`'s Progress table records Stage 6.3; an ADR
only if you make a genuinely non-obvious decision (a coverage audit
following an established test pattern probably doesn't need one — the same
"does a newcomer need this reasoning next to the code" test §0.2 gives); and
Stage 6.4's brief written or confirmed (its own WORKPLAN entry is already
fairly complete, since 6.4 has been "the deferred CI stage" since Stage 0.1 —
check whether it needs anything Stage 6.3 specifically learned before
treating that entry as sufficient on its own).

## Model

**Sonnet**, escalating to **Opus** only if the coverage audit turns up a
genuinely deep bug in the engine's scoring or packing logic that needs real
algorithmic reasoning to fix — not for the coverage-writing or checklist
work itself, which is well-scoped, established-pattern work.
