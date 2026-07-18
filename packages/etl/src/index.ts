/**
 * `@garden-planner/etl` — build-time data pipeline (developer tool, NOT shipped).
 *
 * This code runs on a contributor's machine to ingest external plant sources
 * (PFAF, Permapeople, the OpenFarm dump, GBIF, …), normalize them to the plant
 * schema, reconcile duplicates, validate every record, and emit the static
 * dataset committed under `/data`. The **deployed app never runs this code** —
 * that separation is what keeps the app offline-safe (see docs/adr/0003).
 *
 * Stage 1.1 (this file) adds the runnable pipeline shell and the GBIF
 * name-resolution step; see `docs/adr/0005-gbif-name-resolver.md`. Source
 * adapters (PFAF, OpenFarm, Permapeople) and the merge/validation gate arrive
 * in Stages 1.2–1.5.
 */

import { fileURLToPath } from 'node:url';
import { createGbifResolver } from './resolve/gbif-resolver.ts';
import { loadCache, saveCache } from './resolve/gbif-cache.ts';
import { runPipeline } from './pipeline/run.ts';
import type { PipelineResult } from './pipeline/run.ts';

/**
 * The committed GBIF name-resolution cache. Lives in `packages/etl/cache`,
 * not `/data` — `/data` is the final validated `Plant` dataset artifact
 * (Stage 1.5), while this is an ETL-internal intermediate the resolver reads
 * and writes. See `packages/etl/README.md`.
 */
export const CACHE_PATH = fileURLToPath(new URL('../cache/gbif-name-cache.json', import.meta.url));

/**
 * Run the full pipeline once, using the real GBIF transport and the committed
 * cache file: load the cache, resolve names (source-adapter names once Stage
 * 1.2 exists, `STARTER_NAMES` until then), and persist any newly-learned
 * resolutions back to the cache file so the next run needs no network for
 * those names.
 */
export async function main(): Promise<PipelineResult> {
  const cache = loadCache(CACHE_PATH);
  const resolver = createGbifResolver({ cache });

  const result = await runPipeline({ resolver });

  saveCache(CACHE_PATH, resolver.getCache());
  return result;
}

// When executed directly (e.g. `npm run start -w @garden-planner/etl`), run
// the pipeline and report status. This is developer convenience only; it is
// never bundled into the app.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error('ETL pipeline failed:', error);
    process.exitCode = 1;
  });
}
