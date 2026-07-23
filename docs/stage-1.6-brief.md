# Stage 1.6 brief — location & climate static data

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(§"Climate / location data") and [`WORKPLAN.md`](../WORKPLAN.md) (§0 ground
rules, §1 validation strategy, and the Stage 1.6 entry) first; this brief
concentrates the requirements and the traps.

Stage 1.6 has **no dependency on Stage 1.5** — it hangs directly off the Stage
0.2 schema (`WORKPLAN.md` dependency map). It can be built entirely in parallel
with Phase 2. Stages 0.1–1.5 are done and on the branch you'll be given.

## Goal

Ship the **offline-capable climate context** the app needs to turn a "location"
into real horticultural advice, defaulting to Britain. Concretely: a static
lookup that, given a location, returns **frost dates, an RHS hardiness band, and
season timing**, plus a typed interface the suitability engine (Stage 2.1)
consumes. This is a _run-time static asset_ (like the Stage 1.5 dataset), not an
ETL ingest — it ships with the app and works with no network.

## Scope for this stage (read before over-building)

- **Deliver the offline static core in full.** A UK default profile plus a small,
  extensible set of regions; the climate-profile schema; the resolver interface;
  tests; an ADR; docs.
- **The online geocoding is _optional_ (a progressive enhancement) — you may
  defer it.** `WORKPLAN.md` lists it as "optional online geocoding as graceful
  progressive enhancement." If you build it, it must degrade cleanly to the
  offline default when offline (and be tested that way). If you defer it, define
  the resolver interface so geocoding can slot in later without a breaking change,
  and record the deferral in the ADR as follow-up work. **Do not** make the
  offline path depend on a network call — that would defeat the whole point.
- Note the network reality of this sandbox class: direct fetches to
  `rhs.org.uk` / Met Office endpoints are blocked at the egress proxy (the same
  403 pattern Stages 1.1–1.5 documented for GBIF/PFAF/RHS). So the climate
  figures are **hand-curated from known authoritative values with citations**,
  the same discipline the Stage 1.3 spacing table used — see
  `packages/etl/src/spacing/table.ts` for the citation style to mirror.

## Build on what the schema already gives you

The Stage 0.2 schema (`packages/engine/src/schema/plant.ts`) already has the
vocabulary a climate profile must speak — **reuse it, don't restate it**:

- `RHS_HARDINESS_RATINGS` / `RhsHardinessRatingSchema` / `rhsHardinessRank` — the
  ordered RHS band vocabulary. A _location_ carries a hardiness band; the engine
  (2.1) compares a _plant's_ `hardiness.rhsRating` against it, so both must use
  this same enum and rank helper.
- `MonthRangeSchema` (with the wrap-around-the-new-year semantics documented
  there) and `SeasonsSchema` — the shape for a growing-season / frost window.
- `HardinessSchema` (`rhsRating` + optional `minTempC`) — the pattern for
  carrying both an RHS band and a portable °C figure.

Keep **zod as the single source of truth** and derive types via `z.infer`,
exactly as every existing schema module does.

## What a climate profile needs to carry (your design call, document it)

At minimum, per region: an id/name, an **RHS hardiness band**, **average last
spring frost** and **first autumn frost** (as months, or month+approximate day —
decide and document), and a **growing-season** window derived from them. The
suitability engine (2.1) and the plot-definition UI (Stage 3.2) are the
consumers; design the interface for what they'll ask ("is it too cold here for
this plant?", "is it in season to sow X now?"). This is a genuine modelling
decision — record the shape and the frost-date representation in the ADR the way
Stages 0.2/1.3 recorded theirs.

## Where it should live

Suggested: a new framework-free module in **`packages/engine`** (e.g.
`packages/engine/src/location/` or `.../climate/`), exported from the engine's
public surface — the engine consumes it for scoring and the UI imports it too, so
the framework-free engine package is the natural home (mirrors how the schema
lives there). A separate `packages/location` package is a reasonable alternative
if you'd rather isolate it; justify whichever you pick in the ADR. Whatever you
choose, keep it **DOM/UI-framework-free** so it stays unit-testable in isolation
(`WORKPLAN.md` §0.2).

## Constraints & gotchas

- **Toolchain quirks already solved (don't re-discover):** single pinned Vite 6 /
  Vitest 3; Node ≥ 20; ESM (`"type": "module"`); strict TS with
  `verbatimModuleSyntax`. `packages/etl` needs explicit `.ts` extensions on
  relative imports (Node strip-types); `packages/engine` is bundled by Vite and
  does not — match whichever package you add code to.
- **Unit tests must never hit the network.** If you build the optional geocoder,
  inject its transport the way the GBIF resolver does
  (`packages/etl/src/resolve/gbif-transport.ts`) so tests use a stub, and test the
  offline-fallback path explicitly.
- **Don't guess figures.** Every frost date / hardiness band cites its source
  (RHS hardiness ratings, Met Office / RHS regional frost averages), recorded per
  region like the spacing table's per-figure citations.
- **Provenance/licensing:** climate averages are facts (not copyrightable), so
  this doesn't change the dataset licence — but note the sources in the ADR and,
  if you add region data anywhere user-facing, keep the citation trail.

## Deliverables

1. The climate-profile **zod schema** + inferred types (reusing the engine's
   hardiness/month vocabulary).
2. A **static UK-default profile** plus a small extensible set of regions,
   hand-curated with per-figure citations.
3. A **`resolveClimate(location)`-style interface** the engine consumes, with the
   UK default resolving **fully offline**. Optional geocoding either implemented
   (degrading cleanly offline, tested) or deferred with the interface ready for
   it.
4. **Tests:** UK default resolves offline; region lookup works; (if built)
   geocoding degrades cleanly when offline.
5. **ADR** `docs/adr/0010-*.md`: the climate-profile shape, the frost-date
   representation, where the module lives, and the geocoding build-or-defer call.
   Add it to `docs/adr/README.md`'s index.
6. Updated `docs/architecture.md` (and a package README if you add one).

## Definition of done (WORKPLAN §0.3)

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all green
from the repo root; new code commented per §0.2; ADR written; docs updated. Run
`/code-review` and `/verify` before finishing. Commit and push to the branch
you're given.

## Model

**Sonnet** — `WORKPLAN.md` Stage 1.6. Well-scoped static-data + interface work
with some modelling judgement (the frost-date/profile shape), squarely in
Sonnet's lane; no cross-cutting keystone decision here.

## After 1.6

With climate context available offline, the suitability engine (Stage 2.1, Opus)
can score hardiness/season against a real location instead of a hard-coded
default, and the plot-definition UI (Stage 3.2) can offer a location picker
backed by the region set.
