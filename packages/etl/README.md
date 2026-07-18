# `@garden-planner/etl`

The build-time data pipeline. Runs only on a contributor's machine — **the
deployed app never runs this code** (see `docs/adr/0003`). Its job is to pull
plant data from external sources, normalize it into the Stage 0.2 `Plant`
schema (`@garden-planner/engine`), reconcile duplicates, validate everything,
and write the static dataset committed to `/data`. This package is
framework-free (no React/DOM), like `@garden-planner/engine`.

Full design reasoning: [`docs/adr/0005-gbif-name-resolver.md`](../../docs/adr/0005-gbif-name-resolver.md).

## Status (Stage 1.1)

What exists today:

- **A runnable pipeline shell** (`src/pipeline/run.ts`) that sequences
  "gather names to resolve → resolve them against GBIF → log progress".
- **A GBIF scientific-name resolver** (`src/resolve/`) that fills the schema's
  nullable `gbifId` — the join key later sources are reconciled by.
- **The "add a source" extension point** (`src/pipeline/source.ts`) — the
  `SourceAdapter` interface Stage 1.2's PFAF/OpenFarm/Permapeople adapters
  will implement. No real adapters exist yet; the pipeline runs a small
  built-in starter name list until they do.

Not yet built (arrives in later Phase 1 stages): real source adapters (1.2),
the hand-verified spacing table (1.3), companion data (1.4), and the
merge/validate/emit step that actually writes to `/data` (1.5).

## Running it

```bash
npm run start -w @garden-planner/etl
```

This loads the committed GBIF cache (`cache/gbif-name-cache.json`), resolves
every name it doesn't already have a cached answer for (currently the starter
list — `onion`, `lettuce`, `carrot`, `potato`, `tomato` — since no source
adapters are registered yet), logs each outcome, and writes any newly-learned
resolutions back to the cache file. Commit that file if it changed.

`npm run typecheck -w @garden-planner/etl` and `npm run test -w
@garden-planner/etl` work the same as any other workspace; `npm run build -w
@garden-planner/etl` type-checks (this package ships no compiled output — the
`start` script runs the TypeScript source directly).

## Offline-first: the cache

`cache/gbif-name-cache.json` is a **committed file**, not a build artifact you
regenerate from nothing each time. It's keyed by a normalized query name; each
entry is either a confident GBIF match or a confident "no match" — see the ADR
for why transport failures are deliberately never cached. Once a name is in
the cache, resolving it again never touches the network, which is what makes
CI, a fresh clone, and an offline contributor all work without GBIF access.

The committed cache currently ships **empty**: this development environment's
network egress policy blocks `api.gbif.org` (confirmed via the environment's
proxy status endpoint), so the resolver's live network path couldn't be
exercised in this session — only its offline/cached path (which is what the
unit tests cover). A contributor with GBIF access can run `npm run start -w
@garden-planner/etl` to populate it for real.

## Toolchain notes

- The `start` script runs source directly via `node --experimental-strip-types`
  (no separate build step). Unlike a bundler, Node's ESM resolver requires
  **explicit `.ts` extensions on relative imports** — that's why files in this
  package write `import { x } from './y.ts'` rather than `'./y'`. See
  `tsconfig.json` for the matching `allowImportingTsExtensions` flag.
- Everything else (strict TS, `verbatimModuleSyntax`, pinned Vite/Vitest,
  Node ≥ 20, ESM) follows the repo-wide conventions in `WORKPLAN.md` §0.5.

## Adding a source (Stage 1.2 and beyond)

Implement `SourceAdapter` from `src/pipeline/source.ts`:

```ts
import type { SourceAdapter } from '../pipeline/source.ts';

export const pfafAdapter: SourceAdapter = {
  id: 'pfaf',
  label: 'Plants For A Future',
  async fetchRecords() {
    // fetch/parse the source's own data, return one SourceRecord per plant
    // with `name` set to whatever this source calls it — the pipeline
    // resolves that name against GBIF for you.
    return [];
  },
};
```

Then pass it in: `runPipeline({ sources: [pfafAdapter], resolver })`. Mapping
`SourceRecord.raw` into a `Plant` (and any source-specific caching) is the
adapter's own concern — the pipeline only orchestrates and resolves names.

## Module map

```
src/
  index.ts               CLI entry point: loads the cache, runs the pipeline,
                          saves the cache. Executed by `npm run start`.
  pipeline/
    source.ts             SourceAdapter — the "add a source" extension point.
    run.ts                Orchestration: gather names → resolve → log → summarize.
  resolve/
    gbif-transport.ts      The network boundary (injectable; real fetch impl).
    gbif-cache.ts           Load/save the committed JSON cache.
    gbif-resolver.ts         Offline-first resolve logic (cache → transport).
    apply-resolution.ts      Fills a Plant's gbifId via @garden-planner/engine.
cache/
  gbif-name-cache.json    The committed, offline-first name-resolution cache.
```
