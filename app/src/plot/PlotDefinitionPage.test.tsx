import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { rectangleRegion, resolvePlotConditions, validatePlotRegion } from '@garden-planner/engine';
import { usePlotStore } from '../state/plot-store.ts';
import { PlotDefinitionPage } from './PlotDefinitionPage.tsx';

describe('PlotDefinitionPage', () => {
  beforeEach(() => {
    // Reset the singleton store between tests (mirrors user-plants-store.test.ts).
    usePlotStore.setState({
      region: rectangleRegion(300, 200),
      conditionsInput: { light: 'full-sun' },
    });
  });

  it('produces a region and conditions the engine actually accepts, driven end to end through the DOM', () => {
    render(<PlotDefinitionPage />);

    // Pick a rectangle preset with real dimensions.
    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /use this shape/i }));

    // Fill in growing conditions: partial shade, clay soil, a named region.
    fireEvent.change(screen.getByLabelText(/light level/i), { target: { value: 'partial-shade' } });
    fireEvent.change(screen.getByLabelText(/soil texture/i), { target: { value: 'clay' } });
    fireEvent.click(screen.getByLabelText(/pick a region/i));
    fireEvent.change(screen.getByLabelText(/^region$/i), {
      target: { value: 'south-west-england' },
    });

    const { region, conditionsInput } = usePlotStore.getState();

    // The deliverable: round-trip through the engine's own boundary
    // functions, not just an assertion on this app's own state shape.
    expect(() => validatePlotRegion(region)).not.toThrow();
    const resolved = resolvePlotConditions(conditionsInput);
    expect(resolved.light).toBe('partial-shade');
    expect(resolved.soil).toEqual({ texture: 'clay' });
    expect(resolved.climate.id).toBe('south-west-england');
  });

  it('starts from a valid default plot even before any interaction', () => {
    render(<PlotDefinitionPage />);
    const { region, conditionsInput } = usePlotStore.getState();
    expect(() => validatePlotRegion(region)).not.toThrow();
    expect(() => resolvePlotConditions(conditionsInput)).not.toThrow();
  });
});
