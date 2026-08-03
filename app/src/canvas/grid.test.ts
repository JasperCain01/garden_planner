import { describe, expect, it } from 'vitest';
import { rectangleRegion } from '@garden-planner/engine';
import { regionBounds } from './geometry.ts';
import { gridLinesCm, majorGridLinesCm, metresLabel, minorGridLinesCm } from './grid.ts';

const BOUNDS = regionBounds(rectangleRegion(300, 200));

describe('gridLinesCm', () => {
  it('lays lines on absolute multiples of the step, including both edges', () => {
    expect(gridLinesCm(BOUNDS, 100)).toEqual({ xs: [0, 100, 200, 300], ys: [0, 100, 200] });
  });

  it('anchors to the coordinate frame, not to the plot’s own corner', () => {
    // A plot that starts at 30cm: the first line is at 100, not at 30. This is
    // what makes the grid stay put while a dragged corner moves the outline
    // across it, rather than sliding with the shape being edited.
    const offset = regionBounds({
      vertices: [
        { x: 30, y: 30 },
        { x: 330, y: 30 },
        { x: 330, y: 230 },
        { x: 30, y: 230 },
      ],
    });
    expect(gridLinesCm(offset, 100)).toEqual({ xs: [100, 200, 300], ys: [100, 200] });
  });

  it('produces no lines at all for a plot smaller than one step', () => {
    const tiny = regionBounds({
      vertices: [
        { x: 10, y: 10 },
        { x: 40, y: 10 },
        { x: 40, y: 40 },
        { x: 10, y: 40 },
      ],
    });
    expect(gridLinesCm(tiny, 100)).toEqual({ xs: [], ys: [] });
  });
});

describe('minorGridLinesCm / majorGridLinesCm', () => {
  it('draws each line exactly once — the 50cm grid skips wherever the 1m grid already is', () => {
    expect(minorGridLinesCm(BOUNDS)).toEqual({ xs: [50, 150, 250], ys: [50, 150] });
    expect(majorGridLinesCm(BOUNDS)).toEqual({ xs: [0, 100, 200, 300], ys: [0, 100, 200] });
  });
});

describe('metresLabel', () => {
  it('labels a plot dimension the way a gardener quotes it', () => {
    expect(metresLabel(300)).toBe('3.0 m');
    expect(metresLabel(245)).toBe('2.5 m');
  });
});
