import { describe, expect, it } from 'vitest';
import { assertOpenFarmCropArray } from './types.ts';

const validRecord = {
  slug: 'onion',
  name: 'Onion',
  binomialName: 'Allium cepa',
  sun: 'Full Sun',
  spreadCm: 8,
  rowSpacingCm: 30,
  source: {
    origin: 'OpenFarm.cc',
    license: 'CC0-1.0',
    waybackUrl: 'https://web.archive.org/web/20250101000000/https://openfarm.cc/en/crops/onion',
    captured: '20250101',
  },
};

describe('assertOpenFarmCropArray', () => {
  it('accepts a well-formed array and returns it typed', () => {
    expect(assertOpenFarmCropArray([validRecord])).toEqual([validRecord]);
  });

  it('accepts an empty array', () => {
    expect(assertOpenFarmCropArray([])).toEqual([]);
  });

  it('rejects a non-array top level', () => {
    expect(() => assertOpenFarmCropArray({ slug: 'onion' })).toThrow(/expected a JSON array/);
  });

  it('rejects an entry missing required fields', () => {
    const withoutSlug: Record<string, unknown> = { ...validRecord };
    delete withoutSlug.slug;
    expect(() => assertOpenFarmCropArray([withoutSlug])).toThrow(/entry 0/);
  });

  it('rejects an entry whose source block is malformed', () => {
    const bad = { ...validRecord, source: { origin: 'OpenFarm.cc' } };
    expect(() => assertOpenFarmCropArray([bad])).toThrow(/entry 0/);
  });

  it('rejects an entry with the wrong type for an optional numeric field', () => {
    const bad = { ...validRecord, spreadCm: 'eight' };
    expect(() => assertOpenFarmCropArray([bad])).toThrow(/entry 0/);
  });

  it('reports the index of the first bad entry in a larger array', () => {
    expect(() => assertOpenFarmCropArray([validRecord, { slug: 42 }])).toThrow(/entry 1/);
  });
});
