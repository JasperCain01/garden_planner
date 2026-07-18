import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_PATH, main } from './index.ts';
import { loadCache, saveCache } from './resolve/gbif-cache.ts';
import type { GbifMatchResponse, GbifTransport } from './resolve/gbif-transport.ts';
import type { SourceAdapter } from './pipeline/source.ts';

// This suite never lets `main()` fall back to its real, fetch-backed GBIF
// transport or the committed cache file — every test injects a stub
// transport and a throwaway temp-directory cache path, so `main()`'s full
// composition (loadCache → createGbifResolver → runPipeline → saveCache) is
// exercised end to end without ever touching the network or the real
// packages/etl/cache/gbif-name-cache.json (see docs/adr/0005-gbif-name-resolver.md).

function stubTransport(responses: Record<string, GbifMatchResponse>): GbifTransport {
  return {
    matchName: vi.fn(async (name: string) => {
      const response = responses[name];
      if (!response) throw new Error(`stubTransport: no canned response for "${name}"`);
      return response;
    }),
  };
}

function fixtureSource(names: string[]): SourceAdapter {
  return {
    id: 'fixture',
    label: 'Fixture source',
    fetchRecords: async () => names.map((name) => ({ name, raw: null })),
  };
}

describe('etl entry point', () => {
  it('points the committed cache at packages/etl/cache/gbif-name-cache.json', () => {
    expect(CACHE_PATH.replaceAll('\\', '/')).toMatch(
      /packages\/etl\/cache\/gbif-name-cache\.json$/,
    );
  });

  describe('main()', () => {
    let dir: string;
    let cachePath: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'etl-main-test-'));
      cachePath = join(dir, 'gbif-name-cache.json');
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('resolves names, writes newly-learned resolutions to the cache file, and needs no network on the next run', async () => {
      const transport = stubTransport({
        onion: {
          usageKey: 1000001,
          canonicalName: 'Allium cepa',
          matchType: 'EXACT',
          confidence: 98,
        },
      });

      const first = await main({ cachePath, sources: [fixtureSource(['onion'])], transport });
      expect(first.summary).toEqual({ resolved: 1, unresolved: 0, error: 0, fromCache: 0 });
      expect(loadCache(cachePath)).toEqual({
        onion: {
          status: 'resolved',
          gbifId: 1000001,
          scientificName: 'Allium cepa',
          matchType: 'EXACT',
          confidence: 98,
        },
      });

      // Second run: a fresh transport that would throw if ever called proves
      // the cache file written above is what serves this run, not the network.
      const secondTransport = stubTransport({});
      const second = await main({
        cachePath,
        sources: [fixtureSource(['onion'])],
        transport: secondTransport,
      });

      expect(second.summary).toEqual({ resolved: 1, unresolved: 0, error: 0, fromCache: 1 });
      expect(secondTransport.matchName).not.toHaveBeenCalled();
    });

    it('does not rewrite the cache file when nothing new was learned', async () => {
      saveCache(cachePath, {
        onion: {
          status: 'resolved',
          gbifId: 1000001,
          scientificName: 'Allium cepa',
          matchType: 'EXACT',
          confidence: 98,
        },
      });
      const before = loadCache(cachePath);
      const transport = stubTransport({});

      await main({ cachePath, sources: [fixtureSource(['onion'])], transport });

      expect(loadCache(cachePath)).toEqual(before);
    });

    it('defaults to the OpenFarm adapter (Stage 1.2) when no sources are provided', async () => {
      // A catch-all transport: every OpenFarm record this adapter maps carries
      // a binomial name to resolve, and this suite only cares that *some*
      // real, non-trivial batch of them went through — not the exact count,
      // which would make this test brittle against `categories.ts` growing.
      const transport: GbifTransport = {
        matchName: vi.fn(async (name: string) => ({
          usageKey: name.length, // any stable-ish number; the value isn't asserted on
          matchType: 'EXACT' as const,
          confidence: 95,
          canonicalName: name,
        })),
      };

      const result = await main({ cachePath, transport });

      expect(result.sourceCount).toBe(1);
      // The real committed OpenFarm cache maps well over a hundred crops
      // (see `sources/openfarm/categories.ts`) — asserting "a lot, and zero
      // errors" proves the default source is real and offline-readable
      // without hard-coding a count that would drift as curation grows.
      expect(result.summary.resolved).toBeGreaterThan(100);
      expect(result.summary.error).toBe(0);
      expect(result.summary.unresolved).toBe(0);
    });
  });
});
