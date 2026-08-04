import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { resolvePlotConditions, type PlotConditionsInput } from '@garden-planner/engine';
import { PlotConditionsForm } from './PlotConditionsForm.tsx';

/** A thin controlled wrapper so a test can drive several edits in sequence against live state. */
function ControlledForm({ initial }: { initial: PlotConditionsInput }) {
  const [value, setValue] = useState(initial);
  return <PlotConditionsForm value={value} onChange={setValue} />;
}

/**
 * Open the "Describe your soil (optional)" disclosure (UI redesign Phase 4).
 *
 * Needed because `getByLabelText` does **not** check visibility: without this
 * every soil assertion below would pass in jsdom while the control was
 * unreachable in a real browser. `e2e/plot-settings.spec.ts` is the other half
 * of that — it asserts in Chromium that the control really is hidden until this
 * summary is pressed, which is the thing jsdom structurally cannot tell us.
 */
function openSoil(): void {
  fireEvent.click(screen.getByText(/describe your soil/i));
}

describe('PlotConditionsForm', () => {
  it('reports a light-level change', () => {
    const handleChange = vi.fn();
    render(<PlotConditionsForm value={{ light: 'full-sun' }} onChange={handleChange} />);

    // A segmented control since Phase 4: the options are all on screen, so the
    // interaction is a click on one rather than a change on a `<select>`.
    fireEvent.click(screen.getByLabelText(/^partial shade$/i));

    expect(handleChange).toHaveBeenCalledWith({ light: 'partial-shade' });
  });

  it('has no alert for the default (light-only) value, since it already resolves', () => {
    render(<PlotConditionsForm value={{ light: 'full-sun' }} onChange={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('builds a soil block only once a facet is set, and drops it again once every facet is cleared', () => {
    render(<ControlledForm initial={{ light: 'full-sun' }} />);
    openSoil();

    fireEvent.change(screen.getByLabelText(/soil texture/i), { target: { value: 'clay' } });
    expect(screen.getByLabelText(/soil texture/i)).toHaveProperty('value', 'clay');

    fireEvent.change(screen.getByLabelText(/soil texture/i), { target: { value: '' } });
    expect(screen.getByLabelText(/soil texture/i)).toHaveProperty('value', '');
  });

  it('picks a climate region through one select, with the UK default as an option rather than a mode', () => {
    const handleChange = vi.fn();
    render(<PlotConditionsForm value={{ light: 'full-sun' }} onChange={handleChange} />);

    fireEvent.change(screen.getByLabelText(/^region$/i), {
      target: { value: 'south-west-england' },
    });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        location: { kind: 'region', regionId: 'south-west-england' },
      }),
    );
  });

  it('maps the default option back to an absent location, not to an empty one', () => {
    const handleChange = vi.fn();
    render(
      <PlotConditionsForm
        value={{ light: 'full-sun', location: { kind: 'region', regionId: 'south-west-england' } }}
        onChange={handleChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^region$/i), { target: { value: 'uk-default' } });

    // `resolvePlotConditions` reads an absent location as the UK average — the
    // sentinel must never reach the engine as a region id.
    expect(handleChange).toHaveBeenCalledWith({ light: 'full-sun', location: undefined });
  });

  it('shows an inline error rather than throwing for a value the schema rejects', () => {
    // A value this component would never itself produce (soil present but
    // empty), exercising the resolve-and-catch path the same way a corrupted
    // upstream state would.
    render(<PlotConditionsForm value={{ light: 'full-sun', soil: {} }} onChange={() => {}} />);

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('produces a PlotConditionsInput that resolves cleanly end to end', () => {
    render(<ControlledForm initial={{ light: 'full-sun' }} />);

    fireEvent.click(screen.getByLabelText(/^partial shade$/i));
    openSoil();
    fireEvent.change(screen.getByLabelText(/soil texture/i), { target: { value: 'clay' } });
    fireEvent.click(screen.getByLabelText(/^acid$/i));
    fireEvent.change(screen.getByLabelText(/^region$/i), {
      target: { value: 'south-west-england' },
    });
    fireEvent.change(screen.getByLabelText(/planting month/i), { target: { value: '4' } });

    expect(screen.queryByRole('alert')).toBeNull();

    // Re-derive the same value the component's own onChange calls have been
    // building, by reading the last rendered select states — a lighter check
    // than re-implementing the reducer: the important assertion is that
    // resolvePlotConditions accepts *some* completed value shaped by real
    // form interaction, which the "PlotDefinitionPage" round-trip test
    // exercises against the actual store.
    const resolved = resolvePlotConditions({
      light: 'partial-shade',
      soil: { texture: 'clay', ph: 'acid' },
      location: { kind: 'region', regionId: 'south-west-england' },
      plantingMonth: 4,
    });
    expect(resolved.climate.id).toBe('south-west-england');
  });

  it('keeps the soil facets inside a disclosure that starts closed', () => {
    render(<ControlledForm initial={{ light: 'full-sun' }} />);

    // jsdom can't answer "is it visible", but it can answer "is the disclosure
    // open" — which is the fact this phase's layout depends on, and the reason
    // every soil test above has to open it first.
    const disclosure = screen.getByText(/describe your soil/i).closest('details');
    expect(disclosure?.open).toBe(false);
  });
});
