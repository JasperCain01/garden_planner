import { beforeEach, describe, expect, it } from 'vitest';
import { rectangleRegion, resolvePlotConditions, validatePlotRegion } from '@garden-planner/engine';
import { usePlotStore } from './plot-store.ts';

describe('usePlotStore', () => {
  beforeEach(() => {
    // The store is a module-level singleton; reset it so one test's edits
    // don't leak into the next (mirrors user-plants-store.test.ts).
    usePlotStore.setState({
      region: rectangleRegion(300, 200),
      conditionsInput: { light: 'full-sun' },
    });
  });

  it('starts with a valid default region and conditions input', () => {
    const { region, conditionsInput } = usePlotStore.getState();
    expect(() => validatePlotRegion(region)).not.toThrow();
    expect(() => resolvePlotConditions(conditionsInput)).not.toThrow();
  });

  it('replaces the region wholesale on setRegion', () => {
    const next = rectangleRegion(500, 400);
    usePlotStore.getState().setRegion(next);
    expect(usePlotStore.getState().region).toBe(next);
  });

  it('replaces the conditions input wholesale on setConditionsInput', () => {
    const next = { light: 'full-shade' as const, plantingMonth: 5 as const };
    usePlotStore.getState().setConditionsInput(next);
    expect(usePlotStore.getState().conditionsInput).toBe(next);
  });
});
