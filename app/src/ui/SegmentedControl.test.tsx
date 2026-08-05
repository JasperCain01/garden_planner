import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl.tsx';

/** The shape of vocabulary this control is for: short, closed, and the engine's own slugs. */
const OPTIONS = [
  { value: 'acid', label: 'Acid' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'alkaline', label: 'Alkaline' },
] as const;

function renderControl(value: string, onChange = vi.fn()) {
  render(
    <SegmentedControl
      legend="Soil pH"
      name="test-ph"
      options={OPTIONS}
      value={value}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe('SegmentedControl', () => {
  it('is a named group of native radios, not a row of buttons', () => {
    renderControl('neutral');

    // The `<fieldset>`/`<legend>` pair is the whole reason this is a component
    // rather than three styled labels: a radio group carries its name there,
    // and without it "Acid / Neutral / Alkaline" says nothing about what it is
    // a choice of. Native radios are also *one* tab stop with arrow keys
    // inside, which is the budget argument in `docs/accessibility.md` §9.
    expect(screen.getByRole('group', { name: 'Soil pH' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('reflects the selected value in the accessibility tree, not only in the styling', () => {
    renderControl('neutral');

    expect(screen.getByRole('radio', { name: 'Neutral' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Acid' })).toHaveProperty('checked', false);
  });

  it("reports the option's own value when one is picked", () => {
    const onChange = renderControl('neutral');

    fireEvent.click(screen.getByLabelText('Alkaline'));

    // The engine's value, not the label — the label is a display concern
    // (`humanise` in `PlotConditionsForm`) and the two differ for hyphenated
    // slugs like `partial-shade`.
    expect(onChange).toHaveBeenCalledWith('alkaline');
  });

  it('keeps two instances on a page from becoming one radio group', () => {
    // `name` collisions across two segmented controls would make picking "Acid"
    // in one silently deselect the other — the failure mode `useId` exists to
    // prevent, and one a single-instance test would never see.
    render(
      <>
        <SegmentedControl
          legend="First"
          name="shared"
          options={OPTIONS}
          value="acid"
          onChange={() => {}}
        />
        <SegmentedControl
          legend="Second"
          name="shared"
          options={OPTIONS}
          value="neutral"
          onChange={() => {}}
        />
      </>,
    );

    const names = new Set(
      screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).name),
    );
    expect(names.size).toBe(2);
  });
});
