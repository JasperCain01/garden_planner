import { describe, expect, it } from 'vitest';
import { mapOpenFarmCrop } from './map.ts';
import type { OpenFarmCropRaw } from './types.ts';

/** A minimal record that satisfies every mapping requirement, for tests to tweak. */
function baseRecord(overrides: Partial<OpenFarmCropRaw> = {}): OpenFarmCropRaw {
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

describe('mapOpenFarmCrop', () => {
  it('maps a well-formed, curated record to a schema-valid Plant with gbifId still null', () => {
    const outcome = mapOpenFarmCrop(baseRecord());

    expect(outcome.skipped).toBe(false);
    if (outcome.skipped) throw new Error('unreachable');
    expect(outcome.plant).toMatchObject({
      id: 'onion',
      commonName: 'Onion',
      scientificName: 'Allium cepa',
      gbifId: null,
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 8, betweenRowCm: 30 } },
    });
    expect(outcome.resolveName).toBe('Allium cepa');
  });

  it('attaches provenance with the source, licence, wayback URL, and a fixed retrieval date', () => {
    const outcome = mapOpenFarmCrop(baseRecord());
    if (outcome.skipped) throw new Error('unreachable');

    const [source] = outcome.plant.provenance.sources;
    expect(source).toMatchObject({
      sourceId: 'onion',
      url: 'https://web.archive.org/web/20250218033548/https://openfarm.cc/en/crops/onion',
      license: 'CC0-1.0',
      retrievedAt: '2026-07-18',
    });
    expect(source.note).toContain('2025-02-18');
  });

  it.each([
    ['Full Sun', 'full-sun'],
    ['full sun', 'full-sun'],
    ['Partial Sun', 'partial-shade'],
    ['Full Shade', 'full-shade'],
  ] as const)('maps sun value %j to light requirement %j', (sun, light) => {
    const outcome = mapOpenFarmCrop(baseRecord({ sun }));
    if (outcome.skipped) throw new Error(`expected a mapped record for sun=${sun}`);
    expect(outcome.plant.light).toBe(light);
  });

  it('takes the first binomial when the source lists a species complex', () => {
    const outcome = mapOpenFarmCrop(
      baseRecord({
        slug: 'amaranth',
        name: 'Amaranth',
        binomialName: 'Amaranthus cruentus, Amaranthus hypochondriacus',
      }),
    );
    if (outcome.skipped) throw new Error('amaranth is in the curated category table');
    expect(outcome.plant.scientificName).toBe('Amaranthus cruentus');
    expect(outcome.resolveName).toBe('Amaranthus cruentus');
  });

  it('skips a record whose name is the scrape placeholder', () => {
    const outcome = mapOpenFarmCrop(baseRecord({ name: 'You Can Grow Anything' }));
    expect(outcome).toMatchObject({
      skipped: true,
      slug: 'onion',
      reason: expect.stringContaining('placeholder'),
    });
  });

  it('skips a record with no curated category classification', () => {
    const outcome = mapOpenFarmCrop(baseRecord({ slug: 'not-a-curated-crop' }));
    expect(outcome).toMatchObject({
      skipped: true,
      reason: expect.stringContaining('no curated edible-category classification'),
    });
  });

  it.each([undefined, 'No specific', 'Add this information'])(
    'skips a record with an unmappable sun value: %j',
    (sun) => {
      const outcome = mapOpenFarmCrop(baseRecord({ sun }));
      expect(outcome).toMatchObject({
        skipped: true,
        reason: expect.stringContaining('does not map to a light requirement'),
      });
    },
  );

  it('skips a record with no binomial name', () => {
    const outcome = mapOpenFarmCrop(baseRecord({ binomialName: undefined }));
    expect(outcome).toMatchObject({
      skipped: true,
      reason: expect.stringContaining('no binomial'),
    });
  });

  it.each([
    { spreadCm: undefined, rowSpacingCm: 30 },
    { spreadCm: 8, rowSpacingCm: undefined },
    { spreadCm: 0, rowSpacingCm: 30 },
    { spreadCm: 8, rowSpacingCm: 0 },
  ])('skips a record with missing or non-positive spacing: %j', (overrides) => {
    const outcome = mapOpenFarmCrop(baseRecord(overrides));
    expect(outcome).toMatchObject({
      skipped: true,
      reason: expect.stringContaining('spreadCm/rowSpacingCm'),
    });
  });
});
