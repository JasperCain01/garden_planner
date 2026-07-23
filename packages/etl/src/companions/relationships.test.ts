import { describe, expect, it } from 'vitest';
import { PlantLinkSchema } from '@garden-planner/engine';
import {
  ALL_COMPANION_RELATIONSHIPS,
  findDuplicatePlantLinks,
  toPlantLinksById,
} from './relationships.ts';
import { CURATED_COMPANION_RELATIONSHIPS } from './curated.ts';
import { OPENFARM_DERIVED_COMPANION_RELATIONSHIPS } from './openfarm-derived.ts';
import {
  CompanionRelationshipSchema,
  findDanglingRelationships,
  findDuplicateRelationships,
  type CompanionRelationship,
} from './schema.ts';
import { PLANT_ID_UNIVERSE } from './plant-id-universe.ts';

describe('ALL_COMPANION_RELATIONSHIPS (curated + OpenFarm-derived, combined)', () => {
  it('is exactly the concatenation of both sources', () => {
    expect(ALL_COMPANION_RELATIONSHIPS.length).toBe(
      CURATED_COMPANION_RELATIONSHIPS.length + OPENFARM_DERIVED_COMPANION_RELATIONSHIPS.length,
    );
  });

  it('every relationship is schema-valid', () => {
    for (const relationship of ALL_COMPANION_RELATIONSHIPS) {
      expect(() => CompanionRelationshipSchema.parse(relationship)).not.toThrow();
    }
  });

  it('every relationship carries an evidence tag', () => {
    for (const relationship of ALL_COMPANION_RELATIONSHIPS) {
      expect(relationship.evidence).toBeDefined();
    }
  });

  it('has no dangling relationship (referential integrity) against the plant-id universe', () => {
    expect(findDanglingRelationships(ALL_COMPANION_RELATIONSHIPS, PLANT_ID_UNIVERSE)).toEqual([]);
  });

  it('has no exact duplicate (kind, from, to) edge across curated + derived combined', () => {
    expect(findDuplicateRelationships(ALL_COMPANION_RELATIONSHIPS)).toEqual([]);
  });

  it('expands to no duplicate PlantLink on any single plant (post-symmetric-expansion check)', () => {
    // findDuplicateRelationships only catches exact (kind, from, to) repeats
    // in the pre-expansion edge list — by design, it does not flag a
    // reverse-direction pair (A→B and B→A) as a duplicate, since those are
    // legitimately distinct directed edges. But if such a pair also happens
    // to expand onto the same owner (e.g. a symmetric A→B plus an
    // independently-authored B→A), the *output* PlantLink arrays could still
    // end up double-listing a companion. This checks that actual output.
    expect(findDuplicatePlantLinks(toPlantLinksById(ALL_COMPANION_RELATIONSHIPS))).toEqual([]);
  });
});

describe('toPlantLinksById', () => {
  const fixtures: CompanionRelationship[] = [
    {
      from: 'a',
      to: 'b',
      kind: 'companion',
      evidence: 'well-supported',
      note: 'mutual benefit',
      sources: [{ source: 'Test', url: 'https://example.com/ab' }],
      symmetric: true,
    },
    {
      from: 'c',
      to: 'd',
      kind: 'antagonist',
      evidence: 'traditional',
      note: 'one-directional harm',
      sources: [{ source: 'Test', url: 'https://example.com/cd' }],
      symmetric: false,
    },
  ];

  it('produces a link on both ends for a symmetric relationship', () => {
    const byId = toPlantLinksById(fixtures);
    expect(byId.get('a')?.companions).toEqual([
      { plantId: 'b', evidence: 'well-supported', note: 'mutual benefit' },
    ]);
    expect(byId.get('b')?.companions).toEqual([
      { plantId: 'a', evidence: 'well-supported', note: 'mutual benefit' },
    ]);
  });

  it('produces a link only on "from" for a non-symmetric relationship', () => {
    const byId = toPlantLinksById(fixtures);
    expect(byId.get('c')?.antagonists).toEqual([
      { plantId: 'd', evidence: 'traditional', note: 'one-directional harm' },
    ]);
    expect(byId.get('d')).toBeUndefined();
  });

  it("every produced link validates against the engine's own PlantLinkSchema", () => {
    const byId = toPlantLinksById(fixtures);
    for (const entry of byId.values()) {
      for (const link of [...entry.companions, ...entry.antagonists]) {
        expect(() => PlantLinkSchema.parse(link)).not.toThrow();
      }
    }
  });

  it('separates companions from antagonists for the same owner', () => {
    const mixed: CompanionRelationship[] = [
      { ...fixtures[0]!, kind: 'companion' },
      {
        from: 'a',
        to: 'e',
        kind: 'antagonist',
        evidence: 'traditional',
        note: 'n',
        sources: fixtures[0]!.sources,
        symmetric: false,
      },
    ];
    const byId = toPlantLinksById(mixed);
    expect(byId.get('a')?.companions).toHaveLength(1);
    expect(byId.get('a')?.antagonists).toHaveLength(1);
  });

  it('defaults to the real ALL_COMPANION_RELATIONSHIPS when called with no arguments', () => {
    const byId = toPlantLinksById();
    expect(byId.get('onion')?.companions.some((link) => link.plantId === 'carrot')).toBe(true);
  });
});

describe('findDuplicatePlantLinks', () => {
  it('finds nothing for a clean, single-direction dataset', () => {
    const byId = toPlantLinksById([
      {
        from: 'a',
        to: 'b',
        kind: 'companion',
        evidence: 'well-supported',
        note: 'n',
        sources: [{ source: 'Test', url: 'https://example.com/ab' }],
        symmetric: true,
      },
    ]);
    expect(findDuplicatePlantLinks(byId)).toEqual([]);
  });

  it('catches a symmetric A→B plus an independently-authored B→A ending up duplicated', () => {
    const source = { source: 'Test', url: 'https://example.com/ab' };
    const byId = toPlantLinksById([
      {
        from: 'a',
        to: 'b',
        kind: 'companion',
        evidence: 'well-supported',
        note: 'n1',
        sources: [source],
        symmetric: true,
      },
      {
        from: 'b',
        to: 'a',
        kind: 'companion',
        evidence: 'traditional',
        note: 'n2',
        sources: [source],
        symmetric: false,
      },
    ]);
    // findDuplicateRelationships wouldn't flag this pair (distinct kind/from/to
    // keys). The symmetric a→b edge lists 'a' as a companion of 'b' (via its
    // reverse-direction expansion); the explicit b→a edge lists 'a' as a
    // companion of 'b' too — so 'b's companion list ends up with 'a' twice.
    const duplicates = findDuplicatePlantLinks(byId);
    expect(duplicates).toContainEqual({ plantId: 'b', kind: 'companion', duplicatedPlantId: 'a' });
  });
});
