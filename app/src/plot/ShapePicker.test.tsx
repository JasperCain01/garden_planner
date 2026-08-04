import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  regionAreaSquareMetres,
  validatePlotRegion,
  type PlotRegion,
} from '@garden-planner/engine';
import { ShapePicker } from './ShapePicker.tsx';

describe('ShapePicker', () => {
  it('builds a rectangle region from its metre dimensions, converted to centimetres', () => {
    const handleApply = vi.fn();
    render(<ShapePicker onApply={handleApply} />);

    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /use this shape/i }));

    expect(handleApply).toHaveBeenCalledTimes(1);
    const region = handleApply.mock.calls[0][0] as PlotRegion;
    expect(() => validatePlotRegion(region)).not.toThrow();
    expect(regionAreaSquareMetres(region)).toBeCloseTo(8, 5);
  });

  it('switches to the L-shape preset and builds a valid, strictly non-rectangular region', () => {
    const handleApply = vi.fn();
    render(<ShapePicker onApply={handleApply} />);

    fireEvent.click(screen.getByLabelText(/l-shape/i));
    fireEvent.click(screen.getByRole('button', { name: /use this shape/i }));

    expect(handleApply).toHaveBeenCalledTimes(1);
    const region = handleApply.mock.calls[0][0] as PlotRegion;
    expect(() => validatePlotRegion(region)).not.toThrow();
    expect(region.vertices).toHaveLength(6);
  });

  it('switches to the circle preset and builds a valid region from its diameter', () => {
    const handleApply = vi.fn();
    render(<ShapePicker onApply={handleApply} />);

    fireEvent.click(screen.getByLabelText(/circle/i));
    fireEvent.click(screen.getByRole('button', { name: /use this shape/i }));

    expect(handleApply).toHaveBeenCalledTimes(1);
    const region = handleApply.mock.calls[0][0] as PlotRegion;
    expect(() => validatePlotRegion(region)).not.toThrow();
  });

  it('shows an inline message rather than throwing when a dimension is nonsensical', () => {
    const handleApply = vi.fn();
    render(<ShapePicker onApply={handleApply} />);

    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /use this shape/i }));

    expect(handleApply).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('shows an inline message when an L-shape notch is not smaller than the plot', () => {
    const handleApply = vi.fn();
    render(<ShapePicker onApply={handleApply} />);

    fireEvent.click(screen.getByLabelText(/l-shape/i));
    fireEvent.change(screen.getByLabelText(/notch width/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /use this shape/i }));

    expect(handleApply).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  // ------------------------------------------- UI redesign Phase 4 additions

  it('names the presets as one radio group, so they are one tab stop with arrow keys inside', () => {
    render(<ShapePicker onApply={vi.fn()} />);

    // The `<legend>` is visually hidden but the group still has to be named —
    // "Rectangle / L-shape / Circle" does not say what it is a choice of. See
    // the component doc for why this is the one legend that is hidden.
    const presets = screen.getAllByRole('radio', { name: /rectangle|l-shape|circle/i });
    expect(presets).toHaveLength(3);
    for (const preset of presets) {
      expect(preset.getAttribute('name')).toBe('plot-preset');
    }
  });

  it("draws each tile from the picker's own dimensions, and redraws when they change", () => {
    const { container } = render(<ShapePicker onApply={vi.fn()} />);

    // The default 3 x 2m rectangle, at its own aspect — the review's "drawn
    // with the actual aspect from current dimensions".
    const rectangleTile = () => container.querySelector('svg')?.getAttribute('viewBox');
    expect(rectangleTile()).toBe('0 0 300 200');

    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '8' } });
    expect(rectangleTile()).toBe('0 0 800 200');
  });

  it('falls back to an outline-free tile while a dimension is mid-edit, rather than throwing', () => {
    const { container } = render(<ShapePicker onApply={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '0' } });

    // Two glyphs left (L-shape and circle, whose dimensions are untouched), so
    // the rectangle's is the one that went — and the row kept its three tiles.
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('keeps the unit in the accessible name while showing it inside the field', () => {
    render(<ShapePicker onApply={vi.fn()} />);

    // Visible text is "Width"; the accessible name is "Width (m)". WCAG 2.5.3
    // wants the first contained in the second, and every existing spec and the
    // keyboard walkthrough select on the second.
    const width = screen.getByLabelText(/^width \(m\)$/i);
    expect(width.getAttribute('id')).toBe('plot-rect-width');
  });
});
