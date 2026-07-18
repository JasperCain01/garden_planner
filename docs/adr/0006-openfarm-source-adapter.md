# 0006 — OpenFarm source adapter: why this dataset, and the mapping/caching design

## Status

Accepted (Stage 1.2).

## Context

Stage 1.2 (`docs/stage-1.1-brief.md`'s sequel — see `WORKPLAN.md`) implements
the first real `SourceAdapter` (`packages/etl/src/pipeline/source.ts`, Stage
1.1), establishing the pattern PFAF and Permapeople follow in later Stage 1.2
sub-stages. `DESIGN.md` §2 recommends OpenFarm as one of three growing-
requirement sources, and specifically as the easiest to start with: it names
OpenFarm's dump as already "a static, versioned dataset... still on GitHub" —
no live API, no rate limits, no key, a direct fit for this project's
fetch-once/cache-in-repo, offline-first pattern (`docs/adr/0003`).

Three questions had to be settled: **does that GitHub dump actually exist,
and if not, what's the honest alternative**; **how does a source with no
`category` field of its own satisfy the schema's required `Plant.category`
without guessing**; and **how does caching work for a source that's a single
static blob, not a per-query lookup like the GBIF resolver's cache**.

The code lives in `packages/etl/src/sources/openfarm/`.

## Decision

### 1. The dump `DESIGN.md` describes doesn't exist — a community rescue does

Checking `github.com/openfarmcc/OpenFarm` directly (its `db/seeds.rb`, its
sibling `openfarmcc/Crops` repo, its own issue tracker) turned up no committed
JSON dump. OpenFarm's real data lived in the live service's own database;
[people had been asking for a public dump since 2017](https://github.com/openfarmcc/OpenFarm/issues/940)
and never got one. The service was shut down in April 2025, and the repository
was archived — at which point, per the rescue project's own README, "the data
effectively stopped existing anywhere." `DESIGN.md`'s "the dump is still on
GitHub" was accurate about OpenFarm's _code_ repo existing, but the specific
claim about a data dump does not hold up — worth recording plainly rather than
quietly working around, the same honesty Stage 1.1's ADR (`0005`) applied to
GBIF being unreachable in a sandboxed session.

What does exist: [`thefullnacho/openfarm-crops-rescue`](https://github.com/thefullnacho/openfarm-crops-rescue),
a third-party project that scraped the Wayback Machine's latest capture of
every archived `openfarm.cc/en/crops/*` page (358 pages), parsed them into
340 structured JSON records, and hand-curated the result (13 junk/duplicate
entries pruned, binomial names cross-checked against GrowStuff, four typos
fixed). Every record carries the exact Wayback capture URL it was rebuilt
from, so any entry is independently auditable against the archived original.
It's CC0-1.0 — public domain, matching OpenFarm's own original licence (the
`NOTICE` file previously said CC BY-SA for OpenFarm; that was `DESIGN.md`'s
best guess before this stage confirmed the real number, and is corrected here).

This is a deliberate, documented substitution for the source `DESIGN.md`
named, not silent scope creep: same underlying OpenFarm content, recovered
rather than downloaded, with a stated provenance chain per record. The
rescue project's own README is blunt about the ceiling on data quality —
"treat this as a useful scaffold, not an authority... never use it for
edibility, foraging, or plant-safety decisions" — which this adapter respects
by using it only for structural growing data (sun, spacing) and never as the
basis for an edibility claim.

### 2. Category is a curated allow-list, not a guess

`Plant.category` (`vegetable`/`herb`/`fruit`) is **required** by the Stage 0.2
schema, and OpenFarm — a general growing-guide wiki, not edibles-only — has no
such field. Its 340 records mix genuine edibles with ornamentals
(`african-marigold`, `rose`, `morning-glory`), forage/cover crops (`alfalfa`,
`hairy-vetch`), ambiguous non-food-first crops (`cannabis`, `hops`), and
outright scrape junk (a page literally titled "Human Being" survived).
Inferring category from free text would be exactly the kind of silent
horticultural guess `WORKPLAN.md` §1.1 warns against shipping.

So `sources/openfarm/categories.ts` is a **hand-picked, bounded allow-list**:
162 slugs, each checked against the record's own name/binomial before
inclusion, spanning all three categories. This mirrors the judgement call
Stage 1.1's `starter-source.ts` made with its five-name demo list, just
larger because real source data was on hand to curate against. A crop absent
from the table is not mapped — it's skipped with a stated reason
(`map.ts`'s `mapOpenFarmCrop`), the same "never silently drop, never guess"
discipline the GBIF resolver applies to names it can't confidently place.
Extending coverage over the remaining ~180 records is worthwhile follow-up
curation, explicitly **not** attempted here — Stage 1.2's job is establishing
the pattern, not exhaustive coverage of one source.

The same "don't guess" discipline applies to every other required field:
`light` only comes from an unambiguous `sun` value (`"Full Sun"`,
`"Partial Sun"`, `"Full Shade"`; noise like `"No specific"` or
`"Add this information"` is treated as absent, not defaulted), and `spacing`
only comes from a record that has **both** `spreadCm` and `rowSpacingCm` as
positive numbers — OpenFarm's "spread" (distance to the next plant of the
same crop) and "row spacing" (distance between rows) map directly,
unit-for-unit, onto the schema's `RowSpacingSchema` pair, with no derived
intensive/per-m² figure invented from them. This caught a real data-quality
issue during development: `water-chestnut` is in the curated category table
but has `rowSpacingCm: 0` in the source data, and is correctly skipped rather
than shipped with a nonsensical zero-width row. As of writing, 161 of the 162
curated records clear every check.

Companion-planting data (`companions`, present on 134 records) is
deliberately **not** mapped by this adapter. `Plant.companions` requires an
`evidence` tag (`well-supported`/`traditional`, Stage 0.2), and a scraped
wiki field with no citation is not this adapter's call to make — Stage 1.4
("Companion-planting data (evidence-tagged)") owns reconciling OpenFarm's
companion lists against other sources and assigning evidence honestly. This
keeps Stage 1.2 scoped to what it says on the tin.

### 3. The cache is a committed snapshot, not a per-query index

Unlike `resolve/gbif-cache.ts` (one entry per resolved name, accumulated over
many runs), OpenFarm here is a single static file: `cache/openfarm-crops.json`
committed to the repo, all 340 rescued records verbatim (not just the curated
162 — the fuller snapshot is more useful for future stages, e.g. Stage 1.4
wanting the `companions` field from records this adapter doesn't map today).
`sources/openfarm/cache.ts#loadOpenFarmCache` reads that file; the pipeline
never fetches over the network to run. `sources/openfarm/transport.ts`
isolates the one place that _would_ re-fetch it
(`createFetchOpenFarmTransport`, hitting the rescue repo's raw GitHub URL) —
exercised only by a maintainer manually calling
`cache.ts#refreshOpenFarmCache`, mirroring how `gbif-transport.ts` isolates
GBIF's network call behind an interface unit tests never need to invoke. This
satisfies the same "unit tests must not hit the network" requirement Stage
1.1 established, via the same shape: every test in this package injects a
stub reader or stub transport (`source.test.ts`, `transport.test.ts`,
`cache.test.ts`) instead of touching disk-via-network or the committed file.

`sources/openfarm/types.ts#assertOpenFarmCropArray` validates the shape of
anything loaded from that file or fetched over the network before trusting
it — the same discipline `gbif-transport.ts`'s `assertGbifMatchResponse`
applies to GBIF responses, for the same reason: this is data from outside our
control, so a shape surprise should throw (retryable) rather than silently
propagate a malformed record into the mapper.

### 4. Mapping and resolution are two separate, composable steps

`map.ts#mapOpenFarmCrop` is pure and synchronous: raw record in, either a
schema-valid `Plant` (with `gbifId: null`, which the schema permits) plus the
name to resolve, or a skip reason — never a network call. `gbifId` filling is
left entirely to Stage 1.1's existing `resolve/apply-resolution.ts#applyGbifResolution`,
called by `build-plants.ts#buildOpenFarmPlants`, which ties a `GbifResolver`
to the mapper to produce the concrete "schema-shaped, GBIF-resolved,
individually-`validatePlant`-passing" records this stage is scoped to
deliver. Resolution prefers the source's own scientific (binomial) name over
its common name when both exist — unlike Stage 1.1's demo, which only ever
had common names to work with, a taxonomic query is markedly less ambiguous.
A handful of records list a species complex as several comma-separated
binomials (e.g. amaranth); this adapter takes the first and uses it for both
`scientificName` and the GBIF query, a documented simplification rather than
a data-loss bug.

`build-plants.ts` is deliberately **not** wired into `pipeline/run.ts` or
`src/index.ts`'s CLI output. `pipeline/source.ts`'s own documentation is
explicit that the generic pipeline only orchestrates name resolution and
must stay agnostic to any one source's mapping logic — it doesn't know PFAF's
CSV columns and shouldn't know OpenFarm's JSON shape either. Turning these
`Plant`s into the merged `/data` artifact is Stage 1.5's job. So `src/index.ts`
registers `openfarmSource` (a `SourceAdapter`, for pipeline logging/resolution
only) in place of Stage 1.1's `starterNamesSource` demo — which was always
documented as a stand-in "until Stage 1.2 registers real ones" — while
`buildOpenFarmPlants` exists as a tested, ready-to-import capability for
Stage 1.5, proven by `build-plants.test.ts` rather than by CLI wiring.

`fetchRecords()` itself only returns `SourceRecord`s for the subset it can
actually map (the ~161 that clear every check in §2) — not all 340 raw
records — so the pipeline's name-resolution step, and any future GBIF
quota, isn't spent resolving names for records that could never become a
`Plant` anyway. Records left out are recoverable via `getSkipped()`
(`source.ts`), a small extension to the `SourceAdapter` shape that doesn't
change the interface itself, for diagnostics without polluting
`pipeline/run.ts`'s summary counts with "skipped before resolution" as a
fourth outcome category.

## Alternatives considered

- **Wait for/request an official OpenFarm dump.** Rejected: the service has
  been shut down and archived since April 2025; there is nobody to ask.
- **Scrape `openfarm.cc` or the Wayback Machine directly, ourselves.**
  Rejected as unnecessary duplicate effort: `thefullnacho/openfarm-crops-rescue`
  already did this carefully (deduping, cross-checking binomials against
  GrowStuff, fixing typos) and published the result under a licence at least
  as permissive as OpenFarm's original. Redoing that work from scratch would
  just reintroduce bugs it already fixed.
- **Infer `category` with keyword heuristics** (e.g. "if binomial genus is
  `Capsicum`, it's a vegetable"). Rejected: heuristics have false positives
  by construction, and a wrong edible/ornamental classification is exactly
  the kind of horticultural mistake this project is careful not to ship
  silently (`WORKPLAN.md` §1). A hand-checked allow-list is slower to grow
  but never wrong by construction.
- **Derive an intensive (per-m²) spacing figure from `spreadCm`** (e.g.
  assuming square packing, `perSquareMetre = (100 / spreadCm)²`). Rejected
  for this stage: it would be a derived, invented number attributed to a
  source that never stated it, blurring "what OpenFarm said" and "what we
  calculated" in the provenance record. The row-spacing mapping from
  `spreadCm`/`rowSpacingCm` is a direct, unit-for-unit fit the source
  actually documents; inventing a second growing method from the same two
  numbers is exactly the kind of unstated inference Stage 1.2 avoids.
- **Map companion-planting data now, with a blanket `"traditional"` evidence
  tag.** Rejected: assigning an evidence level is a judgement call
  `WORKPLAN.md` assigns to Stage 1.4 specifically, once companion data from
  multiple sources can be reconciled together. Blanket-tagging everything
  "traditional" here would preempt that stage's actual job.
- **Cache only the curated 162 records instead of the full 340-record dump.**
  Rejected: the committed cache is meant to mirror the _source's_ raw data
  (per the Stage 1.2 brief), not this adapter's current curation choices.
  Keeping the full dump means a future curation pass (extending
  `categories.ts`) or Stage 1.4's companion-data work never needs a second
  network fetch to get at records this adapter doesn't map today.

## Consequences

- `NOTICE` is corrected: OpenFarm's licence there was recorded as CC BY-SA
  (`DESIGN.md`'s assumption about the un-fetched dump); the dataset this
  project actually ingests is CC0-1.0, and the attribution line has been
  updated to name the rescue project and its Wayback-Machine provenance.
- A future contributor extending `categories.ts` should keep it a
  **positive** allow-list (add a slug only after checking it's a genuine
  edible against its own name/binomial), not flip to a denylist — a denylist
  fails open on new junk entries; an allow-list fails closed.
- The 161 mapped records are real, schema-valid, GBIF-query-ready `Plant`s
  today, but none has been resolved against a live GBIF in this session —
  the same sandboxed-egress situation Stage 1.1 documented (`0005`'s
  Consequences). `npm run start -w @garden-planner/etl` was run as part of
  this stage's verification and correctly reports 161 `error` outcomes
  (GBIF unreachable) rather than crashing or caching bad data. A future
  contributor session with GBIF access should re-run it to populate
  `cache/gbif-name-cache.json` for real.
- Fixing `npm run start` to actually exercise this adapter surfaced a latent,
  unrelated bug: `packages/engine`'s own internal re-exports
  (`src/index.ts`, `src/schema/index.ts`) used extension-less relative
  imports, which Node's ESM loader — unlike the bundler tools that had
  exercised this package until now (`tsc`, Vitest, Vite) — can't resolve.
  Stage 1.2 is the first code path to load `@garden-planner/engine` from the
  etl CLI's `node --experimental-strip-types` entry point (via
  `sources/openfarm/map.ts`'s `validatePlant` import), so it's the first to
  hit this. Fixed by adding explicit `.ts` extensions to those two files and
  hoisting `allowImportingTsExtensions` into `tsconfig.base.json` (previously
  duplicated per-package in `etl`'s own config) — mechanical, no behaviour
  change, verified against `npm run build`/`typecheck`/`test` across every
  workspace.
- `sources/openfarm/` is now the concrete template for PFAF and Permapeople:
  a `types.ts` raw shape + guard, a `cache.ts`/`transport.ts` pair for
  offline-first fetch-once caching, a pure `map.ts` that skips rather than
  guesses, and a `SourceAdapter` in `source.ts` that only returns what it can
  actually map. Later adapters aren't obligated to reuse this exact file
  split (a CSV source like PFAF will need different raw-parsing code), but
  the mapping/skip/provenance discipline should carry over unchanged.
