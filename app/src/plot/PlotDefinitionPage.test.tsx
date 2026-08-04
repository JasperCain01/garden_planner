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

  // This render+interact flow was already consistently ~5s on `main` (heavy
  // component tree: outline editor, palette, canvas), right at the default
  // 5000ms timeout's edge. Workplan Stage 6.2 added a second interactive
  // control to every one of the ~130+ palette rows the default conditions
  // rank (the "Add to plot" button, alongside the existing draggable
  // region) for keyboard-operable placement — genuinely more DOM per row,
  // and jsdom mounting + re-rendering that repeatedly (once per form edit
  // below) measured ~18-19s.
  //
  // **It is ~6s again as of UI redesign Phase 3**, which compacted every
  // palette row from the engine's full reasoning (a summary, a confidence
  // line and a four-bullet list, per crop) to an icon, a name and two chips.
  // Roughly three times faster, from the same number of rows — a fair proxy
  // for how much DOM that phase stopped building. The 30s timeout stays as
  // headroom rather than being re-tuned to the new figure: it is insurance
  // against a slow machine, and this test's cost has now moved twice.
  it('produces a region and conditions the engine actually accepts, driven end to end through the DOM', () => {
    render(<PlotDefinitionPage />);

    // Pick a rectangle preset with real dimensions.
    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /use this shape/i }));

    // Fill in growing conditions: partial shade, clay soil, a named region.
    // Light is a segmented control since UI redesign Phase 4, so this is a
    // click on the option rather than a change on a `<select>`.
    fireEvent.click(screen.getByLabelText(/^partial shade$/i));
    // Soil sits behind a disclosure now, and `getByLabelText` would happily
    // drive it shut — which would leave this test green while the control was
    // unreachable in a browser. Open it the way a user has to.
    fireEvent.click(screen.getByText(/describe your soil/i));
    fireEvent.change(screen.getByLabelText(/soil texture/i), { target: { value: 'clay' } });
    // Location is one select now: the UK default is an option, not a mode.
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
  }, 30_000);

  it('starts from a valid default plot even before any interaction', () => {
    render(<PlotDefinitionPage />);
    const { region, conditionsInput } = usePlotStore.getState();
    expect(() => validatePlotRegion(region)).not.toThrow();
    expect(() => resolvePlotConditions(conditionsInput)).not.toThrow();
  });
});
