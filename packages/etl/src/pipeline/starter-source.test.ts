import { describe, expect, it } from 'vitest';
import { STARTER_NAMES, starterNamesSource } from './starter-source.ts';

describe('starterNamesSource', () => {
  it('implements SourceAdapter, yielding one record per starter name', async () => {
    const records = await starterNamesSource.fetchRecords();

    expect(records.map((record) => record.name)).toEqual(STARTER_NAMES);
  });

  it('carries a stable id and label for logging/provenance', () => {
    expect(starterNamesSource.id).toBe('starter-names');
    expect(starterNamesSource.label.length).toBeGreaterThan(0);
  });
});
