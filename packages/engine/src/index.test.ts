import { describe, it, expect } from 'vitest';
import {
  ENGINE_READY,
  engineStatus,
  evaluatePlot,
  rankPlants,
  rectangleRegion,
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

  it('exposes the warnings & companion-suggestion engine end to end', () => {
    const plant = validatePlant({
      id: 'onion',
      commonName: 'Onion',
      scientificName: 'Allium cepa',
      gbifId: null,
      category: 'vegetable',
      light: 'full-shade', // deliberately wrong for the plot below
      spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
      provenance: { sources: [{ source: 'hand-written test fixture' }] },
    });
    const conditions = resolvePlotConditions({ light: 'full-sun' });
    const placements = [{ id: 'bed-1', plant, region: rectangleRegion(100, 100), count: 1 }];

    const evaluation = evaluatePlot(conditions, placements);
    expect(evaluation.warnings).toHaveLength(1);
    expect(evaluation.warnings[0].kind).toBe('wrong-light');
    expect(evaluation.suggestions).toHaveLength(0);
  });
});
