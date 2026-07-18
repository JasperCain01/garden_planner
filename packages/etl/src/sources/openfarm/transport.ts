/**
 * The network boundary for refreshing the OpenFarm crop dump, isolated behind
 * an interface for the same reason `gbif-transport.ts` isolates GBIF: unit
 * tests must never need a real connection (WORKPLAN.md Stage 1.1 brief,
 * carried forward into Stage 1.2 — see `docs/adr/0006-openfarm-source-adapter.md`).
 *
 * Unlike GBIF (one request per name), OpenFarm here is a single static file —
 * there is no live API to call (see the ADR for why). "Transport" therefore
 * means "fetch the whole rescued dump", and in practice this is only ever
 * exercised by a contributor manually refreshing `cache/openfarm-crops.json`,
 * not by the pipeline itself, which always reads the committed cache (see
 * `cache.ts`).
 */

import { assertOpenFarmCropArray, type OpenFarmCropRaw } from './types.ts';

/** The rescued dump this project builds on. See the ADR for the source choice. */
const OPENFARM_DUMP_URL =
  'https://raw.githubusercontent.com/thefullnacho/openfarm-crops-rescue/master/crops.json';

/** How long to wait before treating the fetch as a transport failure. */
const REQUEST_TIMEOUT_MS = 15000;

/** Injectable transport so refreshing the cache is testable without a network call. */
export interface OpenFarmTransport {
  /** Fetch the full crop dump. Throws on any transport failure (network, non-2xx, bad shape). */
  fetchDump(): Promise<OpenFarmCropRaw[]>;
}

/**
 * The real transport, backed by the platform `fetch`. Kept tiny on purpose —
 * see `gbif-transport.ts` for the sibling pattern this mirrors.
 */
export function createFetchOpenFarmTransport(fetchImpl: typeof fetch = fetch): OpenFarmTransport {
  return {
    async fetchDump(): Promise<OpenFarmCropRaw[]> {
      const response = await fetchImpl(OPENFARM_DUMP_URL, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(
          `OpenFarm crop dump fetch returned ${response.status} ${response.statusText}`,
        );
      }
      return assertOpenFarmCropArray(await response.json());
    },
  };
}
