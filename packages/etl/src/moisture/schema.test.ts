import { describe, expect, it } from 'vitest';
import { validateMoistureRecord, validateMoistureTable, type MoistureRecord } from './schema.ts';

/**
 * `table.test.ts` validates the real curated table, which is (rightly) always
 * valid — so neither `validateMoistureRecord` nor `validateMoistureTable`'s
 * own error paths (an invalid row, a duplicate id) were ever exercised
 * anywhere. This is the schema-level counterpart, mirroring the same split
 * `spacing/schema.test.ts` and (now) `exclusions/schema.test.ts` make between
 * "the real table" and "the validator's own error paths".
 */
function row(overrides: Partial<MoistureRecord> = {}): MoistureRecord {
  return {
    id: 'onion',
    moisture: ['moist'],
    note: 'Onions want steady moisture through bulbing but resent waterlogging.',
    ...overrides,
  };
}

describe('validateMoistureRecord', () => {
  it('accepts a well-formed row', () => {
    expect(() => validateMoistureRecord(row())).not.toThrow();
  });

  it('throws on a row with no moisture levels at all', () => {
    expect(() => validateMoistureRecord({ ...row(), moisture: [] })).toThrow();
  });

  it('throws on a row missing its required note', () => {
    expect(() => validateMoistureRecord({ ...row(), note: '' })).toThrow();
  });
});

describe('validateMoistureTable', () => {
  it('accepts a well-formed table', () => {
    expect(() => validateMoistureTable([row()])).not.toThrow();
  });

  it('throws, naming the row index and the problem, on an invalid row', () => {
    expect(() => validateMoistureTable([{ ...row(), moisture: ['soggy'] }])).toThrow(
      /moisture row #0 is invalid/,
    );
  });

  it('throws on a crop listed twice', () => {
    expect(() => validateMoistureTable([row(), row()])).toThrow(
      /moisture table lists "onion" more than once/,
    );
  });
});
