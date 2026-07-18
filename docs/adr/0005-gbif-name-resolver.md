# 0005 — GBIF name resolver: join key, offline cache, and the "add a source" extension point

## Status

Accepted (Stage 1.1).

## Context

Stage 1.1 has three jobs (`docs/stage-1.1-brief.md`): a runnable pipeline shell,
a resolver that fills the Stage 0.2 schema's nullable `gbifId`, and an
offline-first cache so that resolution — and everything downstream of it —
never depends on a live network connection. Three design questions had to be
settled: **why GBIF, and how do we turn "onion" into a stable id**; **how does
"resolve once, cache to a committed file" actually work without becoming
stale or lying about network failures**; and **how do later stages (1.2's
PFAF/OpenFarm/Permapeople adapters) plug into the pipeline without reshaping
it**.

The code lives in `packages/etl/src/resolve/` (the resolver, cache, and
transport) and `packages/etl/src/pipeline/` (the shell and the source-adapter
interface).

## Decision

### 1. GBIF's taxonomic backbone is the join key, not a content source

`DESIGN.md` §2 identifies GBIF as "the canonical name resolver — the key to
merging all the above without duplicating 'onion' three ways", not a source of
growing-requirement facts. Stage 1.1 follows that exactly: the resolver's only
output is `{ gbifId, scientificName, matchType, confidence }` for a queried
name. PFAF/OpenFarm/Permapeople records (Stage 1.2) will each be resolved
against GBIF independently; the merge step (Stage 1.5) then reconciles records
that share a `gbifId`. This keeps the resolver's scope narrow and reusable —
it doesn't know or care which source is asking.

We call GBIF's public `/v1/species/match` endpoint, which does fuzzy taxonomic
matching in one request (rather than a separate search + lookup), and returns
a `matchType` (`EXACT` / `FUZZY` / `HIGHERRANK` / `NONE`) and a `confidence`
score we use to decide whether to trust the match at all (see §3).

**Synonym handling.** When GBIF's match is a synonym, the response includes
`acceptedUsageKey` — the id of the currently-accepted species. We use
`acceptedUsageKey ?? usageKey` as the resolved `gbifId`, so a record ends up
keyed by the accepted taxon rather than a synonym id that might not appear in
another source's own resolution of the "same" plant. We deliberately do
**not** chase a second GBIF request to fetch the accepted name's canonical
text — `scientificName` in the result is whatever GBIF returned for the
_query_, which is an accepted simplification for Stage 1.1 (see
Consequences).

### 2. The cache is a committed JSON file, and only confident GBIF answers are cacheable

`packages/etl/cache/gbif-name-cache.json` is committed to the repo, keyed by a
normalized (trimmed, lowercased) query string. `createGbifResolver` checks
this cache before ever considering the network — a cache hit never calls the
injected transport, which is exactly what the unit tests assert (see
`gbif-resolver.test.ts`). This mirrors the whole project's build-time-fetch /
run-time-offline split (`docs/adr/0003`): a contributor with network access
runs `npm run start -w @garden-planner/etl` once, commits the updated cache,
and everyone else — CI, offline contributors, unit tests — gets the same
answer for free.

The important nuance is **what counts as cacheable**. Three outcomes are
possible for a lookup:

- **`resolved`** — GBIF gave a confident match. Cached.
- **`unresolved`** — GBIF was reached and confidently said "nothing here"
  (`matchType: "NONE"`/`"HIGHERRANK"`, or a match below the confidence
  threshold). This is a real, trustworthy answer from GBIF, so it's cached
  too — otherwise every run would re-query a name that will never resolve.
- **`error`** — the _transport_ failed (network error, timeout, non-2xx, bad
  JSON) — GBIF was never actually consulted. This is **never cached**: caching
  a transient failure as "unresolved" would silently turn a temporary GBIF
  outage (or, as in this sandboxed session, a blocked egress policy — see
  Consequences) into a permanent wrong answer. The name is simply retried on
  the next run.

A confidence threshold (`minConfidence`, default 80) guards against GBIF's
fuzzy matcher returning a low-quality "closest guess" for a name it doesn't
really recognize — below the threshold, the result is treated as `unresolved`
rather than trusted as a real match.

### 3. The network call is isolated behind an injectable `GbifTransport`

`gbif-transport.ts` defines a one-method `GbifTransport` interface;
`createFetchGbifTransport()` is the only place `fetch` is called anywhere in
the resolver. Every unit test injects a stub transport with canned responses
instead (`gbif-resolver.test.ts`), so the suite proves the caching, synonym,
confidence-threshold, and error-handling logic without a network dependency —
satisfying the brief's "unit tests must not hit the network" requirement
directly, rather than by convention.

### 4. The "add a source" extension point

`pipeline/source.ts` defines `SourceAdapter` — `{ id, label, fetchRecords():
Promise<SourceRecord[]> }` — the contract Stage 1.2's PFAF/OpenFarm/Permapeople
adapters implement. `pipeline/run.ts`'s `runPipeline` takes a `sources: []`
array, fetches records from each, extracts the name to resolve from every
record, and resolves the whole batch. Adding a source is: write a module
implementing `SourceAdapter`, add it to the array passed to `runPipeline` —
nothing in the pipeline's sequencing changes, including the "zero sources
registered" case, which `runPipeline` reports plainly (0 names, 0 outcomes)
rather than silently substituting something else.

Until Stage 1.2 exists there's nothing to register, so `src/index.ts`
registers `pipeline/starter-source.ts`'s `starterNamesSource` — a small demo
`SourceAdapter` over a fixed name list (onion, lettuce, carrot, potato,
tomato) — so `npm run start -w @garden-planner/etl` is a real, observable
action today rather than a no-op waiting for 1.2. This demo fallback
deliberately lives at the call site (`index.ts`), not inside `runPipeline`
itself: an early version put the "no sources → use a starter list" branch
directly in the pipeline orchestrator, which meant a genuine misconfiguration
in a future run (e.g. Stage 1.2's adapter registry failing to populate) would
be indistinguishable from "intentionally running the Stage 1.1 demo" — both
would silently resolve five hardcoded crops. Moving the fallback to the
composition root keeps `runPipeline` honest about "zero sources" while still
giving Stage 1.1 something real to run.

## Alternatives considered

- **Resolve against PFAF/USDA names directly, skip GBIF.** Rejected: those
  sources use their own naming conventions, and we'd rebuild GBIF's fuzzy
  matching and synonym handling ourselves. `DESIGN.md` already settled on GBIF
  as the join key.
- **Cache everything, including transport errors, keyed with a TTL.** Rejected
  for Stage 1.1: a TTL adds real complexity (clock handling, expiry policy)
  for a build-time tool that's re-run manually, not on a schedule. The
  resolved/unresolved-vs-error split already gets the important property
  (don't cache what you didn't actually learn) without needing time-based
  invalidation; a TTL can be added later if the cache ever goes stale in
  practice.
- **A single "resolve" call with no separate transport abstraction.** Rejected:
  it would force either a real network call in every unit test or fragile
  `vi.mock('node:fetch')`-style global mocking. An explicit interface is more
  understandable and is the more testable pattern besides.
- **Chase a second GBIF request to fetch an accepted synonym's canonical
  scientific-name text.** Deferred rather than rejected outright — it's a
  reasonable Stage 1.2/1.5-time enhancement once real adapters exist to feel
  the actual impact; adding it now would be speculative complexity against no
  real synonym data yet.

## Consequences

- Every later stage that needs a `gbifId` (source adapters in 1.2, the merge
  in 1.5) reuses this one resolver rather than each rolling its own GBIF
  client.
- The resolved-vs-unresolved-vs-error split means a name transport failure
  during a run never corrupts the committed cache — a property proven directly
  by `gbif-resolver.test.ts`'s "reports a transport failure as an error
  outcome … and does not cache it" case.
- **This sandboxed session cannot reach `api.gbif.org`** — the environment's
  egress proxy returns a policy `403` for that host (confirmed via
  `/__agentproxy/status`, not something to route around per the proxy's own
  guidance). `npm run start -w @garden-planner/etl` was run as part of this
  stage's verification and correctly reports five `error` outcomes rather than
  crashing or silently caching bad data — but that also means
  `packages/etl/cache/gbif-name-cache.json` ships **empty** (`{}`) rather than
  pre-populated. A future contributor session with GBIF access should run
  `npm run start -w @garden-planner/etl` to populate it; nothing else about the
  design depends on that happening in this session.
- `scientificName` on a resolved outcome reflects GBIF's answer for the
  _query_, not necessarily a freshly-fetched accepted-name string when the
  match was a synonym (see §1) — a documented simplification, not a bug, that
  Stage 1.2/1.5 should be aware of if it ever surfaces a mismatch.
- **The transport validates the response shape before trusting it.**
  `createFetchGbifTransport` doesn't just `as`-cast the parsed JSON — it
  checks that `usageKey`/`confidence`/etc. actually have the types the
  resolver assumes, and throws (a retryable `error` outcome, not a cached
  one) otherwise. GBIF is an external API outside our control; treating a
  shape mismatch as a transport failure means a future API change surfaces
  as a loud, retried error rather than a `gbifId` silently poisoned with the
  wrong type. The same reasoning applies one level up: if GBIF returns a
  usable id and `matchType` but no name text at all (both `canonicalName` and
  `scientificName` absent — legal per the response type, if unlikely in
  practice), the resolver treats that as `unresolved` rather than caching the
  raw query string as a stand-in scientific name.
- **`main()` only rewrites the cache file when it actually changed.**
  Because a cache hit never mutates an existing entry (only a genuine miss
  adds one), comparing the entry count before and after a run is enough to
  detect "nothing new was learned" — cheaper than a deep-equality check and
  avoids a spurious write (and possible reformatting diff) on the committed
  cache file for a run that resolved everything from cache.
- `packages/etl/src/resolve/apply-resolution.ts` bridges a resolution back
  into a `Plant` via `@garden-planner/engine`'s own `validatePlant`, so filling
  `gbifId` is proven schema-valid rather than merely plausible — and the etl
  package now depends on `@garden-planner/engine` to get there, reusing the
  Stage 0.2 schema rather than re-declaring any part of it.
