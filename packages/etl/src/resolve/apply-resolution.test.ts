import { describe, expect, it } from 'vitest';
import type { Plant } from '@garden-planner/engine';
import { applyGbifResolution } from './apply-resolution';
import type { ResolvedOutcome } from './gbif-resolver';

/** A minimal, otherwise-valid record with the schema's nullable gbifId unset. */
const onionWithoutGbifId: Plant = {
  id: 'onion',
  commonName: 'Onion',
  scientificName: 'Allium cepa',
  gbifId: null,
  category: 'vegetable',
  light: 'full-sun',
  spacing: { intensive: { plantsPerSquare: 9 } },
  provenance: { sources: [{ source: 'hand-verified', note: 'test fixture' }] },
};

const resolvedOnion: ResolvedOutcome = {
  status: 'resolved',
  query: 'onion',
  gbifId: 1000001,
  scientificName: 'Allium cepa',
  matchType: 'EXACT',
  confidence: 98,
  fromCache: false,
};

describe('applyGbifResolution', () => {
  it('fills the nullable gbifId and returns a schema-valid Plant', () => {
    const result = applyGbifResolution(onionWithoutGbifId, resolvedOnion);
    expect(result.gbifId).toBe(1000001);
  });

  it('leaves the rest of the record untouched', () => {
    const result = applyGbifResolution(onionWithoutGbifId, resolvedOnion);
    expect(result.commonName).toBe('Onion');
    expect(result.scientificName).toBe('Allium cepa');
    expect(result.spacing).toEqual(onionWithoutGbifId.spacing);
  });
});
