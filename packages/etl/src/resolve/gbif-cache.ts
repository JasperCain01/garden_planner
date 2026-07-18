/**
 * The offline-first cache for GBIF name resolutions (WORKPLAN.md Stage 1.1;
 * see `docs/adr/0005-gbif-name-resolver.md` for the reasoning).
 *
 * The cache is a plain JSON file **committed to the repo**. A contributor with
 * network access runs the pipeline once to populate/extend it; from then on,
 * every other run — CI, an offline contributor, a unit test — reads the
 * committed file and never touches the network for a name already in it. This
 * is the same build-time-fetch / run-time-offline split the whole project
 * follows (`docs/adr/0003`).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** A confident, cacheable answer from GBIF for one query name. */
export interface CachedResolution {
  readonly status: 'resolved';
  /** The canonical (or accepted, if the match was a synonym) GBIF taxon id. */
  readonly gbifId: number;
  /** The scientific name GBIF associates with that id. */
  readonly scientificName: string;
  /** GBIF's match quality for this lookup — kept for future debugging/audit. */
  readonly matchType: string;
  readonly confidence: number;
}

/**
 * A confident "GBIF has nothing usable for this name" answer. This is still
 * cacheable and still offline-safe: it's a real answer from GBIF, just a
 * negative one, so a name that genuinely has no match doesn't get re-queried
 * on every run (see the resolver's handling of unresolvable names).
 */
export interface CachedMiss {
  readonly status: 'unresolved';
}

export type CacheEntry = CachedResolution | CachedMiss;

/**
 * Cache keyed by a normalized query string. See {@link normalizeQuery} — this
 * is what makes `"Onion"` and `" onion "` share a cache entry.
 */
export type NameCache = Record<string, CacheEntry>;

/**
 * Normalize a query name for use as a cache key: trim whitespace and
 * lowercase. Keeps the cache resilient to incidental formatting differences
 * between sources (an adapter's "Onion" vs. another's "onion ") without
 * pretending to do real taxonomic normalization — that's GBIF's job.
 */
export function normalizeQuery(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Load a cache file from disk. Missing file is not an error — it means "no
 * cache yet" (e.g. a fresh clone before the first pipeline run), so this
 * returns an empty cache rather than throwing.
 */
export function loadCache(path: string): NameCache {
  if (!existsSync(path)) {
    return {};
  }
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as NameCache;
}

/**
 * Persist a cache to disk as pretty-printed, key-sorted JSON. Keys are sorted
 * so the committed file produces small, stable diffs (a new entry doesn't
 * reshuffle unrelated lines) regardless of the order names were resolved in.
 */
export function saveCache(path: string, cache: NameCache): void {
  const sorted: NameCache = {};
  for (const key of Object.keys(cache).sort()) {
    sorted[key] = cache[key];
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`, 'utf-8');
}
