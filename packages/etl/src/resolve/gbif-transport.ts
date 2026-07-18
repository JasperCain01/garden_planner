/**
 * The network boundary of the GBIF resolver, isolated behind an interface so
 * unit tests never need a real connection (see `docs/adr/0005-gbif-name-resolver.md`).
 *
 * `GbifTransport` is the only place `fetch` is called in the resolver. Tests
 * inject a stub implementation with canned responses; production code uses
 * `createFetchGbifTransport()`, which hits GBIF's public
 * [species/match](https://www.gbif.org/developer/species#searching) endpoint.
 */

/**
 * The subset of GBIF's `/v1/species/match` response we care about. GBIF
 * returns more fields (kingdom, phylum, …) that the resolver doesn't need.
 *
 * - `matchType` is `"NONE"` when GBIF found nothing usable; `"EXACT"` or
 *   `"FUZZY"` for a real match; `"HIGHERRANK"` when it only matched a genus or
 *   higher (not specific enough to be a useful `gbifId`).
 * - `synonym` + `acceptedUsageKey` appear when the matched name is a synonym
 *   of a currently-accepted species — see the resolution logic in `gbif-resolver.ts`.
 */
export interface GbifMatchResponse {
  usageKey?: number;
  acceptedUsageKey?: number;
  scientificName?: string;
  canonicalName?: string;
  confidence?: number;
  matchType?: 'EXACT' | 'FUZZY' | 'HIGHERRANK' | 'NONE';
  synonym?: boolean;
}

/** Injectable transport so the resolver is testable without a network call. */
export interface GbifTransport {
  /**
   * Look up a single name against GBIF's taxonomic backbone. Never throws for
   * "no match" (GBIF reports that as `matchType: "NONE"`, a normal response);
   * it throws only for genuine transport failures (network error, non-2xx,
   * malformed JSON), which callers treat as retryable rather than cacheable.
   */
  matchName(name: string): Promise<GbifMatchResponse>;
}

const GBIF_MATCH_URL = 'https://api.gbif.org/v1/species/match';

/** How long to wait for GBIF before treating the call as a transport failure. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * The real transport, backed by the platform `fetch`. Kept tiny on purpose —
 * all the interesting logic (caching, synonym resolution, confidence
 * thresholds) lives in `gbif-resolver.ts`, not here.
 */
export function createFetchGbifTransport(fetchImpl: typeof fetch = fetch): GbifTransport {
  return {
    async matchName(name: string): Promise<GbifMatchResponse> {
      const url = new URL(GBIF_MATCH_URL);
      url.searchParams.set('name', name);

      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(
          `GBIF species/match returned ${response.status} ${response.statusText} for "${name}"`,
        );
      }

      return (await response.json()) as GbifMatchResponse;
    },
  };
}
