import { describe, expect, it } from 'vitest';
import { validatePlant, type Plant, type PlantLink } from '@garden-planner/engine';
import { validateSpacingRecord, type SpacingRecord } from '../spacing/schema.ts';
import type { PlantLinksByKind } from '../companions/relationships.ts';
import { mergeDataset } from './merge.ts';

function plant(overrides: Partial<Plant> = {}): Plant {
  return validatePlant({
    id: 'onion',
    commonName: 'Onion',
    scientificName: 'Allium cepa',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 8, betweenRowCm: 30 } },
    provenance: { sources: [{ source: 'OpenFarm', license: 'CC0-1.0' }] },
    ...overrides,
  });
}

function spacingRow(overrides: Partial<SpacingRecord> = {}): SpacingRecord {
  const cite = { source: 'RHS', url: 'https://example.test/a', retrievedAt: '2026-01-01' };
  const cite2 = { source: 'Almanac', url: 'https://example.test/b', retrievedAt: '2026-01-01' };
  return validateSpacingRecord({
    id: 'onion',
    commonName: 'Onion',
    scientificName: 'Allium cepa',
    category: 'vegetable',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 }, intensive: { plantsPerSquare: 9 } },
    provenance: { row: [cite, cite2], intensive: [cite, cite2] },
    ...overrides,
  });
}

function link(plantId: string): PlantLink {
  return { plantId, evidence: 'traditional', note: 'test link' };
}

function linksMap(
  entries: Record<string, Partial<PlantLinksByKind>>,
): Map<string, PlantLinksByKind> {
  const map = new Map<string, PlantLinksByKind>();
  for (const [id, kinds] of Object.entries(entries)) {
    map.set(id, { companions: kinds.companions ?? [], antagonists: kinds.antagonists ?? [] });
  }
  return map;
}

describe('mergeDataset — spacing', () => {
  it('lets hand-verified spacing win over OpenFarm scraped spacing', () => {
    const result = mergeDataset({
      openFarmPlants: [plant({ spacing: { row: { inRowCm: 8, betweenRowCm: 30 } } })],
      spacingRecords: [spacingRow()],
      linksById: new Map(),
    });
    const onion = result.plants.find((p) => p.id === 'onion')!;
    // The hand-verified figure (10 in-row, intensive 9) replaced OpenFarm's 8.
    expect(onion.spacing).toEqual({
      row: { inRowCm: 10, betweenRowCm: 30 },
      intensive: { plantsPerSquare: 9 },
    });
    // And the spacing provenance now cites the hand-verified sources.
    expect(onion.provenance.fields?.spacing?.map((s) => s.source)).toContain('RHS');
    expect(result.report.spacingAttached[0]).toMatchObject({
      plantId: 'onion',
      via: 'slug',
      overrodeOpenFarm: true,
    });
  });

  it('attaches spacing across a British-name alias (beetroot → beet)', () => {
    const result = mergeDataset({
      // Two Beta vulgaris crops make the scientific name ambiguous, so only the
      // curated alias can pick the right one (mirrors beet vs. chard in reality).
      openFarmPlants: [
        plant({ id: 'beet', commonName: 'Beet', scientificName: 'Beta vulgaris' }),
        plant({ id: 'chard', commonName: 'Chard', scientificName: 'Beta vulgaris' }),
      ],
      spacingRecords: [
        spacingRow({ id: 'beetroot', commonName: 'Beetroot', scientificName: 'Beta vulgaris' }),
      ],
      linksById: new Map(),
      aliases: { beetroot: 'beet' },
    });
    const beet = result.plants.find((p) => p.id === 'beet')!;
    expect(beet.spacing.intensive).toEqual({ plantsPerSquare: 9 });
    expect(result.report.spacingAttached[0]).toMatchObject({ plantId: 'beet', via: 'alias' });
  });

  it('reports a spacing row with no home rather than dropping it silently', () => {
    const result = mergeDataset({
      openFarmPlants: [plant()],
      spacingRecords: [spacingRow({ id: 'broad-bean', scientificName: 'Vicia faba' })],
      linksById: new Map(),
    });
    expect(result.report.spacingUnattached).toEqual([
      { spacingId: 'broad-bean', reason: expect.stringContaining('no plant matches') },
    ]);
  });

  it('drops a plant whose final spacing is absurd, with a reason', () => {
    const result = mergeDataset({
      openFarmPlants: [
        plant({
          id: 'kiwifruit',
          scientificName: 'Actinidia deliciosa',
          spacing: { row: { inRowCm: 300, betweenRowCm: 6000 } },
        }),
      ],
      spacingRecords: [],
      linksById: new Map(),
    });
    expect(result.plants).toEqual([]);
    expect(result.report.plantsDroppedForSanity[0]).toMatchObject({ plantId: 'kiwifruit' });
  });

  it('lets a hand-verified override RESCUE a plant whose scraped spacing was absurd', () => {
    // The whole point of moving the sanity check after the override: a bad scrape
    // (6000 cm) is replaced by the good hand-verified figure, so the plant ships.
    const result = mergeDataset({
      openFarmPlants: [
        plant({ id: 'onion', spacing: { row: { inRowCm: 8, betweenRowCm: 6000 } } }),
      ],
      spacingRecords: [spacingRow({ id: 'onion' })],
      linksById: new Map(),
    });
    expect(result.plants.map((p) => p.id)).toEqual(['onion']);
    expect(result.report.plantsDroppedForSanity).toEqual([]);
  });

  it('throws if two spacing rows resolve to the same plant', () => {
    expect(() =>
      mergeDataset({
        openFarmPlants: [plant({ id: 'onion', scientificName: 'Allium cepa' })],
        spacingRecords: [
          spacingRow({ id: 'onion' }),
          spacingRow({ id: 'yellow-onion', scientificName: 'Allium cepa' }),
        ],
        linksById: new Map(),
      }),
    ).toThrow(/two spacing rows resolve to the same plant/);
  });
});

describe('mergeDataset — companion/antagonist links', () => {
  it('attaches links to the owning plant', () => {
    const result = mergeDataset({
      openFarmPlants: [
        plant({ id: 'onion' }),
        plant({ id: 'carrot', scientificName: 'Daucus carota' }),
      ],
      spacingRecords: [],
      linksById: linksMap({ onion: { companions: [link('carrot')] } }),
    });
    const onion = result.plants.find((p) => p.id === 'onion')!;
    expect(onion.companions?.map((c) => c.plantId)).toEqual(['carrot']);
    // A plant that gains links records companion provenance.
    expect(onion.provenance.fields?.companions).toBeDefined();
  });

  it('remaps links across an alias (french-bean → green-bean)', () => {
    const result = mergeDataset({
      openFarmPlants: [
        plant({ id: 'green-bean', scientificName: 'Phaseolus vulgaris' }),
        plant({ id: 'garlic', scientificName: 'Allium sativum' }),
      ],
      spacingRecords: [],
      linksById: linksMap({
        'french-bean': { antagonists: [link('garlic')] },
        garlic: { antagonists: [link('french-bean')] },
      }),
      aliases: { 'french-bean': 'green-bean' },
    });
    const greenBean = result.plants.find((p) => p.id === 'green-bean')!;
    const garlic = result.plants.find((p) => p.id === 'garlic')!;
    expect(greenBean.antagonists?.map((a) => a.plantId)).toEqual(['garlic']);
    expect(garlic.antagonists?.map((a) => a.plantId)).toEqual(['green-bean']);
    expect(result.report.companionLinksRemapped).toBeGreaterThan(0);
  });

  it('drops links whose owner or target is not a plant, with a reason', () => {
    const result = mergeDataset({
      openFarmPlants: [plant({ id: 'leek', scientificName: 'Allium porrum' })],
      spacingRecords: [],
      linksById: linksMap({
        leek: { antagonists: [link('broad-bean')] },
        'broad-bean': { antagonists: [link('leek')] },
      }),
    });
    const leek = result.plants.find((p) => p.id === 'leek')!;
    expect(leek.antagonists).toBeUndefined();
    expect(result.report.companionLinksDropped).toHaveLength(2);
    expect(result.report.companionLinksDropped.map((d) => d.reason).join(' ')).toContain(
      'not a plant in the merged dataset',
    );
  });

  it('drops a link that becomes a self-link after id unification', () => {
    const result = mergeDataset({
      openFarmPlants: [plant({ id: 'green-bean', scientificName: 'Phaseolus vulgaris' })],
      spacingRecords: [],
      // green-bean links to french-bean, which aliases back to green-bean itself.
      linksById: linksMap({ 'green-bean': { companions: [link('french-bean')] } }),
      aliases: { 'french-bean': 'green-bean' },
    });
    const greenBean = result.plants.find((p) => p.id === 'green-bean')!;
    expect(greenBean.companions).toBeUndefined();
    expect(result.report.companionLinksDropped[0].reason).toContain('itself');
  });
});

describe('mergeDataset — output', () => {
  it('returns plants sorted by id and reports counts', () => {
    const result = mergeDataset({
      openFarmPlants: [
        plant({ id: 'onion' }),
        plant({ id: 'carrot', scientificName: 'Daucus carota' }),
      ],
      spacingRecords: [],
      linksById: new Map(),
    });
    expect(result.plants.map((p) => p.id)).toEqual(['carrot', 'onion']);
    expect(result.report.outputPlantCount).toBe(2);
    expect(result.report.identityUnifications).toEqual([]);
  });
});
