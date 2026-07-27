# Stage 6.1 brief — the documentation pass

A tight starting point for a fresh session. Read [`WORKPLAN.md`](../WORKPLAN.md)
(§0 ground rules, and the Stage 6.1 entry) before starting; this brief
concentrates what that entry leaves implicit, and records what Stage 6.0 just
changed underneath it.

Everything through Stage 6.0 is merged into `main` — **branch from `main`**.

## Why this stage next (and when to pick 6.2 or 6.3 instead)

`WORKPLAN.md`'s dependency map is `6.0 ─► 6.1, 6.2, 6.3 ─► 6.4`: all three of
6.1, 6.2 and 6.3 are unblocked, and none depends on the others. 6.1 is the
natural default and this brief recommends it, for one reason above the rest:
**"others can clone and understand this easily" is a stated project goal**
(§0.2), and it is the only remaining goal that no stage has yet been
accountable for as its main deliverable. Every stage has _maintained_ docs;
none has audited them end to end.

The honest counter-arguments, since the choice is yours:

- **6.2 (accessibility & responsive polish)** has the strongest claim to going
  first if you think the deployed site will get real visitors soon. It is the
  only remaining stage that changes what a user experiences. Note that the page
  is tall enough that `docs/review-pre-deployment.md` found the plot canvas
  sitting ~3500 px down the page (§2's E2E investigation — fixed there by
  raising the _test_ viewport, which says nothing about how it behaves on a real
  phone). It is also the only Phase 6 stage with a new
  _runnable command_ to leave behind (an axe check), which 6.4 later wires up.
- **6.3 (final validation & coverage)** is best left last of the three: it is a
  confirmation pass, and confirming before 6.1 and 6.2 have landed means
  confirming something you are about to change.

If you pick 6.2 first, say so in the Progress table and write 6.1's brief
forward — don't leave the next session to re-derive the ordering.

## What Stage 6.0 just changed that this stage must not restate wrongly

Stage 6.0 (crop-list half) re-curated the shipped dataset. **Every crop-count
and coverage number in the repo moved**, and this stage's job is partly to
make sure they stay right:

- `data/plants.json` holds **144 crops** (was 162): six British staples added
  through the curated channel, 24 crops that can't be grown outdoors in Britain
  removed (`packages/etl/src/exclusions/`, ADR
  [0025](./adr/0025-uk-outdoor-crop-exclusions.md)).
- Coverage today: light **144/144** (133 full-sun, 11 partial-shade), soil
  **80/144**, hardiness and seasons **8/144**, companion links **76 across 50
  records**, antagonists 8 links on 8 records.
- The pinned numbers live in `packages/engine/src/suitability/dataset.test.ts`,
  `spacing/dataset.test.ts` and `warnings/dataset.test.ts`. **Those three files
  are the source of truth** — if a doc disagrees with them, the doc is wrong.
  A quick way to check any figure before writing it down: read the assertions
  in those tests, or run the numbers from `data/plants.json` directly.

Stage 6.0 already updated `README.md`, `docs/architecture.md`, `data/README.md`,
`packages/etl/README.md`, `docs/icon-style-guide.md`, `NOTICE` and `WORKPLAN.md`
for the new figures. Assume they are right; **verify rather than trust**, since
finding a stale number is exactly what this stage is for.

## What Stage 6.1 actually asks for

`WORKPLAN.md`'s entry lists four deliverables. Two of them substantially exist
already, which is the most useful thing this brief can tell you:

| Deliverable                     | State today                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete `README`               | **Largely done.** What it is, quick start, offline use, deployment, the honest "caveat worth knowing" section. Missing: a live link (Pages was never actually enabled — ADR 0024).                                                                                                                   |
| Architecture overview           | **Exists** (`docs/architecture.md`, ~600 lines, stage by stage) — but it is written as an accreting changelog, not as an overview a newcomer reads top to bottom.                                                                                                                                    |
| Data-provenance & licensing doc | **Scattered but complete**: `NOTICE`, `data/README.md`, ADR 0009, ADR 0023. There is no single document, and the workplan asks for one.                                                                                                                                                              |
| How-to guides                   | **Mostly written, in the wrong place.** `packages/etl/README.md` has "adding a curated crop", "adding a moisture row", "adding an exclusion", "adding a companion relationship" and "adding a source"; `docs/icon-style-guide.md` has "adding/removing an icon". None is linked from a single index. |

So the real shape of this stage is **consolidation and an audit, not writing
from scratch**. The workplan's own verification test is the thing to design
against: _a newcomer (or a fresh session simulating one) can go from clone to
running app, and to adding a plant, using only the docs._ Concretely, that
suggests:

1. A **docs index** — one page that answers "where do I look for X?" and links
   the how-to guides that already exist rather than duplicating them.
   `docs/architecture.md`'s "Where to look next" table is close to this
   already; consider whether it should be promoted or replaced.
2. A **provenance & licensing doc** gathering what `NOTICE`, `data/README.md`
   and ADRs 0009/0023/0025 currently say in four places. Watch the one
   genuinely subtle point: no cited page was ever fetched directly from the
   build environment (RHS and almanac.com both return 403), so figures came
   from web-search snippets of those exact pages, and moisture/exclusion
   judgements cite nothing at all. `NOTICE` states this plainly today and the
   consolidated doc must not soften it.
3. **The code-comment audit §0.2 asks for.** Genuinely worth doing rather than
   ticking: comment quality in this repo is high and uneven in a specific way —
   the ETL and engine modules explain _why_ at length, while some app
   components (`app/src/canvas/`, `app/src/palette/`) are thinner. Prefer
   improving the thin ones to re-polishing the good ones.
4. **A pass for stale figures**, per the section above.

## Traps and constraints (don't rediscover these)

- **`npm install` first**, then `npm run verify` from the repo root (lint →
  typecheck → format:check → test → build → e2e) before finishing. If Playwright
  can't find a browser, set `PW_EXECUTABLE_PATH` — this environment ships
  Chromium at `/opt/pw-browsers/chromium` (see `README.md`).
- **`format:check` covers Markdown.** Prettier formats `.md` in this repo, so a
  hand-wrapped table or an over-long line fails `npm run verify`. Run
  `npm run format` after any substantial doc edit.
- **No `.github/workflows/` directory** — §1.4 holds until Stage 6.4. This stage
  has no reason to go near it.
- **No `.claude/` skills directory** — review your own diff.
- **Don't relocate an ADR or change its number.** They are linked from code
  comments, other ADRs, and `docs/adr/README.md`. Consolidating _prose_ is in
  scope; renumbering decisions is not.
- **The live link.** The README currently documents the manual deploy without
  claiming the site is up, because no session has been able to enable Pages or
  reach the deployed URL (ADR 0024, and the Stage 5.2 entry's honest note). If
  you cannot verify a live URL from this environment either, keep it that way —
  an unverified live link in the README is worse than none.

## Definition of done (WORKPLAN §0.3)

`npm run verify` green; the docs answer the newcomer test above; no stale crop
count or coverage figure anywhere in the repo; `WORKPLAN.md`'s Progress table
records Stage 6.1; an ADR if anything here turns out non-obvious (a docs
reorganisation usually does not need one — say so rather than writing a thin
ADR to satisfy the checklist); and the next stage's brief written (6.2 or 6.3,
whichever you judge more valuable — see the ordering argument above).

## Model

**Sonnet.** Consolidation, auditing and writing against a settled codebase, with
one judgement call (what shape the consolidated docs take) that is reversible
and cheap to get wrong.
