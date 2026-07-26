import { describe, expect, it } from 'vitest';
import { isUserPlantId, validatePlant } from '@garden-planner/engine';
import { CURATED_PLANTS } from './plants.ts';

describe('CURATED_PLANTS', () => {
  it('is not empty — Stage 1.7 ships at least one curated crop', () => {
    expect(CURATED_PLANTS.length).toBeGreaterThan(0);
  });

  it('is schema-valid — the same unrelaxed validatePlant every shipped record clears', () => {
    for (const plant of CURATED_PLANTS) {
      expect(() => validatePlant(plant)).not.toThrow();
    }
  });

  it('has unique ids', () => {
    const ids = CURATED_PLANTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not use the reserved `user-` id namespace (ADR 0011)', () => {
    for (const plant of CURATED_PLANTS) {
      expect(isUserPlantId(plant.id)).toBe(false);
    }
  });

  it('carries no companion/antagonist links of its own (link-free, docs/adr/0021)', () => {
    // Keeping curated additions link-free is what lets them join the merge
    // with no referential-integrity risk of their own — any link they gain
    // (e.g. broad-bean's Stage 1.4 antagonist pairing) comes from the
    // existing companion data attaching onto them, not from this module.
    for (const plant of CURATED_PLANTS) {
      expect(plant.companions).toBeUndefined();
      expect(plant.antagonists).toBeUndefined();
    }
  });

  it('cites at least one real source per record', () => {
    for (const plant of CURATED_PLANTS) {
      expect(plant.provenance.sources.length).toBeGreaterThan(0);
      for (const source of plant.provenance.sources) {
        expect(source.source.length).toBeGreaterThan(0);
      }
    }
  });
});
