import { describe, expect, it, vi } from 'vitest';
import { runPipeline, STARTER_NAMES } from './run';
import type { GbifResolver, ResolveOutcome } from '../resolve/gbif-resolver';
import type { SourceAdapter } from './source';

/** A fake resolver whose `resolveMany` just echoes back canned outcomes, keyed by name. */
function fakeResolver(outcomesByName: Record<string, ResolveOutcome>): GbifResolver {
  return {
    resolve: vi.fn(async (name: string) => outcomesByName[name]),
    resolveMany: vi.fn(async (names: readonly string[]) =>
      names.map((name) => outcomesByName[name]),
    ),
    getCache: () => ({}),
  };
}

describe('runPipeline', () => {
  it('falls back to the starter names when no source adapters are registered', async () => {
    const outcomesByName = Object.fromEntries(
      STARTER_NAMES.map((name) => [
        name,
        { status: 'unresolved', query: name, fromCache: false } as ResolveOutcome,
      ]),
    );
    const resolver = fakeResolver(outcomesByName);

    const result = await runPipeline({ resolver, log: () => {} });

    expect(result.sourceCount).toBe(0);
    expect(resolver.resolveMany).toHaveBeenCalledWith(STARTER_NAMES);
    expect(result.outcomes).toHaveLength(STARTER_NAMES.length);
  });

  it('resolves names gathered from registered source adapters instead of the starter list', async () => {
    const source: SourceAdapter = {
      id: 'fixture-source',
      label: 'Fixture Source',
      fetchRecords: vi.fn(async () => [
        { name: 'kale', raw: {} },
        { name: 'chard', raw: {} },
      ]),
    };
    const resolver = fakeResolver({
      kale: {
        status: 'resolved',
        query: 'kale',
        gbifId: 42,
        scientificName: 'Brassica oleracea',
        matchType: 'EXACT',
        confidence: 95,
        fromCache: false,
      },
      chard: { status: 'unresolved', query: 'chard', fromCache: false },
    });

    const result = await runPipeline({ sources: [source], resolver, log: () => {} });

    expect(source.fetchRecords).toHaveBeenCalled();
    expect(resolver.resolveMany).toHaveBeenCalledWith(['kale', 'chard']);
    expect(result.sourceCount).toBe(1);
    expect(result.summary).toEqual({ resolved: 1, unresolved: 1, error: 0, fromCache: 0 });
  });

  it('summarizes resolved, unresolved, error, and cache-hit counts', async () => {
    const resolver = fakeResolver({
      onion: {
        status: 'resolved',
        query: 'onion',
        gbifId: 1,
        scientificName: 'Allium cepa',
        matchType: 'EXACT',
        confidence: 99,
        fromCache: true,
      },
      lettuce: {
        status: 'resolved',
        query: 'lettuce',
        gbifId: 2,
        scientificName: 'Lactuca sativa',
        matchType: 'EXACT',
        confidence: 99,
        fromCache: false,
      },
      carrot: { status: 'unresolved', query: 'carrot', fromCache: false },
      potato: { status: 'error', query: 'potato', message: 'boom' },
      tomato: { status: 'unresolved', query: 'tomato', fromCache: true },
    });

    const result = await runPipeline({ resolver, log: () => {} });

    expect(result.summary).toEqual({ resolved: 2, unresolved: 2, error: 1, fromCache: 2 });
  });

  it('logs progress instead of throwing when everything is provided a working logger', async () => {
    const resolver = fakeResolver(
      Object.fromEntries(
        STARTER_NAMES.map((name) => [
          name,
          { status: 'unresolved', query: name, fromCache: false } as ResolveOutcome,
        ]),
      ),
    );
    const messages: string[] = [];

    await runPipeline({ resolver, log: (message) => messages.push(message) });

    expect(messages.some((line) => line.includes('starting'))).toBe(true);
    expect(messages.some((line) => line.includes('Done:'))).toBe(true);
  });
});
