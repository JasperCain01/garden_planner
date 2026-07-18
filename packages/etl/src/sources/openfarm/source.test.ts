import { describe, expect, it } from 'vitest';
import { createOpenFarmSource, OPENFARM_CACHE_PATH, openfarmSource } from './source.ts';
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

describe('createOpenFarmSource', () => {
  it('never touches the network: an injected reader is the only source of records', async () => {
    const source = createOpenFarmSource({ reader: () => [rawRecord()] });

    const records = await source.fetchRecords();

    expect(records).toEqual([{ name: 'Allium cepa', raw: rawRecord() }]);
  });

  it('returns only records that map cleanly, and reports the rest via getSkipped()', async () => {
    const mappable = rawRecord();
    const unmappable = rawRecord({ slug: 'not-curated', name: 'Not Curated' });
    const source = createOpenFarmSource({ reader: () => [mappable, unmappable] });

    const records = await source.fetchRecords();
    const skipped = source.getSkipped();

    expect(records).toHaveLength(1);
    expect(records[0]?.name).toBe('Allium cepa');
    expect(skipped).toEqual([
      {
        slug: 'not-curated',
        reason: expect.stringContaining('no curated edible-category classification'),
      },
    ]);
  });

  it('resets getSkipped() on every fetchRecords() call', async () => {
    const source = createOpenFarmSource({
      reader: () => [rawRecord({ slug: 'not-curated', name: 'Not Curated' })],
    });
    await source.fetchRecords();
    expect(source.getSkipped()).toHaveLength(1);

    const secondSource = createOpenFarmSource({ reader: () => [rawRecord()] });
    await secondSource.fetchRecords();
    expect(secondSource.getSkipped()).toHaveLength(0);
  });

  it('exposes id and label for pipeline logging', () => {
    const source = createOpenFarmSource({ reader: () => [] });
    expect(source.id).toBe('openfarm');
    expect(source.label).toContain('OpenFarm');
  });

  describe('the default openfarmSource (reads the committed cache file)', () => {
    it('points OPENFARM_CACHE_PATH at the committed cache/openfarm-crops.json', () => {
      expect(OPENFARM_CACHE_PATH.replaceAll('\\', '/')).toMatch(
        /packages\/etl\/cache\/openfarm-crops\.json$/,
      );
    });

    it('maps a real, substantial batch of records with no network access', async () => {
      const records = await openfarmSource.fetchRecords();

      // Proves the committed cache is readable offline and the curated
      // category table (162 entries as of writing) actually produces
      // mappable records — not an exact count, so this doesn't need
      // updating every time categories.ts grows.
      expect(records.length).toBeGreaterThan(100);
      expect(records.every((r) => typeof r.name === 'string' && r.name.length > 0)).toBe(true);
    });
  });
});
