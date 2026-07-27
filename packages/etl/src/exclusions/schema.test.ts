import { describe, expect, it } from 'vitest';
import { validateExclusionTable, type ExcludedCrop } from './schema.ts';

/**
 * `table.test.ts` validates the real curated list, which is (rightly) always
 * valid — so `validateExclusionTable`'s own error paths (an invalid row, a
 * duplicate id) were never actually exercised anywhere. This is the
 * schema-level counterpart, mirroring `spacing/schema.test.ts`'s split
 * between "the real table" and "the validator's own error paths".
 */
function row(overrides: Partial<ExcludedCrop> = {}): ExcludedCrop {
  return {
    id: 'dragon-fruit',
    commonName: 'Dragon fruit',
    basis: 'too-tender',
    note: 'A tropical cactus that cannot survive a British winter outdoors.',
    ...overrides,
  };
}

describe('validateExclusionTable', () => {
  it('accepts a well-formed list', () => {
    expect(() => validateExclusionTable([row()])).not.toThrow();
  });

  it('throws, naming the row index and the problem, on an invalid row', () => {
    expect(() => validateExclusionTable([{ ...row(), basis: 'too-cold' }])).toThrow(
      /exclusion row #0 is invalid/,
    );
  });

  it('throws on a crop listed twice', () => {
    expect(() => validateExclusionTable([row(), row()])).toThrow(
      /exclusion list names "dragon-fruit" more than once/,
    );
  });
});
