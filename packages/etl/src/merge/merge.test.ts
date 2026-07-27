import { describe, expect, it } from 'vitest';
import { validatePlant, type Plant, type PlantLink } from '@garden-planner/engine';
import { validateSpacingRecord, type SpacingRecord } from '../spacing/schema.ts';
import type { MoistureRecord } from '../moisture/schema.ts';
import type { ExcludedCrop } from '../exclusions/schema.ts';
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
      curatedPlants: [],
      openFarmPlants: [plant({ spacing: { row: { inRowCm: 8, betweenRowCm: 30 } } })],
      spacingRecords: [spacingRow()],
      moistureRecords: [],
      excludedCrops: [],
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
      curatedPlants: [],
      // Two Beta vulgaris crops make the scientific name ambiguous, so only the
      // curated alias can pick the right one (mirrors beet vs. chard in reality).
      openFarmPlants: [
        plant({ id: 'beet', commonName: 'Beet', scientificName: 'Beta vulgaris' }),
        plant({ id: 'chard', commonName: 'Chard', scientificName: 'Beta vulgaris' }),
      ],
      spacingRecords: [
        spacingRow({ id: 'beetroot', commonName: 'Beetroot', scientificName: 'Beta vulgaris' }),
      ],
      moistureRecords: [],
      excludedCrops: [],
      linksById: new Map(),
      aliases: { beetroot: 'beet' },
    });
    const beet = result.plants.find((p) => p.id === 'beet')!;
    expect(beet.spacing.intensive).toEqual({ plantsPerSquare: 9 });
    expect(result.report.spacingAttached[0]).toMatchObject({ plantId: 'beet', via: 'alias' });
  });

  it('reports a spacing row with no home rather than dropping it silently', () => {
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [plant()],
      spacingRecords: [spacingRow({ id: 'broad-bean', scientificName: 'Vicia faba' })],
      moistureRecords: [],
      excludedCrops: [],
      linksById: new Map(),
    });
    expect(result.report.spacingUnattached).toEqual([
      { spacingId: 'broad-bean', reason: expect.stringContaining('no plant matches') },
    ]);
  });

  it('drops a plant whose final spacing is absurd, with a reason', () => {
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [
        plant({
          id: 'kiwifruit',
          scientificName: 'Actinidia deliciosa',
          spacing: { row: { inRowCm: 300, betweenRowCm: 6000 } },
        }),
      ],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [],
      linksById: new Map(),
    });
    expect(result.plants).toEqual([]);
    expect(result.report.plantsDroppedForSanity[0]).toMatchObject({ plantId: 'kiwifruit' });
  });

  it('lets a hand-verified override RESCUE a plant whose scraped spacing was absurd', () => {
    // The whole point of moving the sanity check after the override: a bad scrape
    // (6000 cm) is replaced by the good hand-verified figure, so the plant ships.
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [
        plant({ id: 'onion', spacing: { row: { inRowCm: 8, betweenRowCm: 6000 } } }),
      ],
      spacingRecords: [spacingRow({ id: 'onion' })],
      moistureRecords: [],
      excludedCrops: [],
      linksById: new Map(),
    });
    expect(result.plants.map((p) => p.id)).toEqual(['onion']);
    expect(result.report.plantsDroppedForSanity).toEqual([]);
  });

  it('throws if two spacing rows resolve to the same plant', () => {
    expect(() =>
      mergeDataset({
        curatedPlants: [],
        openFarmPlants: [plant({ id: 'onion', scientificName: 'Allium cepa' })],
        spacingRecords: [
          spacingRow({ id: 'onion' }),
          spacingRow({ id: 'yellow-onion', scientificName: 'Allium cepa' }),
        ],
        moistureRecords: [],
        excludedCrops: [],
        linksById: new Map(),
      }),
    ).toThrow(/two spacing rows resolve to the same plant/);
  });
});

describe('mergeDataset — companion/antagonist links', () => {
  it('attaches links to the owning plant', () => {
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [
        plant({ id: 'onion' }),
        plant({ id: 'carrot', scientificName: 'Daucus carota' }),
      ],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [],
      linksById: linksMap({ onion: { companions: [link('carrot')] } }),
    });
    const onion = result.plants.find((p) => p.id === 'onion')!;
    expect(onion.companions?.map((c) => c.plantId)).toEqual(['carrot']);
    // A plant that gains links records companion provenance.
    expect(onion.provenance.fields?.companions).toBeDefined();
  });

  it('remaps links across an alias (french-bean → green-bean)', () => {
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [
        plant({ id: 'green-bean', scientificName: 'Phaseolus vulgaris' }),
        plant({ id: 'garlic', scientificName: 'Allium sativum' }),
      ],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [],
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
      curatedPlants: [],
      openFarmPlants: [plant({ id: 'leek', scientificName: 'Allium porrum' })],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [],
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
      curatedPlants: [],
      openFarmPlants: [plant({ id: 'green-bean', scientificName: 'Phaseolus vulgaris' })],
      spacingRecords: [],
      // green-bean links to french-bean, which aliases back to green-bean itself.
      moistureRecords: [],
      excludedCrops: [],
      linksById: linksMap({ 'green-bean': { companions: [link('french-bean')] } }),
      aliases: { 'french-bean': 'green-bean' },
    });
    const greenBean = result.plants.find((p) => p.id === 'green-bean')!;
    expect(greenBean.companions).toBeUndefined();
    expect(result.report.companionLinksDropped[0].reason).toContain('itself');
  });
});

describe('mergeDataset — curated plants (Stage 1.7)', () => {
  function curated(overrides: Partial<Plant> = {}): Plant {
    return validatePlant({
      id: 'jerusalem-artichoke',
      commonName: 'Jerusalem artichoke',
      scientificName: 'Helianthus tuberosus',
      gbifId: null,
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 30, betweenRowCm: 90 } },
      provenance: { sources: [{ source: 'RHS' }] },
      ...overrides,
    });
  }

  it('adds a curated plant with no OpenFarm counterpart as a new first-class plant', () => {
    const result = mergeDataset({
      openFarmPlants: [plant({ id: 'onion' })],
      curatedPlants: [curated()],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [],
      linksById: new Map(),
    });
    expect(result.plants.map((p) => p.id)).toEqual(['jerusalem-artichoke', 'onion']);
    expect(result.report.curatedOverrides).toEqual([]);
  });

  it('lets a curated plant overlapping an OpenFarm slug win, replacing it (not duplicating it)', () => {
    const result = mergeDataset({
      openFarmPlants: [
        plant({
          id: 'jerusalem-artichoke',
          commonName: 'OpenFarm scrape',
          provenance: { sources: [{ source: 'OpenFarm', license: 'CC0-1.0' }] },
        }),
      ],
      curatedPlants: [curated({ commonName: 'Jerusalem artichoke (curated)' })],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [],
      linksById: new Map(),
    });
    // Exactly one record ships under the shared id — never a silent duplicate.
    expect(result.plants.map((p) => p.id)).toEqual(['jerusalem-artichoke']);
    expect(result.plants[0].commonName).toBe('Jerusalem artichoke (curated)');
    expect(result.report.curatedOverrides).toEqual([
      { curatedId: 'jerusalem-artichoke', overriddenId: 'jerusalem-artichoke' },
    ]);
  });

  it('lets a curated plant reconcile through an alias, keeping the surviving canonical id', () => {
    const result = mergeDataset({
      openFarmPlants: [plant({ id: 'beet', scientificName: 'Beta vulgaris' })],
      curatedPlants: [
        curated({ id: 'beetroot', scientificName: 'Beta vulgaris', commonName: 'Beetroot' }),
      ],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [],
      linksById: new Map(),
      aliases: { beetroot: 'beet' },
    });
    // The alias resolves 'beetroot' to the existing 'beet' identity — the
    // curated *content* wins, but the id that survives is the one the rest of
    // the dataset (companion links, spacing rows) already knows, so nothing
    // that already points at 'beet' is orphaned by the override.
    expect(result.plants.map((p) => p.id)).toEqual(['beet']);
    expect(result.plants[0].commonName).toBe('Beetroot');
    expect(result.report.curatedOverrides).toEqual([
      { curatedId: 'beetroot', overriddenId: 'beet' },
    ]);
  });

  it('lets a curated plant attach hand-verified spacing and companion links, same as any other plant', () => {
    // Mirrors the real broad-bean case (docs/adr/0009's known gap): a curated
    // plant is an ordinary Plant once folded in, so the existing spacing-attach
    // and companion-remap steps apply to it with no special-casing.
    const result = mergeDataset({
      openFarmPlants: [plant({ id: 'leek', scientificName: 'Allium porrum' })],
      curatedPlants: [
        curated({
          id: 'broad-bean',
          commonName: 'Broad bean',
          scientificName: 'Vicia faba',
          spacing: { row: { inRowCm: 20, betweenRowCm: 60 } },
        }),
      ],
      spacingRecords: [spacingRow({ id: 'broad-bean', scientificName: 'Vicia faba' })],
      moistureRecords: [],
      excludedCrops: [],
      linksById: linksMap({
        leek: { antagonists: [link('broad-bean')] },
        'broad-bean': { antagonists: [link('leek')] },
      }),
    });
    const broadBean = result.plants.find((p) => p.id === 'broad-bean')!;
    expect(broadBean.spacing.intensive).toEqual({ plantsPerSquare: 9 });
    expect(broadBean.antagonists?.map((a) => a.plantId)).toEqual(['leek']);
    expect(result.report.companionLinksDropped).toEqual([]);
  });
});

describe('mergeDataset — output', () => {
  it('returns plants sorted by id and reports counts', () => {
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [
        plant({ id: 'onion' }),
        plant({ id: 'carrot', scientificName: 'Daucus carota' }),
      ],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [],
      linksById: new Map(),
    });
    expect(result.plants.map((p) => p.id)).toEqual(['carrot', 'onion']);
    expect(result.report.outputPlantCount).toBe(2);
    expect(result.report.identityUnifications).toEqual([]);
  });
});

describe('mergeDataset — soil moisture', () => {
  const moistureRow = (overrides: Partial<MoistureRecord> = {}): MoistureRecord => ({
    id: 'onion',
    moisture: ['dry', 'moist'],
    note: 'wants a dry finish to ripen and store',
    ...overrides,
  });

  it('sets soil.moisture on a plant that has no soil block at all', () => {
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [plant()],
      spacingRecords: [],
      moistureRecords: [moistureRow()],
      excludedCrops: [],
      linksById: new Map(),
    });

    const onion = result.plants.find((p) => p.id === 'onion')!;
    expect(onion.soil).toEqual({ moisture: ['dry', 'moist'] });
    expect(result.report.moistureAttached).toEqual([
      { plantId: 'onion', moisture: ['dry', 'moist'] },
    ]);
  });

  it('records where the value came from, without overstating it', () => {
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [plant()],
      spacingRecords: [],
      moistureRecords: [moistureRow()],
      excludedCrops: [],
      linksById: new Map(),
    });

    const onion = result.plants.find((p) => p.id === 'onion')!;
    // Field-level provenance so a reader can tell moisture apart from whatever
    // the record's other fields came from.
    expect(onion.provenance.fields?.soil?.[0].source).toBe('Garden Planner curated moisture table');
    expect(onion.provenance.fields?.soil?.[0].note).toMatch(/hand-authored/i);
    // …and it joins the record-level source list rather than hiding in `fields`.
    expect(onion.provenance.sources.some((s) => /curated moisture table/.test(s.source))).toBe(
      true,
    );
  });

  it('never overwrites a plant that states its own moisture', () => {
    // A curated full-plant record is the more specific authority; a
    // single-field slice must not clobber it.
    const curated = plant({
      soil: { textures: ['loam'], ph: ['neutral'], moisture: ['moist'] },
    });

    const result = mergeDataset({
      curatedPlants: [curated],
      openFarmPlants: [],
      spacingRecords: [],
      moistureRecords: [moistureRow({ moisture: ['wet'] })],
      excludedCrops: [],
      linksById: new Map(),
    });

    const onion = result.plants.find((p) => p.id === 'onion')!;
    expect(onion.soil).toEqual({ textures: ['loam'], ph: ['neutral'], moisture: ['moist'] });
    expect(result.report.moistureAttached).toEqual([]);
    expect(result.report.moistureSkipped).toEqual([
      {
        plantId: 'onion',
        reason: 'plant already states its own soil moisture (curated record wins)',
      },
    ]);
  });

  it('preserves an existing texture/pH block while filling in the missing moisture', () => {
    const partial = plant({ soil: { textures: ['sand'] } });

    const result = mergeDataset({
      curatedPlants: [partial],
      openFarmPlants: [],
      spacingRecords: [],
      moistureRecords: [moistureRow()],
      excludedCrops: [],
      linksById: new Map(),
    });

    expect(result.plants.find((p) => p.id === 'onion')!.soil).toEqual({
      textures: ['sand'],
      moisture: ['dry', 'moist'],
    });
  });

  it('reports a row whose crop is not in the dataset rather than failing silently', () => {
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [plant()],
      spacingRecords: [],
      moistureRecords: [moistureRow({ id: 'not-a-crop' })],
      excludedCrops: [],
      linksById: new Map(),
    });

    expect(result.report.moistureAttached).toEqual([]);
    expect(result.report.moistureUnattached).toEqual([
      {
        moistureId: 'not-a-crop',
        reason: 'no plant with id "not-a-crop" survives in the merged dataset',
      },
    ]);
  });

  it('leaves soil absent on a crop the table has no opinion about', () => {
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [plant()],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [],
      linksById: new Map(),
    });

    // "We don't know" stays "we don't know" — the scorer reports
    // `unknown-plant` rather than being handed a guess.
    expect(result.plants.find((p) => p.id === 'onion')!.soil).toBeUndefined();
  });
});

describe('mergeDataset — UK-outdoor exclusions (Stage 6.0, ADR 0025)', () => {
  function exclusion(id: string): ExcludedCrop {
    return {
      id,
      commonName: id,
      basis: 'too-tender',
      note: 'test exclusion — cannot be grown outdoors in Britain',
    };
  }

  it('drops an excluded crop from the merged dataset and says so in the report', () => {
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [plant(), plant({ id: 'papaya', commonName: 'Papaya' })],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [exclusion('papaya')],
      linksById: new Map(),
    });

    expect(result.plants.map((p) => p.id)).toEqual(['onion']);
    expect(result.report.cropsExcluded).toEqual([{ plantId: 'papaya', basis: 'too-tender' }]);
    expect(result.report.exclusionsUnmatched).toEqual([]);
  });

  it('excludes a curated record too — the rule is about the shipped id, not the source', () => {
    // No curated crop is excluded today, and none should be: writing one by
    // hand and then excluding it would be a contradiction a maintainer should
    // resolve by deleting the record. Pinned anyway so the rule has one
    // meaning rather than two, and so a future collision can't ship silently.
    const result = mergeDataset({
      curatedPlants: [plant({ id: 'papaya', commonName: 'Papaya' })],
      openFarmPlants: [],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [exclusion('papaya')],
      linksById: new Map(),
    });

    expect(result.plants).toEqual([]);
    expect(result.report.cropsExcluded).toEqual([{ plantId: 'papaya', basis: 'too-tender' }]);
  });

  it('drops companion links pointing at an excluded crop instead of dangling them', () => {
    // The reason exclusion happens before the companion remap: the existing
    // referential-integrity machinery handles the fallout, with a stated
    // reason, and needs no special case for exclusions.
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [plant(), plant({ id: 'papaya', commonName: 'Papaya' })],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [exclusion('papaya')],
      linksById: linksMap({
        onion: { companions: [link('papaya')] },
        papaya: { companions: [link('onion')] },
      }),
    });

    expect(result.plants.find((p) => p.id === 'onion')!.companions).toBeUndefined();
    expect(result.report.companionLinksKept).toBe(0);
    expect(result.report.companionLinksDropped).toEqual([
      {
        ownerId: 'onion',
        targetId: 'papaya',
        kind: 'companion',
        reason: 'target "papaya" is not a plant in the merged dataset',
      },
      {
        ownerId: 'papaya',
        targetId: 'onion',
        kind: 'companion',
        reason: 'owner "papaya" is not a plant in the merged dataset',
      },
    ]);
  });

  it('reports an exclusion that matched nothing rather than failing the build', () => {
    // A stale exclusion is a curation drift the exclusion list's own test
    // catches (`exclusions/table.test.ts`); here it is reported, exactly as an
    // unattached spacing or moisture row is.
    const result = mergeDataset({
      curatedPlants: [],
      openFarmPlants: [plant()],
      spacingRecords: [],
      moistureRecords: [],
      excludedCrops: [exclusion('not-a-crop')],
      linksById: new Map(),
    });

    expect(result.plants.map((p) => p.id)).toEqual(['onion']);
    expect(result.report.cropsExcluded).toEqual([]);
    expect(result.report.exclusionsUnmatched).toEqual([
      {
        excludedId: 'not-a-crop',
        reason: 'no plant with id "not-a-crop" reached the merge — a stale or mistyped exclusion',
      },
    ]);
  });
});
