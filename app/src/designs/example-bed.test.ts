import { describe, expect, it } from 'vitest';
import { resolvePlotConditions } from '@garden-planner/engine';
import { SHIPPED_PLANTS } from '../dataset/shipped-plants.ts';
import { evaluateCanvasWarnings } from '../warnings/evaluate-canvas.ts';
import { buildExampleBed } from './example-bed.ts';

/**
 * The starter bed (UI redesign Phase 5), tested against the engine rather than
 * against a snapshot of itself.
 *
 * A demonstration bed's whole job is to show what the app does the first time
 * someone opens it, so the two things worth pinning are that it *works* against
 * the shipped dataset (every crop id still resolves) and that it demonstrates
 * the right thing: no warnings, and a companion suggestion to prove the dock is
 * live. Both are properties of the current dataset, so an ETL change that
 * removed carrot or moved onion's spacing would fail here — which is the point.
 */
describe('the example bed', () => {
  it('resolves every one of its crops against the shipped dataset', () => {
    const design = buildExampleBed(SHIPPED_PLANTS);
    expect(design).not.toBeNull();
    expect(design?.placements).toHaveLength(5);
  });

  it('opens with no warnings and at least one companion suggestion', () => {
    const design = buildExampleBed(SHIPPED_PLANTS);
    if (design === null) throw new Error('no example bed');

    const evaluated = evaluateCanvasWarnings(
      design.placements,
      design.region,
      resolvePlotConditions(design.conditionsInput),
    );

    expect(
      evaluated.warnings.map((warning) => warning.reason),
      'a starter bed that opened with problems would demonstrate the wrong thing',
    ).toEqual([]);
    expect(evaluated.suggestions.length).toBeGreaterThan(0);
  });

  it('skips a crop the dataset no longer has, rather than placing a hole', () => {
    // ADR 0025 deleted 24 crops from the shipped dataset on purpose, and the
    // dataset is a build artifact — so a hard-coded id is a reference that can
    // go stale between deploys, exactly as a saved design's can.
    const withoutCarrot = SHIPPED_PLANTS.filter((plant) => plant.id !== 'carrot');
    const design = buildExampleBed(withoutCarrot);

    expect(design?.placements).toHaveLength(4);
    expect(design?.placements.some((placement) => placement.plant.id === 'carrot')).toBe(false);
  });

  it('gives up rather than offering a bed of one plant', () => {
    expect(buildExampleBed([])).toBeNull();
  });
});
