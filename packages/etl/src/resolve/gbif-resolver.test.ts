import { describe, expect, it, vi } from 'vitest';
import { createGbifResolver } from './gbif-resolver';
import type { GbifMatchResponse, GbifTransport } from './gbif-transport';
import type { NameCache } from './gbif-cache';

/**
 * A stub transport with canned responses, keyed by the exact query string.
 * Standing in for the network per the Stage 1.1 brief: unit tests must never
 * hit GBIF, so every test in this file injects this instead of the real
 * `fetch`-backed transport.
 */
function stubTransport(
  responses: Record<string, GbifMatchResponse | 'network-error'>,
): GbifTransport {
  return {
    matchName: vi.fn(async (name: string) => {
      const response = responses[name];
      if (response === undefined) {
        throw new Error(`stubTransport: no canned response for "${name}"`);
      }
      if (response === 'network-error') {
        throw new Error('simulated network failure');
      }
      return response;
    }),
  };
}

describe('createGbifResolver', () => {
  it('resolves a known common name to its GBIF id and scientific name', async () => {
    const transport = stubTransport({
      onion: {
        usageKey: 1000001,
        canonicalName: 'Allium cepa',
        scientificName: 'Allium cepa L.',
        matchType: 'EXACT',
        confidence: 98,
        synonym: false,
      },
    });
    const resolver = createGbifResolver({ transport });

    const outcome = await resolver.resolve('onion');

    expect(outcome).toMatchObject({
      status: 'resolved',
      query: 'onion',
      gbifId: 1000001,
      scientificName: 'Allium cepa',
      fromCache: false,
    });
  });

  it('resolves several known common names in one batch', async () => {
    const transport = stubTransport({
      onion: {
        usageKey: 1000001,
        canonicalName: 'Allium cepa',
        matchType: 'EXACT',
        confidence: 98,
      },
      lettuce: {
        usageKey: 1000002,
        canonicalName: 'Lactuca sativa',
        matchType: 'FUZZY',
        confidence: 92,
      },
    });
    const resolver = createGbifResolver({ transport });

    const outcomes = await resolver.resolveMany(['onion', 'lettuce']);

    expect(outcomes).toEqual([
      expect.objectContaining({
        status: 'resolved',
        gbifId: 1000001,
        scientificName: 'Allium cepa',
      }),
      expect.objectContaining({
        status: 'resolved',
        gbifId: 1000002,
        scientificName: 'Lactuca sativa',
      }),
    ]);
  });

  it('prefers the accepted taxon id when the match is a synonym', async () => {
    const transport = stubTransport({
      sweetcorn: {
        usageKey: 2000001, // the synonym's own key
        acceptedUsageKey: 1000009, // the currently-accepted species' key
        canonicalName: 'Zea mays',
        matchType: 'EXACT',
        confidence: 97,
        synonym: true,
      },
    });
    const resolver = createGbifResolver({ transport });

    const outcome = await resolver.resolve('sweetcorn');

    expect(outcome).toMatchObject({ status: 'resolved', gbifId: 1000009 });
  });

  it('serves a cache hit without calling the transport (offline-first)', async () => {
    const transport = stubTransport({
      onion: {
        usageKey: 1000001,
        canonicalName: 'Allium cepa',
        matchType: 'EXACT',
        confidence: 98,
      },
    });
    const cache: NameCache = {
      onion: {
        status: 'resolved',
        gbifId: 1000001,
        scientificName: 'Allium cepa',
        matchType: 'EXACT',
        confidence: 98,
      },
    };
    const resolver = createGbifResolver({ transport, cache });

    const outcome = await resolver.resolve('Onion'); // different case → same cache key

    expect(outcome).toMatchObject({ status: 'resolved', gbifId: 1000001, fromCache: true });
    expect(transport.matchName).not.toHaveBeenCalled();
  });

  it('caches a resolution after the first (network) lookup so a second call needs no network', async () => {
    const transport = stubTransport({
      onion: {
        usageKey: 1000001,
        canonicalName: 'Allium cepa',
        matchType: 'EXACT',
        confidence: 98,
      },
    });
    const resolver = createGbifResolver({ transport });

    const first = await resolver.resolve('onion');
    const second = await resolver.resolve('onion');

    expect(first).toMatchObject({ status: 'resolved', fromCache: false });
    expect(second).toMatchObject({ status: 'resolved', fromCache: true });
    expect(transport.matchName).toHaveBeenCalledTimes(1);
  });

  it('handles an unrecognized name gracefully, without throwing', async () => {
    const transport = stubTransport({
      'not-a-real-plant': { matchType: 'NONE', confidence: 0, synonym: false },
    });
    const resolver = createGbifResolver({ transport });

    const outcome = await resolver.resolve('not-a-real-plant');

    expect(outcome).toEqual({ status: 'unresolved', query: 'not-a-real-plant', fromCache: false });
  });

  it('treats a low-confidence fuzzy match as unresolved rather than trusting a weak guess', async () => {
    const transport = stubTransport({
      vague: { usageKey: 999, canonicalName: 'Something spp.', matchType: 'FUZZY', confidence: 40 },
    });
    const resolver = createGbifResolver({ transport, minConfidence: 80 });

    const outcome = await resolver.resolve('vague');

    expect(outcome.status).toBe('unresolved');
  });

  it('caches a confident "no match" so it is not re-queried on the next run', async () => {
    const transport = stubTransport({
      gibberish: { matchType: 'NONE', confidence: 0 },
    });
    const resolver = createGbifResolver({ transport });

    await resolver.resolve('gibberish');
    const cache = resolver.getCache();

    expect(cache.gibberish).toEqual({ status: 'unresolved' });

    // A fresh resolver loaded from that cache must not call the transport again.
    const secondTransport = stubTransport({});
    const secondResolver = createGbifResolver({ transport: secondTransport, cache });
    const outcome = await secondResolver.resolve('gibberish');

    expect(outcome).toMatchObject({ status: 'unresolved', fromCache: true });
    expect(secondTransport.matchName).not.toHaveBeenCalled();
  });

  it('reports a transport failure as an error outcome without throwing, and does not cache it', async () => {
    const transport = stubTransport({ onion: 'network-error' });
    const resolver = createGbifResolver({ transport });

    const outcome = await resolver.resolve('onion');

    expect(outcome).toMatchObject({ status: 'error', query: 'onion' });
    expect(outcome.status === 'error' && outcome.message).toContain('simulated network failure');
    expect(resolver.getCache()).toEqual({});
  });
});
