import { describe, expect, it, vi } from 'vitest';
import type { GbifResolver, ResolveOutcome } from '../resolve/gbif-resolver.ts';
import type { OpenFarmCropRaw } from '../sources/openfarm/types.ts';
import { collectOpenFarmPlants } from './collect-openfarm.ts';

function rawRecord(overrides: Partial<OpenFarmCropRaw> = {}): OpenFarmCropRaw {
  return {
    slug: 'onion',
    name: 'Onion',
    binomialName: 'Allium cepa',
    sun: 'Full Sun',
    spreadCm: 8,
    rowSpacingCm: 30,
    source: {
      origin: 'OpenFarm.cc',
      license: 'CC0-1.0',
      waybackUrl: 'https://web.archive.org/web/20250218033548/https://openfarm.cc/en/crops/onion',
      captured: '20250218',
    },
    ...overrides,
  };
}

function fakeResolver(outcomesByName: Record<string, ResolveOutcome>): GbifResolver {
  return {
    resolve: vi.fn(async (name: string) => {
      const outcome = outcomesByName[name];
      if (!outcome) throw new Error(`fakeResolver: no canned outcome for "${name}"`);
      return outcome;
    }),
    resolveMany: vi.fn(async (names: readonly string[]) => names.map((n) => outcomesByName[n]!)),
    getCache: () => ({}),
  };
}

describe('collectOpenFarmPlants', () => {
  it('fills gbifId when GBIF resolves the name', async () => {
    const resolver = fakeResolver({
      'Allium cepa': {
        status: 'resolved',
        query: 'Allium cepa',
        gbifId: 2857697,
        scientificName: 'Allium cepa',
        matchType: 'EXACT',
        confidence: 98,
        fromCache: false,
      },
    });
    const result = await collectOpenFarmPlants([rawRecord()], resolver);
    expect(result.plants).toHaveLength(1);
    expect(result.plants[0].gbifId).toBe(2857697);
    expect(result.gbif).toMatchObject({ resolved: 1, unresolved: 0, error: 0 });
  });

  it('KEEPS a record with gbifId: null when GBIF is unreachable (does not drop it)', async () => {
    // This is the whole reason this collector exists instead of buildOpenFarmPlants.
    const resolver = fakeResolver({
      'Allium cepa': { status: 'error', query: 'Allium cepa', message: '403 policy denial' },
    });
    const result = await collectOpenFarmPlants([rawRecord()], resolver);
    expect(result.plants).toHaveLength(1);
    expect(result.plants[0].gbifId).toBeNull();
    expect(result.gbif).toMatchObject({ error: 1 });
    expect(result.skipped).toEqual([]);
  });

  it('keeps a record GBIF has no confident match for, with gbifId: null', async () => {
    const resolver = fakeResolver({
      'Allium cepa': { status: 'unresolved', query: 'Allium cepa', fromCache: false },
    });
    const result = await collectOpenFarmPlants([rawRecord()], resolver);
    expect(result.plants).toHaveLength(1);
    expect(result.plants[0].gbifId).toBeNull();
    expect(result.gbif).toMatchObject({ unresolved: 1 });
  });

  it('skips an unmappable record with a stated reason (mapper discipline unchanged)', async () => {
    const resolver = fakeResolver({});
    const result = await collectOpenFarmPlants([rawRecord({ slug: 'not-curated' })], resolver);
    expect(result.plants).toEqual([]);
    expect(result.skipped[0]).toMatchObject({ slug: 'not-curated' });
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('keeps a record with absurd spacing (the sanity filter lives in the merge, not here)', async () => {
    // Collection is deliberately not the sanity gate: a bad scrape might still be
    // rescued by a hand-verified override, so the absurdity check runs on the
    // merged spacing (see merge.ts / merge.test.ts), not on the raw record here.
    const resolver = fakeResolver({
      'Allium cepa': { status: 'error', query: 'Allium cepa', message: 'offline' },
    });
    const result = await collectOpenFarmPlants([rawRecord({ spreadCm: 6000 })], resolver);
    expect(result.plants).toHaveLength(1);
  });
});
