# 0025 — Pruning the crop list: delete the crops Britain can't grow, keep the reasoning

- **Status:** Accepted
- **Date:** 2026-07-27
- **Workplan stage:** 6.0 — fill the data gaps that actually matter (crop-list half)

## Context

The shipped dataset descends from a community rescue of OpenFarm, a general
North-American growing wiki (ADR [0006](./0006-openfarm-source-adapter.md)).
`DESIGN.md` sets **Britain** as this app's default, and the suitability engine
ranks crops against a British plot — but the catalogue it ranks was never
curated for one. Of the 162 crops shipping before this stage, roughly a fifth
were things a British gardener cannot grow outdoors at all: dragon fruit,
papaya, pineapple, star fruit, two strawberry guavas, olive, grapefruit, orange,
lemongrass, ginger, okra, peanut and more.

That is not a cosmetic problem. The plant palette is the one list the whole app
is a way of searching, and `docs/review-pre-deployment.md` §3.9 had already
found the ranking to be close to a two-tier sort on light. A ranked list whose
top tier includes crops that cannot survive the plot is worse than an unranked
one: it spends the user's trust on a recommendation that is wrong in a way they
can check.

`WORKPLAN.md`'s Stage 6.0 entry left one question explicitly open, and it is the
question this ADR answers: **does "prune" mean deleting the records, or flagging
them?** It also handed over the fact that makes the answer safe — Stage 3.6's
in-app add-crop form (ADR [0011](./0011-user-defined-crop-schema.md)) means a
user can add any crop back by hand, in the browser, in about thirty seconds.

## Decision

### 1. Delete, don't flag

An excluded crop does not reach `data/plants.json` at all. There is no
`notViableOutdoorsUK` field, no filter toggle, no greyed-out row.

The case for flagging is real and worth stating: it preserves information, and a
user in a heated greenhouse — or in Cornwall, or in another country entirely,
since this is open source and forkable — might genuinely want papaya. But
"flagging" is not one change; it is at least four:

1. a new optional field on `PlantSchema`, which is the project's keystone schema
   (ADR [0004](./0004-plant-schema.md)) and its most expensive thing to change;
2. a rule somewhere in the suitability model deciding what the flag does to a
   score — and the model's whole design is that **missing data is excluded, not
   defaulted** (ADR [0012](./0012-suitability-scoring.md)), which a "this is
   impossible here" flag sits awkwardly against;
3. UI to surface it, or the flag means nothing to anyone;
4. a decision about what the flag is relative to — "not viable outdoors in the
   UK" is a claim about a _location_, and the app already has a location model
   (ADR [0010](./0010-location-climate-static-data.md)) that this flag would
   either duplicate or contradict.

The brief for this stage was explicit that touching `packages/engine/src/schema/`
would be a much bigger decision than this stage scopes for, and it is right.
Weighed against a session-only, thirty-second, already-built undo, that is a
large amount of machinery to buy an outcome the user can already reach.

There is also a quieter argument for deletion, which is that it is **honest
about what this dataset is**. A crop list curated for British outdoor growing is
a clear, defensible thing. A crop list that includes pineapple with an asterisk
is claiming a generality the rest of the data does not have — every spacing
figure, every moisture judgement and every hardiness rating in here is already
British-outdoor-specific (`packages/etl/src/moisture/table.ts` says so in its own
module doc).

### 2. Keep the reasoning in version control, in its own slice

Deletion's real cost is not the lost record — it is the lost _judgement_. A
maintainer six months from now would see only an absence and have to re-derive
why. So the exclusions live in `packages/etl/src/exclusions/` as data, not as a
one-off commit that removed some lines: one row per crop, each with its id, its
common name, the ground it fails on, and a sentence of horticultural reasoning a
reader can disagree with.

This mirrors the two curation slices already in the merge — the hand-verified
spacing table (ADR [0007](./0007-hand-verified-spacing.md)) and the curated
moisture table — in shape, in evidence bar (a required `note` rather than
citations; see the module doc for why that is right for a judgement rather than
a figure), and in wiring: original curation keyed to a crop id, folded into the
Stage 1.5 merge, deliberately **not** a `SourceAdapter`.

### 3. The test, stated so it can be argued with

> In an average British summer, can this crop give a usable harvest outdoors, in
> an open garden or allotment, with no greenhouse, polytunnel or heated
> protection?

Every clause does work. _Average_ rules out the crop that fruits once a decade.
_Usable harvest_ rules out the tree that grows happily and never ripens
anything — this is a planner for edibles, so a plant you cannot eat is not a
crop. _No protection_ is what keeps the test decidable: once greenhouses are in
scope, almost nothing is excluded and the list becomes arbitrary.

Twenty-four crops fail it, on two grounds:

- **`too-tender` (12)** — a British winter, or an ordinary British night, kills
  it, and it cannot be grown to a harvest as a summer annual either. Tropical
  perennials needing a full year of warmth: dragon fruit, papaya, pineapple,
  star fruit, both strawberry guavas, grapefruit, orange, lemongrass, ginger,
  water spinach, olive.
- **`wont-ripen` (12)** — it survives outdoors perfectly well and never gives
  you anything: okra, peanut, black-eyed pea, cumin, the three melons, loquat,
  pomegranate, persimmon, feijoa, pawpaw.

### 4. Where in the merge, and what happens to the links

The exclusion step runs **after** curated plants are folded in and **before**
anything joins onto a plant (`merge.ts` step 0b). Both halves matter:

- Running it after the fold-in makes the rule about the **shipped id**, not
  about a record's source. A curated record with an excluded id would go too.
  There is one rule and one place it is enforced.
- Running it before the joins means the existing referential-integrity machinery
  handles the fallout with no special case. Nine companion links pointed at, or
  were owned by, an excluded crop (pea↔orange, cabbage↔cumin, mint↔pomegranate,
  rosemary↔olive, and one-directional links from black-eyed pea and peanut).
  Every one was dropped with a stated reason by the same code that has always
  dropped links to plants that don't exist — no hand-editing of
  `companions/curated.ts`, no dangling references, and the merge report shows
  exactly what went.

An exclusion row matching nothing is **reported, not thrown**, exactly like an
unattached spacing or moisture row: it means the curation has drifted from the
source data, which is a maintainer's problem to notice (and
`exclusions/table.test.ts` fails on it) rather than a reason to break the build.

## Alternatives considered

- **Flag rather than delete.** Discussed above: four changes including one to
  the keystone schema, against an undo the app already ships.
- **Remove the slugs from `sources/openfarm/categories.ts` instead.** That is
  the allow-list deciding which OpenFarm records become `Plant`s at all, so
  deleting the entries there would achieve the same shipped result with fewer
  new files. Rejected because it conflates two different judgements: that table
  answers "is this record a mappable edible?", and its module doc is explicit
  that its exclusions are about ornamentals, cover crops and scrape artefacts.
  "Pineapple is a real edible we can map, but not one you can grow here" is a
  different claim, deserving a different home and a stated reason.
- **De-prioritise rather than remove** — keep the records but rank them last.
  Rejected as the worst of both: the schema and UI work of flagging, plus a
  ranking the engine can't justify from data, plus the crops still cluttering
  the palette's search results.
- **Prune the cultivar padding too** (four onions, three cauliflowers, three
  carrots, four radishes, seven squashes, six peppers). Deliberately out of
  scope: every one of those grows here perfectly well, so removing them would be
  a _tidiness_ decision on entirely different grounds. Worth doing one day, with
  its own argument; not smuggled into this one.
- **Pad the list to the ~32 the workplan estimated.** The estimate was made
  without enumerating. Working the actual catalogue against the stated test
  lands on 24, and the difference is crops British gardeners really do grow
  outdoors, awkwardly but successfully — aubergine, chillies, sweet potato, soya
  beans, cape gooseberry, tomatillo, the tender herbs. Marginal is exactly what
  a suitability score is for; hiding those would be the app answering a question
  it should be ranking.

## Consequences

- **`data/plants.json` goes from 162 crops to 144** — 24 removed, six British
  staples added through the Stage 1.7 curated channel (`apple`, `pear`,
  `raspberry`, `brussels-sprouts`, `swede`, `pumpkin`). The two halves are one
  judgement about what belongs in a British planner's crop list.
- **The dataset's pinned coverage tests all moved**, which is how we know the
  change reached the engine: light 144/144 (133 full-sun, 11 partial-shade),
  soil 80/144, hardiness and seasons 8/144, companion links 76 on 50 records.
  They were re-pinned to the new real numbers, not loosened.
- **The ranking's top eight places are now decided by data.** Before this stage
  a sunny plot produced four distinct scores; it now produces six, and the first
  eight crops are ordered by hardiness and season rather than by the alphabet.
  That is still 8 of 144 records — this stage did not close the hardiness/season
  gap and was not meant to.
- **Nothing else in the pipeline needed to know.** The moisture table had never
  written a row for an excluded crop (its own module doc explains why it skipped
  the tropicals), the spacing table never covered one, and the icon set follows
  the dataset automatically once `tools/icons/classification.ts` is updated.
- **Adding a crop back is a one-line change in either direction** — delete its
  row from `EXCLUDED_CROPS` to restore an OpenFarm-sourced record, or write a
  `CURATED_PLANTS` entry to add something new. A user who just wants it in their
  own browser needs neither, and can use the in-app form.
- **The exclusion list is a claim that will age.** British summers are getting
  warmer, and some of the `wont-ripen` twelve — feijoa and persimmon are the
  likeliest — may become genuinely growable here. That is a good reason to have
  written the reasoning down next to each id rather than only in a commit
  message.
