import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant } from '@garden-planner/engine';
import { CACHE_PATH } from '../index.ts';
import { loadCache } from '../resolve/gbif-cache.ts';
import { createGbifResolver } from '../resolve/gbif-resolver.ts';
import type { GbifTransport } from '../resolve/gbif-transport.ts';
import { loadOpenFarmCache } from '../sources/openfarm/cache.ts';
import { OPENFARM_CACHE_PATH } from '../sources/openfarm/source.ts';
import { buildDataset } from './build-dataset.ts';
import { validateDataset } from './validate.ts';

/**
 * The committed `data/plants.json` is what the app ships, and nothing in CI
 * regenerates it: `npm run build:data` is run by hand. These tests are the
 * gate between that file and users.
 *
 * - The ETL's own hard-fail gate (`validateDataset`: schema, referential
 *   integrity of companion/antagonist links, spacing sanity bounds, duplicate
 *   ids, the reserved `user-` namespace) must pass on the committed file, not
 *   only on freshly merged data inside a build.
 * - The committed file must be exactly what an offline build from the
 *   committed sources produces, so a hand-edit, or a source change committed
 *   without rebuilding, fails here instead of shipping.
 * - A snapshot of the dataset's shape makes any intended data change show up
 *   as a reviewed edit to this file. The engine's dataset tests are written as
 *   properties so they don't break when the data changes; this is the one place
 *   the figures are pinned.
 */

const DATASET_PATH = fileURLToPath(new URL('../../../../data/plants.json', import.meta.url));

interface CommittedArtifact {
  readonly generatedAt?: string;
  readonly plantCount: number;
  readonly plants: readonly unknown[];
  readonly [key: string]: unknown;
}

const COMMITTED = JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as CommittedArtifact;
const PLANTS: Plant[] = COMMITTED.plants.map((record) => validatePlant(record));

/** GBIF is never contacted: names resolve from the committed cache or not at all. */
const OFFLINE: GbifTransport = {
  matchName: () => Promise.reject(new Error('offline: tests never contact GBIF')),
};

describe('the committed data/plants.json', () => {
  it("passes the ETL's hard-fail validation gate", () => {
    const report = validateDataset(COMMITTED.plants);
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    expect(COMMITTED.plantCount).toBe(COMMITTED.plants.length);
  });

  it('is exactly what an offline build from the committed sources produces', async () => {
    const resolver = createGbifResolver({ cache: loadCache(CACHE_PATH), transport: OFFLINE });
    const { artifact } = await buildDataset({
      rawOpenFarm: loadOpenFarmCache(OPENFARM_CACHE_PATH),
      resolver,
      generatedAt: COMMITTED.generatedAt,
      log: () => {},
    });
    // Compare as parsed JSON: the committed file is Prettier-formatted.
    expect(JSON.parse(JSON.stringify(artifact))).toEqual(COMMITTED);
  });

  it('has the shape it was last reviewed at (update deliberately when the data changes)', () => {
    const count = (predicate: (plant: Plant) => boolean): number => PLANTS.filter(predicate).length;
    const companions = PLANTS.flatMap((plant) => plant.companions ?? []);
    const antagonistPairs = new Set(
      PLANTS.flatMap((plant) =>
        (plant.antagonists ?? []).map((link) =>
          [[plant.id, link.plantId].sort().join('<->'), link.evidence].join(' '),
        ),
      ),
    );

    expect({
      records: PLANTS.length,
      fullSun: count((p) => p.light === 'full-sun'),
      partialShade: count((p) => p.light === 'partial-shade'),
      withRowSpacing: count((p) => p.spacing.row !== undefined),
      withIntensiveSpacing: count((p) => p.spacing.intensive !== undefined),
      withSoilMoisture: count((p) => p.soil?.moisture !== undefined),
      withHardinessAndSeasons: PLANTS.filter(
        (p) => p.hardiness !== undefined && p.seasons !== undefined,
      )
        .map((p) => p.id)
        .sort(),
      recordsWithCompanions: count((p) => p.companions !== undefined),
      companionLinks: companions.length,
      wellSupportedCompanionLinks: companions.filter((l) => l.evidence === 'well-supported').length,
      antagonistPairs: [...antagonistPairs].sort(),
    }).toEqual({
      records: 144,
      fullSun: 133,
      partialShade: 11,
      withRowSpacing: 144,
      withIntensiveSpacing: 9,
      withSoilMoisture: 80,
      withHardinessAndSeasons: [
        'apple',
        'broad-bean',
        'brussels-sprouts',
        'jerusalem-artichoke',
        'pear',
        'pumpkin',
        'raspberry',
        'swede',
      ],
      recordsWithCompanions: 50,
      companionLinks: 76,
      wellSupportedCompanionLinks: 3,
      // Each reciprocal pair appears once per direction, collapsed here.
      antagonistPairs: [
        'broad-bean<->leek traditional',
        'garlic<->green-bean traditional',
        'onion<->pea traditional',
        'potato<->tomato well-supported',
      ],
    });
  });
});
