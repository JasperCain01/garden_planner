import { describe, it, expect } from 'vitest';
import {
  ENGINE_READY,
  engineStatus,
  rankPlants,
  resolvePlotConditions,
  scorePlant,
  validatePlant,
} from './index';

// Smoke tests for the scaffold. These are replaced by the real golden-case and
// property-based suites in Phase 2 (see WORKPLAN.md §1.2), but they already prove
// the engine package builds and is unit-testable in isolation.
describe('engine scaffold', () => {
  it('is wired in', () => {
    expect(ENGINE_READY).toBe(true);
  });

  it('reports a ready status', () => {
    expect(engineStatus()).toContain('ready');
  });
});

/**
 * The public surface is what the app and the ETL import; these check that each
 * module is actually re-exported from the package root, not merely present in
 * its own directory.
 */
describe('engine public surface', () => {
  it('exposes the suitability engine end to end', () => {
    const plant = validatePlant({
      id: 'onion',
      commonName: 'Onion',
      scientificName: 'Allium cepa',
      gbifId: null,
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
      provenance: { sources: [{ source: 'hand-written test fixture' }] },
    });
    const conditions = resolvePlotConditions({ light: 'full-sun' });

    expect(scorePlant(plant, conditions).band).toBe('good');
    expect(rankPlants([plant], conditions)).toHaveLength(1);
  });
});
