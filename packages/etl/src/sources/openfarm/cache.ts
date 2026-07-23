/**
 * The offline-first cache for the OpenFarm crop dump (WORKPLAN.md Stage 1.2;
 * see `docs/adr/0006-openfarm-source-adapter.md`).
 *
 * Unlike `resolve/gbif-cache.ts`, which accumulates one entry per resolved
 * name over many runs, this is a single committed snapshot of the whole
 * source: `cache/openfarm-crops.json` **is** the source data, not a
 * derived index of it. A contributor with network access can run
 * {@link refreshOpenFarmCache} to re-fetch it; every other run — CI, an
 * offline contributor, a unit test — reads the committed file and never
 * touches the network. This is the same build-time-fetch / run-time-offline
 * split as the rest of the project (`docs/adr/0003`, `docs/adr/0005`).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { assertOpenFarmCropArray, type OpenFarmCropRaw } from './types.ts';
import type { OpenFarmTransport } from './transport.ts';

/**
 * The date this project's copy of the rescue dump was retrieved, used as the
 * `retrievedAt` on every record's provenance (see `map.ts`). Update this
 * alongside the cache file if {@link refreshOpenFarmCache} is ever run again.
 */
export const OPENFARM_CACHE_RETRIEVED_AT = '2026-07-18';

/**
 * Load the committed crop dump from disk. A missing file means "never
 * fetched yet" (e.g. a fresh clone before a maintainer first ran the refresh
 * script) — that's not a hard error, it just means an empty source, mirroring
 * `gbif-cache.ts`'s `loadCache`.
 */
export function loadOpenFarmCache(path: string): OpenFarmCropRaw[] {
  if (!existsSync(path)) {
    return [];
  }
  const raw = readFileSync(path, 'utf-8');
  return assertOpenFarmCropArray(JSON.parse(raw));
}

/**
 * Persist the dump to disk as pretty-printed JSON, sorted by `slug` for
 * stable diffs — the same reasoning as `gbif-cache.ts`'s key-sorted writes.
 */
export function saveOpenFarmCache(path: string, records: readonly OpenFarmCropRaw[]): void {
  const sorted = [...records].sort((a, b) => a.slug.localeCompare(b.slug));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`, 'utf-8');
}

/**
 * Re-fetch the dump over the network and overwrite the committed cache. This
 * is a manual maintenance action (there is no scheduled refresh), analogous
 * to running `npm run start -w @garden-planner/etl` to extend the GBIF cache —
 * it is **not** called by the pipeline itself, which always reads the
 * committed file via {@link loadOpenFarmCache}.
 */
export async function refreshOpenFarmCache(
  path: string,
  transport: OpenFarmTransport,
): Promise<void> {
  const records = await transport.fetchDump();
  saveOpenFarmCache(path, records);
}
