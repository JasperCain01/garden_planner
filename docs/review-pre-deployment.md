# Pre-deployment review — Stages 0.1 → 5.1

**Date:** 2026-07-26 · **Reviewer model:** Opus · **Branch:** `claude/github-pages-review-b3pomw`
**Scope:** everything merged to `main` up to and including Stage 5.1 (PWA / offline
support). Stage 5.2 (GitHub Pages deployment) is **not** reviewed — it has not
started, and nothing here attempts to do it.

This is the "stop and look back" pass `WORKPLAN.md` implies before the project
becomes publicly hosted. It checks four things the workplan asks for by name:
**accuracy**, **efficiency**, **adherence to the overall objective**
(`DESIGN.md`), and **quality of code and commenting** (§0.2) — plus one thing
the prompt asked for specifically: whether the tests are _designed_ such that a
pass is genuine assurance, rather than merely green.

---

## 1. Headline

The build is in good shape and the engineering standard is unusually high — the
commenting convention in §0.2 has genuinely been honoured rather than performed,
and the engine's test design is the strongest part of the repository. **Nine
findings** follow. Two are worth fixing before the site goes live (§3.1, §3.2);
the rest are accuracy and honesty issues that will cost a future contributor
time if left.

Nothing found here challenges an architectural decision. The ADRs are sound and
the reasoning in them holds up under inspection.

---

## 2. What I ran, and what it actually said

All commands from a clean `npm install` at the repo root.

| Check                      | Result       | Notes                                                                  |
| -------------------------- | ------------ | ---------------------------------------------------------------------- |
| `npm run lint`             | ✅ pass      | clean                                                                  |
| `npm run typecheck`        | ✅ pass      | all three workspaces                                                   |
| `npm run format:check`     | ✅ pass      | clean                                                                  |
| `npm test`                 | ✅ pass      | engine + etl: 29 files / **230 tests**; app: 30 files / **150 tests**  |
| `npm run build`            | ✅ pass      | with a Vite chunk-size warning — see §3.6                              |
| `npm run e2e` (Playwright) | ⚠️ **flaky** | 7 tests. **Failed on the first full-suite run**, passed on four reruns |

The §1.4 check list is therefore green **except** for E2E, which is not green in
the sense that matters: it is intermittently red. See §3.1.

**Process note.** `npm test` does not include E2E — Playwright is a separate
`npm run e2e`. §0.3's definition of done says "the test suite passes", and a
stage run against `npm test` alone would never have exercised the E2E specs at
all. That is how the §3.1 flake reached `main` unnoticed.

---

## 3. Findings

Ordered by how much they'd cost to leave. Each names the file, what is wrong,
why it matters, and the fix I'd make.

### 3.1 — The plot-export E2E test is racy and intermittently fails ⚠️ **fix before deploy**

**Where:** `app/e2e/plot-export.spec.ts:16-58`

On the first full-suite run (with the Playwright `webServer` still building, so
the machine was under load) this failed:

```
Expected substring: "1 placed of"
Received string:    "Kale: 2 placed of 16 the plot can hold (2.6667 per m²)"
```

It then passed on three isolated reruns and two further full-suite runs. So:
real, load-sensitive, and it will fail again on a slower or busier machine.

**Root cause** — a genuine missing synchronisation in the test, not a bug in the
app. The loop does:

```ts
await searchBox.fill(crop); // filter the palette
const source = page.getByLabel(/drag .* onto the plot to place it/i).first();
```

The locator is a **wildcard** plus `.first()`. Playwright's auto-waiting waits
for the locator to resolve to _something visible_ — and a stale entry from the
**previous** search term is something visible. If React hasn't re-rendered the
palette yet (it ranks 162 plants per keystroke), the third drag grabs the
still-rendered _Kale_ entry instead of _Lettuce_. That is exactly the observed
failure: Onion 1, Kale 2, Lettuce 0.

There is a second, quieter fragility in the same line. Searching `Kale` matches
four crops (`Kale`, `Lacinato Kale`, `Red Russian Kale`, `Sea Kale`) and
`Onion` matches six. `.first()` picks whichever the **suitability ranking**
happens to put first — so a future change to `rankPlants`' tie-break could
silently change which crop this test places, without the test noticing.

**Fix.** Make the locator name the crop, which fixes both problems at once —
it is unique, and Playwright will genuinely wait for it because a stale Kale
entry no longer matches:

```ts
async function dragOntoCanvas(page: Page, crop: string, targetX: number, targetY: number) {
  const source = page.getByLabel(new RegExp(`^drag ${crop} onto the plot to place it$`, 'i'));
  const sourceBox = await source.boundingBox();   // waits for visibility
  ...
}
```

(The palette's label is `` `drag ${plant.commonName} onto the plot to place it` ``
— `PlantPalette.tsx:189` — so an anchored regex distinguishes `Kale` from
`Lacinato Kale` cleanly.)

**Also worth doing:** add a root `test:all` script that runs unit + E2E, so
§0.3's "the test suite passes" is a single command that means what it says.

### 3.2 — `vite.config.ts` states the opposite of what the build does ⚠️ **fix before deploy**

**Where:** `app/vite.config.ts:62-72`

The comment justifying the `workbox.globPatterns` change says crop icons

> "are imported with Vite's `?url` query, **which always emits a separate hashed
> asset file rather than inlining, regardless of size** — so `dist/` ends up with
> real `.svg` files the default pattern doesn't match. **Confirmed by inspecting
> a production build's `dist/` output** and the generated `sw.js` precache
> manifest."

That is false, and I confirmed it against a real build:

- `dist/` contains **zero** crop `.svg` files. The only two SVGs are
  `pwa-icon.svg` and `maskable-icon.svg`, which come from `app/public/` and are
  already covered by `includeAssets`.
- The JS bundle contains **163 `data:image/svg` URIs** — every crop icon plus
  the generic fallback, base64-inlined. `?url` does _not_ defeat Vite's
  `assetsInlineLimit`; only `?no-inline` does.
- `dist/sw.js`'s precache manifest has **9 entries**, none of them a crop icon.

**The good news:** ADR 0022 gets this exactly right (lines 50-73: "**no separate
crop-icon `.svg` files**… they're inlined as `data:` URIs… the glob change is
deliberately a safety net"). So the _decision_ is sound and the _offline
behaviour is correct_ — the icons ship inside the precached JS bundle.

The problem is that the code comment and the ADR it points at say opposite
things, and the code comment is both the false one and the one a contributor
reads first. §0.2 exists precisely to stop this. Rewrite the comment to match
ADR 0022: the `svg` pattern is a safety net for a future icon that grows past
the inline threshold, not something today's build needs.

### 3.3 — The export legend repeats a line per placed _instance_, not per crop

**Where:** `app/src/canvas/export.ts:64-71`, pinned by `export.test.ts:37`

`buildLegendText` emits one `- <crop name>` line per element of `placements`.
Place 60 onions and the legend is 60 identical `- Onion` lines. Because
`compositeExportCanvas` sizes the panel from the line count
(`legendHeightPx = padding*2 + lines.length * lineHeight`, `export.ts:145`), the
exported PNG also grows to ~1,300 px of repeated text.

Stage 3.7's deliverable is "a **key** naming the chosen crops"; `DESIGN.md` §1
says "a key naming the chosen crops". A list with sixty identical rows is not a
key.

**This is a case where the test is the problem.** `export.test.ts:37` asserts
`toEqual(['- Onion', '- Kale', '- Onion'])` — it deliberately pins the
duplication. The test is well written and passes; it just guarantees the wrong
specification. Worth calling out explicitly given the question asked: green here
is not assurance.

**Fix.** Group by plant id and show a count, reusing the grouping that already
exists (`canvas/feedback.ts#computePlacementTally`), so the legend reads
`- Onion × 12`. Update the test to match.

### 3.4 — Overcrowding never considers crops _together_

**Where:** `app/src/warnings/placement-derivation.ts:61-71`, ADR 0018

`deriveOvercrowdingPlacements` gives every crop `region = the whole plot` and
`count = instances of that crop`. Each crop is therefore checked against the
plot's capacity **for that crop alone**. A user can place 60 onions (the plot's
full onion capacity) _and_ 8 kale (its full kale capacity) and be told nothing —
the plot is at 200% and silently fine.

`canvas/feedback.ts:28` acknowledges this in a field comment ("independent of
what else is placed"), but ADR 0018 does not discuss it and the user never sees
it. Given `DESIGN.md` §1.4 promises a warning when plants are "too closely
spaced", this is the one place the app makes a horticultural claim it cannot
actually back.

**Fix (smallest honest option).** Don't build a cumulative packing model — that
is a real design problem and out of scope here. Instead record the limitation in
ADR 0018 under a "Known limitations" heading, and consider a cheap
area-budget check in the warnings panel (sum of `placedCount × areaPerPlantCm2`
versus `regionAreaCm2`) as a separate, clearly-labelled advisory. Flagging this
now matters because the app is about to be public.

### 3.5 — Dataset-size claims went stale when Stage 1.7 landed

Stage 1.7 took the dataset from 160 to 162 crops but did not refresh the
downstream comments that quote its shape. The actual figures today are
**162 records: 153 `row` only, 9 `row` + `intensive`, 0 `intensive` only.**

The load-bearing one:

- `packages/engine/src/spacing/method.ts:8-16` — the "What the shipped data
  actually looks like" table still reads `160 / 151 / 9`. This is a _factual
  data claim_ used to justify the fallback rule, so it should be right.
- `packages/engine/src/spacing/method.ts:126` — "151 of 160 shipped crops".

Cosmetic but worth a sweep while you're there: `suitability/model.ts:20`,
`hardiness.ts:9`, `soil.ts:21`, `season.ts:24`, `warnings/suitability-rules.ts:13`,
`icons/resolveIcon.ts:29`, `docs/architecture.md:146,390,401,414`.

The `WORKPLAN.md` progress table also still says Stage 1.4 left "85 companion +
6 antagonist links"; the shipped artifact now has 85 companion and **8**
antagonist links (the curated crops added two).

**Not stale, and correctly so:** `suitability/dataset.test.ts:70` says "the 160
records with light data only" — that is 162 minus the 2 curated, and is right.

### 3.6 — Nothing budgets the thing that actually ships

**Where:** `app/src/icons/budget.test.ts`

The budget test measures **source `.svg` files on disk** (122 KB against a
250 KB cap). But per §3.2 those files never ship as files — they ship
base64-inlined, which costs roughly 4/3 of their bytes (~163 KB) inside the JS
bundle.

Meanwhile the thing a user actually downloads has no budget at all:

```
dist/assets/index-CImMNreX.js   1,108.56 kB │ gzip: 263.77 kB
(!) Some chunks are larger than 500 kB after minification.
```

One 1.1 MB chunk, and Vite warns about it on every single build. For a PWA whose
whole pitch is "works in a garden with no signal", first load before anything
renders is 264 KB gzipped. It is _correct_ — everything is precached, offline
works — but it is the efficiency finding of this review.

**Fix.** Either raise a deliberate budget on built bundle size (and record the
number), or split the dataset/icons out of the main chunk via `manualChunks` so
the app shell paints before 1.1 MB has parsed. At minimum, adjust the budget
test's docstring so it does not imply it is guarding the shipped payload.

### 3.7 — A property test can be silently disarmed

**Where:** `packages/engine/src/spacing/properties.test.ts:76-80`

```ts
const { inRowCm, betweenRowCm } = spacing.row ?? { inRowCm: 0, betweenRowCm: 0 };
...
return areaCm2 / (inRowCm * pitch);
```

If a spacing without a `row` block is ever added to `SPACINGS`, this returns
`Infinity` and `expect(count).toBeLessThanOrEqual(Infinity)` passes for
everything — the area upper-bound property, the strongest test in the engine,
becomes vacuous with no failure to signal it.

Every entry in `SPACINGS` has `row` today, so this is latent, not live. But it
is exactly the failure mode the prompt asked about. **Fix:** throw on the
missing-`row` case rather than defaulting to zero, or derive the bound through
`resolveLatticeSpacing` so intensive spacings are handled properly.

### 3.8 — The GBIF join key is inert (0 of 162 records resolved)

Every record in `data/plants.json` has `gbifId: null`. ADR 0005 designed the
GBIF resolver as _the_ cross-source join key, and `NOTICE` is honest that GBIF
is unreachable from the build sandbox.

This costs nothing today because OpenFarm is the only full-plant source, so the
merge falls through to slug/alias matching (`merge/join.ts`) and works. It
becomes load-bearing the moment Stage 1.2's deferred PFAF and Permapeople
adapters land — merging two sources on slug aliases alone is a much weaker
guarantee than merging on a taxonomic id.

**No fix needed now.** Worth recording in the Stage 1.2 brief so whoever picks
up the remaining adapters knows the join key they are relying on has never been
exercised against real data.

### 3.9 — Stage 1.2 is still ⚠️ partial, and it is why 3 of 4 scoring dimensions are inert

Not a defect — the progress table is honest about it — but it deserves stating
plainly at the deployment boundary, because it is the largest gap between
`DESIGN.md`'s promise and what will be hosted.

`DESIGN.md` §1 promises scoring on "light match, hardiness vs. the location's
climate, soil match, and season". In the shipped dataset:

| Dimension | Records carrying data                                                        |
| --------- | ---------------------------------------------------------------------------- |
| light     | 162 / 162 (but only **two distinct values**: 148 full-sun, 14 partial-shade) |
| hardiness | 2 / 162                                                                      |
| soil      | 2 / 162                                                                      |
| seasons   | 2 / 162                                                                      |

So the ranked palette is, in practice, a **two-tier sort on light**, plus two
curated crops that sit above it. The engine is built for four dimensions and is
scrupulously honest about the gap (the confidence-shrinkage model, the "Scored
on light alone" summaries, and `suitability/dataset.test.ts` pinning exactly
this) — that honesty is a genuine credit to Stage 2.1.

But a visitor to the deployed site will see a "ranked, suitability-scored
palette" that is mostly sorting by one field with two values. The unblocker is
Stage 1.2's remaining adapters (PFAF carries hardiness and soil; Permapeople
carries light and growth characteristics), not anything in the engine.

**Recommendation:** say so on the deployed site or in the README's status
section, and treat finishing Stage 1.2 as the highest-value remaining data work
— higher than anything in Phase 6.

---

## 4. Are the tests designed so a pass means something?

Mostly **yes**, and in the engine, emphatically yes. Specifics, since this was
asked directly:

**Genuinely strong:**

- **`suitability/dataset.test.ts`** is the best test file here. It runs against
  the _real shipped artifact_, and it explicitly guards the failure mode the
  Stage 2.1 brief warned about — "it is easy to build a beautiful four-dimension
  scorer that returns the same number for every record" — by asserting the exact
  set of distinct ranking scores (`[0.9, 0.87, 0.675, 0.5525]`). A scorer that
  collapsed would fail loudly. It also pins dataset coverage itself
  (`hardiness !== undefined` → exactly `['broad-bean', 'jerusalem-artichoke']`),
  so a data change cannot quietly invalidate the expectations.
- **`spacing/properties.test.ts`** computes the area upper bound
  _independently from the inputs_ rather than reading it off the result, so it
  is a real check and not a restatement. The module doc is careful to say which
  properties are theorems and which are empirical sweeps — that distinction is
  rarely made and it is correct here.
- **The "known limitation" comb test** (`properties.test.ts:231-280`) pins a
  case where the algorithm gives a _worse_ answer for a bigger plot, and
  explains why that trade was made. Testing your own weakness is the sign the
  suite is honest.
- **`spacing/fit.test.ts`** golden cases carry the arithmetic in the comments
  (`floor(200/10) × floor(100/30) = 60`), so a failure tells you which step of
  the model broke, and the tests double as the documentation §1.2 asks for.
- **`merge/validate.test.ts`** hits all four gate layers _including_ "collects
  ALL issues, not just the first", and `build-dataset.test.ts` verifies the
  build fails loudly on an intentionally-broken curated record — which is Stage
  1.5's and Stage 1.7's stated verification bar, met literally.
- **`e2e/offline.spec.ts`** is a real offline test, not a simulation: it waits
  for `navigator.serviceWorker.controller`, goes offline, reloads, and re-runs
  the full drag-a-crop journey. A pass genuinely means the app works with the
  network off.

**Where a pass is worth less than it looks:**

1. **`export.test.ts:37`** pins the wrong specification (§3.3). Green, correct
   about the code, wrong about the product.
2. **`properties.test.ts:76`** can be silently disarmed (§3.7).
3. **`budget.test.ts`** measures bytes that are not the bytes that ship (§3.6).
4. **`plot-export.spec.ts`** is racy (§3.1) — and a flaky test is worse than no
   test, because a red run trains people to rerun rather than look.
5. **A note on the "60 random polygons" test** (`properties.test.ts:101`): the
   PRNG is seeded, so this is 60 _fixed_ cases, not 60 random ones. That is the
   right call for reproducibility and the comment says so — but it means the
   suite explores no new inputs over time, and `randomPolygon` only generates
   **star-shaped** rings. Non-star-shaped non-convexity is covered only by the
   two hand-built cases (the L-shape and the comb). Not a defect; just the
   accurate size of the assurance.

**Coverage gaps worth knowing:** `useCanvasWarnings.ts`, `useCanvasDropHandler.ts`
and `WarningsSection.tsx` have no direct tests. ADR 0017 sets that precedent
deliberately (thin glue, covered via the page and E2E) and I think it is
defensible — but it does mean the E2E specs are load-bearing for those paths,
which raises the cost of §3.1's flake.

---

## 5. Adherence to the objective, and to the workplan's own rules

**Held well:**

- **The static/offline constraint (§0.1) is respected everywhere.** No runtime
  fetches; the dataset is a JSON module compiled into the bundle; icons are
  bundled assets; the ETL is genuinely a separate workspace that the app never
  imports. The one network-touching thing (`climate/geocode.ts`) is optional
  progressive enhancement, as specified.
- **Engine/UI separation is real.** `packages/engine` has one dependency (zod)
  and no React anywhere. Every engine module doc ends with the "Framework-free:
  no React, no DOM (WORKPLAN §0.2)" line — a small discipline, consistently kept.
- **The no-CI rule (§1.4) has been honoured.** There is no `.github/workflows/`,
  and the Stage 5.2 brief goes out of its way to warn the next session that
  §1.4 overrides the older per-stage wording. That is exactly the hand-off
  discipline §0.6 asks for.
- **Hand-off discipline (§0.6).** 24 stage briefs, 22 ADRs, a complete ADR
  index. `docs/stage-5.2-brief.md` exists and is thorough. No stage skipped it.
- **Licensing (§0.5) is handled with real care.** `NOTICE` is notably honest —
  it states plainly that CC BY-NC-SA is _not_ compelled by the sources currently
  shipped (OpenFarm is CC0) and that PFAF is unreachable, then explains why the
  stricter licence is kept anyway. That is the right instinct.
- **Commenting (§0.2) is the standout.** Comments explain intent and reasoning,
  not the code. `packing.ts`'s derivation of the hexagonal `√3/2` pitch, with
  both guard cases worked through, is documentation a newcomer can actually
  learn from — which is the stated goal.

**Gaps against the plan:**

- Stage 1.2 remains partial (§3.9) — flagged in the table, but its downstream
  consequence for the scoring engine is not.
- §0.3 requires the test suite to pass; E2E is outside `npm test` (§2).
- Stage 1.7 did not refresh the docs its data change invalidated (§3.5), which
  §0.2's "update docs as part of the stage, not later" asks for.

---

## 6. Recommended order of work

**Before Stage 5.2 ships the site:**

1. §3.1 — fix the racy export E2E (crop-specific locator). ~10 lines.
2. §3.2 — correct the `vite.config.ts` comment to agree with ADR 0022. ~6 lines.

**Alongside or shortly after 5.2:**

3. §3.5 — refresh the stale 160/151 figures, starting with `method.ts`.
4. §3.3 — group the export legend by crop, and update its test.
5. §3.7 — make the property test's upper bound fail loudly instead of vacuously.
6. §3.4 — record the cumulative-overcrowding limitation in ADR 0018.
7. Add a root `test:all` script covering unit + E2E.

**Deferred, but decide consciously:**

8. §3.6 — bundle-size budget or `manualChunks`.
9. §3.9 — finish Stage 1.2's adapters; it is the highest-value remaining work in
   the whole plan, because it is what makes the suitability engine mean something.

---

## 7. One-line verdict

Green on every automated check except an intermittently-failing export E2E;
architecturally sound with sound ADRs; unusually well commented; and honest
about its own data gaps almost everywhere — the exceptions being one code
comment that contradicts its own ADR, and a legend specification that its test
locks in rather than checks.
