# Data provenance & licensing

Where every fact in `data/plants.json` came from, and what you may do with it.
This page gathers what `NOTICE`, `data/README.md`, and ADRs
[0009](./adr/0009-dataset-merge-and-licensing.md),
[0023](./adr/0023-dataset-licence-cc0.md) and
[0025](./adr/0025-uk-outdoor-crop-exclusions.md) each say in part; none of
them is superseded by this page — read them for the full reasoning behind a
decision summarised here. Code licensing and icon licensing are covered too,
briefly, since `NOTICE` covers all three.

## The one point not to skim

**No source page cited anywhere in this project was ever fetched directly
from the build environment that authored it.** `rhs.org.uk` and
`almanac.com` both answer a direct request with HTTP 403; GBIF's API
(`api.gbif.org`) is blocked outright. Concretely, that means:

- The hand-verified spacing table's figures, and the RHS spacing / hardiness
  / soil / season figures in the eight maintainer-curated plant records, came
  from **web-search snippets of those exact pages** — not a live fetch. Each
  one still carries the page's URL and a note quoting what that page states,
  so a reviewer with unrestricted network access can check it directly.
- The curated soil-moisture table's judgements and the UK-outdoor exclusion
  list's reasoning **cite nothing at all**. They are hand-authored from
  general horticultural consensus (a moisture preference or a hardiness
  outcome that doesn't need a citation to be true), and their own module docs
  (`packages/etl/src/moisture/`, `packages/etl/src/exclusions/`) say so
  plainly rather than dressing a judgement call up as a sourced fact.

Treat the dataset as **guidance for planning a garden, not as an authority**.
That framing, and the retrieval caveat above, are not softened anywhere else
in the project either — see `NOTICE` for the same statement at the source.

## Licensing, in one table

| What                          | Licence             | Where recorded                                                                |
| ----------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| Code (`app/`, `packages/`)    | MIT                 | [`LICENSE`](../LICENSE)                                                       |
| Dataset (`data/`)             | CC0-1.0             | [ADR 0023](./adr/0023-dataset-licence-cc0.md), `NOTICE`                       |
| Crop icons (`app/src/icons/`) | MIT (original work) | `NOTICE`'s "ILLUSTRATIONS" section, [icon style guide](./icon-style-guide.md) |

The dataset was **CC BY-NC-SA 4.0** from Stage 1.5 until Stage 6.0: that
restriction existed only to absorb Plants For A Future, whose terms would
have propagated to the merged artifact (see ADR 0009 §7). Stage 6.0 replaced
the "ingest PFAF" plan with curation instead (see below), so nothing left in
the artifact compels a restriction, and [ADR 0023](./adr/0023-dataset-licence-cc0.md)
relicensed it to CC0-1.0 — public domain, no attribution required. CC0
removes attribution as a legal _condition_; it does not remove it from the
data. Every record keeps its `provenance.sources`, and the table below still
credits every source, because knowing where a figure came from is what makes
it checkable, not because a licence demands it.

## The dataset's inputs, and what each one owes to whom

| Input                                                                                                                                       | Licence / basis                                                                                                                                        | Why CC0 is available                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **OpenFarm crops rescue** — a community Wayback-Machine recovery of a shut-down service ([ADR 0006](./adr/0006-openfarm-source-adapter.md)) | CC0-1.0                                                                                                                                                | Already CC0 at the source.                                                                             |
| **Hand-verified spacing table** (`packages/etl/src/spacing/`, [ADR 0007](./adr/0007-hand-verified-spacing.md))                              | RHS, Old Farmer's Almanac, Square Foot Gardening Foundation charts — cited per figure                                                                  | Growing facts aren't copyrightable; the selection and per-method citation are this project's own work. |
| **Companion/antagonist relationships** (`packages/etl/src/companions/`, [ADR 0008](./adr/0008-companion-planting-data.md))                  | Hand-curated (cited) + OpenFarm-derived                                                                                                                | Hand-authored by this project, or CC0 via OpenFarm.                                                    |
| **Maintainer-curated plants** (`packages/etl/src/curated/`, [ADR 0021](./adr/0021-curated-plant-input.md))                                  | RHS grow-your-own guides, RHS rootstock advice, RHS plant pages, Old Farmer's Almanac, NC State Extension, one permaculture guide — individually cited | Hand-authored by this project.                                                                         |
| **UK-outdoor exclusion list** (`packages/etl/src/exclusions/`, [ADR 0025](./adr/0025-uk-outdoor-crop-exclusions.md))                        | Hand-authored horticultural judgement, no citations                                                                                                    | Hand-authored by this project; a judgement call, not a scraped fact.                                   |
| **Curated soil-moisture table** (`packages/etl/src/moisture/`)                                                                              | Hand-authored, no citations                                                                                                                            | Hand-authored by this project.                                                                         |
| **GBIF taxonomic backbone**                                                                                                                 | Name-resolution join key only                                                                                                                          | Unreachable from every build to date (`api.gbif.org` blocked) — no record currently carries a GBIF id. |

Full per-source detail, including exact URLs, lives in `NOTICE`; per-record
detail (which source backs which field, on which plant) lives in
`data/plants.json` itself, under each record's `provenance`.

## What Stage 6.0 changed here, and why the licence moved

Stage 6.0 was originally scoped to finish the PFAF/Permapeople source
adapters `WORKPLAN.md` §1.2 left partial. It didn't: only 95 of the
162-crop dataset then shipping joined uniquely by scientific name, 67 sat in
ambiguous species groups (_Brassica oleracea_ alone covers 11 shipped crops),
and PFAF's species-level rows couldn't honestly supply cultivar-level season
data. Stage 6.0 filled the same gaps by **curation** instead — six British
staples added, 24 crops that can't be grown outdoors in Britain removed (see
[ADR 0025](./adr/0025-uk-outdoor-crop-exclusions.md) for the full reasoning
and the per-crop table) — which is why PFAF is "no longer planned" rather
than "blocked," and why the licence that was reserving space for it no longer
needs to.

## Two things this dataset is not

- **Not a taxonomic authority.** Every `gbifId` in the shipped artifact is
  `null` — the join key exists and upgrades automatically the moment GBIF
  becomes reachable, but nothing pretends to a GBIF id it doesn't have.
- **Not exhaustive.** Of 144 shipped crops: light coverage is 144/144 (but
  only two distinct values), soil is 80/144, hardiness and seasons are
  8/144. See the [README](../README.md)'s "caveat worth knowing" section for
  what that means for the suitability rankings, and
  [`packages/engine/src/suitability/dataset.test.ts`](../packages/engine/src/suitability/dataset.test.ts)
  for the pinned numbers this page's figures were checked against.

## If you add a new source

Record it here, in `NOTICE`, and in `data/README.md` — and check its licence
_before_ ingesting it. CC0 is only honest while every input permits it:
adding a share-alike or non-commercial source (Plants For A Future, for
instance) would mean relicensing the affected build, not quietly leaving this
page and `NOTICE` as they stand.
