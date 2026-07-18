import { describe, expect, it, vi } from 'vitest';
import { buildOpenFarmPlants } from './build-plants.ts';
import type { GbifResolver, ResolveOutcome } from '../../resolve/gbif-resolver.ts';
import type { OpenFarmCropRaw } from './types.ts';

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

/** A fake resolver whose `resolve` echoes back a canned outcome per query name. */
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

describe('buildOpenFarmPlants', () => {
  it('produces a schema-shaped, GBIF-resolved, validatePlant-passing Plant for a mappable, resolved record', async () => {
    const resolver = fakeResolver({
      'Allium cepa': {
        status: 'resolved',
        query: 'Allium cepa',
        gbifId: 2874490,
        scientificName: 'Allium cepa',
        matchType: 'EXACT',
        confidence: 98,
        fromCache: false,
      },
    });

    const result = await buildOpenFarmPlants([rawRecord()], resolver);

    expect(result.skipped).toEqual([]);
    expect(result.plants).toHaveLength(1);
    // gbifId is filled in from the resolver — the concrete Stage 1.1↔1.2 link.
    expect(result.plants[0]).toMatchObject({ id: 'onion', gbifId: 2874490 });
  });

  it('skips a record the mapper rejects, without ever calling the resolver for it', async () => {
    const resolver = fakeResolver({});
    const unmappable = rawRecord({ slug: 'not-curated', name: 'Not Curated' });

    const result = await buildOpenFarmPlants([unmappable], resolver);

    expect(result.plants).toEqual([]);
    expect(result.skipped).toEqual([
      {
        slug: 'not-curated',
        reason: expect.stringContaining('no curated edible-category classification'),
      },
    ]);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('skips a mappable record GBIF has no confident match for', async () => {
    const resolver = fakeResolver({
      'Allium cepa': { status: 'unresolved', query: 'Allium cepa', fromCache: false },
    });

    const result = await buildOpenFarmPlants([rawRecord()], resolver);

    expect(result.plants).toEqual([]);
    expect(result.skipped).toEqual([
      { slug: 'onion', reason: expect.stringContaining('no confident match') },
    ]);
  });

  it('skips a mappable record when GBIF resolution fails outright', async () => {
    const resolver = fakeResolver({
      'Allium cepa': { status: 'error', query: 'Allium cepa', message: 'network blocked' },
    });

    const result = await buildOpenFarmPlants([rawRecord()], resolver);

    expect(result.plants).toEqual([]);
    expect(result.skipped).toEqual([
      { slug: 'onion', reason: expect.stringContaining('network blocked') },
    ]);
  });

  it('processes a mixed batch, keeping mapping/resolution outcomes independent per record', async () => {
    const resolver = fakeResolver({
      'Allium cepa': {
        status: 'resolved',
        query: 'Allium cepa',
        gbifId: 2874490,
        scientificName: 'Allium cepa',
        matchType: 'EXACT',
        confidence: 98,
        fromCache: false,
      },
      'Daucus carota': { status: 'unresolved', query: 'Daucus carota', fromCache: false },
    });
    const records = [
      rawRecord(),
      rawRecord({ slug: 'carrot', name: 'Carrot', binomialName: 'Daucus carota' }),
      rawRecord({ slug: 'not-curated', name: 'Not Curated' }),
    ];

    const result = await buildOpenFarmPlants(records, resolver);

    expect(result.plants.map((p) => p.id)).toEqual(['onion']);
    expect(result.skipped.map((s) => s.slug)).toEqual(['carrot', 'not-curated']);
  });
});
