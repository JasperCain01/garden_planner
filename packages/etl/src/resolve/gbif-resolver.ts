/**
 * The GBIF scientific-name resolver (WORKPLAN.md Stage 1.1).
 *
 * Given a common or scientific name, resolves it to a canonical GBIF taxon id
 * — the value that fills the Stage 0.2 schema's nullable `Plant.gbifId` — via
 * GBIF's taxonomic backbone (`DESIGN.md` §2: "GBIF ties them together by
 * scientific name"). This is the join key later source adapters (Stage 1.2)
 * and the merge step (Stage 1.5) reconcile records by.
 *
 * Offline-first by construction: every lookup checks the cache first and only
 * calls the injected `GbifTransport` on a miss (see `gbif-cache.ts` and
 * `gbif-transport.ts`, and `docs/adr/0005-gbif-name-resolver.md` for why the
 * design is split this way).
 */

import type { GbifTransport } from './gbif-transport.ts';
import { createFetchGbifTransport } from './gbif-transport.ts';
import type { CacheEntry, CachedResolution, NameCache } from './gbif-cache.ts';
import { normalizeQuery } from './gbif-cache.ts';

/**
 * A confident resolution: GBIF matched the name to a usable taxon. Extends
 * the cache entry shape directly (rather than re-declaring `gbifId`/
 * `scientificName`/`matchType`/`confidence`) so the two can't drift apart.
 */
export interface ResolvedOutcome extends Omit<CachedResolution, 'status'> {
  readonly status: 'resolved';
  /** The name as originally queried (before normalization). */
  readonly query: string;
  /** Whether this answer came from the cache (no network call was made). */
  readonly fromCache: boolean;
}

/**
 * A confident negative: GBIF was reached (or the cache already recorded a
 * prior confident negative) and there is no usable match. This is *not* an
 * error — it's documented, expected behaviour for names GBIF doesn't
 * recognize (a misspelling, a non-taxonomic name, a too-vague common name).
 */
export interface UnresolvedOutcome {
  readonly status: 'unresolved';
  readonly query: string;
  readonly fromCache: boolean;
}

/**
 * A transport failure (network error, GBIF outage, malformed response) — not
 * a GBIF answer at all. Deliberately **never cached**: caching a transient
 * failure as "unresolved" would wrongly turn a temporary outage into a
 * permanent, silently-wrong answer. The name is simply retried on the next run.
 */
export interface ErrorOutcome {
  readonly status: 'error';
  readonly query: string;
  readonly message: string;
}

export type ResolveOutcome = ResolvedOutcome | UnresolvedOutcome | ErrorOutcome;

export interface GbifResolverOptions {
  /** Injectable transport; defaults to a real `fetch`-backed GBIF client. */
  transport?: GbifTransport;
  /** Initial cache contents, typically loaded from the committed cache file. */
  cache?: NameCache;
  /**
   * Below this GBIF confidence score (0–100), treat a match as unresolved
   * rather than trusting it. GBIF's fuzzy matcher can return a low-confidence
   * "closest guess" for a name it doesn't really recognize; a threshold stops
   * that guess from silently becoming a wrong `gbifId`. Defaults to 80,
   * chosen to accept GBIF's own EXACT/high-confidence FUZZY matches while
   * rejecting weak guesses — see the ADR for the reasoning.
   */
  minConfidence?: number;
}

export interface GbifResolver {
  /** Resolve one name, checking the cache before ever considering the network. */
  resolve(name: string): Promise<ResolveOutcome>;
  /**
   * Resolve several names in sequence. Sequential (not `Promise.all`) is
   * deliberate: this is a build-time tool talking to a shared public API, not
   * a latency-sensitive request path, so there's no reason to hammer GBIF
   * with concurrent requests when a simple queue is just as correct.
   */
  resolveMany(names: readonly string[]): Promise<ResolveOutcome[]>;
  /** A snapshot of the resolver's current cache, for persisting to disk. */
  getCache(): NameCache;
}

/** Create a resolver. See {@link GbifResolverOptions} for the injection points tests use. */
export function createGbifResolver(options: GbifResolverOptions = {}): GbifResolver {
  const transport = options.transport ?? createFetchGbifTransport();
  const minConfidence = options.minConfidence ?? 80;
  // Copy the incoming cache so mutating it here never mutates the caller's object.
  const cache: NameCache = { ...(options.cache ?? {}) };

  function toResolvedOutcome(
    query: string,
    entry: Omit<CachedResolution, 'status'>,
    fromCache: boolean,
  ): ResolvedOutcome {
    return { status: 'resolved', query, fromCache, ...entry };
  }

  async function resolve(name: string): Promise<ResolveOutcome> {
    const key = normalizeQuery(name);
    const cached = cache[key];
    if (cached) {
      return cached.status === 'resolved'
        ? toResolvedOutcome(name, cached, true)
        : { status: 'unresolved', query: name, fromCache: true };
    }

    let response;
    try {
      response = await transport.matchName(name);
    } catch (error) {
      // Transport failure: not cached, so this name is retried next run.
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'error', query: name, message };
    }

    const gbifId = response.acceptedUsageKey ?? response.usageKey;
    const confidence = response.confidence ?? 0;
    // GBIF can, in principle, return a matched id with no name text at all.
    // Trusting the raw query string as a stand-in "scientific name" would
    // silently cache a common name (e.g. "onion") as if GBIF had vouched for
    // it — so a match with no name string is treated as unresolved rather
    // than guessed at.
    const scientificName = response.canonicalName ?? response.scientificName;
    const isUsableMatch =
      response.matchType !== undefined &&
      response.matchType !== 'NONE' &&
      response.matchType !== 'HIGHERRANK' &&
      gbifId !== undefined &&
      scientificName !== undefined &&
      confidence >= minConfidence;

    if (!isUsableMatch) {
      const entry: CacheEntry = { status: 'unresolved' };
      cache[key] = entry;
      return { status: 'unresolved', query: name, fromCache: false };
    }

    const entry: CachedResolution = {
      status: 'resolved',
      gbifId,
      scientificName,
      matchType: response.matchType!,
      confidence,
    };
    cache[key] = entry;
    return toResolvedOutcome(name, entry, false);
  }

  async function resolveMany(names: readonly string[]): Promise<ResolveOutcome[]> {
    const outcomes: ResolveOutcome[] = [];
    for (const name of names) {
      outcomes.push(await resolve(name));
    }
    return outcomes;
  }

  return {
    resolve,
    resolveMany,
    getCache: () => ({ ...cache }),
  };
}
