import { describe, expect, it } from 'vitest';
import {
  CompanionRelationshipSchema,
  findDanglingRelationships,
  findDuplicateRelationships,
  validateCompanionRelationship,
  type CompanionRelationship,
} from './schema.ts';

function makeRelationship(overrides: Partial<CompanionRelationship> = {}): CompanionRelationship {
  return {
    from: 'onion',
    to: 'carrot',
    kind: 'companion',
    evidence: 'well-supported',
    note: 'test relationship',
    sources: [{ source: 'Test Source', url: 'https://example.com/test' }],
    symmetric: true,
    ...overrides,
  };
}

describe('CompanionRelationshipSchema', () => {
  it('accepts a well-formed relationship', () => {
    expect(() => validateCompanionRelationship(makeRelationship())).not.toThrow();
  });

  it('rejects a relationship linking a plant to itself', () => {
    expect(() =>
      validateCompanionRelationship(makeRelationship({ from: 'onion', to: 'onion' })),
    ).toThrow();
  });

  it('rejects a missing evidence tag', () => {
    const relationship: Record<string, unknown> = { ...makeRelationship() };
    delete relationship.evidence;
    expect(() => CompanionRelationshipSchema.parse(relationship)).toThrow();
  });

  it('rejects an evidence value outside the closed enum', () => {
    expect(() =>
      validateCompanionRelationship(makeRelationship({ evidence: 'made-up' as never })),
    ).toThrow();
  });

  it('rejects an empty note', () => {
    expect(() => validateCompanionRelationship(makeRelationship({ note: '' }))).toThrow();
  });

  it('rejects an empty sources array', () => {
    const relationship = { ...makeRelationship(), sources: [] };
    expect(() => validateCompanionRelationship(relationship)).toThrow();
  });

  it('rejects a non-slug id', () => {
    expect(() => validateCompanionRelationship(makeRelationship({ from: 'Onion!' }))).toThrow();
  });

  it('rejects an unknown key (strict)', () => {
    expect(() =>
      CompanionRelationshipSchema.parse({ ...makeRelationship(), extra: 'nope' }),
    ).toThrow();
  });
});

describe('findDanglingRelationships', () => {
  it('reports no dangling relationships when both ends are in the universe', () => {
    const universe = new Set(['onion', 'carrot']);
    expect(findDanglingRelationships([makeRelationship()], universe)).toEqual([]);
  });

  it('reports a relationship whose "to" is outside the universe', () => {
    const universe = new Set(['onion']);
    const dangling = findDanglingRelationships([makeRelationship()], universe);
    expect(dangling).toHaveLength(1);
    expect(dangling[0]?.missing).toEqual(['to']);
  });

  it('reports a relationship whose "from" is outside the universe', () => {
    const universe = new Set(['carrot']);
    const dangling = findDanglingRelationships([makeRelationship()], universe);
    expect(dangling).toHaveLength(1);
    expect(dangling[0]?.missing).toEqual(['from']);
  });

  it('reports both ends missing when neither is in the universe', () => {
    const universe = new Set<string>();
    const dangling = findDanglingRelationships([makeRelationship()], universe);
    expect(dangling[0]?.missing).toEqual(['from', 'to']);
  });
});

describe('findDuplicateRelationships', () => {
  it('finds no duplicates in a clean list', () => {
    const list = [
      makeRelationship(),
      makeRelationship({ from: 'garlic', to: 'pea', kind: 'antagonist' }),
    ];
    expect(findDuplicateRelationships(list)).toEqual([]);
  });

  it('flags an exact repeat of kind/from/to', () => {
    const list = [makeRelationship(), makeRelationship({ note: 'a different note, same edge' })];
    expect(findDuplicateRelationships(list)).toHaveLength(1);
  });

  it('does not flag the same from/to recorded as a different kind', () => {
    const list = [
      makeRelationship({ kind: 'companion' }),
      makeRelationship({ kind: 'antagonist' }),
    ];
    expect(findDuplicateRelationships(list)).toEqual([]);
  });

  it('does not flag the reverse direction of a symmetric pair as a duplicate', () => {
    const list = [
      makeRelationship({ from: 'onion', to: 'carrot' }),
      makeRelationship({ from: 'carrot', to: 'onion' }),
    ];
    expect(findDuplicateRelationships(list)).toEqual([]);
  });
});
