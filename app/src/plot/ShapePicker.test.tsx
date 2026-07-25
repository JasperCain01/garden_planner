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
});
