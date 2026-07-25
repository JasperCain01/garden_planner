# 0012 — Suitability scoring: the weighting model, the missing-data policy, and how reasoning is represented

- **Status:** Accepted
- **Date:** 2026-07-25
- **Workplan stage:** 2.1 (⭐ keystone) — suitability scoring engine

## Context

`DESIGN.md` §1 promises that the app "scores every plant in its database against
the plot's conditions and presents a filtered, ranked palette", and that it can
explain _why_. Stage 2.1 builds that brain: pure, framework-free functions in
`packages/engine/src/suitability/` that turn a `Plant` plus a plot's growing
conditions into one ranked, explainable result.

Three questions had to be settled, and only the first is the obvious one:

1. **How the four dimensions combine** — light, hardiness, soil, season into one
   number (`DESIGN.md` §"The two calculations that make it useful").
2. **What happens when a dimension has no data.** This is the decision that
   dominates the stage, because of what the shipped dataset actually looks like.
3. **How the reasoning is represented**, given that it is a deliverable the UI
   renders (Stage 3.3's palette) and a foundation Stage 2.3's warnings engine
   builds rules on — not a debug aid.

### The constraint that shaped everything: the data is sparse

`data/plants.json` as it ships today (160 records, Stage 1.5):

| Field       | Coverage                                                                      |
| ----------- | ----------------------------------------------------------------------------- |
| `light`     | **160/160** — but only _two_ distinct values (146 full-sun, 14 partial-shade) |
| `hardiness` | **0/160**                                                                     |
| `soil`      | **0/160**                                                                     |
| `seasons`   | **0/160**                                                                     |

So three of the model's four dimensions have **no data at all** in the shipped
records, and the fourth has two values. A four-dimension scorer that defaults
absent data to a constant returns very nearly the same number for all 160 plants
— a ranked palette in which nothing is meaningfully ranked. That was the failure
mode to design against.

Two things stop this being a reason to build a light-only scorer instead: a
**user-defined crop can supply hardiness, soil and seasons today** (ADR 0011 —
the form offers all three), and Stage 1.7's curated records are expected to. The
policy therefore has to be **per record**, not a global "we have no hardiness
data".

## Decision

### 1. Score scale: every score is a 0–1 fraction

Per dimension and in aggregate. 1 means "the plot gives this crop what it asks
for"; 0 means "this crop cannot work here" and is reserved — only a dimension
returning exactly 0 can disqualify a crop (§4). Percentages, 0–100 integers and
letter grades were all rejected as presentation choices the UI can make from a
fraction; the engine's job is the number, not its formatting.

### 2. Weighted mean, with weights ordered by what a gardener _can't change_

| Dimension   | Weight | Why                                                                                                                                                                                        |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `light`     | 0.35   | Fixed by walls, fences and neighbours' trees. Also the only dimension with real coverage, and the one the user always supplies.                                                            |
| `hardiness` | 0.30   | The region's winter is not negotiable, and frost loss is total rather than a poor yield. Below light because much British growing is annual — a tender crop can still be worth one summer. |
| `soil`      | 0.20   | Genuinely important, but the condition a gardener _changes_: grit, compost, lime, raised beds, irrigation.                                                                                 |
| `season`    | 0.15   | The softest, because it is a question of _when_, not _whether_. "Sow in March, not July" is advice you act on by waiting.                                                                  |

The weights are a horticultural judgement, not a statistical fit — there is no
labelled dataset of "plants that did well in this plot" to fit against, and
pretending otherwise would be false precision. They live in one exported
constant (`DIMENSION_WEIGHTS`, `model.ts`) so the whole model can be re-tuned in
one place, and they sum to 1 so a weight doubles as "the share of confidence
this dimension is worth" (§3).

### 3. The missing-data policy: exclude, then report the gap as _confidence_

**A dimension with no data scores `null` and takes no part in the weighted
mean.** It is not defaulted to 1, not to 0, not to 0.5. This is the core
decision, and it produces three numbers rather than one:

- **`score`** — the weighted mean over the dimensions that _could_ be assessed:
  "given what we know, how well does this crop fit?"
- **`confidence`** — the share of the model's total weight that was assessable.
  Every shipped record today scores `confidence: 0.35`, because light is all
  there is. The information lost by excluding a dimension is thus **reported**,
  not buried.
- **`rankingScore`** — `score` shrunk towards a neutral prior of 0.5 in
  proportion to what is missing:
  `rankingScore = score × confidence + 0.5 × (1 − confidence)`.

That last line is where "absent must not silently mean perfect match or total
mismatch" becomes an actual number. Worked through:

- A crop with only light data, perfectly matched, scores `1.0` on the evidence
  but ranks `0.675` — it **cannot** reach the top on one lucky dimension, and it
  bands as `good` rather than `excellent`. A fully-described crop matching on all
  four ranks `1.0` and takes the top spot.
- The same sparse crop in a plot one step too shady scores `0.45` on the evidence
  but ranks `0.4825` — pulled _up_, because three unrecorded facts are not
  evidence against it.

Ranking and banding both use `rankingScore`, so the palette can never show an
"excellent" crop below a "good" one.

**The two kinds of unknown are distinguished**, because the remedy differs:
`unknown-plant` (our data doesn't say — the common case) versus `unknown-plot`
(the _user_ didn't say, e.g. soil left blank, which the UI can ask about).

**And it is said out loud.** Every result's `summary` names what was missing:

> Good match — Wants full sun, and the plot is in full sun. Scored on light
> alone — no hardiness, soil or season data for this crop (confidence 35%).

### 4. A hard mismatch caps the result: Liebig's law of the minimum

A plain weighted mean lets three good dimensions outvote one fatal one: a
full-sun crop in a deep-shade bed with perfect soil, hardiness and timing would
average 0.65 — a respectable "good" for a crop that will not crop.

So: **if any dimension's finding is `unsuitable` (score exactly 0), both `score`
and `rankingScore` are capped at 0.2 and the band is forced to `unsuitable`**,
with the offending dimensions listed in `limitedBy`. The cap sits below the
`poor` band's floor (0.25), so a capped result always sorts beneath every
uncapped one.

It is a **cap, not a veto** (dropping the crop, or scoring it 0) because the
palette should still be able to show the crop greyed out _with the explanation_,
and because Stage 2.3 turns exactly these results into warnings. Callers who want
them gone pass `rankPlants(…, { excludeUnsuitable: true })` — which is also how
the Workplan's "no matching plants" edge case arises honestly: an all-shade plot
against today's dataset returns exactly the 14 shade-tolerant crops, and against
a full-sun-only list returns an empty array.

Which dimensions may return 0 is itself a decision:

- **Light** may (deficit of two steps): you cannot add sun to a shaded bed.
- **Hardiness** may (three or more RHS bands short): the crop dies in winter.
- **Soil never does.** Soil is the condition a gardener changes; a wrong soil is a
  job, not a barrier. Its worst score is 0.3.
- **Season never does.** Wrong timing is fixed by waiting. Its floor is 0.2.

### 5. Per-dimension rules, and one asymmetry worth naming

- **Light** — signed distance between the plot's level and the crop's need, via
  the ordered enum's `lightRequirementRank` (ADR 0004 §4). Deliberately
  asymmetric: one step _too shady_ scores 0.45 and two steps scores 0, while one
  step _too sunny_ scores 0.65 and two steps 0.15. You can shade, mulch and water
  a sunny bed; you cannot light a shaded one.
- **Hardiness** — RHS bands when both sides carry one (no conversion: a plant and
  a `ClimateProfile` share `HardinessSchema` verbatim, ADR 0010 §1), falling back
  to the portable `minTempC` figures. Being _hardier_ than the region needs is
  never rewarded or penalised. If the two sides have no representation in common,
  the dimension is unknown rather than converted — a band↔°C conversion would
  invent precision.
- **Soil** — a membership test per facet (the plot has one texture; the crop
  lists the textures it tolerates), averaged over the facets **both** sides
  describe. pH bands are treated as **unordered**: ADR 0004 promises a meaningful
  ordering only for `light` and `rhsRating`, and inferring one from another
  enum's declaration order would silently couple this scorer to an array literal.
- **Season** — with a `plantingMonth`, "can I sow this now?" against the crop's
  sowing windows (in-window 1, one month either side 0.6, otherwise 0.2). Without
  one, "does this crop's window fit this region at all?", scored against the
  growing season **widened by two months either side**. The widening is not
  padding: `growingSeason` is the _frost-free_ window (May–October for the UK
  default), while British gardeners sow from March under cover and lift roots and
  brassicas into winter — scoring sowing dates against the frost-free window
  alone would mark ordinary March sowings as out of season.

### 6. Reasoning is a `finding` **and** a sentence, per dimension

Every `DimensionScore` carries a machine-readable `finding` from one closed
vocabulary (`match` / `marginal` / `mismatch` / `unsuitable` / `unknown-plant` /
`unknown-plot`) _and_ a human-readable `reason`. Stage 2.3 keys its warnings off
the `finding` and the `dimension`; it must never parse the prose. The aggregate
adds a one-line `summary` (band + the single most decisive reason + what could
not be assessed) for the palette's tooltip, with the four `reason` strings as the
expandable detail behind it.

Reasons explain rather than restate: "Wants full sun but the plot is in partial
shade — it will grow, more slowly and with a lighter crop", not "light: 0.45".

### 7. Inputs are zod; outputs are plain types

`PlotConditionsSchema` (light, optional soil, a resolved `ClimateProfile`,
optional planting month) and `PlotConditionsInputSchema` (the same with the
location still unresolved) are zod-first with `z.infer` types, reusing the Stage
0.2 enums verbatim — a plot's light level and a plant's light requirement are
_the same enum on purpose_. `resolvePlotConditions` is the boundary: it validates
and calls `resolveClimate`, so no scorer defends against malformed input.

Results (`DimensionScore`, `SuitabilityResult`) are **plain TypeScript
interfaces**. They are computed here and consumed here; nothing ever parses one
from untrusted input, so a validator would add ceremony without a guarantee —
the same reasoning ADR 0010 §6 used for keeping region centroids out of
`ClimateProfileSchema`.

A plot's soil is **singular** (one texture, one pH, one moisture) where a plant's
is **plural** (the values it tolerates). The asymmetry is real, and it is what
makes soil scoring a membership test.

### 8. Ranking is a total order, so it can't depend on input order

`rankPlants` sorts by `rankingScore` desc, then `confidence` desc (between two
crops the model rates equally, prefer the one we know something about), then
`commonName` and `id` ascending. Ids are unique, so the comparator is total: the
same set ranks identically however it arrived. Plain `<`/`>` rather than
`localeCompare`, which is ICU- and locale-dependent and would make the order vary
by environment.

## Alternatives considered

- **Default missing dimensions to 1 ("no news is good news").** Rejected: it
  makes every sparse record a perfect match, so all 160 shipped plants tie at the
  top and the ranked palette ranks nothing.
- **Default them to 0.** Rejected as the mirror image, and worse: it punishes
  crops for facts nobody has recorded, burying perfectly good crops beneath the
  handful that happen to be well documented.
- **Default them to 0.5.** The tempting middle. Rejected because it is
  indistinguishable, in the output, from a genuine half-match — the UI could not
  tell "we checked and it's marginal" from "we have no idea", and the promise to
  explain _why_ a crop ranked where it did would be unmeetable.
- **Renormalise the weights but rank on the raw evidence score** (i.e. drop the
  shrinkage). Simpler by one number, and it was the starting design. Rejected
  because a crop known only by its light would then tie exactly with a
  fully-described perfect match, which is the "absent means perfect" failure in a
  subtler form.
- **A single confidence-adjusted score, without exposing `score` and
  `confidence` separately.** Rejected: the UI needs the honest evidence score to
  say "perfect on everything we know" and the confidence to say "which isn't
  much", and Stage 2.3 needs both to decide whether a warning is worth raising.
- **Drop `unsuitable` crops instead of capping them.** Rejected: the palette
  should be able to explain a greyed-out crop, and Stage 2.3's "wrong light"
  warning needs the result to exist. Made an opt-in filter instead.
- **A veto (score 0) rather than a cap.** Rejected as lossy: capped results still
  order sensibly among themselves, which matters when _everything_ is capped (the
  all-shade plot) and the UI still has to show something in a useful order.
- **Score only light, until the data improves.** Rejected: user-defined crops can
  supply all four dimensions today (ADR 0011), so the model would be wrong for the
  very records users care most about, and Stage 1.7 would face a rewrite rather
  than a data drop.
- **Learn the weights from data.** No such data exists (no outcome labels), and
  inventing it would be false precision. The weights are documented judgement,
  changeable in one constant.
- **Treat `acid`/`neutral`/`alkaline` as ordered, scoring "one band out" above
  "opposite".** Rejected (§5): the schema promises ordering only where it exposes
  a rank helper, and with three bands the gain is negligible.
- **Put the month-range helpers in `schema/`.** Rejected: ADR 0004 explicitly
  says expanding a range into months is engine logic, not schema logic. They live
  in `suitability/month-range.ts` and are publicly exported for Stages 2.2/2.3.

## Consequences

- **The palette can rank today's dataset meaningfully, but only as far as the
  data allows.** In a sunny plot the 160 shipped records take exactly two
  distinct ranking scores — one per distinct light value. That is the ceiling the
  data imposes, and the tests assert the model reaches it rather than collapsing
  below it.
- **Every shipped record reports `confidence: 0.35`,** and says so in its
  summary. This is deliberately visible: it is a standing, user-facing argument
  for Stage 1.7's curated records, and `dataset.test.ts` will fail loudly when
  that coverage changes — a tripwire as much as a test.
- **Stage 2.3 has a stable contract**: `dimension` + `finding` + `limitedBy`,
  none of which requires parsing prose. The rules engine itself is deliberately
  not built here.
- **Scores are comparable only within one plot.** They are a fit between a crop
  and a set of conditions, not a quality rating of the crop; nothing should
  average them across plots or present them as an absolute.
- **Rounding to 4 decimal places** keeps results stable across platforms and
  readable in test expectations. It is far finer than any horticultural
  distinction the model can honestly claim.
- **Re-tuning is cheap; the shape is not.** Weights, band thresholds, the cap and
  the prior all live in `model.ts` and can be changed in one place. The three-
  number result shape (`score`, `confidence`, `rankingScore`) is the part later
  stages build on, and changing _that_ would be the expensive unwind.
- **The engine still touches nothing external**: no network, no clock (a planting
  month is passed in, never read from `Date.now()`), no DOM. It stays pure and
  unit-testable in isolation, and a test asserts the offline guarantee explicitly.
