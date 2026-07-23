# 0010 — Location & climate static data: profile shape, frost-date representation, module home, and the geocoding defer

## Status

Accepted (Stage 1.6).

## Context

Stage 1.6 (`docs/stage-1.6-brief.md`; `WORKPLAN.md`'s Stage 1.6 entry) ships the
**offline-capable climate context** the app needs to turn "a location" into real
horticultural advice, defaulting to Britain: frost dates, an RHS hardiness band,
and season timing. Like the Stage 1.5 dataset, this is a **run-time static
asset** — it ships with the app and must resolve with zero network access, not
an ETL ingest. It has no dependency on Stage 1.5; it hangs directly off the
Stage 0.2 schema (`packages/engine/src/schema/plant.ts`).

Four questions had to be settled: **what shape a climate profile takes** (a
genuine modelling decision — there was no existing pattern in this repo for
"a location's climate"); **how a frost date is represented** (a single month is
too coarse to distinguish nearby regions, a full `Date` implies false
precision); **where the module lives**; and **whether to build the optional
online-geocoding progressive enhancement this stage, or defer it**.

The code lives in `packages/engine/src/climate/` (`schema.ts`, `season.ts`,
`regions.ts`, `resolve.ts`, `geocode.ts`, `index.ts`, and their tests).

## Decision

### 1. Reuse the Stage 0.2 vocabulary; add one small, justified export

The brief is explicit: "the schema already has the vocabulary a climate profile
must speak — reuse it, don't restate it." This module imports directly from
`schema/plant.ts` rather than redefining anything:

- `RhsHardinessRatingSchema` (via `HardinessSchema`) — a location's hardiness
  band uses the exact same ordered enum a plant's `hardiness.rhsRating` does, so
  the engine (Stage 2.1) compares the two with `rhsHardinessRank` and no
  conversion step.
- `HardinessSchema` itself (`rhsRating` + optional `minTempC`) — reused
  **verbatim** for `ClimateProfile.hardiness`, rather than inventing a
  location-specific hardiness shape. This is the exact "band + portable °C
  figure" pattern the brief calls out.
- `MonthRangeSchema` — reused verbatim for `growingSeason`, including its
  documented wrap-around-the-new-year semantics (relevant the day this table
  ever gains a southern-hemisphere region).
- `SourceRefSchema` — reused verbatim for every citation, identical to a plant
  record's provenance.
- `SlugSchema` — reused verbatim for a region `id`, so region ids and plant ids
  can never collide on shape.

One genuinely new export was needed: `MonthSchema` (the `1..12` integer bound
`MonthRangeSchema` is built from) was **not exported** from `schema/plant.ts`
before this stage — only the composite `MonthRangeSchema`/`SeasonsSchema` were.
A frost date needs a bare month number, not a range, so `schema/plant.ts` now
exports `MonthSchema` and its inferred `MonthNumber` type (a two-line, additive,
non-breaking change) rather than this module restating "an integer 1 to 12"
independently and risking the two bounds drifting apart.

### 2. Frost-date representation: month + approximate day, not a bare month or a `Date`

The brief left this as an open call ("as months, or month+approximate day —
decide and document"). **Month + day** was chosen (`CalendarDayOfYearSchema`:
`{ month, day }`, validated against real days-per-month):

- A bare month is too coarse to be useful: two regions can share a last-frost
  _month_ while differing by two-plus weeks in practice (this repo's own
  Northern England and Scotland-Highlands profiles both round to a June growing-
  season start at month granularity — see §5). Day-level precision is what the
  cited sources actually report ("24th April", "late October"), so discarding it
  would throw away real information for no reason.
- A full `Date` was rejected: these are **long-run averages**, not a fact about
  any specific year. A `Date` implies a precision (a specific year) the
  underlying figures don't have and never will — actual frost in a given year
  can be 1–3 weeks off the average. `{ month, day }` says exactly as much as is
  known and no more.
- The day is validated against real days-in-month (`DAYS_IN_MONTH`), so a "30
  February" typo is a schema error, not a silently-accepted absurdity.

### 3. `growingSeason` is **derived**, not a third hand-typed figure

`ClimateProfile.growingSeason` (a `MonthRange`) is computed from the frost
window by `deriveGrowingSeason()` (`season.ts`), not typed by hand per region.
Rule: a month counts as "in season" if at least half of it is expected to be
frost-free — last frost in the first half of its month keeps that month as the
start, otherwise the start rolls to next month; symmetrically for the end. This
is a deliberately simple, documented, month-granularity convenience for the
engine's coarse "is it in season" checks — a future feature needing day-level
precision should read `frost` directly instead of `growingSeason`.

Computing it, rather than hand-typing it, means it **cannot drift** from the
frost dates it depends on, and it correctly has **no citation slot** of its own
in `ClimateProvenanceSchema` — citing a derived value would imply a source that
doesn't exist. `ClimateProvenanceSchema` requires citations for exactly the two
categories that _are_ independently sourced facts: `hardiness` and `frost`.

### 4. Module home: `packages/engine/src/climate/`, not a separate package

The brief offered a separate `packages/location` package as an alternative.
`packages/engine` was chosen because:

- The engine (Stage 2.1) is the primary consumer, comparing a plant's hardiness
  against a location's — putting the schema and the resolver where the consumer
  already lives avoids a new cross-package dependency for a module this small.
- It mirrors how the Stage 0.2 plant schema already lives in `engine/src/schema/`
  — "the framework-free engine package is the natural home" for typed, DOM-free
  static data-plus-logic, and this repo already has that precedent.
- A dedicated package would only pay for itself if the climate module grew
  large or needed independent versioning/publishing — neither applies at this
  scope (one schema file, one region table, one small resolver).

`climate/` is re-exported from the engine's public surface (`engine/src/index.ts`)
exactly as `schema/` is, so consumers write
`import { resolveClimate, type ClimateProfile } from '@garden-planner/engine'`.

### 5. The region set: UK default plus three regions, hand-curated with citations

Per-figure citations mirror `docs/adr/0007`'s spacing-table discipline exactly:
a `cite()` helper builds uniform `SourceRef`s, named per-source functions
(`rhs`, `gardenis`, `gardencalc`, `airtasker`, `weatherspark`) keep ~15 citations
legible, and every hardiness band and frost date cites a real URL with a
`retrievedAt` date.

**Retrieval honesty.** In the environment this table was authored in
(2026-07-23), direct fetches to `rhs.org.uk` and Met Office endpoints returned
HTTP 403 at the sandbox's egress proxy — the identical blocker Stages 1.1–1.3
documented for GBIF/PFAF/RHS (`docs/adr/0005` §retrieval, `docs/adr/0007` §3).
Web search was reachable, though, so every figure below was retrieved via
**search-result snippets of the sources' own pages** — the same sanctioned path
Stage 1.3 used, and a genuine retrieval of each source's real words with the
real URL recorded, not an invented reference. A reviewer with unrestricted
network access can re-open every cited URL and confirm each figure.

**The four profiles:**

| Region                                  | RHS band | Last spring frost | First autumn frost |
| --------------------------------------- | -------- | ----------------- | ------------------ |
| `uk-default` (national)                 | H4       | 20 April          | 5 November         |
| `south-west-england` (Cornwall/Devon)   | H3       | 5 April           | 25 November        |
| `northern-england` (Yorkshire/Pennines) | H5       | 25 May            | 25 October         |
| `scotland-highlands`                    | H6       | 20 May            | 20 October         |

RHS's own hardiness-rating guidance gives both the numeric H1a–H7 bands (used
for each `minTempC`, set to each band's floor) and a regional mapping ("Cornwall
and the Channel Islands behave like H3", "the Scottish Highlands behave like H6
or H7", "most of England and Wales sit in the H4 to H5 range") — this is what
picked each region's band; H6 (not H7) represents the Highlands generally,
reserving H7 for a future, more exposed-site-specific extension.

**Where sources disagreed, the disagreement is recorded, not hidden** (same
rule Stage 1.3 followed for the onion 9-vs-16 split):

- Cornwall's last frost: one source gave "24th April" directly, but described
  the wider far-south-west pattern as "typically early April". Early April (5th)
  was chosen as more representative of the H3/mildest-in-mainland-Britain
  classification; the 24th is recorded in the citation note.
- Cornwall's first autumn frost: the same source's framing ("frost may not
  return until January") reads as an outlier rather than a true regional
  average; a more moderate late-November figure was chosen instead, with the
  source's stronger claim noted rather than silently adopted.
- Northern England's first autumn frost had no single clean regional figure — one
  source's "late November" reads implausibly late for a region colder than the
  default (likely conflating it with the Midlands). 25 October was chosen by
  reconciling the well-established "further north, shorter season" pattern
  against the (cited, but inconsistent) source figure, and both are recorded.

**Why these four and not more.** "A small, extensible set of regions" is the
brief's own framing (identical in spirit to Stage 1.3's "kept small on
purpose"). Four profiles span the real range RHS's own hardiness map describes
(H3 mildest to H6 harshest) with a clean default in between, each individually
citable — breadth beyond that is a future, well-cited addition, not a
one-pass goal.

### 6. Coordinates resolve to the nearest region centroid — enables geocoding without needing it built yet

`resolveClimate(location?)` accepts three location shapes: no location / an
explicit `{ kind: 'default' }` (→ the UK default), `{ kind: 'region', regionId }`
(exact lookup, throws on an unknown id — a caller bug, not a "not found" case to
degrade from), and `{ kind: 'coordinates', lat, lng }`.

The coordinates path resolves to the nearest of four representative city
centroids (Birmingham for the default, Truro, Leeds, Inverness) by haversine
distance — plain arithmetic, no network, always resolves (even for a coordinate
outside the UK, which just gets _some_ nearest region; genuinely non-UK
locations are out of scope for this stage). Centroids are **not** part of
`ClimateProfileSchema` itself — they are resolution-time metadata in
`resolve.ts`, kept separate from what the engine/UI actually consume
(hardiness/frost/season), because latitude/longitude isn't a fact the schema's
consumers need once a profile has been resolved.

`LocationInput` (the `resolveClimate` parameter type) is itself a zod schema
(`LocationInputSchema`, a `discriminatedUnion` on `kind`), not a hand-written
TypeScript union — consistent with this module being zod-first throughout.
This matters at exactly the boundary Stage 3.2's location picker will need:
round-tripping a chosen location through storage or URL state means a
malformed `lat`/`lng` should fail loudly at that boundary rather than
propagate into the distance calculation. `lat`/`lng` are bounds-checked
(±90/±180) and `regionId` reuses `SlugSchema`, matching every
`ClimateProfile.id` this module ships.

This is the concrete mechanism that satisfies the brief's "define the resolver
interface so geocoding can slot in later without a breaking change": a
geocoder's entire job is turning free text into `{ lat, lng }`. That pair
already has a fully-offline path to a `ClimateProfile` today. A future geocoder
implementation changes nothing about `resolveClimate`'s signature or any
existing caller.

### 7. Online geocoding: deferred, interface-ready, recorded as follow-up

The brief explicitly permits deferring optional geocoding as long as the
interface is ready for it. **Deferred**, for two reasons:

- The offline core is the mandatory deliverable this stage, and it must not
  depend on a network call under any condition. Building a geocoder alongside it
  — even behind an injectable-transport seam — adds surface area to get subtly
  wrong for a feature this stage doesn't require.
- Any real geocoding API is unreachable from this sandbox (§5's egress block),
  so its response shape could not be verified against a live call, unlike the
  Stage 1.1 GBIF resolver, which at least had a prior session's network access
  to shape its parser against (`docs/adr/0005`).

What's shipped instead: `geocode.ts` defines `Coordinates` and a
`GeocodeTransport` interface (mirroring `GbifTransport`'s injectable-transport
shape, `packages/etl/src/resolve/gbif-transport.ts`) — typed and documented, not
implemented. A future stage adds a real implementation and a thin
`geocodeLocation()` wrapper that geocodes text and feeds the result straight
into the coordinates path already built and tested here (§6), with unit tests
stubbing `GeocodeTransport` exactly as the GBIF resolver's tests stub
`GbifTransport` — so they never touch the network either.

**Follow-up work (not done in this stage):** implement `GeocodeTransport`
against a real geocoding service; add a `geocodeLocation()` convenience that
composes it with `resolveClimate`'s coordinates path; test the offline-fallback
behaviour explicitly once there's a real transport to fall back from.

## Alternatives considered

- **A bare month for frost dates**, no day component. Rejected (§2): too coarse
  to distinguish real, cited differences between nearby regions.
- **A full `Date` for frost dates.** Rejected (§2): implies a specific-year
  precision these long-run averages don't have.
- **Hand-typing `growingSeason` per region alongside the frost dates.**
  Rejected (§3): a third hand-typed figure per region that could silently drift
  from the frost dates it's supposed to summarize; deriving it mechanically
  makes drift impossible.
- **A separate `packages/location` package.** Rejected (§4): the engine is the
  primary consumer and already hosts the analogous Stage 0.2 schema; a new
  package boundary isn't earning its cost at this size.
- **Store centroids inside `ClimateProfileSchema`.** Rejected (§6): latitude/
  longitude is resolution-time plumbing, not a fact the engine or UI need from a
  resolved profile; keeping it in `resolve.ts` keeps the schema focused on what
  its consumers actually ask for.
- **Build the online geocoder this stage.** Rejected (§7): the brief allows
  deferring it, the offline core is the only mandatory piece, and the target
  API's shape is unverifiable from this sandbox today. Deferred with the
  extension point ready rather than built against untested assumptions.
- **Throw or silently default on an unknown `regionId`.** Silent-default
  rejected: it would hide a caller bug (a typo'd id, or a UI region list that
  drifted from `ALL_CLIMATE_PROFILES`) behind an unrelated-looking result.
  Throwing with the bad id in the message was chosen instead — this is
  categorically different from the "coordinates never fail" guarantee (§6),
  because a `regionId` is expected to come from this module's own known list,
  while coordinates are inherently open-ended input.

## Consequences

- The suitability engine (Stage 2.1) can call `resolveClimate()` for the UK
  default with zero setup, or pass a `regionId`/coordinates once the
  plot-definition UI (Stage 3.2) offers a location picker — no code path in
  either engine or UI ever needs to handle "climate resolution failed" for the
  default or region cases; only an invalid `regionId` throws, which is a
  programmer error to fix, not a runtime case to design UX for.
- `growingSeason` is coarse (month-granularity) by design; two regions with
  meaningfully different frost _dates_ can still land on the same
  `growingSeason` `MonthRange` (Northern England and Scotland-Highlands both
  round to a June–October season here) — a consumer needing finer resolution
  should read `frost` directly rather than assuming `growingSeason` carries all
  the precision the citations do.
- The frost figures are cross-checked but retrieved via search snippets, not
  direct page fetches (sandbox egress policy) — mirrors the standing caveat in
  `docs/adr/0007`. A contributor with unrestricted network access should be able
  to re-open every cited URL and confirm each figure.
- No online geocoding exists yet — a location must be chosen from the shipped
  four profiles or supplied as raw coordinates until a future stage implements
  `GeocodeTransport`. This is an explicit, recorded gap, not an oversight.
- `schema/plant.ts` now exports `MonthSchema`/`MonthNumber` in addition to the
  composite schemas it already exported — a small, backward-compatible surface
  growth other stages can also reuse for a bare month number.
