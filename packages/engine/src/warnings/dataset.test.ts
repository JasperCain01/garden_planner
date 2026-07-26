import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { validatePlant, type Plant } from '../schema/plant';
import { resolveClimate } from '../climate/resolve';
import type { PlotConditions } from '../suitability/conditions';
import { rectangleRegion } from '../spacing/region';
import type { CropPlacement } from './model';
import { evaluatePlot } from './evaluate';

/**
 * Pinning **today's link coverage** as a tripwire, the way
 * `spacing/dataset.test.ts` pins the intensive records and
 * `suitability/dataset.test.ts` pins hardiness/soil/seasons coverage. Stage
 * 1.7's curated `broad-bean` record already tripped this once (see below) —
 * closing ADR 0009's documented `leek`/`broad-bean` gap. If a future
 * companions/antagonist refresh changes these counts again, that is the
 * signal that the warnings/companions engine now has more (or different)
 * real data to work with, not a broken test.
 */

const DATASET_PATH = fileURLToPath(new URL('../../../../data/plants.json', import.meta.url));

interface DatasetArtifact {
  readonly plantCount: number;
  readonly plants: readonly unknown[];
}

function loadShippedPlants(): Plant[] {
  const artifact = JSON.parse(readFileSync(DATASET_PATH, 'utf8')) as DatasetArtifact;
  return artifact.plants.map((record) => validatePlant(record));
}

const PLANTS = loadShippedPlants();
const BY_ID = new Map(PLANTS.map((plant) => [plant.id, plant]));

describe('the shipped companion/antagonist data (ADR 0008)', () => {
  it('is the dataset these expectations were written against', () => {
    expect(PLANTS).toHaveLength(162);
  });

  it('carries companions on exactly 56/162 records, 85 links, 3 well-supported and 82 traditional', () => {
    const withCompanions = PLANTS.filter((plant) => plant.companions !== undefined);
    expect(withCompanions).toHaveLength(56);

    const links = withCompanions.flatMap((plant) => plant.companions ?? []);
    expect(links).toHaveLength(85);
    expect(links.filter((link) => link.evidence === 'well-supported')).toHaveLength(3);
    expect(links.filter((link) => link.evidence === 'traditional')).toHaveLength(82);
  });

  it('carries antagonists on exactly 8/162 records, 8 links -- four reciprocal pairs', () => {
    // Stage 1.7's curated `broad-bean` is the fourth pair: the Stage 1.4
    // `leek`/`broad-bean` antagonist link (ADR 0008) had no plant to attach to
    // until this stage gave broad-bean one (ADR 0009's documented gap, closed
    // by ADR 0021).
    const withAntagonists = PLANTS.filter((plant) => plant.antagonists !== undefined);
    expect(withAntagonists).toHaveLength(8);

    const links = withAntagonists.flatMap((plant) => plant.antagonists ?? []);
    expect(links).toHaveLength(8);

    const pairs = new Set(
      withAntagonists.flatMap((plant) =>
        (plant.antagonists ?? []).map((link) => [plant.id, link.plantId].sort().join('<->')),
      ),
    );
    // Every reciprocal pair collapses to one entry when sorted and deduped.
    expect(pairs).toEqual(
      new Set(['broad-bean<->leek', 'garlic<->green-bean', 'onion<->pea', 'potato<->tomato']),
    );
  });

  it('is the entire shipped basis for antagonist-adjacency: garlic/green-bean and onion/pea traditional, potato/tomato well-supported', () => {
    const garlic = BY_ID.get('garlic');
    const onion = BY_ID.get('onion');
    const potato = BY_ID.get('potato');
    expect(garlic?.antagonists).toMatchObject([{ plantId: 'green-bean', evidence: 'traditional' }]);
    expect(onion?.antagonists).toMatchObject([{ plantId: 'pea', evidence: 'traditional' }]);
    expect(potato?.antagonists).toMatchObject([{ plantId: 'tomato', evidence: 'well-supported' }]);
  });
});

describe('evaluatePlot against the real shipped dataset', () => {
  it('runs every shipped record through the full evaluation without throwing', () => {
    const conditions: PlotConditions = { light: 'full-sun', climate: resolveClimate() };
    // A generous 4 m x 2.5 m bed per crop, spaced 5 m apart so no two beds are
    // ever "nearby" -- this test is about not throwing, not about triggering
    // adjacency warnings.
    const widthCm = 400;
    const heightCm = 250;
    const placements: CropPlacement[] = PLANTS.map((plant, index) => {
      const minX = index * 500;
      return {
        id: plant.id,
        plant,
        region: {
          vertices: [
            { x: minX, y: 0 },
            { x: minX + widthCm, y: 0 },
            { x: minX + widthCm, y: heightCm },
            { x: minX, y: heightCm },
          ],
        },
        count: 1,
      };
    });

    expect(() => evaluatePlot(conditions, placements)).not.toThrow();
  });

  it('produces the real potato/tomato antagonist-adjacency warning when planted touching', () => {
    const potato = BY_ID.get('potato');
    const tomato = BY_ID.get('tomato');
    expect(potato).toBeDefined();
    expect(tomato).toBeDefined();
    if (potato === undefined || tomato === undefined) return;

    const conditions: PlotConditions = { light: 'full-sun', climate: resolveClimate() };
    const placements: CropPlacement[] = [
      { id: 'potato-bed', plant: potato, region: rectangleRegion(100, 100), count: 1 },
      {
        id: 'tomato-bed',
        plant: tomato,
        region: {
          vertices: [
            { x: 100, y: 0 },
            { x: 200, y: 0 },
            { x: 200, y: 100 },
            { x: 100, y: 100 },
          ],
        },
        count: 1,
      },
    ];

    const { warnings } = evaluatePlot(conditions, placements);
    const antagonistWarning = warnings.find((w) => w.kind === 'antagonist-adjacency');
    expect(antagonistWarning).toMatchObject({ evidence: 'well-supported', severity: 'severe' });
  });
});
