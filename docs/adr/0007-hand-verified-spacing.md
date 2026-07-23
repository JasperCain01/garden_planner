# 0007 — Hand-verified spacing table: shape, sourcing method, and sanity bounds

## Status

Accepted (Stage 1.3).

## Context

Stage 1.3 (`docs/stage-1.3-brief.md`; `WORKPLAN.md` marks it ⭐ data-critical) is
the one place the project produces spacing figures by **original curation**
rather than by ingesting a source. `DESIGN.md` §2 explains why this is worth a
whole stage: spacing is the make-or-break input for the density calculator
(Stage 2.2), and it is **method-aware** — the same crop has one density in
traditional rows (in-row × between-row) and a tighter one in an intensive/
square-foot bed. Onions are the canonical example (~10 cm × 30 cm in rows; ~9 per
30 cm square in a bed). A table that stored one number would silently pick a
growing method for the user.

The Stage 0.2 schema already models this (`SpacingSchema` in
`packages/engine/src/schema/plant.ts`: `row` and/or `intensive`, at least one
required). What Stage 1.3 adds is the **verified data** to fill it, plus the
constraints that make "verified" a reviewable fact rather than a claim:
`WORKPLAN.md` §1.1 requires every figure to be **cross-checked against ≥2
authoritative sources, recorded per row**.

Four questions had to be settled: **what shape the curated data takes** (there is
no existing pattern to mirror — this is deliberately _not_ a `SourceAdapter`);
**how the ≥2-source rule is enforced** rather than merely intended; **how to
source real figures when the authoritative sites are network-blocked in this
sandbox**; and **which crops** the starter table covers.

The code lives in `packages/etl/src/spacing/` (`schema.ts`, `table.ts`,
`index.ts`, and their tests).

## Decision

### 1. A typed `.ts` table, not a `SourceAdapter`, not raw JSON

This stage is original curation, so it does **not** implement
`packages/etl/src/pipeline/source.ts`'s `SourceAdapter` interface — that
interface is for _adapting an external, ingested source's raw records_ (Stage
1.2's OpenFarm, PFAF, …). Forcing hand-authored data through it would be a
category error (there is no external record to fetch, cache, or shape-guard).
The spacing table is closer in spirit to Stage 1.1's `starter-source.ts` demo:
a small, hand-authored capability that Stage 1.5 imports directly, not something
`pipeline/run.ts` orchestrates.

The data is a **TypeScript module** (`table.ts` exporting `HAND_VERIFIED_SPACING:
readonly SpacingRecord[]`), not a `data/*.json` file. The brief offered either;
`.ts` won because every figure carries a _reason_ — which value, from what source
range, with what caveat — and JSON cannot hold the inline comments that make the
table reviewable and teachable (`WORKPLAN.md` §0.2's whole premise). The data is
still schema-validated with identical rigour to a JSON artifact: `table.test.ts`
runs `validateSpacingTable(HAND_VERIFIED_SPACING)`, which parses every row
through the same zod schema Stage 1.5's hard-fail gate will use.

Each row is a **thin slice of a `Plant`** — identity (`id`, `commonName`,
`scientificName`, `category`) + the `spacing` block + per-method provenance —
not a whole plant record. Light, hardiness, soil and seasons come from the
ingested sources; Stage 1.5 merges this spacing slice onto them by GBIF id. The
`id` is a `Plant.id`-shaped slug so the rows line up in that merge — validated by
the engine's `SlugSchema`, which this stage made `export` and reuses directly
rather than restating the regex, so the two rules can't drift. `validateSpacingTable`
additionally enforces that both `id` **and** `scientificName` are unique across
the table: the merge joins on the GBIF id resolved from the scientific name, so
two rows sharing a species (distinct slugs, same binomial) would silently attach
two conflicting spacing slices to one plant — caught here at the source of the
join key rather than in the merge.

### 2. The ≥2-source rule is enforced _per method_, and coupled to the figure

`SpacingSchema` from `@garden-planner/engine` is reused verbatim for the `spacing`
block — this stage never redefines what a spacing figure is. On top of it,
`schema.ts` adds provenance keyed **by growing method**: `provenance.row` and
`provenance.intensive`, each an array of the engine's `SourceRefSchema` requiring
**at least two** entries (`MIN_SOURCES_PER_METHOD`). Crucially, a
`superRefine` **couples figure to provenance both ways**: a `spacing.row` figure
is invalid without `provenance.row`, and dangling `provenance.intensive` with no
`spacing.intensive` figure is invalid too.

That coupling is the technical mechanism behind the brief's hardest rule — **don't
invent a method-aware figure from a single-method source** (the exact temptation
`docs/adr/0006` §rejected-alternatives records the OpenFarm adapter resisting).
Because citations attach to a _method_, you physically cannot record an intensive
density here without citing two sources that actually state an intensive density;
there is no schema-valid way to back-fill it from row citations. `table.test.ts`
reinforces this at the data level by asserting every intensive figure carries a
genuine square-foot-gardening citation.

### 3. Sourcing method: real sources, retrieved honestly, disagreements recorded

Every figure is cross-checked against ≥2 independent authoritative sources:

- **Row figures** — the **RHS** grow guide (primary UK authority) + the **Old
  Farmer's Almanac** plant pages (extension-grade second source).
- **Intensive figures** — the **Square Foot Gardening Foundation**'s own spacing
  guidance + a second reproduced square-foot chart. Never derived from a row
  figure (see §2).

**On retrieval honesty.** In the environment this table was authored in
(2026-07-22), direct page fetches (`curl`/WebFetch) to `rhs.org.uk`,
`almanac.com`, and `squarefootgardening.org` were **blocked by the sandbox's
egress policy** (HTTP 403 at the proxy) — the same class of blocker Stages
1.1/1.2 documented for GBIF/PFAF/Permapeople (`docs/adr/0005`, `0006`). Rather
than fabricate citations or stop, the figures were retrieved via **web-search
result snippets of those exact pages** — a genuine retrieval of each source's own
published words, with the real page URL recorded, not an invented reference. This
is the brief's sanctioned path: cite what was actually seen, honestly labeled.
The verification is reproducible by a reviewer from a session with unrestricted
network access (re-open each cited URL and confirm the figure), which is what
`WORKPLAN.md` §1.1's "committed and reviewable" record is for.

Where sources **genuinely disagree**, the row's `note` records the disagreement
and the choice, rather than hiding it. The clearest case is onion intensive
density: the square-foot system splits **9 per square for bulbing onions vs 16
for bunching/salad onions**; 9 is recorded (our crop is the bulb onion) with the
split noted. Where a method has no honest figure at all, the block is **left
absent** rather than forced: potatoes (grown by earthing-up, not a square-foot
crop), broad beans (no established SFG density), and leeks (SFG sources split 4
vs 9 per square) are recorded **row-only** — the schema permits it, and an honest
omission beats a contested number.

### 4. Sanity bounds: positivity floor from the schema, plausibility ceilings here

`WORKPLAN.md` §1.1 asks for automated checks on implausible values. The engine's
`SpacingSchema` already enforces the **positivity floor** (`.positive()` on every
distance and density), so this stage does not re-check that. `spacingSanityIssues`
(a pure, separately-tested function reused inside the schema's `superRefine`) adds
what positivity can't catch:

- **Plausibility ceilings** — `maxDistanceCm` (300 cm) and `maxPlantsPerSquare`
  (36) reject a misplaced decimal (a `3700` that should be `37`) that is positive
  but absurd at plot scale. Bounds are deliberately generous — a "reject the
  absurd" gate, not a horticultural opinion.
- **Plausibility floors** — a `0.3 cm` in-row spacing, or a `0.01`-per-square
  density, is positive yet physically impossible; `minDistanceCm` (1 cm) and
  `minDensity` (0.1, symmetric with the distance floor) catch decimal slips at
  the sparse end too.
- **One cross-field invariant** — `betweenRowCm >= inRowCm`. Rows are never
  spaced tighter than the plants within them; a record failing this has almost
  certainly transposed the pair, and the error message says so.

Bounds live as exported constants (`SPACING_SANITY_BOUNDS`) so tests, docs, and
Stage 1.5 reference one authoritative set of numbers.

### 5. The starter crop set: 12 common British edibles

The table covers **12 vegetables**: onion, lettuce, carrot, potato, tomato,
beetroot, radish, garlic, leek, pea, broad bean, French bean. The set was chosen
to (a) include the **Stage 1.1 demo five** (onion, lettuce, carrot, potato,
tomato) already used across the pipeline, and (b) **overlap heavily with the
crops OpenFarm's adapter already maps** (`sources/openfarm/categories.ts`),
maximising the record overlap Stage 1.5's merge benefits from. `WORKPLAN.md`
pins neither count nor list; the set is kept small and real-world-common per
`DESIGN.md`'s "the set is small and bounded" framing, because every figure is a
per-crop hand-verification cost — breadth is traded for trustworthiness, and the
table is designed to be extended one well-cited row at a time.

Herbs and fruit are deliberately deferred: this first table stays within
vegetables so the verification method is established on the tightest, best-
documented data before widening.

## Alternatives considered

- **Implement it as a `SourceAdapter`.** Rejected: there is no external source to
  adapt. The interface's fetch/cache/shape-guard steps are meaningless for
  hand-authored data, and `pipeline/source.ts`'s own docs say the pipeline stays
  agnostic to per-source shaping. (Details in §1.)
- **Store the data as `data/hand-verified-spacing.json`.** Rejected: JSON can't
  carry the per-figure reasoning comments that make the table reviewable, which
  is the point of a _hand-verified_ table. Schema validation is preserved either
  way, so the only thing lost by JSON is the explanation. (Details in §1.)
- **Lump all citations at the record level (≥2 sources per _row_).** Rejected:
  it would technically satisfy "≥2 per row" while letting an intensive figure
  ride on citations that only ever stated a row distance — precisely the unstated
  inference this stage exists to prevent. Per-method provenance closes that gap.
  (Details in §2.)
- **Derive intensive densities from row spacing** (e.g. `perSquareMetre ≈
(100/inRowCm)²`). Rejected for the same reason `docs/adr/0006` rejected it for
  OpenFarm: it blurs "what the source said" with "what we calculated" in the
  provenance record. Where no genuine intensive source exists, the block is left
  absent instead.
- **Stop and ask for network access** (the brief's other sanctioned path).
  Considered, but unnecessary: the sources' figures _were_ obtainable via search
  snippets of the real pages, so honest cross-checked citations were possible
  without fabricating anything. The retrieval limitation is documented (§3) so a
  reviewer can independently re-verify.
- **Cover 60+ crops in one pass.** Rejected: hand-verification is a per-crop
  cost, and a bounded, fully-verified 12 is more valuable than a large, thinly-
  checked table. Extension is designed to be incremental.

## Consequences

- Stage 1.5's merge can import `HAND_VERIFIED_SPACING` and attach each row's
  `spacing` onto the matching `Plant` by GBIF id, using `spacingRecordSources()`
  to populate `provenance.fields.spacing`. Per the workplan's conflict policy,
  these hand-verified figures should **win** over any scraped spacing (e.g.
  OpenFarm's) for the same crop.
- The figures are cross-checked but **retrieved via search snippets, not direct
  page fetches** (sandbox egress policy). A contributor with unrestricted network
  access should be able to re-open every cited URL and confirm each figure; the
  committed citations (source + real URL + `retrievedAt`) make that a mechanical
  re-check. This mirrors how Stages 1.1/1.2 left GBIF/PFAF verification for a
  future networked session rather than working around the blocker.
- The `betweenRowCm >= inRowCm` invariant is a genuine horticultural rule for the
  row crops here, but a future contributor adding an unusual crop should confirm
  it still holds (it does for all 12 current rows) before assuming the bound is
  free.
- Slug ids use British spellings (`beetroot`, `broad-bean`) that differ from
  OpenFarm's (`beet`); this is harmless because the Stage 1.5 merge joins on GBIF
  id / scientific name, not the slug. The scientific names here are the join keys
  and were chosen to match GBIF's accepted names.
- Herbs and fruit are uncovered for now; the density calculator will have no
  intensive figure for crops outside this table until it is extended.
