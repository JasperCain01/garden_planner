import { describe, expect, it, vi } from 'vitest';
import { runPipeline } from './run.ts';
import type { GbifResolver, ResolveOutcome } from '../resolve/gbif-resolver.ts';
import type { SourceAdapter } from './source.ts';

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

/** A fixture source adapter yielding one `SourceRecord` per given name. */
function fixtureSource(id: string, names: string[]): SourceAdapter {
  return {
    id,
    label: `Fixture: ${id}`,
    fetchRecords: vi.fn(async () => names.map((name) => ({ name, raw: null }))),
  };
}

describe('runPipeline', () => {
  it('resolves nothing and reports zero sources when none are registered', async () => {
    const resolver = fakeResolver({});

    const result = await runPipeline({ resolver, log: () => {} });

    expect(result.sourceCount).toBe(0);
    expect(result.outcomes).toEqual([]);
    expect(resolver.resolveMany).toHaveBeenCalledWith([]);
  });

  it('resolves names gathered from every registered source adapter', async () => {
    const source = fixtureSource('fixture-source', ['kale', 'chard']);
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

  it('gathers names from multiple registered sources in order', async () => {
    const sourceA = fixtureSource('a', ['onion']);
    const sourceB = fixtureSource('b', ['lettuce']);
    const resolver = fakeResolver({
      onion: { status: 'unresolved', query: 'onion', fromCache: false },
      lettuce: { status: 'unresolved', query: 'lettuce', fromCache: false },
    });

    const result = await runPipeline({ sources: [sourceA, sourceB], resolver, log: () => {} });

    expect(resolver.resolveMany).toHaveBeenCalledWith(['onion', 'lettuce']);
    expect(result.sourceCount).toBe(2);
  });

  it('summarizes resolved, unresolved, error, and cache-hit counts', async () => {
    const names = ['onion', 'lettuce', 'carrot', 'potato', 'tomato'];
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

    const result = await runPipeline({
      sources: [fixtureSource('fixture', names)],
      resolver,
      log: () => {},
    });

    expect(result.summary).toEqual({ resolved: 2, unresolved: 2, error: 1, fromCache: 2 });
  });

  it('logs progress instead of throwing when everything is provided a working logger', async () => {
    const source = fixtureSource('fixture', ['onion']);
    const resolver = fakeResolver({
      onion: { status: 'unresolved', query: 'onion', fromCache: false },
    });
    const messages: string[] = [];

    await runPipeline({ sources: [source], resolver, log: (message) => messages.push(message) });

    expect(messages.some((line) => line.includes('starting'))).toBe(true);
    expect(messages.some((line) => line.includes('Done:'))).toBe(true);
  });
});
