# Stage 1.1 brief — ETL scaffolding & name resolution

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md) and
[`WORKPLAN.md`](../WORKPLAN.md) first (especially §0 ground rules and the Stage
1.1 entry); this brief concentrates the requirements so you don't have to
reconstruct them. Stage 0.2 (the plant-record schema) is done and on `main` —
build on it, don't redefine it.

## Goal

Stand up the **build-time ETL pipeline skeleton** and a **GBIF-based
scientific-name resolver** that becomes the join key uniting every later data
source. Nothing in Phase 1 works until this exists: adapters (1.2) map into the
Stage 0.2 schema, and the merge (1.5) reconciles records by the GBIF id this
stage resolves.

## Where it lives

`packages/etl` — the developer-only, framework-free pipeline (never shipped; see
`docs/adr/0003`). The current `src/index.ts` is a scaffold marker (`runPipeline`).
Replace/extend it with a real, runnable shell. Keep the engine and etl packages
**framework-free** (no React/DOM). The resolver consumes the schema from
`@garden-planner/engine` (import `type Plant`, `validatePlant`, etc.) — do not
re-declare any schema shape.

## What to build

1. **A runnable pipeline shell.** A clear entry point (`npm run start -w
@garden-planner/etl`) that sequences steps and logs progress. Define a small,
   documented **"add a source" extension point** — an adapter interface later
   stages implement — so 1.2 slots sources in without reshaping the pipeline.
2. **A GBIF scientific-name resolver.** Given a common/scientific name, resolve it
   to a canonical GBIF taxon id and accepted scientific name (GBIF is the
   canonical name resolver per `DESIGN.md` §2). This is the value that fills the
   schema's nullable `gbifId`.
3. **A local cache (offline-first).** Resolve against the network **once**, then
   cache results to a committed file in the repo so a second run — and CI, and
   offline contributors — need **no network**. This mirrors the whole project's
   build-time-fetch / run-time-offline split (`docs/adr/0003`, WORKPLAN §0.1).
   Guard network calls so a cache hit never touches the network.

## Constraints & gotchas

- **Network policy / proxy.** External fetches (GBIF) may need the environment's
  agent proxy. Design so the resolver is **fully testable offline against the
  cache/fixtures** — unit tests must not hit the network. Consider a small
  injectable fetch/transport so tests supply canned GBIF responses.
- **Don't ingest real source data yet.** No PFAF/OpenFarm/Permapeople adapters
  here — that's Stage 1.2. Stage 1.1 is the shell + resolver + cache only.
- **Toolchain quirks already solved (don't re-discover):** single pinned Vite 6 /
  Vitest 3; Node ≥ 20; ESM (`"type": "module"`); strict TS with
  `verbatimModuleSyntax` (use `import type` for type-only imports). The etl `start`
  script runs TS directly via `node --experimental-strip-types`.

## Deliverables

1. A runnable `packages/etl` pipeline shell with a documented adapter extension
   point.
2. A GBIF name resolver with an in-repo cache (offline after first run).
3. **Unit tests (Vitest):** resolver maps a handful of known common names
   (e.g. onion → _Allium cepa_, GBIF id) correctly from cached/fixture data; a
   second run needs no network (assert the transport isn't called on a cache hit);
   an unresolvable name is handled gracefully (documented behaviour, not a crash).
4. **ADR** `docs/adr/0005-*.md`: the resolver + cache design — why GBIF is the
   join key, the cache/offline strategy, and how the "add a source" extension
   point works. Add it to the ADR index.
5. Update `docs/architecture.md` and/or a `packages/etl` README to reflect the
   pipeline shape and how to run it.

## Definition of done (WORKPLAN §0.3)

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all green
from the repo root; new code clearly commented (WORKPLAN §0.2); ADR written; docs
updated. Run `/code-review` (and `/verify` where there's a runnable surface to
drive) before finishing. Commit and push.

## Model

**Sonnet** (per WORKPLAN §4) — well-scoped pipeline/infra work once the schema
shape is set.
