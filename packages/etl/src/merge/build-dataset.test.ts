import { describe, expect, it, vi } from 'vitest';
import type { GbifResolver, ResolveOutcome } from '../resolve/gbif-resolver.ts';
import type { OpenFarmCropRaw } from '../sources/openfarm/types.ts';
import { validateSpacingRecord } from '../spacing/schema.ts';
import type { PlantLinksByKind } from '../companions/relationships.ts';
import { buildDataset } from './build-dataset.ts';
import { validateDataset } from './validate.ts';

function raw(overrides: Partial<OpenFarmCropRaw> = {}): OpenFarmCropRaw {
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

/** An offline resolver: every lookup errors (mirrors GBIF being unreachable). */
const offlineResolver: GbifResolver = {
  resolve: vi.fn(async (name: string): Promise<ResolveOutcome> => ({
    status: 'error',
    query: name,
    message: 'offline',
  })),
  resolveMany: vi.fn(async (names: readonly string[]) =>
    names.map((query) => ({ status: 'error' as const, query, message: 'offline' })),
  ),
  getCache: () => ({}),
};

const onionSpacing = validateSpacingRecord({
  id: 'onion',
  commonName: 'Onion',
  scientificName: 'Allium cepa',
  category: 'vegetable',
  spacing: { row: { inRowCm: 10, betweenRowCm: 30 }, intensive: { plantsPerSquare: 9 } },
  provenance: {
    row: [
      { source: 'RHS', url: 'https://example.test/a', retrievedAt: '2026-01-01' },
      { source: 'Almanac', url: 'https://example.test/b', retrievedAt: '2026-01-01' },
    ],
    intensive: [
      { source: 'SFG', url: 'https://example.test/c', retrievedAt: '2026-01-01' },
      { source: 'SFG chart', url: 'https://example.test/d', retrievedAt: '2026-01-01' },
    ],
  },
});

function links(entries: Record<string, Partial<PlantLinksByKind>>): Map<string, PlantLinksByKind> {
  const map = new Map<string, PlantLinksByKind>();
  for (const [id, k] of Object.entries(entries)) {
    map.set(id, { companions: k.companions ?? [], antagonists: k.antagonists ?? [] });
  }
  return map;
}

describe('buildDataset (end to end, offline / gbifId null)', () => {
  it('produces a valid artifact from clean fixtures', async () => {
    const result = await buildDataset({
      rawOpenFarm: [raw(), raw({ slug: 'carrot', name: 'Carrot', binomialName: 'Daucus carota' })],
      resolver: offlineResolver,
      spacingRecords: [onionSpacing],
      linksById: links({ onion: { companions: [{ plantId: 'carrot', evidence: 'traditional' }] } }),
      generatedAt: '2026-07-23',
    });

    expect(result.artifact.plantCount).toBe(2);
    // GBIF unreachable → gbifId stays null but the plant still ships.
    expect(result.collect.gbif.error).toBe(2);
    expect(result.plants.every((p) => p.gbifId === null)).toBe(true);

    // Spacing attached (hand-verified wins), link attached and resolvable.
    const onion = result.plants.find((p) => p.id === 'onion')!;
    expect(onion.spacing.intensive).toEqual({ plantsPerSquare: 9 });
    expect(onion.companions?.map((c) => c.plantId)).toEqual(['carrot']);

    // The emitted artifact independently re-passes the gate.
    expect(validateDataset(result.artifact.plants).ok).toBe(true);
  });

  it('drops a link to a filtered-out record rather than dangling', async () => {
    // The carrot record is absurd-spaced → skipped at collection; a link to it
    // must be dropped (not left dangling to fail the gate).
    const result = await buildDataset({
      rawOpenFarm: [
        raw(),
        raw({ slug: 'carrot', name: 'Carrot', binomialName: 'Daucus carota', spreadCm: 9000 }),
      ],
      resolver: offlineResolver,
      spacingRecords: [],
      linksById: links({ onion: { companions: [{ plantId: 'carrot', evidence: 'traditional' }] } }),
    });
    expect(result.plants.map((p) => p.id)).toEqual(['onion']);
    expect(result.mergeReport.companionLinksDropped.length).toBeGreaterThan(0);
    expect(validateDataset(result.artifact.plants).ok).toBe(true);
  });
});
