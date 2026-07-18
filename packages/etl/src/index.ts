/**
 * `@garden-planner/etl` — build-time data pipeline (developer tool, NOT shipped).
 *
 * This code runs on a contributor's machine to ingest external plant sources
 * (PFAF, Permapeople, the OpenFarm dump, GBIF, …), normalize them to the plant
 * schema, reconcile duplicates, validate every record, and emit the static
 * dataset committed under `/data`. The **deployed app never runs this code** —
 * that separation is what keeps the app offline-safe (see docs/adr/0003).
 *
 * Stage 1.1 added the runnable pipeline shell and the GBIF name-resolution
 * step (`docs/adr/0005-gbif-name-resolver.md`). Stage 1.2 adds the first real
 * source adapter, OpenFarm (`docs/adr/0006-openfarm-source-adapter.md`) —
 * registered below in place of Stage 1.1's `starterNamesSource` demo, which
 * was always a stand-in "until Stage 1.2 registers real ones" (see
 * `pipeline/starter-source.ts`). PFAF and Permapeople, and the merge/
 * validation gate that actually writes `/data`, arrive in Stages 1.2–1.5.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGbifResolver } from './resolve/gbif-resolver.ts';
import type { GbifTransport } from './resolve/gbif-transport.ts';
import { loadCache, saveCache } from './resolve/gbif-cache.ts';
import { runPipeline } from './pipeline/run.ts';
import type { PipelineResult } from './pipeline/run.ts';
import type { SourceAdapter } from './pipeline/source.ts';
import { openfarmSource } from './sources/openfarm/source.ts';

/**
 * The committed GBIF name-resolution cache. Lives in `packages/etl/cache`,
 * not `/data` — `/data` is the final validated `Plant` dataset artifact
 * (Stage 1.5), while this is an ETL-internal intermediate the resolver reads
 * and writes. See `packages/etl/README.md`.
 */
export const CACHE_PATH = fileURLToPath(new URL('../cache/gbif-name-cache.json', import.meta.url));

export interface MainOptions {
  /** Where the committed cache lives. Defaults to `CACHE_PATH`; tests override with a temp path. */
  cachePath?: string;
  /**
   * Source adapters to run. Defaults to the Stage 1.2 OpenFarm adapter — this
   * is the one place that decision is made; `runPipeline` itself stays
   * agnostic to which sources are registered (`pipeline/source.ts`).
   */
  sources?: SourceAdapter[];
  /** Injectable GBIF transport. Defaults to the real fetch-backed client; tests inject a stub. */
  transport?: GbifTransport;
}

/**
 * Run the full pipeline once: load the cache, resolve names (from `sources`,
 * defaulting to the OpenFarm adapter), and persist any newly-learned
 * resolutions back to the cache file — but only if resolving actually taught
 * the resolver something new. An unchanged cache is never rewritten: every
 * cache hit is served from the loaded cache without modifying it, so if the
 * key count after the run matches the key count before it, nothing new was
 * learned and there is nothing to commit.
 */
export async function main(options: MainOptions = {}): Promise<PipelineResult> {
  const cachePath = options.cachePath ?? CACHE_PATH;
  const sources = options.sources ?? [openfarmSource];

  const cache = loadCache(cachePath);
  const resolver = createGbifResolver({ cache, transport: options.transport });

  const result = await runPipeline({ sources, resolver });

  const updatedCache = resolver.getCache();
  if (Object.keys(updatedCache).length !== Object.keys(cache).length) {
    saveCache(cachePath, updatedCache);
  }
  return result;
}

// When executed directly (e.g. `npm run start -w @garden-planner/etl`), run
// the pipeline and report status. This is developer convenience only; it is
// never bundled into the app. Compares as `file://` URLs (via
// `pathToFileURL`, not string concatenation) so this also works on Windows,
// where `process.argv[1]` is a backslash path that `file://${...}` would
// never match against `import.meta.url`.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error('ETL pipeline failed:', error);
    process.exitCode = 1;
  });
}
